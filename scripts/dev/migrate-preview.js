#!/usr/bin/env node
// Maintainer helper: preview the v1 → v2 migration (ADR-0050) of a downstream checkout without
// touching it — the same migrateV1 call gearbox-update makes, against the fences of the Gearbox
// checkout this script lives in. Writes AGENTS.md, CONTEXT.md, INDEX.md (when the index would
// move) and report.json into <out-dir>, and nothing anywhere else: an out-dir that is the
// downstream or this checkout is refused, as is any input update itself would refuse to migrate.
// Usage: node scripts/dev/migrate-preview.js <downstream-dir> <out-dir>
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findFence, FenceError } from "../lib/fence.js";
import { loadKnown } from "../lib/v1-known.js";
import { migrateV1, MigrationError } from "../lib/migrate-v1.js";

function fail(msg) {
  console.error(`migrate-preview: ${msg}`);
  process.exit(1);
}

const [down, out] = process.argv.slice(2).map((p) => p && resolve(p));
if (!down || !out) fail("usage: node scripts/dev/migrate-preview.js <downstream-dir> <out-dir>");
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
if (!existsSync(down) || !statSync(down).isDirectory()) fail(`no downstream directory at ${down}`);
if (existsSync(out)) {
  const same = (dir) => realpathSync(out) === realpathSync(dir);
  if (same(down)) fail(`out-dir is the downstream dir (${down}) — the preview would overwrite the files it reads; pick another out-dir`);
  if (same(root)) fail(`out-dir is the Gearbox checkout (${root}) — the preview would overwrite its fenced AGENTS.md / CONTEXT.md; pick another out-dir`);
}

const read = (dir, f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
// A malformed marker is a FenceError: named with its file, never a stack trace.
function fenceIn(dir, file, name) {
  try {
    return findFence(read(dir, file), name);
  } catch (e) {
    if (!(e instanceof FenceError)) throw e;
    return fail(`${join(dir, file)}: ${e.message}`);
  }
}

const protocol = fenceIn(root, "AGENTS.md", "protocol");
const glossary = fenceIn(root, "CONTEXT.md", "glossary");
if (!protocol || !glossary) fail(`${root} has no gearbox fences — run this from a Gearbox v2 checkout`);
// The same inputs gearbox-update refuses to migrate (scripts/gearbox-update, planMigration).
const agentsMd = read(down, "AGENTS.md");
if (!agentsMd.trim()) fail(`no AGENTS.md in ${down} (or it's empty) — not an onboarded Gearbox repo, nothing to migrate`);
if (fenceIn(down, "AGENTS.md", "protocol")) fail(`${join(down, "AGENTS.md")} already has a gearbox:protocol fence — nothing to migrate`);
if (fenceIn(down, "CONTEXT.md", "glossary"))
  fail("CONTEXT.md has a gearbox:glossary fence while AGENTS.md has no gearbox:protocol fence — a half-migrated tree, which gearbox-update refuses too");

let m;
try {
  m = migrateV1({
    agentsMd,
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
