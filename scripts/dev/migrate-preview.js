#!/usr/bin/env node
// Maintainer helper: preview the v1 → v2 migration (ADR-0050) of a downstream checkout without
// touching it — the same migrateV1 call gearbox-update makes, against the fences of the Gearbox
// checkout this script lives in. Writes AGENTS.md, CONTEXT.md, INDEX.md (when the index would
// move) and report.json into <out-dir>.
// Usage: node scripts/dev/migrate-preview.js <downstream-dir> <out-dir>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findFence } from "../lib/fence.js";
import { loadKnown } from "../lib/v1-known.js";
import { migrateV1, MigrationError } from "../lib/migrate-v1.js";

const [down, out] = process.argv.slice(2).map((p) => p && resolve(p));
if (!down || !out) {
  console.error("usage: node scripts/dev/migrate-preview.js <downstream-dir> <out-dir>");
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (dir, f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const protocol = findFence(read(root, "AGENTS.md"), "protocol");
const glossary = findFence(read(root, "CONTEXT.md"), "glossary");
if (!protocol || !glossary) fail(`${root} has no gearbox fences — run this from a Gearbox v2 checkout`);
if (findFence(read(down, "AGENTS.md"), "protocol")) fail(`${down}/AGENTS.md already has a gearbox:protocol fence — nothing to migrate`);

let m;
try {
  m = migrateV1({
    agentsMd: read(down, "AGENTS.md"),
    contextMd: read(down, "CONTEXT.md"),
    known: loadKnown(),
    protocolBlock: protocol.block,
    glossaryBlock: glossary.block,
  });
} catch (e) {
  if (!(e instanceof MigrationError)) throw e;
  fail(`migration refused: ${e.message}`);
}
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "AGENTS.md"), m.agentsMd);
writeFileSync(join(out, "CONTEXT.md"), m.contextMd);
if (m.indexMd) writeFileSync(join(out, "INDEX.md"), m.indexMd);
writeFileSync(join(out, "report.json"), JSON.stringify(m.report, null, 2) + "\n");
const r = m.report;
console.log(
  `AGENTS.md ${Buffer.byteLength(m.agentsMd)} B · maintainer ${r.maintainer || "?"} · carried ${r.carried.length} · moved ${r.moved.length} · flagged ${r.flagged.length} · collisions ${r.context.collisions.length} · index ${r.indexMoved ? "moved" : "kept"}${r.oversize ? ` · OVERSIZE ${r.oversize} B` : ""}`,
);
