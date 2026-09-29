import test from "node:test";
import assert from "node:assert/strict";
import { normalizeKnownLine, knownLineHash, termKey, tableTerms, buildKnown, serializeKnown, loadKnown } from "../scripts/lib/v1-known.js";
import { tmp, write } from "./helpers.js";

test("normalizeKnownLine trims and folds the maintainer name back to the placeholder", () => {
  assert.equal(normalizeKnownLine("  - L1 waits for `real-owner` agreement  ", "real-owner"), "- L1 waits for `<maintainer>` agreement");
  assert.equal(normalizeKnownLine("x", null), "x");
});

test("tableTerms skips header and separator rows and normalizes the first cell", () => {
  assert.deepEqual(tableTerms("| Term | Def |\n|---|---|\n| **Handoff** | x |\n| `gate` | y |\n"), ["handoff", "gate"]);
});

test("buildKnown → serialize → load round-trips", () => {
  const k = buildKnown(["## Working agreement\n"], ["## Terms\n\n| Term | D |\n|---|---|\n| handoff | x |\n"]);
  assert.ok(k.lines.has(knownLineHash("## Terms")));
  const dir = tmp();
  const p = write(dir, "k.json", serializeKnown(k, { test: true }));
  const back = loadKnown(p);
  assert.ok(back.lines.has(knownLineHash("| handoff | x |")));
  assert.ok(back.lines.has(knownLineHash("## Working agreement")));
  assert.ok(back.terms.has("handoff"));
  assert.equal(knownLineHash("abc").length, 12);
  assert.equal(termKey(" `L1/L2 tiers` "), "l1/l2 tiers");
});

test("buildKnown hashes a Chinese-era <维护者> line as written and in its <maintainer> form", () => {
  const k = buildKnown(["- L1 等 `<维护者>` 同意\n- an ordinary line\n"], []);
  assert.ok(k.lines.has(knownLineHash("- L1 等 `<维护者>` 同意")));
  assert.ok(k.lines.has(knownLineHash("- L1 等 `<maintainer>` 同意")));
  assert.equal(k.lines.size, 3); // the placeholder line twice, the ordinary line once
});

test("buildKnown takes lines from both files but terms from the CONTEXT.md texts only", () => {
  const agents = "## Roles\n\n| Role | When |\n|---|---|\n| **Task** | an actionable thing |\n";
  const context = "## Terms\n\n| Term | D |\n|---|---|\n| handoff | x |\n";
  const k = buildKnown([agents], [context]);
  assert.deepEqual([...k.terms], ["handoff"]); // "task" is a role-table cell in AGENTS.md, not a glossary term
  assert.ok(k.lines.has(knownLineHash("| **Task** | an actionable thing |"))); // its row is still a known line
  assert.ok(k.lines.has(knownLineHash("| handoff | x |")));
});

test("the shipped fingerprint knows v1 protocol text in both languages", () => {
  const k = loadKnown();
  assert.ok(k.lines.has(knownLineHash("### While working")));
  assert.ok(k.lines.has(knownLineHash("### On starting a shift (the three start-of-shift steps)")));
  assert.ok(k.lines.has(knownLineHash("### 协议自身的变更（改本文件的规则）")));
  assert.ok(k.terms.has("handoff"));
  assert.ok(k.terms.has("交接（handoff）"));
});

test("the shipped fingerprint knows a Chinese-era maintainer line once the maintainer is folded to <maintainer>", () => {
  const k = loadKnown();
  // v1.0.0–v1.3.x spell the placeholder <维护者>; the migration folds a bound maintainer name to <maintainer> before lookup.
  assert.ok(k.lines.has(knownLineHash("- **谁 merge**：PR 作者 agent 在 CI 绿后自行 merge。协议改动按分级走（见「协议自身的变更」）：L1 等 `<维护者>` 同意，L2 自主。")));
  assert.ok(k.lines.has(knownLineHash("- **谁 merge**：PR 作者 agent 在 CI 绿后自行 merge。协议改动按分级走（见「协议自身的变更」）：L1 等 `<maintainer>` 同意，L2 自主。")));
});

test("the shipped fingerprint's terms are glossary terms only — an AGENTS.md role-table cell like \"task\" is not one", () => {
  const k = loadKnown();
  assert.ok(!k.terms.has("task"));
  assert.ok(k.terms.has("handoff"));
  assert.ok(k.terms.has("交接（handoff）"));
});
