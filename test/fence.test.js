import test from "node:test";
import assert from "node:assert/strict";
import {
  normalize, hashContent, renderFence, findFence, replaceFence, fenceStatus, FenceError,
} from "../scripts/lib/fence.js";

const BODY = "## Working agreement (multi-agent)\n\n- rule one\n- rule two";

test("normalize: CRLF, trailing whitespace and blank edges don't matter", () => {
  assert.equal(normalize("\n\r\n## A  \r\n- b\t\n\n"), "## A\n- b");
});

test("hashContent: 12 lowercase hex, stable under normalization", () => {
  assert.match(hashContent(BODY), /^[0-9a-f]{12}$/);
  assert.equal(hashContent(BODY), hashContent(`\n${BODY.replace(/\n/g, "  \r\n")}\n\n`));
  assert.notEqual(hashContent(BODY), hashContent(`${BODY}\n- rule three`));
});

test("renderFence → findFence round-trips version, hash and content", () => {
  const doc = `# P\n\n${renderFence("protocol", "v2.0.0", BODY)}\n\n## After\n`;
  const f = findFence(doc, "protocol");
  assert.equal(f.version, "v2.0.0");
  assert.equal(f.hash, hashContent(BODY));
  assert.equal(f.actualHash, f.hash);
  assert.equal(normalize(f.content), BODY);
  assert.ok(f.block.startsWith("<!-- gearbox:protocol v2.0.0 sha256:"));
  assert.ok(f.block.endsWith("<!-- /gearbox:protocol -->"));
});

test("a hand edit shows up as actualHash ≠ hash", () => {
  const f = findFence(renderFence("protocol", "v2.0.0", BODY).replace("rule two", "rule 2"), "protocol");
  assert.notEqual(f.actualHash, f.hash);
});

test("findFence returns null when there is no fence of that name", () => {
  assert.equal(findFence("# nothing here\n", "protocol"), null);
  assert.equal(findFence(renderFence("glossary", "v2.0.0", "| a |"), "protocol"), null);
});

test("malformed, duplicate, unbalanced and nested markers are hard errors", () => {
  const good = renderFence("protocol", "v2.0.0", BODY);
  assert.throws(() => findFence(`${good}\n${good}`, "protocol"), FenceError);
  assert.throws(() => findFence(good.split("\n").slice(0, -1).join("\n"), "protocol"), /no end marker/);
  assert.throws(() => findFence(`<!-- /gearbox:protocol -->\n${good}`, "protocol"), /without a begin marker/);
  assert.throws(() => findFence("<!-- gearbox:protocol oops -->", "protocol"), /malformed/);
  const nested = good.replace("- rule one", renderFence("glossary", "v2.0.0", "x"));
  assert.throws(() => findFence(nested, "protocol"), /nested/);
});

test("replaceFence swaps the block and keeps everything around it", () => {
  const doc = `top\n${renderFence("protocol", "v2.0.0", BODY)}\nbottom\n`;
  const next = replaceFence(doc, "protocol", renderFence("protocol", "v2.1.0", `${BODY}\n- rule three`));
  assert.ok(next.startsWith("top\n<!-- gearbox:protocol v2.1.0"));
  assert.ok(next.endsWith("<!-- /gearbox:protocol -->\nbottom\n"));
  assert.equal(findFence(next, "protocol").version, "v2.1.0");
});

test("fenceStatus: synced / behind / hand-edited / missing", () => {
  const up = renderFence("protocol", "v2.1.0", `${BODY}\n- rule three`);
  const old = renderFence("protocol", "v2.0.0", BODY);
  assert.equal(fenceStatus(up, up, "protocol").state, "synced");
  assert.equal(fenceStatus(old, up, "protocol").state, "behind");
  assert.equal(fenceStatus(old.replace("rule one", "rule 1"), up, "protocol").state, "hand-edited");
  assert.equal(fenceStatus("# v1 layout\n", up, "protocol").state, "missing");
  assert.throws(() => fenceStatus(up, "# no fence upstream", "protocol"), /upstream has no/);
});

test("renderFence rejects unknown names and bad versions", () => {
  assert.throws(() => renderFence("nope", "v2.0.0", "x"), FenceError);
  assert.throws(() => renderFence("protocol", "2.0.0", "x"), FenceError);
});
