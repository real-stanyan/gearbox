#!/usr/bin/env node
// Maintainer helper (Gearbox repo only, ADR-0050): after editing text between the gearbox
// markers in AGENTS.md or CONTEXT.md, rewrite both markers. The hash is recomputed; the version
// follows the release rule the self-check enforces (scripts/lib/fence-release.js): fence content
// changed since the latest tag ⇒ package.json's version, which must be bumped past that tag
// (else this refuses and writes nothing); unchanged ⇒ the tag's version, so a README-only release
// doesn't move the protocol version. Without a tag: package.json's version if content changed
// since the last stamp, else the current one. Both markers always carry the same version.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findFence, renderFence, replaceFence } from "../lib/fence.js";
import { releaseState } from "../lib/fence-release.js";

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
const [protocol, glossary] = targets.map((t) => t.fence);
const state = releaseState(root, { protocol, glossary }, pkgVersion);
if (state.tag && state.changed && !state.bumped) {
  console.error(`fence content changed since ${state.tag} — bump package.json's version first (ADR-0050)`);
  process.exit(1);
}
const version = state.tag
  ? state.expected
  : targets.some((t) => t.fence.actualHash !== t.fence.hash)
    ? pkgVersion
    : protocol.version;
for (const t of targets) {
  const next = replaceFence(t.text, t.name, renderFence(t.name, version, t.fence.content));
  if (next !== t.text) writeFileSync(join(root, t.file), next);
  console.log(`${t.file}: gearbox:${t.name} ${version} sha256:${findFence(next, t.name).hash}${next === t.text ? " (unchanged)" : ""}`);
}
