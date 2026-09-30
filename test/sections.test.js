import test from "node:test";
import assert from "node:assert/strict";
import { headings, baseTitle, hasHeading, sectionBody, splitByLevel, sectionSizes, fenceRun } from "../scripts/lib/sections.js";

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

test("fenceRun detects fence markers and returns char + length", () => {
  assert.deepEqual(fenceRun("```"), { char: "`", len: 3 });
  assert.deepEqual(fenceRun("````"), { char: "`", len: 4 });
  assert.deepEqual(fenceRun("~~~"), { char: "~", len: 3 });
  assert.deepEqual(fenceRun("  ```markdown"), { char: "`", len: 3 });
  assert.deepEqual(fenceRun("   ~~~"), { char: "~", len: 3 });
  assert.equal(fenceRun("    ```"), null); // 4 spaces = not a fence
  assert.equal(fenceRun("# not a fence"), null);
  assert.equal(fenceRun("``"), null); // only 2 backticks
});

test("headings: backtick and tilde fences are both recognized", () => {
  const md = "# T\n\n```bash\n## not heading\n```\n\n## A\n\n~~~\n## also not heading\n~~~\n\n## B\n";
  const h = headings(md);
  assert.deepEqual(h.map((x) => x.title), ["T", "A", "B"]);
});

test("headings: tilde fence requires matching length to close", () => {
  const md = "# T\n\n~~~~\n## trapped\n~~~\n\n## A\n";
  const h = headings(md);
  assert.deepEqual(h.map((x) => x.title), ["T"]); // ## A is still inside the 4-tilde fence
});

test("headings: backticks and tildes don't interfere", () => {
  const md = "# T\n\n````\n~~~\n## not heading (inside backticks)\n~~~\n````\n\n## A\n";
  const h = headings(md);
  assert.deepEqual(h.map((x) => x.title), ["T", "A"]);
});

test("sectionBody ignores headings inside fences", () => {
  const md = "## A\ntext\n```\n### B\n```\n### C\nmore\n## D\nend";
  assert.equal(sectionBody(md, 2, "A"), "text\n```\n### B\n```\n### C\nmore");
  assert.equal(sectionBody(md, 3, "C"), "more");
  assert.equal(sectionBody(md, 3, "B"), null); // ### B inside fence doesn't exist
});

test("splitByLevel ignores headings inside fences", () => {
  const md = "# T\nintro\n## A\n```\n## hidden\n```\n## B\n";
  const chunks = splitByLevel(md, 2);
  assert.deepEqual(chunks.map((c) => c.title), [null, "A", "B"]);
});

test("headings: CommonMark heading syntax — double spaces, trailing hashes, indentation", () => {
  assert.deepEqual(
    headings("##  Gate").map((h) => h.title),
    ["Gate"]
  );
  assert.deepEqual(
    headings("## Gate ##").map((h) => h.title),
    ["Gate"]
  );
  assert.deepEqual(
    headings("## Gate  ##").map((h) => h.title),
    ["Gate"]
  );
  assert.deepEqual(
    headings("   ## Indented").map((h) => h.title),
    ["Indented"]
  ); // 3 spaces OK
  assert.deepEqual(
    headings("    ## Four").map((h) => h.title),
    []
  ); // 4 spaces = not a heading
});

test("headings: # without space is not a heading", () => {
  assert.deepEqual(headings("#hashtag").length, 0);
  assert.deepEqual(headings("##no-space").length, 0);
});
