import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const temp = await mkdtemp(join(tmpdir(), "aps-open-core-"));
const dataDir = join(temp, "data");
const licenseDir = join(temp, "license");
const backupDir = join(temp, "backups");
const seedPath = join(temp, "state.json");
const port = 39080 + (process.pid % 500);
const baseUrl = `http://127.0.0.1:${port}`;

const state = JSON.parse(await readFile(join(root, "seed", "state.json"), "utf8"));
state.organizations.push({ id: "org-test", name: "Test Org" });
state.projects.push({ id: "project-test", organizationId: "org-test", name: "Test Project" });
state.processes.push({
  id: "process-test",
  projectId: "project-test",
  name: "Test Process",
  status: "Brouillon",
  version: 1,
  steps: [],
});
state.analyses.push({ id: "analysis-seeded", processId: "process-test", issues: [] });
state.prompts.push({ id: "prompt-core-test", name: "Synthèse", module: "core", language: "fr", version: "1.0.0", active: true, custom: false });
state.prompts.push({ id: "prompt-audit-test", name: "Audit", module: "audit", language: "fr", version: "1.0.0", active: true, custom: false });
await writeFile(seedPath, `${JSON.stringify(state, null, 2)}\n`);

const child = spawn(process.execPath, ["server.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    APS_HOST: "127.0.0.1",
    APS_DATA_DIR: dataDir,
    APS_LICENSE_DIR: licenseDir,
    APS_BACKUP_DIR: backupDir,
    APS_SEED_FILE: seedPath,
    APS_DEFAULT_PUBLIC_KEY_FILE: join(root, "seed", "public-key.pem"),
    APS_CLIENT_DIR: join(root, "dist", "client"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
child.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
child.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Server did not start.\n${serverLog}`);
}

let cookie = "";
let csrfToken = "";

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set("cookie", cookie);
  if (csrfToken && !["GET", "HEAD"].includes(options.method || "GET")) headers.set("x-aps-csrf", csrfToken);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (!headers.has("origin") && !["GET", "HEAD"].includes(options.method || "GET")) headers.set("origin", baseUrl);
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

try {
  await waitForServer();

  const setupResponse = await api("/api/auth/setup", {
    method: "POST",
    body: JSON.stringify({ name: "CI", password: "VeryStrongPassword123!" }),
  });
  assert(setupResponse.status === 201, `Setup failed: ${setupResponse.status}`);
  cookie = (setupResponse.headers.get("set-cookie") || "").split(";")[0];
  const setup = await setupResponse.json();
  csrfToken = setup.csrfToken;
  assert(cookie.startsWith("aps_session="), "Session cookie missing");
  assert(Boolean(csrfToken), "CSRF token missing");

  const modules = await (await api("/api/modules")).json();
  assert(modules.edition === "Community", "Expected Community edition");
  assert(JSON.stringify(modules.modules) === JSON.stringify(["core", "discover", "map"]), "Unexpected Community modules");

  const visibleStateResponse = await api("/api/state");
  assert(visibleStateResponse.status === 200, "State read failed");
  const visibleState = await visibleStateResponse.json();
  assert(visibleState.analyses.length === 0, "Professional analyses leaked through /api/state");
  assert(visibleState.prompts.some((prompt) => prompt.module === "core"), "Community prompt missing through /api/state");
  assert(!visibleState.prompts.some((prompt) => prompt.module === "audit"), "Professional prompt leaked through /api/state");

  visibleState.settings.companyName = "Community change";
  const stateSave = await api("/api/state", { method: "PUT", body: JSON.stringify(visibleState) });
  assert(stateSave.status === 200, `Community state save should preserve hidden Professional data: ${stateSave.status}`);

  const entityRead = await api("/api/entities/analyses");
  assert(entityRead.status === 403, `Professional entity read should be blocked: ${entityRead.status}`);

  const entityWrite = await api("/api/entities/analyses", {
    method: "POST",
    body: JSON.stringify({ id: "analysis-injected", processId: "process-test", issues: [] }),
  });
  assert(entityWrite.status === 403, `Professional entity write should be blocked: ${entityWrite.status}`);

  const craftedRestore = structuredClone(state);
  craftedRestore.analyses.push({ id: "analysis-injected", processId: "process-test", issues: [] });
  const restoreResponse = await api("/api/restore", {
    method: "POST",
    body: JSON.stringify({ format: "aps-backup", version: "2.1.0", state: craftedRestore }),
  });
  assert(restoreResponse.status === 403, `Community restore must reject Professional injection: ${restoreResponse.status}`);

  const backupResponse = await api("/api/backup", { method: "POST", body: "{}" });
  assert(backupResponse.status === 200, `Backup failed: ${backupResponse.status}`);
  const backupFiles = (await readdir(backupDir)).filter((name) => name.startsWith("aps-backup-") && name.endsWith(".json"));
  assert(backupFiles.length === 1, "Expected one backup file");
  const backup = JSON.parse(await readFile(join(backupDir, backupFiles[0]), "utf8"));
  assert(backup.state.analyses.some((item) => item.id === "analysis-seeded"), "Raw backup must preserve user-owned Professional data");
  assert(backup.state.prompts.some((item) => item.id === "prompt-audit-test"), "Raw backup must preserve Professional prompts");

  const exportResponse = await api("/api/export/project/project-test");
  assert(exportResponse.status === 200, `Project export failed: ${exportResponse.status}`);
  const exportText = Buffer.from(await exportResponse.arrayBuffer()).toString("latin1");
  assert(exportText.includes("project.json"), "Community project export missing project data");
  assert(!exportText.includes("analyses/analysis-seeded.json"), "Community project export leaked Professional analyses");

  const rejectedLicense = await api("/api/license", {
    method: "PUT",
    body: JSON.stringify({
      license_id: "APS-TEST-INVALID",
      customer: "CI",
      edition: "Professional",
      modules: ["unknown_module"],
      issued_at: new Date().toISOString(),
      expires_at: null,
      signature: "A".repeat(88),
    }),
  });
  assert(rejectedLicense.status === 422, `Unknown Professional module must be rejected: ${rejectedLicense.status}`);
  const rejectedBody = await rejectedLicense.json();
  assert(rejectedBody.code === "LICENSE_REJECTED", "Expected LICENSE_REJECTED code");

  console.log("Open-core policy integration test passed.");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, 2000);
    child.once("exit", () => { clearTimeout(timer); resolvePromise(); });
  });
  await rm(temp, { recursive: true, force: true });
}
