#!/usr/bin/env node
// Maintainer helper (Gearbox repo only, ADR-0050): after editing text between the gearbox
// markers in AGENTS.md or CONTEXT.md, rewrite both markers. The hash is recomputed; when either
// fence's content changed, both versions become package.json's version (both markers always
// carry the protocol version). Unchanged content keeps its version, so a README-only release
// doesn't move the protocol version.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findFence, renderFence, replaceFence } from "../lib/fence.js";

const root = process.cwd();
const pkgVersion = "v" + JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const targets = [["AGENTS.md", "protocol"], ["CONTEXT.md", "glossary"]].map(([file, name]) => {
  const text = readFileSync(join(root, file), "utf8");
  const fence = findFence(text, name);
  if (!fence) {
    console.error(`${file}: no gearbox:${name} fence`);
    process.exit(1);
  }
  return { file, name, text, fence };
});
const changed = targets.some((t) => t.fence.actualHash !== t.fence.hash);
for (const t of targets) {
  const version = changed ? pkgVersion : t.fence.version;
  const next = replaceFence(t.text, t.name, renderFence(t.name, version, t.fence.content));
  if (next !== t.text) writeFileSync(join(root, t.file), next);
  console.log(`${t.file}: gearbox:${t.name} ${version} sha256:${findFence(next, t.name).hash}${changed ? "" : " (unchanged)"}`);
}
