import { test } from "node:test";
import assert from "node:assert/strict";
import { findFence } from "../scripts/lib/fence.js";
import { read, write, runTool, gearboxRepo, restamp } from "./helpers.js";

const check = (dir) => runTool("check-gearbox.js", [], { cwd: dir, env: { CI: "" } });
const NOTE = "counts as part of the `## Hard rules` section";

test("warnings from the shared protocol check are printed before the verdict and don't fail the gate", () => {
  const dir = gearboxRepo();
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("- `RicksZhang` — shared: stanyan", "- `<second-account>` — shared: stanyan"));
  const r = check(dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /⚠ "## Roster" still holds a placeholder account/);
  assert.ok(r.out.indexOf("⚠") < r.out.indexOf("✅"), "warnings come before the verdict");
});

test("the ADR-0018 note must sit inside the protocol fence — a copy outside it doesn't count", () => {
  const dir = gearboxRepo({ tag: false }); // no tag: re-stamping the edited fence can't trip the version rule
  const agents = read(dir, "AGENTS.md");
  assert.equal(findFence(agents, "protocol").content.split(NOTE).length, 2, "the fence carries the note exactly once");
  write(
    dir,
    "AGENTS.md",
    agents
      .replace(NOTE, "counts as a hard rule")
      .replace("## Hard rules\n\n", `## Hard rules\n\nA clause marked **Hard rule** ${NOTE}.\n\n`),
  );
  restamp(dir, "v2.0.0");
  const r = check(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /self-check failed \(1\)/);
  assert.match(r.out, /the protocol fence must keep the hard-rule-by-designation note/);
});
