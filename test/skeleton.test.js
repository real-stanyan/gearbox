import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentsMd, buildContextMd, SOT_NOTE, PLACEHOLDERS } from "../scripts/lib/skeleton.js";
import { ciYml, SYNC_YML, CHECK_YML, pinSyncYml } from "../scripts/lib/workflows.js";
import { headings } from "../scripts/lib/sections.js";
import { renderFence, findFence } from "../scripts/lib/fence.js";

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
