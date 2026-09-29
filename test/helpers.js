import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderFence } from "../scripts/lib/fence.js";
import { buildAgentsMd, buildContextMd } from "../scripts/lib/skeleton.js";
import { ciYml } from "../scripts/lib/workflows.js";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GIT_ENV = {
  GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com",
};

export function tmp(prefix = "gearbox-test-") {
  return mkdtempSync(join(tmpdir(), prefix));
}
export function write(dir, rel, text) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  return p;
}
export function read(dir, rel) {
  return readFileSync(join(dir, rel), "utf8");
}
export function git(dir, ...args) {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8", env: { ...process.env, ...GIT_ENV }, stdio: ["ignore", "pipe", "pipe"] }).trim();
}
export function gitInit(dir) {
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "commit.gpgsign", "false");
}
export function commitAll(dir, msg = "init") {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", msg);
}
export function runTool(script, args = [], { cwd = REPO, env = {} } = {}) {
  const r = spawnSync(process.execPath, [join(REPO, "scripts", script), ...args], {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...GIT_ENV, NO_COLOR: "1", ...env },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

// Minimal v2 fence content carrying every heading the check requires.
export const PROTOCOL = [
  "## Working agreement (multi-agent)", "",
  "### On starting a shift (the start-of-shift steps)", "", "1. Sync, then read.", "",
  "### While working", "", "- Commit in small steps.", "",
  "### Roles of issues & PRs", "", "- silent judgment calls are not allowed.", "",
  "### PR disposition (merge rules)", "", "- Merge commits only.", "",
  "### Changing the protocol itself (rules for changing this file)", "", "- Tiers.", "",
  "### Gate contract (must be all-green before merge and shift-end)", "", "- Both jobs green.", "",
  "### On ending a shift (shift-end rules)", "", "1. The gate and the protocol check are green.",
].join("\n");
export const GLOSSARY = "## Protocol terms\n\n| Term | Definition | Notes |\n|---|---|---|\n| handoff | a baton passed at merge | — |";

// A downstream-shaped v2 repo on disk (no git unless the caller adds it).
export function v2Repo({ gate = "npm test", ci = null, version = "v2.0.0", stamp = version, maintainer = "octo", localExtensions, whereToFind } = {}) {
  const dir = tmp("gearbox-v2-");
  write(dir, "AGENTS.md", buildAgentsMd({ title: "demo", gate, maintainer, localExtensions, whereToFind, protocolBlock: renderFence("protocol", version, PROTOCOL) }));
  write(dir, "CONTEXT.md", buildContextMd({ title: "demo", glossaryBlock: renderFence("glossary", version, GLOSSARY) }));
  write(dir, "CLAUDE.md", "@AGENTS.md\n");
  write(dir, ".github/workflows/ci.yml", ci ?? ciYml(gate));
  if (stamp) write(dir, ".gearbox-version", `${stamp}\n`);
  return dir;
}

// A fake upstream Gearbox checkout: fenced AGENTS.md / CONTEXT.md + two ADRs + package.json.
export function makeUpstream({ version = "v2.0.0", protocol = PROTOCOL, glossary = GLOSSARY } = {}) {
  const dir = tmp("gearbox-up-");
  write(dir, "AGENTS.md", `# Gearbox\n\nintro\n\n${renderFence("protocol", version, protocol)}\n\n## Where to find things\n\n- x\n`);
  write(dir, "CONTEXT.md", `# Domain context — Gearbox\n\n${renderFence("glossary", version, glossary)}\n`);
  write(dir, "docs/gearbox-adr/0001-adr-template.md", "# ADR-0001: <decision title>\n\n- Date: <YYYY-MM-DD>\n- Status: accepted\n");
  write(dir, "docs/gearbox-adr/0002-self-check-as-gate.md", "# ADR-0002: Self-check as gate\n\n- Date: 2026-07-17\n- Status: accepted\n");
  write(dir, "package.json", JSON.stringify({ name: "gearbox-agents", version: version.slice(1), repository: { url: "https://github.com/example/gearbox.git" } }));
  return dir;
}
