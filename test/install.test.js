import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { findFence, renderFence } from "../scripts/lib/fence.js";
import { renderOlderDuplicates, OLDER_DUPLICATES_PATH } from "../scripts/lib/adr-ids.js";
import { makeUpstream, runTool, gitInit, git, tmp, read, write } from "./helpers.js";

test("install lays down a v2 tree that passes gearbox-check", () => {
  const up = makeUpstream();
  const target = tmp();
  gitInit(target);
  const r = runTool("gearbox-install", [target, "--name", "demo", "--maintainer", "octo", "--gate", "npm test"], { env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /docs\/adr\/<issue>-<slug>\.md/, "the closing hint names project ADRs after their issue (ADR-0052)");
  assert.doesNotMatch(r.out, /docs\/adr\/0001-/);
  const agents = read(target, "AGENTS.md");
  assert.ok(agents.startsWith("# demo\n"));
  assert.equal(findFence(agents, "protocol").block, findFence(read(up, "AGENTS.md"), "protocol").block);
  assert.equal(findFence(read(target, "CONTEXT.md"), "glossary").block, findFence(read(up, "CONTEXT.md"), "glossary").block);
  assert.match(agents, /- `octo` — shared: octo — maintainer/);
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

// The backup notice says where a hand-written glossary goes: `## Project terms`, never into the fence.
test("install backs up a hand-written CONTEXT.md and points its entries at Project terms, outside the fence", () => {
  const up = makeUpstream();
  const target = tmp();
  gitInit(target);
  write(target, "CONTEXT.md", "# Glossary\n\n- widget: a thing we sell\n");
  const r = runTool("gearbox-install", [target, "--name", "demo", "--maintainer", "octo", "--gate", "npm test"], { env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 0, r.out);
  assert.equal(read(target, "CONTEXT-backup.md"), "# Glossary\n\n- widget: a thing we sell\n");
  assert.ok(
    read(target, "AGENTS.md").includes("> - `CONTEXT-backup.md` — its glossary entries go under `## Project terms` in the new CONTEXT.md, outside the `gearbox:glossary` fence"),
    read(target, "AGENTS.md").slice(0, 800),
  );
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

// ADR-0052: a project arriving with duplicate ADR numbers in docs/adr/ gets them recorded, so its check
// warns about them once instead of failing on day one. Only then: no duplicates, or a list already
// there, and install writes none.
test("install records a target's existing docs/adr duplicates in docs/adr/older-duplicates.md, and the check passes with one warning", () => {
  const up = makeUpstream();
  const install = (target) => runTool("gearbox-install", [target, "--name", "demo", "--maintainer", "octo", "--gate", "npm test"], { env: { GEARBOX_DIR: up } });
  const target = tmp();
  gitInit(target);
  for (const f of ["0045-a.md", "0045-b.md", "0046-c.md"]) write(target, `docs/adr/${f}`, "# x\n");
  const r = install(target);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /✓ docs\/adr\/older-duplicates\.md {2}\(recorded 1 older duplicate ADR number /);
  assert.equal(read(target, OLDER_DUPLICATES_PATH), renderOlderDuplicates([{ id: 45, files: ["0045-a.md", "0045-b.md"] }]));
  const c = runTool("gearbox-check", [], { cwd: target });
  assert.equal(c.code, 0, c.out);
  assert.deepEqual(c.out.split("\n").filter((l) => l.startsWith("⚠")), [
    "⚠ docs/adr: older duplicate ADR numbers, recorded in docs/adr/older-duplicates.md: ADR-45 (0045-a.md, 0045-b.md) — references to them are ambiguous and they stay as they are (ADR-0052)",
  ]);

  const distinct = tmp();
  write(distinct, "docs/adr/0001-a.md", "# x\n");
  assert.equal(install(distinct).code, 0);
  assert.ok(!existsSync(join(distinct, OLDER_DUPLICATES_PATH)));
  const listed = tmp();
  for (const f of ["0045-a.md", "0045-b.md"]) write(listed, `docs/adr/${f}`, "# x\n");
  write(listed, OLDER_DUPLICATES_PATH, "a list of our own\n");
  assert.equal(install(listed).code, 0);
  assert.equal(read(listed, OLDER_DUPLICATES_PATH), "a list of our own\n");
});
