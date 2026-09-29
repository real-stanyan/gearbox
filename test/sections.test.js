import test from "node:test";
import assert from "node:assert/strict";
import { headings, baseTitle, hasHeading, sectionBody, splitByLevel, sectionSizes } from "../scripts/lib/sections.js";

test("headings ignore lines inside code blocks", () => {
  const md = "# T\n\n## A\n\n```bash\n# not a heading\n```\n\n### B (x)\n";
  assert.deepEqual(headings(md).map((h) => [h.level, h.title]), [[1, "T"], [2, "A"], [3, "B (x)"]]);
});

test("baseTitle strips a trailing ASCII or full-width parenthetical", () => {
  assert.equal(baseTitle("On starting a shift (the three start-of-shift steps)"), "On starting a shift");
  assert.equal(baseTitle("On starting a shift（开工五件事）"), "On starting a shift");
  assert.equal(baseTitle("Issue & PR 的角色"), "Issue & PR 的角色");
});

test("hasHeading matches whole headings at one level, or a prefix", () => {
  const md = "## Gate\n### Gate contract (x)\n";
  assert.equal(hasHeading(md, 2, "Gate"), true);
  assert.equal(hasHeading(md, 3, "Gate"), false);
  assert.equal(hasHeading(md, 3, "Gate contract", { prefix: true }), true);
});

test("sectionBody stops at the next heading of the same or a higher level", () => {
  const md = "## A\na1\n### A.1\na2\n## B\nb1\n";
  assert.equal(sectionBody(md, 2, "A"), "a1\n### A.1\na2");
  assert.equal(sectionBody(md, 3, "A.1"), "a2");
  assert.equal(sectionBody(md, 2, "Missing"), null);
  assert.equal(sectionBody(md, 3, "A.", { prefix: true }), "a2");
});

test("splitByLevel: preamble + one chunk per heading of exactly that level", () => {
  const chunks = splitByLevel("# T\nintro\n## A\na\n### A.1\nx\n## B\nb", 2);
  assert.deepEqual(chunks.map((c) => c.title), [null, "A", "B"]);
  assert.deepEqual(chunks[0].lines, ["# T", "intro"]);
  assert.equal(chunks[1].heading, "## A");
  assert.deepEqual(chunks[1].lines, ["a", "### A.1", "x"]);
});

test("sectionSizes lists level-2 sections largest first", () => {
  const sizes = sectionSizes(`# T\n## Small\nx\n## Big\n${"y".repeat(100)}\n`);
  assert.equal(sizes[0].title, "Big");
  assert.ok(sizes[0].bytes > 100);
});
