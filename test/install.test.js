import test from "node:test";
import assert from "node:assert/strict";
import { findFence, renderFence } from "../scripts/lib/fence.js";
import { makeUpstream, runTool, gitInit, git, tmp, read, write } from "./helpers.js";

test("install lays down a v2 tree that passes gearbox-check", () => {
  const up = makeUpstream();
  const target = tmp();
  gitInit(target);
  const r = runTool("gearbox-install", [target, "--name", "demo", "--maintainer", "octo", "--gate", "npm test"], { env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 0, r.out);
  const agents = read(target, "AGENTS.md");
  assert.ok(agents.startsWith("# demo\n"));
  assert.equal(findFence(agents, "protocol").block, findFence(read(up, "AGENTS.md"), "protocol").block);
  assert.equal(findFence(read(target, "CONTEXT.md"), "glossary").block, findFence(read(up, "CONTEXT.md"), "glossary").block);
  assert.match(agents, /GitHub account: `octo`/);
  assert.equal(read(target, ".gearbox-version").trim(), "v2.0.0");
  assert.match(read(target, ".github/workflows/gearbox-check.yml"), /gearbox-agents@2 check/);
  assert.match(read(target, ".github/workflows/gearbox-sync.yml"), /gearbox-agents@2 update/);
  const c = runTool("gearbox-check", [], { cwd: target });
  assert.equal(c.code, 0, c.out);
});

test("install names the project after the git remote, not the directory (#133)", () => {
  const up = makeUpstream();
  const target = tmp("atlas-method-pilot-");
  gitInit(target);
  git(target, "remote", "add", "origin", "https://github.com/example/atlas-method.git");
  const r = runTool("gearbox-install", [target, "--gate", "npm test"], { env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 0, r.out);
  assert.ok(read(target, "AGENTS.md").startsWith("# atlas-method\n"));
});

test("install refuses a tree that already carries a gearbox fence", () => {
  const up = makeUpstream();
  const target = tmp();
  write(target, "AGENTS.md", `# x\n\n${renderFence("protocol", "v2.0.0", "## Working agreement (multi-agent)")}\n`);
  const r = runTool("gearbox-install", [target], { env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 1);
  assert.match(r.out, /already has a Gearbox AGENTS\.md/);
});

test("install refuses on the fence marker alone, whatever the fenced text says", () => {
  const up = makeUpstream();
  const target = tmp();
  write(target, "AGENTS.md", `# x\n\n${renderFence("protocol", "v2.0.0", "## Some other heading")}\n`);
  const r = runTool("gearbox-install", [target], { env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 1);
  assert.match(r.out, /already has a Gearbox AGENTS\.md/);
});
