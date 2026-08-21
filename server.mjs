import { createServer } from "node:http";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual, verify } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join, resolve, sep } from "node:path";

const scrypt = promisify(scryptCallback);
const APP_VERSION = "1.1.1";
const SCHEMA_VERSION = "2.1.0";
const BACKUP_FORMAT_VERSION = "2.1.0";
const PORT = Number(process.env.PORT || 3080);
const HOST = process.env.APS_HOST || "127.0.0.1";
const DATA_DIR = resolve(process.env.APS_DATA_DIR || "./data");
const LICENSE_DIR = resolve(process.env.APS_LICENSE_DIR || "./license");
const BACKUP_DIR = resolve(process.env.APS_BACKUP_DIR || "./backups");
const SEED_FILE = resolve(process.env.APS_SEED_FILE || "./seed/state.json");
const DEFAULT_PUBLIC_KEY_FILE = resolve(process.env.APS_DEFAULT_PUBLIC_KEY_FILE || "./seed/public-key.pem");
const CLIENT_DIR = resolve(process.env.APS_CLIENT_DIR || "./dist/client");
const STATE_FILE = join(DATA_DIR, "state.json");
const ADMIN_FILE = join(DATA_DIR, "admin.json");
const DOCUMENTS_DIR = join(DATA_DIR, "documents");
const LICENSE_FILE = join(LICENSE_DIR, "license.json");
const PUBLIC_KEY_FILE = join(LICENSE_DIR, "public-key.pem");
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LICENSE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const LEGACY_BUNDLED_LICENSE_ID = "APS-2026-V1-LOCAL";

const COMMUNITY_MODULES = Object.freeze(["core", "discover", "map"]);
const PROFESSIONAL_MODULES = Object.freeze(["audit", "ai_finder", "optimize", "sop", "roadmap"]);
const ALLOWED_MODULES = new Set([...COMMUNITY_MODULES, ...PROFESSIONAL_MODULES]);
const COLLECTION_MODULE = Object.freeze({
  analyses: "audit",
  opportunities: "ai_finder",
  targetProcesses: "optimize",
  sops: "sop",
  roadmapItems: "roadmap",
});

const sessions = new Map();
const loginAttempts = new Map();
const COLLECTIONS = [
  "organizations", "projects", "processes", "analyses", "opportunities",
  "targetProcesses", "sops", "roadmapItems", "documents", "prompts", "events",
];
const CONTENT_TYPES = {
  ".avif": "image/avif", ".css": "text/css; charset=utf-8", ".gif": "image/gif",
  ".html": "text/html; charset=utf-8", ".ico": "image/x-icon", ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp",
  ".woff": "font/woff", ".woff2": "font/woff2", ".xml": "application/xml; charset=utf-8",
};
const DOCUMENT_TYPES = new Map([
  ["text/plain", ".txt"], ["text/markdown", ".md"], ["application/pdf", ".pdf"],
]);

const uiModule = await import("./dist/server/index.js");
const uiExport = uiModule.default;
const uiFetch = typeof uiExport === "function" ? uiExport : uiExport?.fetch?.bind(uiExport);
if (typeof uiFetch !== "function") throw new Error("Le build UI APS ne fournit pas de handler fetch valide.");

await Promise.all([
  mkdir(DATA_DIR, { recursive: true }), mkdir(LICENSE_DIR, { recursive: true }),
  mkdir(BACKUP_DIR, { recursive: true }), mkdir(DOCUMENTS_DIR, { recursive: true }),
]);

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}

function securityHeaders(headers = new Headers()) {
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("content-security-policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  return headers;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

async function atomicWrite(path, content) {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path);
}

function ensureLocalWrite(request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (new URL(origin).host !== request.headers.get("host")) throw new Error("Origine de la requête refusée.");
}

async function parseBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) throw new Error("Le document dépasse 16 Mo.");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new Error("Le document dépasse 16 Mo.");
  return text ? JSON.parse(text) : {};
}

function defaultScoringWeights() {
  return { timeGain: 2, frequency: 2, businessImpact: 3, ease: 2, risk: -2, confidentiality: -1 };
}

function defaultPrompts() {
  const names = [
    ["process-discovery", "Découverte de processus", "discover"],
    ["process-analysis", "Audit de processus", "audit"],
    ["ai-opportunity-analysis", "Opportunités IA", "ai_finder"],
    ["process-optimization", "Processus cible", "optimize"],
    ["sop-generation", "Procédure opérationnelle", "sop"],
    ["executive-summary", "Synthèse exécutive", "core"],
    ["action-plan", "Plan d’action", "roadmap"],
  ];
  return names.map(([id, name, module]) => ({ id, name, module, language: "fr", version: "1.0.0", active: true, custom: false, updatedAt: now() }));
}

function validateState(value) {
  if (!value || typeof value !== "object") return "Le document racine doit être un objet.";
  if (value.schemaVersion !== SCHEMA_VERSION) return `Le schéma ${value.schemaVersion || "absent"} n’est pas pris en charge.`;
  for (const collection of COLLECTIONS) {
    if (!Array.isArray(value[collection])) return `La collection ${collection} est absente.`;
    if (value[collection].length > 10_000) return `La collection ${collection} dépasse la limite autorisée.`;
  }
  if (!value.settings || typeof value.settings !== "object") return "Les paramètres sont absents.";
  for (const retired of ["n8nWebhookUrl", "notionWebhookUrl", "n8nEnabled", "notionEnabled"]) {
    if (retired in value.settings) return `Le paramètre obsolète ${retired} doit être supprimé.`;
  }
  const ids = new Set();
  for (const collection of COLLECTIONS) {
    for (const item of value[collection]) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(item.id)) return `Un élément de ${collection} n’a pas d’identifiant valide.`;
      if (ids.has(item.id)) return `L’identifiant ${item.id} est dupliqué.`;
      ids.add(item.id);
    }
  }
  for (const processItem of value.processes) {
    if (!processItem.name || !Array.isArray(processItem.steps)) return `Le processus ${processItem.id} est incomplet.`;
    if (processItem.steps.length > 1_000) return `Le processus ${processItem.id} contient trop d’étapes.`;
    for (const [index, step] of processItem.steps.entries()) {
      if (!step?.id || !step?.name || step.order !== index + 1) return `Les étapes du processus ${processItem.id} sont invalides.`;
    }
  }
  return null;
}

function migrateState(source) {
  const value = structuredClone(source || {});
  const sourceVersion = value.schemaVersion || "absent";
  const migrated = sourceVersion !== SCHEMA_VERSION;
  value.schemaVersion = SCHEMA_VERSION;
  for (const collection of COLLECTIONS) if (!Array.isArray(value[collection])) value[collection] = [];
  if (!value.prompts.length) value.prompts = defaultPrompts();
  value.prompts = value.prompts.filter((prompt) => !["automation", "notion_bridge"].includes(prompt?.module));
  value.opportunities = value.opportunities.map((opportunity) => opportunity?.category === "Automatiser avec n8n" ? { ...opportunity, category: "Automatiser" } : opportunity);
  const previousSettings = value.settings && typeof value.settings === "object" ? value.settings : {};
  const {
    n8nWebhookUrl: _retiredN8nUrl,
    notionWebhookUrl: _retiredNotionUrl,
    n8nEnabled: _retiredN8nEnabled,
    notionEnabled: _retiredNotionEnabled,
    ...retainedSettings
  } = previousSettings;
  value.settings = {
    companyName: "",
    locale: "fr",
    aiMode: "manual",
    ...retainedSettings,
    scoringWeights: { ...defaultScoringWeights(), ...(previousSettings.scoringWeights || {}) },
  };
  if (migrated) value.events.push({ id: uid("evt"), type: "system.migrated", at: now(), message: `Migration du schéma ${sourceVersion} vers ${SCHEMA_VERSION}` });
  return value;
}

async function writeState(value) {
  const error = validateState(value);
  if (error) throw new Error(error);
  await atomicWrite(STATE_FILE, `${JSON.stringify(value, null, 2)}\n`);
}

async function readState() {
  const source = JSON.parse(await readFile(existsSync(STATE_FILE) ? STATE_FILE : SEED_FILE, "utf8"));
  const migrated = migrateState(source);
  const error = validateState(migrated);
  if (error) throw new Error(`Stockage local invalide : ${error}`);
  const legacySettingPresent = ["n8nWebhookUrl", "notionWebhookUrl", "n8nEnabled", "notionEnabled"].some((key) => key in (source.settings || {}));
  const legacyOpportunity = (source.opportunities || []).some((item) => item?.category === "Automatiser avec n8n");
  const legacyPrompt = (source.prompts || []).some((item) => ["automation", "notion_bridge"].includes(item?.module));
  const needsWrite = !existsSync(STATE_FILE) || source.schemaVersion !== SCHEMA_VERSION || legacySettingPresent || legacyOpportunity || legacyPrompt || COLLECTIONS.some((collection) => !Array.isArray(source[collection])) || !source.settings;
  if (needsWrite) await writeState(migrated);
  return migrated;
}

async function appendEvent(type, message, metadata = {}) {
  const state = await readState();
  state.events.unshift({ id: uid("evt"), type, at: now(), message, metadata });
  state.events = state.events.slice(0, 1_000);
  await writeState(state);
}

function canonicalLicense(license) {
  return JSON.stringify({ license_id: license.license_id, customer: license.customer, edition: license.edition, modules: license.modules, issued_at: license.issued_at, expires_at: license.expires_at ?? null });
}

function validateLicenseDocument(license) {
  if (!license || typeof license !== "object" || Array.isArray(license)) return "La licence doit être un objet JSON.";
  const required = ["license_id", "customer", "edition", "modules", "issued_at", "signature"];
  if (required.some((key) => !(key in license))) return "Champs obligatoires manquants.";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(String(license.license_id || ""))) return "Identifiant de licence invalide.";
  if (typeof license.customer !== "string" || !license.customer.trim() || license.customer.length > 200) return "Client de licence invalide.";
  if (license.edition !== "Professional") return "Seule l’édition Professional peut être activée par licence signée.";
  if (!Array.isArray(license.modules) || !license.modules.length) return "La licence Professional doit contenir au moins un module.";
  if (new Set(license.modules).size !== license.modules.length) return "La licence contient des modules dupliqués.";
  if (license.modules.some((module) => !PROFESSIONAL_MODULES.includes(module))) return "La licence contient un module Professional inconnu.";
  const issuedAt = Date.parse(license.issued_at);
  if (!Number.isFinite(issuedAt) || issuedAt > Date.now() + LICENSE_CLOCK_SKEW_MS) return "Date d’émission de licence invalide.";
  if (license.expires_at !== null && license.expires_at !== undefined) {
    const expiresAt = Date.parse(license.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= issuedAt) return "Date d’expiration de licence invalide.";
  }
  if (typeof license.signature !== "string" || license.signature.length < 40 || license.signature.length > 256) return "Signature de licence invalide.";
  return null;
}

function communityEntitlement(reason = null) {
  return {
    valid: true,
    licenseId: "COMMUNITY",
    customer: "Installation locale",
    edition: "Community",
    modules: [...COMMUNITY_MODULES],
    expiresAt: null,
    source: "community",
    ...(reason ? { reason } : {}),
  };
}

async function verifyLicense(candidate) {
  const explicitCandidate = candidate !== undefined;
  try {
    if (!explicitCandidate && !existsSync(LICENSE_FILE)) return communityEntitlement();
    const license = explicitCandidate ? candidate : JSON.parse(await readFile(LICENSE_FILE, "utf8"));
    if (license?.license_id === LEGACY_BUNDLED_LICENSE_ID) throw new Error("La licence publique V1 est obsolète depuis la version 1.1.0.");
    const shapeError = validateLicenseDocument(license);
    if (shapeError) throw new Error(shapeError);
    const publicKey = await readFile(PUBLIC_KEY_FILE, "utf8");
    if (!verify(null, Buffer.from(canonicalLicense(license)), publicKey, Buffer.from(license.signature, "base64"))) throw new Error("Signature Ed25519 invalide.");
    if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) throw new Error("Licence expirée.");
    const modules = [...new Set([...COMMUNITY_MODULES, ...license.modules])];
    return { valid: true, licenseId: license.license_id, customer: license.customer, edition: "Professional", modules, expiresAt: license.expires_at ?? null, source: "license", raw: license };
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Licence invalide.";
    if (explicitCandidate) return { ...communityEntitlement(), valid: false, licenseId: "LICENCE_INVALIDE", source: "rejected", reason: message };
    return communityEntitlement(message);
  }
}

async function ensurePublicKeyFile() {
  if (!existsSync(PUBLIC_KEY_FILE)) await atomicWrite(PUBLIC_KEY_FILE, await readFile(DEFAULT_PUBLIC_KEY_FILE));
}
await ensurePublicKeyFile();

async function requireModule(module) {
  if (!ALLOWED_MODULES.has(module)) return jsonResponse({ error: `Module inconnu : ${module}.` }, 404);
  const entitlement = await verifyLicense();
  if (!entitlement.modules.includes(module)) return jsonResponse({ error: `Le module ${module} nécessite AI Process Studio Professional.`, code: "PROFESSIONAL_REQUIRED", module }, 403);
  return null;
}

function stateForEntitlement(state, entitlement) {
  const visible = structuredClone(state);
  for (const [collection, module] of Object.entries(COLLECTION_MODULE)) {
    if (!entitlement.modules.includes(module)) visible[collection] = [];
  }
  visible.prompts = visible.prompts.filter((prompt) => !prompt?.module || entitlement.modules.includes(prompt.module));
  return visible;
}

async function reconcileStateModuleWrites(current, next) {
  const entitlement = await verifyLicense();
  const value = structuredClone(next);
  for (const [collection, module] of Object.entries(COLLECTION_MODULE)) {
    if (entitlement.modules.includes(module)) continue;
    const requested = Array.isArray(value[collection]) ? value[collection] : [];
    const stored = current[collection];
    if (requested.length > 0 && JSON.stringify(requested) !== JSON.stringify(stored)) {
      return { denied: jsonResponse({ error: `La modification de ${collection} nécessite AI Process Studio Professional.`, code: "PROFESSIONAL_REQUIRED", module }, 403), value: null };
    }
    value[collection] = stored;
  }

  const protectedPromptModules = new Set(PROFESSIONAL_MODULES.filter((module) => !entitlement.modules.includes(module)));
  const requestedProtectedPrompts = value.prompts.filter((prompt) => protectedPromptModules.has(prompt?.module));
  const storedProtectedPrompts = current.prompts.filter((prompt) => protectedPromptModules.has(prompt?.module));
  if (requestedProtectedPrompts.length > 0 && JSON.stringify(requestedProtectedPrompts) !== JSON.stringify(storedProtectedPrompts)) {
    return { denied: jsonResponse({ error: "La modification des prompts Professional nécessite les modules correspondants.", code: "PROFESSIONAL_REQUIRED", module: "prompts" }, 403), value: null };
  }
  value.prompts = [
    ...value.prompts.filter((prompt) => !protectedPromptModules.has(prompt?.module)),
    ...storedProtectedPrompts,
  ];
  return { denied: null, value };
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get("cookie") || "").split(";").map((part) => part.trim().split("=")).filter(([key]) => key));
}

async function authStatus(request) {
  const configured = existsSync(ADMIN_FILE);
  const token = parseCookies(request).aps_session;
  const session = token && sessions.get(token);
  if (session && session.expiresAt > Date.now()) return { configured, authenticated: true, user: { name: session.name }, csrfToken: session.csrfToken };
  if (token) sessions.delete(token);
  return { configured, authenticated: false };
}

async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const key = await scrypt(password, salt, 64);
  return { salt, hash: Buffer.from(key).toString("hex") };
}

async function checkPassword(password, admin) {
  const candidate = await scrypt(password, admin.salt, 64);
  return timingSafeEqual(Buffer.from(admin.hash, "hex"), Buffer.from(candidate));
}

function createSession(name) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  sessions.set(token, { name, csrfToken, expiresAt: Date.now() + SESSION_TTL_MS });
  return { token, csrfToken };
}

function sessionCookie(token, maxAge = Math.floor(SESSION_TTL_MS / 1000)) {
  return `aps_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

async function requireAuth(request) {
  const status = await authStatus(request);
  if (!status.configured) return jsonResponse({ error: "Configuration administrateur requise.", code: "SETUP_REQUIRED" }, 401);
  if (!status.authenticated) return jsonResponse({ error: "Authentification requise.", code: "AUTH_REQUIRED" }, 401);
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("x-aps-csrf") !== status.csrfToken) return jsonResponse({ error: "Jeton CSRF invalide." }, 403);
  return null;
}

async function handleAuth(request, url) {
  if (request.method === "GET" && url.pathname === "/api/auth/status") return jsonResponse(await authStatus(request));
  if (request.method === "POST" && url.pathname === "/api/auth/setup") {
    ensureLocalWrite(request);
    if (existsSync(ADMIN_FILE)) return jsonResponse({ error: "Le compte administrateur existe déjà." }, 409);
    const { name = "Administrateur", password } = await parseBody(request);
    if (typeof password !== "string" || password.length < 10) return jsonResponse({ error: "Le mot de passe doit contenir au moins 10 caractères." }, 422);
    const credentials = await hashPassword(password);
    await atomicWrite(ADMIN_FILE, `${JSON.stringify({ name: String(name).slice(0, 120), ...credentials, createdAt: now() }, null, 2)}\n`);
    const session = createSession(String(name).slice(0, 120));
    await appendEvent("auth.setup", "Compte administrateur initialisé");
    return jsonResponse({ authenticated: true, user: { name }, csrfToken: session.csrfToken }, 201, { "set-cookie": sessionCookie(session.token) });
  }
  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    ensureLocalWrite(request);
    const key = request.headers.get("x-forwarded-for") || "local";
    const attempt = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
    if (attempt.blockedUntil > Date.now()) return jsonResponse({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, 429);
    if (!existsSync(ADMIN_FILE)) return jsonResponse({ error: "Configuration administrateur requise." }, 409);
    const { password } = await parseBody(request);
    const admin = JSON.parse(await readFile(ADMIN_FILE, "utf8"));
    if (typeof password !== "string" || !(await checkPassword(password, admin))) {
      attempt.count += 1;
      if (attempt.count >= 5) { attempt.blockedUntil = Date.now() + 5 * 60 * 1000; attempt.count = 0; }
      loginAttempts.set(key, attempt);
      return jsonResponse({ error: "Mot de passe incorrect." }, 401);
    }
    loginAttempts.delete(key);
    const session = createSession(admin.name);
    await appendEvent("auth.login", "Connexion administrateur");
    return jsonResponse({ authenticated: true, user: { name: admin.name }, csrfToken: session.csrfToken }, 200, { "set-cookie": sessionCookie(session.token) });
  }
  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = parseCookies(request).aps_session;
    if (token) sessions.delete(token);
    return jsonResponse({ authenticated: false }, 200, { "set-cookie": sessionCookie("", 0) });
  }
  return null;
}

function sanitizeFilename(name) {
  return basename(String(name || "document")).replace(/[^a-zA-Z0-9À-ÿ._ -]/g, "_").slice(0, 180);
}

async function handleDocuments(request, url) {
  const state = await readState();
  if (request.method === "POST" && url.pathname === "/api/documents") {
    ensureLocalWrite(request);
    const input = await parseBody(request);
    const extension = DOCUMENT_TYPES.get(input.mimeType);
    if (!extension || !String(input.name || "").toLowerCase().endsWith(extension)) return jsonResponse({ error: "Format accepté : TXT, Markdown ou PDF." }, 422);
    const bytes = Buffer.from(String(input.base64 || ""), "base64");
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) return jsonResponse({ error: "Le document doit contenir entre 1 octet et 10 Mo." }, 422);
    const id = uid("doc");
    const filename = sanitizeFilename(input.name);
    const folder = join(DOCUMENTS_DIR, id);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, filename), bytes, { mode: 0o600 });
    const document = { id, projectId: input.projectId, processId: input.processId || null, name: filename, mimeType: input.mimeType, size: bytes.length, checksum: createHash("sha256").update(bytes).digest("hex"), createdAt: now() };
    state.documents.push(document);
    state.events.unshift({ id: uid("evt"), type: "document.created", at: now(), message: `Document ajouté : ${filename}`, metadata: { documentId: id } });
    await writeState(state);
    return jsonResponse(document, 201);
  }
  const match = url.pathname.match(/^\/api\/documents\/([^/]+)(?:\/content)?$/);
  if (!match) return null;
  const document = state.documents.find((item) => item.id === decodeURIComponent(match[1]));
  if (!document) return jsonResponse({ error: "Document introuvable." }, 404);
  const path = join(DOCUMENTS_DIR, document.id, sanitizeFilename(document.name));
  if (request.method === "GET" && url.pathname.endsWith("/content")) return new Response(await readFile(path), { headers: { "content-type": document.mimeType, "content-disposition": `attachment; filename="${sanitizeFilename(document.name)}"` } });
  if (request.method === "DELETE") {
    ensureLocalWrite(request);
    await unlink(path).catch(() => {});
    state.documents = state.documents.filter((item) => item.id !== document.id);
    state.events.unshift({ id: uid("evt"), type: "document.deleted", at: now(), message: `Document supprimé : ${document.name}`, metadata: { documentId: document.id } });
    await writeState(state);
    return jsonResponse({ deleted: true });
  }
  return null;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, "/"));
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26); name.copy(local, 30);
    locals.push(local, data);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); name.copy(central, 46);
    centrals.push(central); offset += local.length + data.length;
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

async function projectExport(projectId, entitlement) {
  const state = await readState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return null;
  const organization = state.organizations.find((item) => item.id === project.organizationId);
  const processes = state.processes.filter((item) => item.projectId === projectId);
  const processIds = new Set(processes.map((item) => item.id));
  const subset = (collection, predicate) => state[collection].filter(predicate);
  const enabled = (module) => entitlement.modules.includes(module);
  const entries = [
    { name: "manifest.json", data: JSON.stringify({ format: "aps-project", version: APP_VERSION, exportedAt: now(), projectId, edition: entitlement.edition, modules: entitlement.modules }, null, 2) },
    { name: "organization.json", data: JSON.stringify(organization ?? null, null, 2) },
    { name: "project.json", data: JSON.stringify(project, null, 2) },
    ...processes.map((item) => ({ name: `processes/${item.id}.json`, data: JSON.stringify(item, null, 2) })),
    ...(enabled("audit") ? subset("analyses", (item) => processIds.has(item.processId)).map((item) => ({ name: `analyses/${item.id}.json`, data: JSON.stringify(item, null, 2) })) : []),
    ...(enabled("ai_finder") ? subset("opportunities", (item) => processIds.has(item.processId)).map((item) => ({ name: `opportunities/${item.id}.json`, data: JSON.stringify(item, null, 2) })) : []),
    ...(enabled("optimize") ? subset("targetProcesses", (item) => processIds.has(item.sourceProcessId)).map((item) => ({ name: `target-processes/${item.id}.json`, data: JSON.stringify(item, null, 2) })) : []),
    ...(enabled("sop") ? subset("sops", (item) => processIds.has(item.processId)).map((item) => ({ name: `sops/${item.id}.json`, data: JSON.stringify(item, null, 2) })) : []),
    ...(enabled("roadmap") ? subset("roadmapItems", (item) => item.projectId === projectId).map((item) => ({ name: `roadmap/${item.id}.json`, data: JSON.stringify(item, null, 2) })) : []),
  ];
  for (const document of state.documents.filter((item) => item.projectId === projectId)) {
    const path = join(DOCUMENTS_DIR, document.id, sanitizeFilename(document.name));
    if (existsSync(path)) entries.push({ name: `documents/${document.id}/${sanitizeFilename(document.name)}`, data: await readFile(path) });
  }
  return createZip(entries);
}

async function handleApi(request, url) {
  if (request.method === "GET" && url.pathname === "/api/health") return jsonResponse({ status: "ok", version: APP_VERSION, schema: SCHEMA_VERSION, storage: "json-local", edition: (await verifyLicense()).edition });
  const authResponse = await handleAuth(request, url);
  if (authResponse) return authResponse;
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;

  const documentResponse = await handleDocuments(request, url);
  if (documentResponse) return documentResponse;

  if (request.method === "GET" && url.pathname === "/api/state") {
    const entitlement = await verifyLicense();
    return jsonResponse(stateForEntitlement(await readState(), entitlement));
  }
  if (request.method === "PUT" && url.pathname === "/api/state") {
    ensureLocalWrite(request);
    const current = await readState();
    const requested = migrateState(await parseBody(request));
    const { denied, value } = await reconcileStateModuleWrites(current, requested);
    if (denied) return denied;
    await writeState(value);
    return jsonResponse({ saved: true, updatedAt: now() });
  }

  const entityMatch = url.pathname.match(/^\/api\/entities\/([A-Za-z]+)(?:\/([^/]+))?$/);
  if (entityMatch && COLLECTIONS.includes(entityMatch[1])) {
    const [, collection, encodedId] = entityMatch;
    const requiredModule = COLLECTION_MODULE[collection];
    if (requiredModule) {
      const denied = await requireModule(requiredModule);
      if (denied) return denied;
    }
    const state = await readState();
    if (request.method === "GET") return jsonResponse(encodedId ? state[collection].find((item) => item.id === decodeURIComponent(encodedId)) || null : state[collection]);
    ensureLocalWrite(request);
    if (request.method === "POST") {
      const item = await parseBody(request);
      if (!item.id) item.id = uid(collection.slice(0, 3));
      state[collection].push(item);
      state.events.unshift({ id: uid("evt"), type: `${collection}.created`, at: now(), message: `${collection} créé`, metadata: { id: item.id } });
      await writeState(state);
      return jsonResponse(item, 201);
    }
    const id = decodeURIComponent(encodedId || "");
    const index = state[collection].findIndex((item) => item.id === id);
    if (index < 0) return jsonResponse({ error: "Élément introuvable." }, 404);
    if (request.method === "PUT") state[collection][index] = { ...(await parseBody(request)), id };
    else if (request.method === "DELETE") state[collection].splice(index, 1);
    else return jsonResponse({ error: "Méthode non prise en charge." }, 405);
    state.events.unshift({ id: uid("evt"), type: `${collection}.${request.method === "PUT" ? "updated" : "deleted"}`, at: now(), message: `${collection} modifié`, metadata: { id } });
    await writeState(state);
    return jsonResponse({ saved: true });
  }

  if (request.method === "GET" && url.pathname === "/api/projects") return jsonResponse({ projects: (await readState()).projects });
  if (request.method === "GET" && url.pathname.startsWith("/api/processes/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/processes/".length));
    const item = (await readState()).processes.find((processItem) => processItem.id === id);
    return item ? jsonResponse(item) : jsonResponse({ error: "Processus introuvable." }, 404);
  }

  if (request.method === "POST" && url.pathname === "/api/analyses/import") {
    const denied = await requireModule("audit");
    if (denied) return denied;
    ensureLocalWrite(request);
    const analysis = await parseBody(request);
    if (!analysis.processId || !Array.isArray(analysis.issues)) return jsonResponse({ error: "Analyse incomplète." }, 422);
    const state = await readState();
    analysis.id ||= uid("analysis"); analysis.importedAt ||= now(); analysis.status ||= "À valider";
    state.analyses.push(analysis);
    state.events.unshift({ id: uid("evt"), type: "analysis.imported", at: now(), message: "Analyse IA importée", metadata: { analysisId: analysis.id, processId: analysis.processId } });
    await writeState(state);
    return jsonResponse(analysis, 201);
  }

  if (request.method === "GET" && url.pathname === "/api/modules") {
    const info = { ...(await verifyLicense()) }; delete info.raw; return jsonResponse(info);
  }
  if (request.method === "PUT" && url.pathname === "/api/license") {
    ensureLocalWrite(request);
    const candidate = await parseBody(request);
    const checked = await verifyLicense(candidate);
    if (!checked.valid) return jsonResponse({ error: checked.reason, code: "LICENSE_REJECTED" }, 422);
    await atomicWrite(LICENSE_FILE, `${JSON.stringify(candidate, null, 2)}\n`);
    await appendEvent("license.imported", "Licence Professional importée", { licenseId: checked.licenseId });
    const info = { ...checked }; delete info.raw; return jsonResponse(info);
  }

  if (request.method === "POST" && url.pathname === "/api/backup") {
    ensureLocalWrite(request);
    const stamp = now().replace(/[:.]/g, "-");
    const file = `aps-backup-${stamp}.json`;
    const state = await readState();
    const license = await verifyLicense();
    await atomicWrite(join(BACKUP_DIR, file), `${JSON.stringify({ format: "aps-backup", version: BACKUP_FORMAT_VERSION, createdAt: now(), applicationVersion: APP_VERSION, state, license: license.source === "license" ? license.raw : null }, null, 2)}\n`);
    await appendEvent("backup.created", "Sauvegarde créée", { file });
    return jsonResponse({ created: true, file });
  }
  if (request.method === "POST" && url.pathname === "/api/restore") {
    ensureLocalWrite(request);
    const backup = await parseBody(request);
    if (backup.format !== "aps-backup" || !backup.state) return jsonResponse({ error: "Sauvegarde APS invalide." }, 422);
    const current = await readState();
    const migrated = migrateState(backup.state);
    const error = validateState(migrated);
    if (error) return jsonResponse({ error }, 422);
    const { denied, value } = await reconcileStateModuleWrites(current, migrated);
    if (denied) return denied;
    const safety = `aps-before-restore-${now().replace(/[:.]/g, "-")}.json`;
    await atomicWrite(join(BACKUP_DIR, safety), `${JSON.stringify({ format: "aps-backup", version: BACKUP_FORMAT_VERSION, createdAt: now(), applicationVersion: APP_VERSION, state: current }, null, 2)}\n`);
    await writeState(value);
    await appendEvent("backup.restored", "Sauvegarde restaurée", { safety });
    return jsonResponse({ restored: true, safety });
  }

  const exportMatch = url.pathname.match(/^\/api\/export\/project\/([^/]+)$/);
  if (request.method === "GET" && exportMatch) {
    const projectId = decodeURIComponent(exportMatch[1]);
    const entitlement = await verifyLicense();
    const archive = await projectExport(projectId, entitlement);
    if (!archive) return jsonResponse({ error: "Projet introuvable." }, 404);
    return new Response(archive, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${sanitizeFilename(projectId)}.aps.zip"` } });
  }

  if (request.method === "GET" && url.pathname === "/api/maintenance") {
    const backups = (await readdir(BACKUP_DIR)).filter((file) => file.endsWith(".json")).sort().reverse();
    return jsonResponse({ version: APP_VERSION, schema: SCHEMA_VERSION, edition: (await verifyLicense()).edition, sessions: sessions.size, backups });
  }
  return jsonResponse({ error: "Route API inconnue." }, 404);
}

async function serveStaticAsset(request, url) {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  let relativePath;
  try { relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, ""); }
  catch { return new Response("Chemin invalide.", { status: 400 }); }
  if (!relativePath || relativePath.includes("\0")) return null;
  const filePath = resolve(CLIENT_DIR, relativePath);
  if (!filePath.startsWith(`${CLIENT_DIR}${sep}`)) return new Response("Accès refusé.", { status: 403 });
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return null;
    return new Response(request.method === "HEAD" ? null : await readFile(filePath), { headers: {
      "cache-control": url.pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
      "content-length": String(fileStat.size), "content-type": CONTENT_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
    } });
  } catch (reason) {
    if (reason && typeof reason === "object" && "code" in reason && reason.code === "ENOENT") return null;
    throw reason;
  }
}

async function dispatch(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    try { return await handleApi(request, url); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : "Erreur interne.";
      const clientError = /Mo|Origine|JSON|schéma|invalide|absent|dupliqué|obsolète/.test(message);
      return jsonResponse({ error: message }, clientError ? 400 : 500);
    }
  }
  const staticResponse = await serveStaticAsset(request, url);
  if (staticResponse) return staticResponse;
  if (url.pathname.startsWith("/assets/")) return new Response("Fichier statique introuvable.", { status: 404 });
  return uiFetch(request, {}, { waitUntil() {}, passThroughOnException() {} });
}

const server = createServer(async (incoming, outgoing) => {
  const startedAt = Date.now();
  const method = incoming.method || "GET";
  const path = incoming.url || "/";
  try {
    const request = new Request(`http://${incoming.headers.host || `localhost:${PORT}`}${path}`, {
      method, headers: incoming.headers, body: ["GET", "HEAD"].includes(method) ? undefined : incoming,
      duplex: ["GET", "HEAD"].includes(method) ? undefined : "half",
    });
    const response = await dispatch(request);
    outgoing.statusCode = response.status;
    securityHeaders(response.headers).forEach((value, name) => outgoing.setHeader(name, value));
    if (method === "HEAD" || !response.body) outgoing.end();
    else outgoing.end(Buffer.from(await response.arrayBuffer()));
    console.log(`${now()} ${method} ${new URL(request.url).pathname} ${response.status} ${Date.now() - startedAt}ms`);
  } catch (reason) {
    outgoing.statusCode = 500;
    securityHeaders(new Headers({ "content-type": "application/json; charset=utf-8" })).forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(JSON.stringify({ error: "Erreur interne APS." }));
    console.error(`${now()} ${method} ${path.split("?")[0]} 500 ${reason instanceof Error ? reason.message : "unknown"}`);
  }
});

server.listen(PORT, HOST, () => console.log(`AI Process Studio ${APP_VERSION} écoute sur http://${HOST}:${PORT}`));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
