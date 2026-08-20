import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const roots = ["app", "prompts"];
const forbidden = [
  /\bai_finder\b/i,
  /\boptimize\b/i,
  /\broadmap\b/i,
  /\bProfessionalGate\b/,
  /\bAuditView\b/,
  /\bOpportunitiesView\b/,
  /\bOptimizeView\b/,
  /\bSopView\b/,
  /\bRoadmapView\b/,
  /process-analysis/i,
  /ai-opportunity-analysis/i,
  /process-optimization/i,
  /sop-generation/i,
  /action-plan/i,
];

async function filesUnder(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (/\.(?:ts|tsx|js|mjs|json|md)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const violations = [];
for (const root of roots) {
  for (const file of await filesUnder(root)) {
    const content = await readFile(file, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(content)) violations.push(`${file}: ${pattern}`);
    }
  }
}

if (violations.length) {
  console.error("Professional implementation markers found in Community source:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Community source boundary clean.");
