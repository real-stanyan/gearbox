#!/usr/bin/env node
// Maintainer helper (Gearbox repo only): builds scripts/lib/v1-known-lines.json for the
// v1 → v2 migration (ADR-0050). Sources — everything upstream published before v2:
//   1. every revision of AGENTS.md and CONTEXT.md up to the last v1 tag (incl. the Chinese era)
//   2. the downstream-flavored AGENTS.md / CONTEXT.md that each v1 tag's gearbox-install generates
// Both sources are collected per file: line hashes come from both files, terms from CONTEXT.md only.
// Run from the repo root with full history and tags. Deterministic: same history → same file.
import { execSync, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildKnown, serializeKnown, KNOWN_PATH } from "../lib/v1-known.js";

const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] });
const tags = git(["tag", "-l", "v1.*", "--sort=v:refname"]).trim().split("\n").filter(Boolean);
const lastV1 = tags.at(-1);
if (!lastV1) {
  console.error("no v1.* tags — run in the gearbox repo with tags fetched");
  process.exit(1);
}

const texts = { "AGENTS.md": [], "CONTEXT.md": [] };
const revs = git(["log", "--format=%H", lastV1, "--", "AGENTS.md", "CONTEXT.md"]).trim().split("\n").filter(Boolean);
for (const rev of revs)
  for (const f of Object.keys(texts)) {
    try {
      texts[f].push(git(["show", `${rev}:${f}`]));
    } catch {
      /* file absent at that revision */
    }
  }

const installs = [];
for (const tag of tags) {
  try {
    git(["cat-file", "-e", `${tag}:scripts/gearbox-install`]);
  } catch {
    continue;
  }
  const work = mkdtempSync(join(tmpdir(), "gearbox-v1-"));
  const up = join(work, "up");
  const target = join(work, "target");
  mkdirSync(up);
  mkdirSync(target);
  try {
    execSync(`git archive ${tag} | tar -x -C "${up}"`, { stdio: "ignore" });
    execFileSync(process.execPath, [join(up, "scripts", "gearbox-install"), target, "--name", "example-project"], {
      env: { ...process.env, GEARBOX_DIR: up },
      stdio: "ignore",
      timeout: 60000,
    });
    for (const f of Object.keys(texts)) if (existsSync(join(target, f))) texts[f].push(readFileSync(join(target, f), "utf8"));
    installs.push(tag);
  } catch {
    /* that tag's installer can't run standalone — its text is still covered by source 1 */
  }
  rmSync(work, { recursive: true, force: true });
}

const known = buildKnown(texts["AGENTS.md"], texts["CONTEXT.md"]);
writeFileSync(KNOWN_PATH, serializeKnown(known, { lastV1, revisions: revs.length, installs }));
console.log(`wrote ${KNOWN_PATH}: ${known.lines.size} line hashes, ${known.terms.size} terms (${revs.length} revisions; installs: ${installs.join(" ")})`);
