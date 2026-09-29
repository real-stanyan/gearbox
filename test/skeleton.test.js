import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildAgentsMd, buildContextMd, SOT_NOTE, PLACEHOLDERS } from "../scripts/lib/skeleton.js";
import { ciYml, SYNC_YML, CHECK_YML, pinSyncYml } from "../scripts/lib/workflows.js";
import { headings } from "../scripts/lib/sections.js";
import { renderFence, findFence } from "../scripts/lib/fence.js";
import { tmp, write, gitInit, git, commitAll } from "./helpers.js";

const PROTOCOL = renderFence("protocol", "v2.0.0", "## Working agreement (multi-agent)\n\n- rule");
const GLOSSARY = renderFence("glossary", "v2.0.0", "## Protocol terms\n\n| Term | Definition | Notes |\n|---|---|---|\n| handoff | x | y |");

test("buildAgentsMd lays sections out in the v2 order with the fence verbatim", () => {
  const md = buildAgentsMd({ title: "demo", gate: "npm test", maintainer: "octo", protocolBlock: PROTOCOL });
  assert.deepEqual(headings(md).filter((h) => h.level <= 2).map((h) => h.title), [
    "demo", "Tech stack", "Hard rules", "Gate", "Maintainer", "Working agreement (multi-agent)",
    "Local protocol extensions", "Division of labor", "Where to find things",
  ]);
  assert.ok(md.includes(SOT_NOTE));
  assert.ok(md.includes("```bash\nnpm test\n```"));
  assert.ok(md.includes("GitHub account: `octo`"));
  assert.equal(findFence(md, "protocol").block, PROTOCOL);
});

test("buildAgentsMd defaults to placeholders and keeps gate notes and extra sections", () => {
  const md = buildAgentsMd({ protocolBlock: PROTOCOL, gateNotes: "note line", extraSections: ["## Extra\n\nx"] });
  assert.ok(md.includes(PLACEHOLDERS.gate));
  assert.ok(md.includes("GitHub account: `<maintainer>`"));
  assert.ok(md.includes("note line"));
  assert.ok(md.indexOf("## Extra") < md.indexOf("## Where to find things"));
});

test("buildContextMd: title, glossary fence, project terms", () => {
  const md = buildContextMd({ title: "demo", glossaryBlock: GLOSSARY });
  assert.ok(md.startsWith("# Domain context — demo\n"));
  assert.equal(findFence(md, "glossary").block, GLOSSARY);
  assert.ok(md.trimEnd().endsWith("|---|---|---|"));
});

test("workflow templates: gate in ci.yml, @2 pins, read-only check job", () => {
  assert.match(ciYml("npm test"), /- run: npm test\n/);
  assert.match(ciYml(null), /exit 1/);
  assert.match(SYNC_YML, /npx -y gearbox-agents@2 update --refresh-drift/);
  assert.doesNotMatch(SYNC_YML, /@latest/);
  assert.match(CHECK_YML, /npx -y gearbox-agents@2 check/);
  assert.match(CHECK_YML, /contents: read/);
  assert.equal(pinSyncYml("npx -y gearbox-agents@latest update"), "npx -y gearbox-agents@2 update");
});

// The body of gearbox-sync.yml's "Open the backfill PR" step, dedented — the script Actions runs.
function prStepScript() {
  const lines = SYNC_YML.split("\n");
  const step = lines.findIndex((l) => l.includes("- name: Open the backfill PR"));
  const run = lines.findIndex((l, i) => i > step && /^ +run: \|$/.test(l));
  const indent = " ".repeat(lines[run].indexOf("run:") + 2);
  const body = [];
  for (const l of lines.slice(run + 1)) {
    if (l.trim() && !l.startsWith(indent)) break;
    body.push(l.slice(indent.length));
  }
  return body.join("\n");
}

// The PR step used to end in `|| echo "…"`: a failed `gh pr create` left the job green with no PR.
// update now exits 1 on a failed push, so this step runs only after a pushed branch or none — and a
// failure here is the job's failure too. Run as Actions runs it (bash -e) against a gh that fails.
test("gearbox-sync.yml: a failed PR step is an ::error:: and a red job; no branch is still a green 'nothing to sync'", () => {
  assert.doesNotMatch(SYNC_YML, /\|\| echo/);
  const bin = tmp("gearbox-fake-gh-");
  write(bin, "gh", '#!/bin/sh\necho "GitHub Actions is not permitted to create or approve pull requests" >&2\nexit 1\n');
  chmodSync(join(bin, "gh"), 0o755);
  const repo = tmp("gearbox-sync-step-");
  gitInit(repo);
  write(repo, "README.md", "x\n");
  commitAll(repo);
  const step = () => spawnSync("bash", ["-e", "-c", prStepScript()], { cwd: repo, encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  const none = step();
  assert.equal(none.status, 0, none.stdout + none.stderr);
  assert.match(none.stdout, /Nothing to sync — protocol is current\./);
  git(repo, "branch", "docs/gearbox-backfill-2026-09-29");
  const failed = step();
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(failed.stdout, /^::error::PR creation failed — [^\n]*Settings → Actions → General → Workflow permissions/m);
});

test("ciYml: multi-line gate uses block scalar (run: |)", () => {
  const yml = ciYml("npx tsc --noEmit\nnpx vitest run");
  assert.ok(yml.includes("- run: |"));
  assert.ok(yml.includes("          npx tsc --noEmit"));
  assert.ok(yml.includes("          npx vitest run"));
  assert.doesNotMatch(yml, /- run: npx tsc/);
});

test("ciYml: gate with ': ' uses block scalar", () => {
  const yml = ciYml('echo "step: one" && npm test');
  assert.ok(yml.includes("- run: |"));
  assert.ok(yml.includes('echo "step: one" && npm test'));
});

test("ciYml: gate with ' #' uses block scalar", () => {
  const yml = ciYml("npm test # run tests");
  assert.ok(yml.includes("- run: |"));
  assert.ok(yml.includes("npm test # run tests"));
});

test("ciYml: gate with leading '!' uses block scalar", () => {
  const yml = ciYml('! grep -rn "console.log" src');
  assert.ok(yml.includes("- run: |"));
  assert.ok(yml.includes('! grep -rn "console.log" src'));
});

test("ciYml: plain single-line gate uses plain scalar (- run: cmd)", () => {
  const yml = ciYml("npm test");
  assert.match(yml, /- run: npm test\n/);
  assert.doesNotMatch(yml, /run: \|/);
});
