# Protocol Fence (Gearbox v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Gearbox protocol body into a tool-managed, hash-checked fence in `AGENTS.md` / `CONTEXT.md`, so downstream protocol text is rewritten by tooling instead of merged by hand. Release this as gearbox v2.0.0 and migrate Mandy-s-Bubble-Tea-App, Mr-Otto and Mandy-s-Bubble-Tea.

**Architecture:**
- New pure libraries under `scripts/lib/`:
  - `fence.js` — find, hash and replace fences.
  - `sections.js` — markdown headings.
  - `skeleton.js` — assembles v2 files.
  - `workflows.js` — workflow templates.
  - `protocol-check.js` — shared assertions.
  - `v1-known.js` — fingerprint of old upstream text.
  - `migrate-v1.js` — v1 → v2 migration.
- The tools (`gearbox-install` / `-update` / `-version`, the new `gearbox-check`) and the upstream gate (`check-gearbox.js`) become thin callers of these libraries.
- The upstream `AGENTS.md` / `CONTEXT.md` are restructured into the same v2 layout, and their fences are the single source that tooling copies downstream.

**Tech Stack:** Node.js ≥ 18, ESM, zero runtime dependencies; tests on `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-09-29-protocol-fence-v2-design.md`

## Global Constraints

- Zero runtime dependencies — only `node:` built-ins. Tools stay extensionless ESM scripts with `#!/usr/bin/env node`.
- Tests: `test/*.test.js` on `node:test`. The Gate command is exactly `node scripts/check-gearbox.js && node --test test/*.test.js` — the glob is shell-expanded, never a bare directory.
- Marker begin line: `<!-- gearbox:(protocol|glossary) vX.Y.Z sha256:<12 lowercase hex>; <note without "--"> -->`. End line: `<!-- /gearbox:(protocol|glossary) -->`.
- Hashing:
  - Hash = first 12 hex chars of sha256 of the normalized content.
  - Normalization: CRLF → LF; strip trailing spaces/tabs per line; drop leading/trailing blank lines.
- Budgets: `AGENTS.md` ≤ 32768 bytes (UTF-8); upstream protocol fence content ≤ 20480 bytes.
- Versions:
  - The protocol version is the marker version `vX.Y.Z`; both markers always carry the same version.
  - Downstream `.gearbox-version` is a single line equal to it.
- Backfill/migration branches are named `docs/gearbox-backfill-<YYYY-MM-DD>`.
- All repo text is English (ADR-0032).
- Never copy content from the private downstream repos into this repo: test fixtures are synthetic or generated from Gearbox's own public history.
- Commits:
  - Small; the message says *why*.
  - Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - The gate (`node scripts/check-gearbox.js && node --test test/*.test.js`) must be green at every commit from Task 5 on. Before Task 5, run `node --test test/*.test.js` plus the old `node scripts/check-gearbox.js`.
- Outward actions (issue/PR comments, push, tag, npm, other repos) happen only in the tasks that name them. Confirm with the user at execution time if not already approved in-session.
- Work in the worktree `/Users/stanyan/Github/gearbox/.claude/worktrees/gearbox-promo-video-262514` on branch `claude/gearbox-improvements-d4d1d0`. Never bare `git stash`.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `scripts/lib/fence.js` | new | Parse, normalize, hash, render and replace fences; `fenceStatus` |
| `scripts/lib/sections.js` | new | Markdown headings (code-block aware), `baseTitle`, `sectionBody`, `splitByLevel`, `sectionSizes` |
| `scripts/lib/skeleton.js` | new | `buildAgentsMd` / `buildContextMd` + the shared note texts and placeholders |
| `scripts/lib/workflows.js` | new | `ciYml(gate)`, `SYNC_YML`, `CHECK_YML`, `pinSyncYml` |
| `scripts/lib/protocol-check.js` | new | `runProtocolChecks(root, {upstream})`, `gateCommand`, `maintainerAccount`, budgets |
| `scripts/lib/v1-known.js` | new | Line/term fingerprints of v1 upstream text: build, serialize, load |
| `scripts/lib/v1-known-lines.json` | generated | The shipped fingerprint (hashes only) |
| `scripts/lib/migrate-v1.js` | new | `migrateV1({agentsMd, contextMd, known, protocolBlock, glossaryBlock})` |
| `scripts/gearbox-check` | new | CLI for `runProtocolChecks` |
| `scripts/dev/rehash-fences.js` | new | Maintainer helper: recompute markers after editing fences |
| `scripts/dev/build-v1-known.js` | new | Maintainer helper: regenerate the fingerprint JSON from git history |
| `scripts/dev/migrate-preview.js` | new | Maintainer helper: dry-run the migration on a checkout |
| `scripts/gearbox-install` | modify | Skeleton + fence copy; `gearbox-check.yml`; project name from remote |
| `scripts/gearbox-update` | modify | Fence sync, `--force`, `--no-push`, stamp fix, migration, new report |
| `scripts/gearbox-version` | modify | Fence states, protocol-version comparison, size warning |
| `scripts/check-gearbox.js` | rewrite | Upstream gate on top of `protocol-check.js` + version rule |
| `bin/gearbox.js` | modify | `check` route |
| `AGENTS.md`, `CONTEXT.md` | modify | v2 layout with fences |
| `.github/workflows/ci.yml` | modify | New gate command, full-history checkout |
| `.github/pull_request_template.md`, `README.md` | modify | v2 wording |
| `docs/gearbox-adr/0050-*.md`, `0051-*.md` | new | The two ADRs |
| `package.json` | modify | `2.0.0` |
| `test/helpers.js` + `test/*.test.js` + `test/fixtures/v1.15.2-install/` | new | Suite and fixtures |

---

### Task 0: Shift start and tracking issue

**Files:** none (GitHub only)

- [ ] **Step 1: Confirm the baseline.** The worktree was synced and the gate was green at 9ec79ea. Run `git fetch origin && git status -sb && node scripts/check-gearbox.js`. Expected: `✅ Gearbox self-check passed`.
- [ ] **Step 2: Close the context-only handoff (#138).** It says "close after reading", and it has been read.

```bash
gh issue close 138 -R real-stanyan/gearbox --comment "Read at shift start (context only, ADR-0048) — closing. This shift implements the protocol fence (Gearbox v2), tracked in the issue opened next."
```

- [ ] **Step 3: Open the tracking issue.**

```bash
gh issue create -R real-stanyan/gearbox --title "Protocol gap: downstream protocol text is merged by hand — drift, a false 'fully synced', a 324 KB AGENTS.md" --body "$(cat <<'EOF'
**Type: Protocol gap.** Filed from a 2026-09-29 audit of three downstream repos (Mr-Otto, Mandy-s-Bubble-Tea, Mandy-s-Bubble-Tea-App).

## Evidence

- `gearbox-update` never writes `AGENTS.md`; it prints a hand-edit checklist. Downstreams diverged: one still carries the Chinese-era protocol plus hand-translated additions, another grew ~8 local clauses inside the protocol sections.
- `gearbox-update` returns early when no ADR is missing and never bumps `.gearbox-version` (`scripts/gearbox-update` ~L873). Two downstreams have been stuck at v1.15.0 since v1.15.2 shipped, while their weekly sync Action reports success. `gearbox-version` prints "behind by patch" and "✅ fully synced" in the same run.
- v1.15.1 and v1.15.2 changed no protocol file (only site/README), yet bumped the protocol version.
- Mr-Otto's `AGENTS.md` grew from 21 KB to 324 KB in six weeks (≈100k tokens loaded into every session); Codex reads only its first 32 KiB.

## Fix

Design approved in session: `docs/superpowers/specs/2026-09-29-protocol-fence-v2-design.md` — the protocol body becomes a tool-managed, hash-checked fence; a `gearbox-agents check` job runs in CI; `AGENTS.md` gets a 32 KiB budget; a v1 → v2 migration. L1 — major version (v2.0.0).
EOF
)"
```

Record the issue number as `$TRACK` for the PR body (Task 14).

- [ ] **Step 4: Claim it.** Run `gh issue edit $TRACK -R real-stanyan/gearbox --add-assignee @me`.

---

### Task 1: `scripts/lib/fence.js`

**Files:**
- Create: `scripts/lib/fence.js`
- Test: `test/fence.test.js`

**Interfaces:**
- Produces:
  - `normalize(content) → string`
  - `hashContent(content) → string` (12 hex)
  - `findFence(text, name) → Fence | null`, where `Fence = { name, version: "vX.Y.Z", hash, actualHash, content, block, beginLine, endLine }`
  - `renderFence(name, version, content) → string`
  - `replaceFence(text, name, block) → string`
  - `fenceStatus(localText, upstreamText, name) → { state: "synced"|"behind"|"hand-edited"|"missing", local: Fence|null, upstream: Fence }`
  - `class FenceError`
  - `FENCE_NOTES`

- [ ] **Step 1: Write the failing test** — `test/fence.test.js`:

```js
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
```

- [ ] **Step 2: Run it and watch it fail.** Run `node --test test/*.test.js`. Expected: FAIL with `Cannot find module '.../scripts/lib/fence.js'`.

- [ ] **Step 3: Implement** — `scripts/lib/fence.js`:

```js
// Gearbox protocol fences (ADR-0050): the tool-managed blocks in AGENTS.md (`protocol`)
// and CONTEXT.md (`glossary`). Pure string functions, no fs — shared by install / update /
// version / check and the upstream self-check.
import { createHash } from "node:crypto";

export const FENCE_NOTES = {
  protocol:
    'managed by gearbox-agents, do not edit by hand; project additions go in "## Local protocol extensions"',
  glossary:
    'managed by gearbox-agents, do not edit by hand; project terms go in "## Project terms"',
};

const BEGIN_RE = /^<!-- gearbox:(protocol|glossary) (v\d+\.\d+\.\d+) sha256:([0-9a-f]{12});.*-->$/;
const END_RE = /^<!-- \/gearbox:(protocol|glossary) -->$/;
const MARKER_RE = /^<!-- \/?gearbox:/;

export class FenceError extends Error {}

function toLines(text) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

export function normalize(content) {
  const lines = toLines(content).map((l) => l.replace(/[ \t]+$/, ""));
  while (lines.length > 0 && lines[0] === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

export function hashContent(content) {
  return createHash("sha256").update(normalize(content)).digest("hex").slice(0, 12);
}

// null when `text` has no marker of this fence; FenceError on anything malformed — never a guess.
export function findFence(text, name) {
  const lines = toLines(text);
  let begin = -1;
  let end = -1;
  let version = null;
  let hash = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!MARKER_RE.test(line)) continue;
    const b = line.match(BEGIN_RE);
    const e = line.match(END_RE);
    if (!b && !e) throw new FenceError(`malformed gearbox marker on line ${i + 1}: ${line}`);
    const markerName = (b || e)[1];
    if (markerName !== name) {
      if (begin !== -1 && end === -1)
        throw new FenceError(`gearbox:${markerName} marker nested inside gearbox:${name} (line ${i + 1})`);
      continue;
    }
    if (b) {
      if (begin !== -1) throw new FenceError(`duplicate gearbox:${name} begin marker (line ${i + 1})`);
      begin = i;
      version = b[2];
      hash = b[3];
    } else {
      if (begin === -1)
        throw new FenceError(`gearbox:${name} end marker without a begin marker (line ${i + 1})`);
      if (end !== -1) throw new FenceError(`duplicate gearbox:${name} end marker (line ${i + 1})`);
      end = i;
    }
  }
  if (begin === -1) return null;
  if (end === -1) throw new FenceError(`gearbox:${name} begin marker (line ${begin + 1}) has no end marker`);
  const content = lines.slice(begin + 1, end).join("\n");
  return {
    name,
    version,
    hash,
    actualHash: hashContent(content),
    content,
    block: lines.slice(begin, end + 1).join("\n"),
    beginLine: begin,
    endLine: end,
  };
}

export function renderFence(name, version, content) {
  if (!FENCE_NOTES[name]) throw new FenceError(`unknown fence name: ${name}`);
  if (!/^v\d+\.\d+\.\d+$/.test(version)) throw new FenceError(`bad fence version: ${version}`);
  const body = normalize(content);
  return [
    `<!-- gearbox:${name} ${version} sha256:${hashContent(body)}; ${FENCE_NOTES[name]} -->`,
    body,
    `<!-- /gearbox:${name} -->`,
  ].join("\n");
}

export function replaceFence(text, name, block) {
  const fence = findFence(text, name);
  if (!fence) throw new FenceError(`no gearbox:${name} fence to replace`);
  const lines = toLines(text);
  return [...lines.slice(0, fence.beginLine), block, ...lines.slice(fence.endLine + 1)].join("\n");
}

export function fenceStatus(localText, upstreamText, name) {
  const upstream = findFence(upstreamText, name);
  if (!upstream) throw new FenceError(`upstream has no gearbox:${name} fence`);
  const local = findFence(localText, name);
  if (!local) return { state: "missing", local: null, upstream };
  if (local.actualHash !== local.hash) return { state: "hand-edited", local, upstream };
  if (local.hash !== upstream.hash || local.version !== upstream.version)
    return { state: "behind", local, upstream };
  return { state: "synced", local, upstream };
}
```

- [ ] **Step 4: Run it and watch it pass.** Run `node --test test/*.test.js`. Expected: all fence tests pass.
- [ ] **Step 5: Commit.**

```bash
git add scripts/lib/fence.js test/fence.test.js
git commit -m "feat(lib): protocol fence parser + hash (ADR-0050 groundwork)

Every later tool reads and writes fences through this one module, so marker
grammar and hash normalization live in exactly one place. Malformed markers are
hard errors: a guessed fence boundary would silently rewrite project text.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `scripts/lib/sections.js`

**Files:**
- Create: `scripts/lib/sections.js`
- Test: `test/sections.test.js`

**Interfaces:**
- Produces:
  - `headings(text) → [{ index, level, title }]` — ignores lines inside ``` blocks.
  - `baseTitle(title) → string` — strips a trailing `(…)` / `（…）`.
  - `hasHeading(text, level, title, {prefix}) → boolean`
  - `sectionBody(text, level, title, {prefix}) → string|null`
  - `splitByLevel(text, level) → [{ title: string|null, level, heading: string|null, lines: string[] }]` — splits only at headings of exactly `level`; chunk 0 is the preamble.
  - `sectionSizes(text) → [{ title, bytes }]` — level-2 chunks, largest first.

- [ ] **Step 1: Write the failing test** — `test/sections.test.js`:

```js
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
```

- [ ] **Step 2: Run it and watch it fail.** Run `node --test test/*.test.js`. Expected: FAIL, `Cannot find module .../sections.js`.
- [ ] **Step 3: Implement** — `scripts/lib/sections.js`:

```js
// Markdown heading helpers for AGENTS.md / CONTEXT.md. A line inside a ``` block is never a
// heading (a `# comment` in a bash block is not an H1).

function toLines(text) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

export function headings(text) {
  const out = [];
  let inCode = false;
  const lines = toLines(text);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = line.match(/^(#{1,6}) (.+?)\s*$/);
    if (m) out.push({ index: i, level: m[1].length, title: m[2] });
  }
  return out;
}

export function baseTitle(title) {
  return title.replace(/\s*[(（][^()（）]*[)）]\s*$/, "").trim();
}

function matches(h, level, title, prefix) {
  return h.level === level && (prefix ? h.title.startsWith(title) : h.title === title);
}

export function hasHeading(text, level, title, { prefix = false } = {}) {
  return headings(text).some((h) => matches(h, level, title, prefix));
}

export function sectionBody(text, level, title, { prefix = false } = {}) {
  const lines = toLines(text);
  const hs = headings(text);
  const i = hs.findIndex((h) => matches(h, level, title, prefix));
  if (i === -1) return null;
  const next = hs.slice(i + 1).find((h) => h.level <= level);
  return lines.slice(hs[i].index + 1, next ? next.index : lines.length).join("\n");
}

export function splitByLevel(text, level) {
  const lines = toLines(text);
  const chunks = [];
  let current = { title: null, level: 0, heading: null, start: 0 };
  for (const h of headings(text).filter((x) => x.level === level)) {
    chunks.push({ ...current, lines: lines.slice(current.start, h.index) });
    current = { title: h.title, level: h.level, heading: lines[h.index], start: h.index + 1 };
  }
  chunks.push({ ...current, lines: lines.slice(current.start) });
  return chunks.map(({ start, ...c }) => c);
}

export function sectionSizes(text) {
  return splitByLevel(text, 2)
    .map((c) => ({
      title: c.title ?? "(preamble)",
      bytes: Buffer.byteLength([...(c.heading ? [c.heading] : []), ...c.lines].join("\n") + "\n"),
    }))
    .sort((a, b) => b.bytes - a.bytes);
}
```

- [ ] **Step 4: Run it and watch it pass.** Run `node --test test/*.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add scripts/lib/sections.js test/sections.test.js
git commit -m "feat(lib): code-block-aware markdown section helpers

The check and the migration both slice AGENTS.md by heading; a Gate code block
holding a '# comment' must not be read as an H1, or the slicing moves project text.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `scripts/lib/skeleton.js` + `scripts/lib/workflows.js`

**Files:**
- Create: `scripts/lib/skeleton.js`, `scripts/lib/workflows.js`
- Test: `test/skeleton.test.js`

**Interfaces:**
- Consumes: nothing (pure strings).
- Produces:
  - `buildAgentsMd({ title, intro, head, techStack, hardRules, gate, gateNotes, maintainer, protocolBlock, localExtensions, divisionOfLabor, extraSections, whereToFind }) → string`
  - `buildContextMd({ title, head, glossaryBlock, projectTerms }) → string`
  - Constants: `SOT_NOTE`, `LOCAL_EXTENSIONS_NOTE`, `GATE_NOTE`, `DEFAULT_DIVISION`, `INDEX_POINTERS`, `PLACEHOLDERS`, `CONTEXT_INTRO`, `PROJECT_TERMS`
  - `ciYml(gateCmd) → string`, `SYNC_YML`, `CHECK_YML`, `pinSyncYml(text) → string`

- [ ] **Step 1: Write the failing test** — `test/skeleton.test.js`:

```js
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
```

- [ ] **Step 2: Run it and watch it fail.** Run `node --test test/*.test.js`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** — `scripts/lib/skeleton.js`:

```js
// v2 AGENTS.md / CONTEXT.md assembly (ADR-0050). install builds a fresh skeleton with
// placeholders; the v1 → v2 migration fills the same skeleton with the project's own
// content. Fence blocks are passed in verbatim — nothing here edits protocol text.

export const SOT_NOTE = [
  "> This file is the single source of truth for ALL AI coding agents, whatever the tool (Claude Code, Z Code, Cursor, Codex, etc.). Rules live here and only here.",
  "> The block between the `gearbox:protocol` markers is the Gearbox protocol, managed by `gearbox-agents` — don't edit it. Project rules go in the sections outside it.",
].join("\n");

export const LOCAL_EXTENSIONS_NOTE =
  "> Project additions to the fenced protocol. Each `###` entry names the fenced section it extends (`- Extends:`) and where it stands upstream (`- Upstream:` an upstream issue link, `project-specific`, or `undecided`). An entry is tiered as if it were written into the section it extends (ADR-0006/0012).";

export const GATE_NOTE =
  "> The Gate contract (what must be green, and when) is in the protocol below. This section holds only this project's command; `.github/workflows/ci.yml` runs it byte-for-byte.";

export const DEFAULT_DIVISION =
  "No fixed division of labor (ADR-0008 option 2): Task-issue claim-based ownership — whoever claims a task sees it through start to finish.";

export const INDEX_POINTERS = [
  "- `CONTEXT.md` — domain glossary (protocol terms, fenced + this project's terms)",
  "- `docs/gearbox-adr/` — protocol ADRs (managed by tooling — don't hand-edit)",
  "- `docs/adr/` — this project's own architectural decisions",
  "- `docs/INDEX.md` — the full map of where things live (kept out of this file so it stays within 32 KiB)",
].join("\n");

export const PLACEHOLDERS = {
  intro: "<One sentence: what this project is, what counts as done, what the scope boundaries are.>",
  techStack: "<Project tech stack, one per line. Example: Next.js 15 / TypeScript / Postgres>",
  hardRules:
    "<Project rules that must not be violated, one per line. Example: money is always cents + BigInt; never expose SECRET_* to the client.>",
  gate: "<gate command, e.g.: npx tsc --noEmit && npx vitest run>",
  maintainer: "<maintainer>",
  localExtensions: "(none yet)",
  divisionOfLabor: [
    "<Pick one (ADR-0008), then delete this line and the other two options:>",
    "",
    "1. **Fill it in**: which kind of task goes to which agent (split by capability, not tied to a specific tool).",
    "2. **Leave it blank**: the default rule = **Task-issue claim-based ownership** — whoever claims a task sees it through start to finish; tasks aren't routed by agent specialty.",
    '3. **Single-agent project**: write "Single-agent project — no division of labor."',
  ].join("\n"),
  whereToFind: [
    "- `CONTEXT.md` — domain glossary (protocol terms, fenced + this project's terms)",
    "- `docs/gearbox-adr/` — protocol ADRs (managed by tooling — don't hand-edit)",
    "- `docs/adr/` — this project's own architectural decisions",
    "- <one line per entry: `path` — what's there. Longer maps go in `docs/INDEX.md`>",
  ].join("\n"),
};

export const CONTEXT_INTRO =
  "Domain glossary. All agents' understanding of domain terms is grounded here; code naming stays consistent with the terms defined here.";

export const PROJECT_TERMS = "## Project terms\n\n| Term | Definition | Notes |\n|---|---|---|";

export function buildAgentsMd({
  title = "Project",
  intro = PLACEHOLDERS.intro,
  head = null,
  techStack = PLACEHOLDERS.techStack,
  hardRules = PLACEHOLDERS.hardRules,
  gate = null,
  gateNotes = "",
  maintainer = null,
  protocolBlock,
  localExtensions = PLACEHOLDERS.localExtensions,
  divisionOfLabor = PLACEHOLDERS.divisionOfLabor,
  extraSections = [],
  whereToFind = PLACEHOLDERS.whereToFind,
}) {
  if (!protocolBlock) throw new Error("buildAgentsMd needs the protocol fence block");
  const top = (head ?? `# ${title}\n\n${intro}\n\n${SOT_NOTE}`).trim();
  const gateBody = [
    "```bash",
    (gate || PLACEHOLDERS.gate).trim(),
    "```",
    "",
    GATE_NOTE,
    ...(gateNotes.trim() ? ["", gateNotes.trim()] : []),
  ].join("\n");
  return (
    [
      top,
      `## Tech stack\n\n${techStack.trim()}`,
      `## Hard rules\n\n${hardRules.trim()}`,
      `## Gate\n\n${gateBody}`,
      `## Maintainer\n\nGitHub account: \`${maintainer || PLACEHOLDERS.maintainer}\``,
      protocolBlock.trim(),
      `## Local protocol extensions\n\n${LOCAL_EXTENSIONS_NOTE}\n\n${localExtensions.trim()}`,
      `## Division of labor\n\n${divisionOfLabor.trim()}`,
      ...extraSections.map((s) => s.trim()).filter(Boolean),
      `## Where to find things\n\n${whereToFind.trim()}`,
    ].join("\n\n") + "\n"
  );
}

export function buildContextMd({ title = "Project", head = null, glossaryBlock, projectTerms = PROJECT_TERMS }) {
  if (!glossaryBlock) throw new Error("buildContextMd needs the glossary fence block");
  const top = (head ?? `# Domain context — ${title}\n\n${CONTEXT_INTRO}`).trim();
  return [top, glossaryBlock.trim(), projectTerms.trim()].join("\n\n") + "\n";
}
```

- [ ] **Step 4: Implement** — `scripts/lib/workflows.js`. The `ciYml` body is the current install template; `SYNC_YML` is the current template with `@latest` → `@2`, the ADR-0050 wording and `@v5` actions.

```js
// Workflow templates written into downstream repos. gearbox-check.yml is tool-owned
// (ADR-0051): gearbox-update rewrites it whenever it differs from CHECK_YML.

export function ciYml(gateCmd) {
  return `name: gate

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      # IMPORTANT: keep this identical to the Gate section in AGENTS.md.
      # That sameness is the contract that lets CI enforce what agents promise.
      - run: ${gateCmd || "echo '<fill in the Gate command, byte-identical to the Gate section in AGENTS.md>' && exit 1"}
`;
}

export const SYNC_YML = `name: gearbox-sync

# Scheduled protocol auto-update (gearbox ADR-0049, fences ADR-0050).
# Weekly: checks the gearbox npm package (major version pinned), and when the
# protocol moved, opens a backfill PR (docs/gearbox-backfill-*) that rewrites the
# protocol fences and copies new protocol ADRs. Merging stays a human/agent
# decision in this repo (L1). Opt out by deleting this file — the shift-start
# self-check (gearbox-version) keeps working without it.

on:
  schedule:
    - cron: "17 3 * * 1"
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Skip if a backfill PR is already open
        id: guard
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          OPEN=\$(gh pr list --repo "\$GITHUB_REPOSITORY" --state open --json headRefName --jq '[.[] | select(.headRefName | startswith("docs/gearbox-backfill-"))] | length')
          if [ "\$OPEN" != "0" ]; then
            echo "Previous backfill PR still open — merge it first. Skipping."
            echo "skip=true" >> "\$GITHUB_OUTPUT"
          else
            echo "skip=false" >> "\$GITHUB_OUTPUT"
          fi
      - uses: actions/checkout@v5
        if: steps.guard.outputs.skip == 'false'
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v5
        if: steps.guard.outputs.skip == 'false'
        with:
          node-version: 24
      - name: Git identity for backfill commits
        if: steps.guard.outputs.skip == 'false'
        run: |
          git config user.name "gearbox-sync[bot]"
          git config user.email "gearbox-sync-bot@users.noreply.github.com"
      - name: Run gearbox-update
        if: steps.guard.outputs.skip == 'false'
        run: npx -y gearbox-agents@2 update --refresh-drift
      - name: Open the backfill PR
        if: steps.guard.outputs.skip == 'false'
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          BRANCH=\$(git for-each-ref --format='%(refname:short)' 'refs/heads/docs/gearbox-backfill-*' | tail -1)
          if [ -z "\$BRANCH" ]; then
            echo "Nothing to sync — protocol is current."
            exit 0
          fi
          gh pr create --head "\$BRANCH" \\
            --title "gearbox: protocol backfill (\$BRANCH)" \\
            --body-file gearbox-update-report.md \\
            || echo "PR creation failed — if the log above says GitHub Actions may not create pull requests, enable it in Settings → Actions → General → Workflow permissions. The sync branch is already pushed."
`;

export const CHECK_YML = `name: gearbox-check

# Protocol check (gearbox ADR-0051): fences intact, AGENTS.md within 32 KiB,
# required sections present, CI runs the Gate command. Read-only and offline.
# Tool-owned: gearbox-agents update rewrites this file when the template changes.

on:
  pull_request:
  push:
    branches: [main, master]

permissions:
  contents: read

jobs:
  protocol:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      - run: npx -y gearbox-agents@2 check
`;

export function pinSyncYml(text) {
  return text.replace(/gearbox-agents@latest/g, "gearbox-agents@2");
}
```

- [ ] **Step 5: Run it and watch it pass.** Run `node --test test/*.test.js`. Expected: PASS.
- [ ] **Step 6: Commit.**

```bash
git add scripts/lib/skeleton.js scripts/lib/workflows.js test/skeleton.test.js
git commit -m "feat(lib): v2 skeleton builder + workflow templates

install and the v1 migration must produce the same layout; one builder keeps
them from drifting. Workflow templates move out of install so update can write
gearbox-check.yml too, and the sync template pins @2 instead of @latest.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `scripts/lib/protocol-check.js` + `gearbox-check` CLI + `check` route

**Files:**
- Create: `scripts/lib/protocol-check.js`, `scripts/gearbox-check`, `test/helpers.js`
- Modify: `bin/gearbox.js` (ROUTES + help text)
- Test: `test/protocol-check.test.js`

**Interfaces:**
- Consumes: `findFence`, `FenceError` (Task 1); `headings`, `sectionBody`, `sectionSizes` (Task 2); `buildAgentsMd`, `buildContextMd` (Task 3, tests only); `ciYml` (tests only).
- Produces:
  - `runProtocolChecks(root, { upstream }) → { errors: string[], warnings: string[], protocol: Fence|null, glossary: Fence|null }`
  - `gateCommand(agentsText) → string[]|null`
  - `maintainerAccount(agentsText) → string|null`
  - `AGENTS_MAX_BYTES = 32768`, `PROTOCOL_FENCE_MAX_BYTES = 20480`
  - `test/helpers.js`: `REPO`, `tmp`, `write`, `read`, `git`, `gitInit`, `commitAll`, `runTool`, `PROTOCOL`, `GLOSSARY`, `v2Repo`, `makeUpstream`

- [ ] **Step 1: Write the shared test helpers** — `test/helpers.js`:

```js
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
```

- [ ] **Step 2: Write the failing test** — `test/protocol-check.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { runProtocolChecks, gateCommand, maintainerAccount, AGENTS_MAX_BYTES } from "../scripts/lib/protocol-check.js";
import { renderFence } from "../scripts/lib/fence.js";
import { v2Repo, write, read, gitInit, runTool, tmp, PROTOCOL } from "./helpers.js";

const errorsOf = (dir, opts) => runProtocolChecks(dir, opts).errors;

test("a clean v2 repo passes", () => {
  assert.deepEqual(errorsOf(v2Repo()), []);
});

test("a hand-edited fence is an error that names the fix", () => {
  const dir = v2Repo();
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  const errs = errorsOf(dir);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /edited by hand/);
  assert.match(errs[0], /update --force/);
});

test(".gearbox-version must equal the fence version downstream, not upstream", () => {
  const dir = v2Repo({ stamp: "v1.15.0" });
  assert.match(errorsOf(dir).join("\n"), /\.gearbox-version is "v1\.15\.0"/);
  assert.deepEqual(errorsOf(dir, { upstream: true }), []);
});

test("AGENTS.md over 32 KiB is an error listing the largest sections", () => {
  const dir = v2Repo({ whereToFind: `- ${"x".repeat(AGENTS_MAX_BYTES)}` });
  assert.match(errorsOf(dir).join("\n"), /over the 32768-byte budget.*Where to find things/);
});

test("missing project sections and missing fence headings are errors", () => {
  const dir = v2Repo();
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("## Maintainer\n", "## Owner\n"));
  assert.match(errorsOf(dir).join("\n"), /missing the project section "## Maintainer"/);
});

test("CI must run every Gate line; trailing comments are ignored; placeholders fail", () => {
  assert.match(errorsOf(v2Repo({ ci: "jobs: {}\n" })).join("\n"), /doesn't run the Gate command line `npm test`/);
  const commented = v2Repo({ gate: "npm test   # offline suite\nnpm run lint", ci: "- run: npm test\n- run: npm run lint\n" });
  assert.deepEqual(errorsOf(commented), []);
  assert.match(errorsOf(v2Repo({ gate: "<gate command, e.g.: npm test>" })).join("\n"), /placeholder command/);
});

test("CLAUDE.md shell, HANDOFF.md and gitignored protocol files", () => {
  const dir = v2Repo();
  write(dir, "CLAUDE.md", "rules here\n");
  write(dir, "HANDOFF.md", "x\n");
  gitInit(dir);
  write(dir, ".gitignore", "CONTEXT.md\n");
  const all = errorsOf(dir).join("\n");
  assert.match(all, /CLAUDE\.md must be exactly '@AGENTS\.md'/);
  assert.match(all, /HANDOFF\.md must not exist/);
  assert.match(all, /must not be gitignored: CONTEXT\.md/);
});

test("warnings: placeholder maintainer, undecided / missing Upstream lines", () => {
  const dir = v2Repo({
    maintainer: null,
    localExtensions: "### Worktree discipline\n\n- Extends: While working\n- Upstream: undecided\n\nx\n\n### No upstream line\n\ny",
  });
  const { errors, warnings } = runProtocolChecks(dir);
  assert.deepEqual(errors, []);
  assert.match(warnings.join("\n"), /names no GitHub account/);
  assert.match(warnings.join("\n"), /"Worktree discipline" is "Upstream: undecided"/);
  assert.match(warnings.join("\n"), /"No upstream line" has no "- Upstream:" line/);
});

test("upstream mode enforces the 20 KiB protocol-fence budget", () => {
  const dir = v2Repo();
  const agents = read(dir, "AGENTS.md");
  const big = renderFence("protocol", "v2.0.0", `${PROTOCOL}\n\n${"z".repeat(21000)}`);
  const start = agents.indexOf("<!-- gearbox:protocol");
  const end = agents.indexOf("<!-- /gearbox:protocol -->") + "<!-- /gearbox:protocol -->".length;
  write(dir, "AGENTS.md", agents.slice(0, start) + big + agents.slice(end));
  assert.match(errorsOf(dir, { upstream: true }).join("\n"), /20480-byte upstream budget/);
});

test("gateCommand and maintainerAccount read the project sections", () => {
  const md = read(v2Repo({ gate: "npm test  # x\nnpx tsc --noEmit" }), "AGENTS.md");
  assert.deepEqual(gateCommand(md), ["npm test", "npx tsc --noEmit"]);
  assert.equal(maintainerAccount(md), "octo");
});

test("gearbox-check CLI exits 0 on a clean repo and 1 with errors", () => {
  assert.equal(runTool("gearbox-check", [], { cwd: v2Repo() }).code, 0);
  const bad = runTool("gearbox-check", [], { cwd: tmp() });
  assert.equal(bad.code, 1);
  assert.match(bad.out, /AGENTS\.md is missing/);
});
```

- [ ] **Step 3: Run it and watch it fail.** Run `node --test test/*.test.js`. Expected: FAIL, `protocol-check.js` not found.
- [ ] **Step 4: Implement** — `scripts/lib/protocol-check.js`:

```js
// Shared protocol assertions (ADR-0051). Downstream: `gearbox-agents check` (CI job
// gearbox-check). Upstream: scripts/check-gearbox.js runs them in upstream mode, which skips
// .gearbox-version and adds the protocol-fence budget.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { findFence, FenceError } from "./fence.js";
import { headings, sectionBody, sectionSizes } from "./sections.js";

export const AGENTS_MAX_BYTES = 32768;
export const PROTOCOL_FENCE_MAX_BYTES = 20480;
export const PROJECT_HEADINGS = ["Tech stack", "Hard rules", "Gate", "Maintainer", "Local protocol extensions", "Where to find things"];
export const FENCE_HEADINGS = [
  [2, "Working agreement (multi-agent)"],
  [3, "On starting a shift"],
  [3, "While working"],
  [3, "Roles of issues & PRs"],
  [3, "PR disposition"],
  [3, "Changing the protocol itself"],
  [3, "Gate contract"],
  [3, "On ending a shift"],
];
export const NEVER_IGNORED = ["AGENTS.md", "CLAUDE.md", "CONTEXT.md", "docs/gearbox-adr", ".gearbox-version", ".github/workflows/ci.yml"];

// Non-empty lines of the first ``` block under "## Gate", trailing "# comments" stripped.
export function gateCommand(agentsText) {
  const body = sectionBody(agentsText, 2, "Gate");
  if (body === null) return null;
  const m = body.match(/```[^\n]*\n([\s\S]*?)\n```/);
  if (!m) return null;
  return m[1].split("\n").map((l) => l.replace(/\s+#.*$/, "").trim()).filter(Boolean);
}

export function maintainerAccount(agentsText) {
  const body = sectionBody(agentsText, 2, "Maintainer");
  const m = body && body.match(/GitHub account:\s*`([^`]+)`/);
  return m ? m[1] : null;
}

function withoutFence(text, fence) {
  if (!fence) return text;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return [...lines.slice(0, fence.beginLine), ...lines.slice(fence.endLine + 1)].join("\n");
}

function inGit(root) {
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isIgnored(root, path) {
  try {
    execSync(`git check-ignore -q "${path}"`, { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function runProtocolChecks(root, { upstream = false } = {}) {
  const errors = [];
  const warnings = [];
  const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), "utf8") : null);
  const agents = read("AGENTS.md");
  const context = read("CONTEXT.md");
  if (agents === null) errors.push("AGENTS.md is missing");
  if (context === null) errors.push("CONTEXT.md is missing");

  const fenceOf = (text, file, name) => {
    if (text === null) return null;
    try {
      const f = findFence(text, name);
      if (!f) errors.push(`${file} has no gearbox:${name} fence — run \`npx gearbox-agents update\` (a v1 layout is migrated automatically, ADR-0050)`);
      return f;
    } catch (e) {
      if (!(e instanceof FenceError)) throw e;
      errors.push(`${file}: ${e.message}`);
      return null;
    }
  };
  const protocol = fenceOf(agents, "AGENTS.md", "protocol");
  const glossary = fenceOf(context, "CONTEXT.md", "glossary");

  for (const [file, f, home] of [["AGENTS.md", protocol, "## Local protocol extensions"], ["CONTEXT.md", glossary, "## Project terms"]]) {
    if (f && f.actualHash !== f.hash)
      errors.push(`${file}: the gearbox:${f.name} fence was edited by hand (marker sha256:${f.hash}, content sha256:${f.actualHash}) — move project text to "${home}", then re-apply upstream's fence with \`npx gearbox-agents update --force\` (ADR-0050)`);
  }
  if (protocol && glossary && protocol.version !== glossary.version)
    errors.push(`fence versions differ: protocol ${protocol.version}, glossary ${glossary.version} — both markers always carry the protocol version (ADR-0050)`);
  if (!upstream && protocol) {
    const stamp = (read(".gearbox-version") || "").split("\n")[0].trim();
    if (stamp !== protocol.version)
      errors.push(`.gearbox-version is "${stamp || "(missing)"}" but the protocol fence is ${protocol.version} — they must match (ADR-0050)`);
  }

  if (agents !== null) {
    const bytes = Buffer.byteLength(agents);
    if (bytes > AGENTS_MAX_BYTES) {
      const top = sectionSizes(agents).slice(0, 4).map((s) => `${s.title} ${s.bytes} B`).join(", ");
      errors.push(`AGENTS.md is ${bytes} bytes, over the ${AGENTS_MAX_BYTES}-byte budget (ADR-0051; Codex reads only the first 32 KiB by default). Largest sections: ${top}. Move long maps to docs/INDEX.md and keep "Where to find things" to one line per entry`);
    }
    const outside = withoutFence(agents, protocol);
    const outsideHeadings = headings(outside);
    for (const t of PROJECT_HEADINGS)
      if (!outsideHeadings.some((h) => h.level === 2 && h.title === t))
        errors.push(`AGENTS.md is missing the project section "## ${t}" (outside the protocol fence)`);
    if (protocol) {
      const inside = headings(protocol.content);
      for (const [level, t] of FENCE_HEADINGS)
        if (!inside.some((h) => h.level === level && (level === 2 ? h.title === t : h.title.startsWith(t))))
          errors.push(`the protocol fence is missing "${"#".repeat(level)} ${t}"`);
      const fenceBytes = Buffer.byteLength(protocol.content);
      if (upstream && fenceBytes > PROTOCOL_FENCE_MAX_BYTES)
        errors.push(`the protocol fence is ${fenceBytes} bytes, over the ${PROTOCOL_FENCE_MAX_BYTES}-byte upstream budget (ADR-0051) — move rationale into ADRs`);
    }

    const gate = gateCommand(agents);
    const ci = read(".github/workflows/ci.yml");
    if (!gate || gate.length === 0) errors.push('AGENTS.md "## Gate" has no fenced command block');
    else if (gate.some((l) => /^<.*>$/.test(l)))
      errors.push('AGENTS.md "## Gate" still holds the placeholder command — fill it in, and the same command in .github/workflows/ci.yml');
    else if (ci === null) errors.push(".github/workflows/ci.yml is missing (CI == Gate contract)");
    else for (const l of gate) if (!ci.includes(l)) errors.push(`.github/workflows/ci.yml doesn't run the Gate command line \`${l}\` (CI == Gate contract)`);

    const m = maintainerAccount(agents);
    if (!m || m === "<maintainer>")
      warnings.push('"## Maintainer" names no GitHub account yet — L1 approval has nothing to verify against (ADR-0034)');

    const ext = sectionBody(outside, 2, "Local protocol extensions");
    if (ext !== null) {
      for (const part of ext.split(/\n(?=### )/).filter((p) => p.startsWith("### "))) {
        const title = part.split("\n")[0].slice(4).trim();
        const up = part.match(/^- Upstream:\s*(.+)$/m);
        if (!up) warnings.push(`local extension "${title}" has no "- Upstream:" line`);
        else if (/^undecided/i.test(up[1].trim()))
          warnings.push(`local extension "${title}" is "Upstream: undecided" — decide: an upstream issue link, or project-specific`);
      }
    }
  }

  const claude = read("CLAUDE.md");
  if (claude === null || claude.trim() !== "@AGENTS.md")
    errors.push("CLAUDE.md must be exactly '@AGENTS.md' (the empty-shell contract; rules live only in AGENTS.md)");
  if (existsSync(join(root, "HANDOFF.md"))) errors.push("HANDOFF.md must not exist (progress lives in issues/PRs)");
  if (inGit(root))
    for (const f of NEVER_IGNORED)
      if (isIgnored(root, f)) errors.push(`protocol file must not be gitignored: ${f} (ADR-0037 — it would never reach the next shift's clone)`);

  return { errors, warnings, protocol, glossary };
}
```

- [ ] **Step 5: Implement the CLI** — `scripts/gearbox-check`, then run `chmod +x scripts/gearbox-check`:

```js
#!/usr/bin/env node
// gearbox-check — offline protocol check for a Gearbox repo (ADR-0051). Read-only; exit 1 on
// any error, warnings don't fail. Runs as the downstream CI job gearbox-check and at shift-end;
// the upstream self-check (scripts/check-gearbox.js) runs the same assertions in upstream mode.
import { cwd, exit, argv } from "node:process";
import { runProtocolChecks } from "./lib/protocol-check.js";

if (argv.includes("--help") || argv.includes("-h")) {
  console.log("gearbox-check — verify the protocol fences, the AGENTS.md size budget, required sections and the CI == Gate contract (read-only, offline)");
  exit(0);
}

const { errors, warnings } = runProtocolChecks(cwd());
for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length > 0) {
  console.error(`\n✖ gearbox check failed (${errors.length}):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error("");
  exit(1);
}
console.log("✅ gearbox check passed — fences intact, AGENTS.md within budget, CI runs the Gate.");
```

- [ ] **Step 6: Add the `check` route** — in `bin/gearbox.js`:
  - Add `check: { cmd: "node", file: "scripts/gearbox-check" }, // offline protocol check (ADR-0051)` to `ROUTES`, after `update`.
  - Add a help line after the `update` line: `"  check     offline protocol check: fences intact, AGENTS.md ≤ 32 KiB, CI == Gate (ADR-0051)\n" +`.
  - Change the header comment's `<install|version|update>` to `<install|version|update|check|prune>`.
- [ ] **Step 7: Run it and watch it pass.** Run `node --test test/*.test.js && node scripts/check-gearbox.js`. Expected: all tests pass; the old self-check still passes.
- [ ] **Step 8: Commit.**

```bash
git add scripts/lib/protocol-check.js scripts/gearbox-check bin/gearbox.js test/helpers.js test/protocol-check.test.js
git commit -m "feat: gearbox-agents check — offline protocol check (ADR-0051 groundwork)

Downstream CI never verified anything about the protocol: a hand-edited or
translated protocol body, a 324 KB AGENTS.md and a Gate that CI doesn't run all
passed silently. One assertion set now serves downstream CI and the upstream gate.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Restructure upstream `AGENTS.md` / `CONTEXT.md` into the v2 layout; rewrite the upstream gate

**Files:**
- Create: `scripts/dev/rehash-fences.js`
- Modify: `AGENTS.md`, `CONTEXT.md`, `package.json` (version `2.0.0`), `.github/workflows/ci.yml`
- Rewrite: `scripts/check-gearbox.js`

**Interfaces:**
- Consumes: `findFence`, `renderFence`, `replaceFence` (Task 1); `runProtocolChecks` (Task 4).
- Produces: the upstream fences that every later task copies. Gate command = `node scripts/check-gearbox.js && node --test test/*.test.js`.

- [ ] **Step 1: Write the rehash helper** — `scripts/dev/rehash-fences.js` (then `chmod +x`):

```js
#!/usr/bin/env node
// Maintainer helper (Gearbox repo only, ADR-0050): after editing text between the gearbox
// markers in AGENTS.md or CONTEXT.md, rewrite both markers. The hash is recomputed; when either
// fence's content changed, both versions become package.json's version (both markers always
// carry the protocol version). Unchanged content keeps its version, so a README-only release
// doesn't move the protocol version.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findFence, renderFence, replaceFence } from "../lib/fence.js";

const root = process.cwd();
const pkgVersion = "v" + JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const targets = [["AGENTS.md", "protocol"], ["CONTEXT.md", "glossary"]].map(([file, name]) => {
  const text = readFileSync(join(root, file), "utf8");
  const fence = findFence(text, name);
  if (!fence) {
    console.error(`${file}: no gearbox:${name} fence`);
    process.exit(1);
  }
  return { file, name, text, fence };
});
const changed = targets.some((t) => t.fence.actualHash !== t.fence.hash);
for (const t of targets) {
  const version = changed ? pkgVersion : t.fence.version;
  const next = replaceFence(t.text, t.name, renderFence(t.name, version, t.fence.content));
  if (next !== t.text) writeFileSync(join(root, t.file), next);
  console.log(`${t.file}: gearbox:${t.name} ${version} sha256:${findFence(next, t.name).hash}${changed ? "" : " (unchanged)"}`);
}
```

- [ ] **Step 2: Bump the version.** In `package.json`, set `"version": "2.0.0"`.

- [ ] **Step 3: Restructure `AGENTS.md`** — apply these edits in order (Edit tool, exact strings):

  **3a. Opening blockquote.** Replace the two lines `> This file is the single source of truth for ALL AI coding agents, whatever the tool (Claude Code, Z Code, Cursor, etc.).` and `> Rules live here and only here. Do not duplicate them elsewhere.` with:

  ```
  > This file is the single source of truth for ALL AI coding agents, whatever the tool (Claude Code, Z Code, Cursor, Codex, etc.). Rules live here and only here.
  > The block between the `gearbox:protocol` markers is the Gearbox protocol, managed by `gearbox-agents` — don't edit it. Project rules go in the sections outside it.
  ```

  **3b. Tech stack.** Replace the first Tech stack bullet (`- Node.js (structural self-check script + the full tool family: …, ADR-0016/0017/0022/0030/0035)`) with:

  ```
  - Node.js ≥ 18, no runtime dependencies: the structural self-check (`scripts/check-gearbox.js`), a `node:test` suite (`test/`), and the tool family — `scripts/gearbox-install` scaffold / `scripts/gearbox-version` sync quick-check / `scripts/gearbox-update` downstream sync + v1→v2 migration / `scripts/gearbox-check` protocol check / `scripts/gearbox-prune` branch hygiene — sharing `scripts/lib/` (fence, sections, protocol-check, skeleton, workflows, v1-known, migrate-v1, the TUI animation layer) (ADR-0016/0017/0022/0030/0035/0050/0051)
  ```

  **3c. Hard rules → Hard rules + Gate + Maintainer + fence begin.** Replace everything from `## Hard rules` up to (not including) `## Working agreement (multi-agent)` with the block below. `CMD` stands for a line holding a triple backtick followed by `bash`; `END` for a line with a bare triple backtick.

  ```
  ## Hard rules

  Gearbox's own (dogfood) hard rules are its gate assertions — `scripts/check-gearbox.js` and `test/` are their executable source of truth, so they aren't repeated here. Clauses marked **Hard rule** in the protocol fence below also count as part of this section (see the fence's opening note).

  ## Gate

  CMD
  node scripts/check-gearbox.js && node --test test/*.test.js
  END

  > The Gate contract (what must be green, and when) is in the protocol below. This section holds only this project's command; `.github/workflows/ci.yml` runs it byte-for-byte.

  This repo is the Gearbox core itself, so the gate is a **structural self-check** plus the tool test suite. `check-gearbox.js` verifies required files, the `CLAUDE.md` empty shell, both fences (hash, version, budgets), the section anchors, that `HANDOFF` never appears, and that this Gate matches CI. `node --test` runs the tool suite (`node:test`, zero dependencies). The glob is expanded by the shell, so the command works on Node 18–24 and never scans `.claude/worktrees/`.

  ## Maintainer

  GitHub account: `real-stanyan`

  <!-- gearbox:protocol v2.0.0 sha256:000000000000; managed by gearbox-agents, do not edit by hand; project additions go in "## Local protocol extensions" -->
  ```

  **3d. Fence opening note.** Directly after the `## Working agreement (multi-agent)` line (and its blank line), insert:

  ```
  > This block is the Gearbox protocol — byte-identical in every repo that runs it (ADR-0050). In a downstream repo it changes only through `gearbox-agents update`; record project deviations in `## Local protocol extensions` instead of editing here. In the Gearbox repo itself it is edited under the tiers in "Changing the protocol itself".
  >
  > Any clause marked **Hard rule** — in this block, in `## Hard rules`, or in `## Local protocol extensions` — counts as part of the `## Hard rules` section and is protected under L1: the criterion anchors to the marking itself, not to where the clause lives (ADR-0018).

  ```

  **3e. Start-of-shift steps.**
  - Rename the heading `### On starting a shift (the three start-of-shift steps)` → `### On starting a shift (the start-of-shift steps)`.
  - In step 3, replace `Run the gate command (see below) to confirm` → `Run the gate command (\`## Gate\`) to confirm`.
  - Append after step 3:

  ```
  4. (Downstream repos) Run `npx gearbox-agents version`: `behind` → run `npx gearbox-agents update` and merge its `docs/gearbox-backfill-*` PR through this repo's L1 flow (ADR-0026/0050); `hand-edited` → move the local rules into `## Local protocol extensions`, then re-apply the fence with `npx gearbox-agents update --force` — never edit the fence itself; `v1 layout` → `npx gearbox-agents update` migrates it
  ```

  **3f. While working.** Replace the bullet `- Look up domain-term definitions in \`CONTEXT.md\`; add new terms as they come up` with the three bullets:

  ```
  - Look up domain-term definitions in `CONTEXT.md`; add new project terms under its `## Project terms` as they come up (protocol terms live in its fence)
  - **Never edit between the `gearbox:` markers** (in `AGENTS.md` or `CONTEXT.md`). Project rules go in the project sections; additions to the protocol go in `## Local protocol extensions`, each with `- Extends:` (the section it extends) and `- Upstream:` (an upstream issue link, `project-specific`, or `undecided`) (ADR-0050)
  - **Keep `AGENTS.md` within 32 KiB**: every agent loads it in full at session start, and Codex silently drops everything past its first 32 KiB. "Where to find things" gets one line per entry — a path plus what's there; longer maps go in `docs/INDEX.md`. `gearbox-agents check` enforces the budget (ADR-0051)
  ```

  **3g. `<maintainer>` → the maintainer** (8 occurrences):

  | Old | New |
  |---|---|
  | ``L1 waits for `<maintainer>` agreement`` | `L1 waits for the maintainer's agreement` |
  | ``the `<maintainer>`'s after-the-fact veto`` | `the maintainer's after-the-fact veto` |
  | ``or the `<maintainer>` directs it`` | `or the maintainer directs it` |
  | ``it's enough for the `<maintainer>` to say`` | `it's enough for the maintainer to say` |
  | ``only a comment authored by the GitHub account `<maintainer>` names counts (ADR-0034)`` | `only a comment authored by the maintainer's GitHub account counts (ADR-0034)` |
  | ``A stalled lane is released by the `<maintainer>`:`` | `A stalled lane is released by the maintainer:` |

  The L1 tier-table row becomes:

  ```
  | **L1 strict tier** | Hard rules / Gate command / Tech stack / Maintainer / this section itself | issue + ADR + PR, **and the agent may only merge after the maintainer explicitly agrees, in the session or in a PR comment** |
  ```

  In the L2 row, `Working agreement (except Gate)` → `Working agreement (except the Gate contract)`. Delete the blockquote that starts `> **When you copy this Gearbox: replace \`<maintainer>\``, together with its preceding blank line. Afterwards, `grep -c "<maintainer>" AGENTS.md` must print `0`.

  **3h. Changing the protocol itself.**
  - Directly after its heading line (and blank line), insert:

  ```
  Where the protocol text lives decides how it changes (ADR-0050). In the **Gearbox repo**, the fenced protocol is edited under the tiers below. In a **downstream repo**, the fence changes only through upstream releases (`gearbox-agents update`); a local deviation goes in `## Local protocol extensions` and is tiered as if it were written into the section it extends — the ADR-0012 criterion applies unchanged. "The maintainer" below is the GitHub account named in `## Maintainer` (ADR-0034).

  ```

  - Replace the whole `**Downstream backfill** (ADR-0013, pull trigger see ADR-0026): …` paragraph with:

  ```
  **Protocol updates** (ADR-0026/0050): pull-triggered. Start-of-shift step 4 (`gearbox-agents version`) and the optional weekly `gearbox-sync` Action run `gearbox-agents update`, which rewrites both fences, copies new protocol ADRs and bumps `.gearbox-version` on a `docs/gearbox-backfill-*` branch; merging that PR adopts the new protocol version and is L1 in the receiving repo. The fence markers and `.gearbox-version` carry the protocol version — tooling maintains them, humans don't. (The upstream-side release rules — the `Affects downstream` declaration, version bumps, tags, npm publish — are the Gearbox repo's own local extension.)
  ```

  - Delete the whole `**Protocol version number** (ADR-0023): …` paragraph (it moves to 3l).

  **3i. Gate → Gate contract.** Replace everything from `### Gate (the hard gate — must be all-green before shift-end)` up to (not including) `### On ending a shift` with:

  ```
  ### Gate contract (must be all-green before merge and shift-end)

  The Gate command lives in the project's `## Gate` section. CI's `gate` job (`.github/workflows/ci.yml`) runs it byte-for-byte — the CI == Gate contract. The `gearbox-check` job runs `npx gearbox-agents check`: fences intact, `AGENTS.md` within 32 KiB, required sections present, CI == Gate (ADR-0051; in the Gearbox repo, `scripts/check-gearbox.js` runs the same checks inside the gate). Both must be green to merge; if either is red, merging is not allowed.

  ```

  **3j. On ending a shift and Branch hygiene.**
  - Rule 1: `1. The gate is all-green` → `1. The gate and the protocol check are green (see Gate contract)`.
  - Branch hygiene: `run \`npx gearbox-agents prune\` (in this repo you can run \`node scripts/gearbox-prune\` directly). It cleans` → `run \`npx gearbox-agents prune\`. It cleans`.

  **3k. Division of labor + fence end.** Replace the whole `### Division of labor (optional, fill in as needed)` subsection (heading and its three options) with:

  ```
  ### Division of labor

  Division of labor is a project property, declared in the project's `## Division of labor` section (ADR-0008). When that section is absent or blank, the default applies: **Task-issue claim-based ownership** — whoever claims a task sees it through start to finish; tasks aren't routed by agent specialty.
  <!-- /gearbox:protocol -->
  ```

  **3l. Local extensions, Division of labor, Where to find things.** Replace the old `## Where to find things` section (heading to end of file) with:

  ```
  ## Local protocol extensions

  > Project additions to the fenced protocol. Each `###` entry names the fenced section it extends (`- Extends:`) and where it stands upstream (`- Upstream:` an upstream issue link, `project-specific`, or `undecided`). An entry is tiered as if it were written into the section it extends (ADR-0006/0012).

  ### Upstream release process (Gearbox repo only)

  - Extends: Changing the protocol itself
  - Upstream: n/a — this is the upstream

  **Editing the fences** (ADR-0050): after changing anything between the `gearbox:` markers in `AGENTS.md` or `CONTEXT.md`, set `package.json`'s version to this change's target version, then run `node scripts/dev/rehash-fences.js` — it rewrites both markers' hash and, when content changed, their version. The self-check fails when a marker's hash doesn't match its content, and when fence content differs from the latest tag's while the marker version ≠ `package.json`'s.

  **Downstream impact declaration** (ADR-0013, pull model ADR-0026): every protocol-change PR declares `Affects downstream` in the PR body (`yes`/`no` + one reason). It's informational — it helps gauge blast radius, it opens no per-downstream issues and doesn't block merge. A maintainer running a private fleet may optionally open notification issues against known downstream projects (fleet notes live outside the template, ADR-0033).

  **Version numbers** (ADR-0023, split by ADR-0050): a semver variant, baseline `v0.0.0`. Segment criterion — **major** = a cross-tool/cross-repo contract change (hash stamp format, install-anchor structure, file layout, renames) that needs manual intervention for downstream backfill; **minor** = a new mechanism (new ADR / new tool / new protocol clause); **patch** = a revision to an existing file (wording, a status line, a typo). There are two numbers: the **package version** (`package.json` = the git tag) moves on every release; the **protocol version** (the fence markers) moves only when fence content changes, and then equals that release's package version. Process (ADR-0029): the PR body declares `Version bump: major|minor|patch|none` (`none` needs one reason, enforced via the PR template); in the same PR the author sets `package.json`'s `version` to the target (latest tag + segment, ADR-0028) and reruns `rehash-fences.js` if fences changed; after merge **the author agent** pushes an annotated tag based on the latest tag at merge time; **then the maintainer runs `npm publish`** (it hits an external registry and needs credentials, so agents don't run it). A `none` segment triggers no tag/publish and doesn't touch `package.json`'s version. No CHANGELOG — the tag message + the ADR are the change record.

  ## Division of labor

  No fixed division of labor (ADR-0008 option 2): Task-issue claim-based ownership — whoever claims a task sees it through start to finish.

  ## Where to find things

  - `CONTEXT.md` — domain glossary (protocol terms fenced + Gearbox's own terms)
  - `docs/gearbox-adr/` — protocol ADRs (downstream copies are managed by tooling — never hand-edited there)
  - `docs/superpowers/` — design specs and implementation plans
  - `scripts/` — gate self-check (`check-gearbox.js`), the tool family, shared modules in `scripts/lib/`, maintainer helpers in `scripts/dev/` (ADR-0016/0017/0022/0030/0035/0050/0051)
  - `test/` — tool test suite (`node:test`, fixtures in `test/fixtures/`)
  - `site/` — landing page (Vercel; not in the npm package)
  ```

- [ ] **Step 4: Restructure `CONTEXT.md`.**
  - Replace `## Terms` with two lines: the begin marker `<!-- gearbox:glossary v2.0.0 sha256:000000000000; managed by gearbox-agents, do not edit by hand; project terms go in "## Project terms" -->`, then `## Protocol terms`.
  - Delete the `| Dogfood |` row.
  - Replace these three rows:

  ```
  | gate | The command that must be all-green before merging and before ending a shift. Each repo writes its own in the `## Gate` section of AGENTS.md | CI runs the same command (CI == Gate contract) — red means no merge |
  | backfill | Downstream pulls Gearbox protocol improvements; **pull-triggered** — downstream runs `gearbox-version` at the start of a shift and `gearbox-update` if it's behind (or the weekly `gearbox-sync` Action does), which rewrites both fences and copies new protocol ADRs on a backfill branch; it's alignment, not enforcement — merging the PR is the downstream's L1 decision | ADR-0013 → ADR-0026 → ADR-0050 |
  | protocol version number | A semver-variant version: **major** = cross-tool/cross-repo contract change; **minor** = a new mechanism added; **patch** = revision of an existing file. Two numbers: the package version (package.json = tag) moves every release; the protocol version (the fence markers, mirrored in downstream `.gearbox-version`) moves only when fence content changes | ADR-0023, split by ADR-0050; baseline v0.0.0 |
  ```

  - After the `protocol version number` row, append:

  ```
  | protocol fence | The tool-managed block between `<!-- gearbox:protocol … -->` and `<!-- /gearbox:protocol -->` in AGENTS.md (and `gearbox:glossary` in CONTEXT.md): the Gearbox protocol, byte-identical in every repo for a given protocol version; its marker records the version and a content hash | ADR-0050; downstream never edits it — `gearbox-agents update` rewrites it |
  | local protocol extension | A project's addition to the fenced protocol, written as a `###` entry under `## Local protocol extensions` with `- Extends:` and `- Upstream:` lines | ADR-0050; tiered as if written into the section it extends (ADR-0006/0012) |
  | protocol check | `gearbox-agents check`: offline, read-only verification that the fences are intact, AGENTS.md is within 32 KiB, required sections exist and CI runs the Gate command | ADR-0051; the `gearbox-check` CI job downstream, inside `check-gearbox.js` upstream |
  ```

  - Rename `## Key invariants` → `### Key invariants` (it stays inside the fence).
  - After its last bullet, append the end marker, the Project terms section and the Dogfood row:

  ```
  <!-- /gearbox:glossary -->

  ## Project terms

  | Term | Definition | Notes |
  |---|---|---|
  | Dogfood | This repo develops itself using the protocol it defines | It's a verification method, not the goal itself |
  ```

- [ ] **Step 5: Stamp the fences.** Run `node scripts/dev/rehash-fences.js`. Expected:
  - `AGENTS.md: gearbox:protocol v2.0.0 sha256:<12 hex>`
  - `CONTEXT.md: gearbox:glossary v2.0.0 sha256:<12 hex>`

- [ ] **Step 6: Rewrite `scripts/check-gearbox.js`** (whole file):

```js
#!/usr/bin/env node
// Gearbox structural self-check — the upstream gate (ADR-0002).
//
// The gate asserts Gearbox's own contract holds, so that:
//   - contributors can't accidentally break the template structure
//   - the dogfood rule "CI runs the same command as AGENTS.md's Gate" is real
// Fence / section / budget / CI == Gate assertions are shared with the downstream protocol
// check (scripts/lib/protocol-check.js, ADR-0051) and run here in upstream mode.
//
// Exit non-zero on any violation. Keep assertions structural, not stylistic.

import { readFileSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { runProtocolChecks } from "./lib/protocol-check.js";
import { findFence } from "./lib/fence.js";

const root = process.cwd();
const failures = [];

function check(label, cond) {
  if (!cond) failures.push(label);
}

function readFile(rel) {
  return readFileSync(join(root, rel), "utf8");
}

// 1. Required files exist
const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTEXT.md",
  "README.md",
  ".github/workflows/ci.yml",
  "docs/gearbox-adr/0001-adr-template.md",
  // B-3 carrier (ADR-0013 → ADR-0026 pull model): the downstream-impact declaration runs
  // through the PR template — if it disappears, the mechanism dies silently.
  ".github/pull_request_template.md",
];
for (const f of requiredFiles) check(`missing required file: ${f}`, existsSync(join(root, f)));

// 2. docs/gearbox-adr/ is a directory
check(
  "docs/gearbox-adr/ must be a directory",
  existsSync(join(root, "docs", "gearbox-adr")) && statSync(join(root, "docs", "gearbox-adr")).isDirectory(),
);

// 3. package.json `files` must ship the ADR dir that actually exists (ADR-0028/0031): if it
//    points at a moved dir, `npm pack` silently ships zero ADRs and every npx command crashes.
if (existsSync(join(root, "package.json"))) {
  let files = [];
  try {
    files = JSON.parse(readFile("package.json")).files || [];
  } catch {
    check("package.json must be valid JSON", false);
  }
  check(
    'package.json `files` must include "docs/gearbox-adr/" (else npm pack ships zero ADRs — ADR-0028/0031)',
    files.some((f) => f.replace(/\/$/, "") === "docs/gearbox-adr"),
  );
}

// 4. Shared protocol assertions, upstream mode (ADR-0050/0051): both fences present and
//    unedited, equal fence versions, AGENTS.md ≤ 32 KiB, protocol fence ≤ 20 KiB, required
//    project + fence sections, CLAUDE.md shell, no HANDOFF.md, protocol files not gitignored,
//    and CI runs every Gate command line.
const { errors, protocol, glossary } = runProtocolChecks(root, { upstream: true });
for (const e of errors) failures.push(e);

// 5. Gearbox-specific text contracts
if (existsSync(join(root, "AGENTS.md"))) {
  const agents = readFile("AGENTS.md");
  check(
    "AGENTS.md's Gate must run the self-check (node scripts/check-gearbox.js) — the dogfood CI == Gate contract",
    agents.includes("node scripts/check-gearbox.js"),
  );
  check(
    "AGENTS.md must not reference HANDOFF.md (README forbids it; rules must stay consistent)",
    !/HANDOFF\.?md/i.test(agents),
  );
  // Hard-rule-by-designation (ADR-0018): without the note, scattered "Hard rule" markings
  // silently lose L1 protection.
  check(
    "the protocol fence must keep the hard-rule-by-designation note ('counts as part of the `## Hard rules` section', ADR-0018)",
    agents.includes("counts as part of the `## Hard rules` section"),
  );
  // The protocol-gap rule (ADR-0003) is the self-repair loop's only entry point.
  check(
    "AGENTS.md must keep the 'protocol gap -> open issue, no silent judgment' rule (ADR-0003)",
    agents.includes("silent judgment calls are not allowed") && agents.includes("Protocol gap"),
  );
  check(
    "AGENTS.md must keep the downstream-impact rule referencing 'Affects downstream' (ADR-0013/0026)",
    agents.includes("Affects downstream"),
  );
}
if (existsSync(join(root, ".github/pull_request_template.md"))) {
  check(
    ".github/pull_request_template.md must keep the 'Affects downstream' declaration field (ADR-0013, informational per ADR-0026)",
    readFile(".github/pull_request_template.md").includes("Affects downstream"),
  );
}

// 6. Version rule (ADR-0050): when either fence's content differs from the latest tag's, the
//    marker version must equal package.json's — changing the protocol means shipping a new
//    protocol version. Skipped outside git or without tags (the npm package); ci.yml checks
//    out full history so CI enforces it.
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 24 });
  } catch {
    return null;
  }
}
const latestTag = (git("tag -l 'v*' --sort=-v:refname") || "").trim().split("\n")[0];
if (latestTag && protocol && glossary && existsSync(join(root, "package.json"))) {
  const pkgVersion = "v" + JSON.parse(readFile("package.json")).version;
  const fenceAt = (path, name) => {
    const text = git(`show ${latestTag}:${path}`);
    try {
      return text ? findFence(text, name) : null;
    } catch {
      return null;
    }
  };
  const prevProtocol = fenceAt("AGENTS.md", "protocol");
  const prevGlossary = fenceAt("CONTEXT.md", "glossary");
  const changed =
    !prevProtocol ||
    !prevGlossary ||
    prevProtocol.actualHash !== protocol.actualHash ||
    prevGlossary.actualHash !== glossary.actualHash;
  check(
    `fence content changed since ${latestTag}, so the marker version (${protocol.version}) must equal package.json's (${pkgVersion}) — set package.json's version, then run node scripts/dev/rehash-fences.js (ADR-0050)`,
    !changed || protocol.version === pkgVersion,
  );
}

// Report
if (failures.length > 0) {
  console.error(`\n❌ Gearbox self-check failed (${failures.length}):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

console.log("✅ Gearbox self-check passed — structure contract holds.");
```

- [ ] **Step 7: Update `.github/workflows/ci.yml`.** Replace the steps block with:

```yaml
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0 # tags + history: the self-check's fence version rule compares against the latest tag
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      # No dependencies — node:fs + node:test only, so skip npm ci.
      # IMPORTANT: keep this identical to the Gate section in AGENTS.md.
      # That sameness is the contract that lets CI enforce what agents promise.
      - run: node scripts/check-gearbox.js && node --test test/*.test.js
```

- [ ] **Step 8: Run the new gate.** Run `node scripts/check-gearbox.js && node --test test/*.test.js`.
  - Expected: `✅ Gearbox self-check passed` and all tests pass.
  - Also check the budgets: `wc -c AGENTS.md` must be < 32768, and the fence content must be < 20480 (the self-check enforces both).
  - If the fence budget fails, trim rationale sentences inside the fence and rerun `rehash-fences.js`. Do not delete rules.
  - Measured in planning: the edits remove ≈4.0 KB and add ≈3.9 KB, so the fence lands near 20.0 KB — only ≈0.5 KB under budget.
  - First trimming candidate: the "> Why so strict: … PR #21 retrospective" blockquote (245 B). It is pure history, and ADR-0012 already records it.
  - Keep every trim in a separate commit so the L1 reviewer sees exactly what left the fence.

- [ ] **Step 9: Commit.**

```bash
git add AGENTS.md CONTEXT.md package.json .github/workflows/ci.yml scripts/check-gearbox.js scripts/dev/rehash-fences.js
git commit -m "feat(protocol)!: fence the protocol body in AGENTS.md / CONTEXT.md (ADR-0050)

The upstream files become the v2 layout every repo will share: project sections
(Gate command, Maintainer, local extensions) outside, the protocol inside a
hash-checked fence that tooling copies verbatim. <maintainer> placeholders give
way to '## Maintainer'; upstream-only release rules move to Gearbox's own local
extension. The gate now also runs node:test and enforces the fence version rule.
Removes self-check assertion #9 (AGENTS_MD_IMPACT) — the hand-edit map it guarded
is retired with the hand-edit flow (L1, see ADR-0050).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `gearbox-install` builds the v2 layout

**Files:**
- Modify: `scripts/gearbox-install`
- Test: `test/install.test.js`

**Interfaces:**
- Consumes:
  - `findFence` (Task 1)
  - `buildAgentsMd`, `buildContextMd` (Task 3)
  - `ciYml`, `SYNC_YML`, `CHECK_YML` (Task 3)
  - `makeUpstream`, `runTool`, `gitInit`, `git`, `tmp`, `read`, `write` from `test/helpers.js`
- Produces: installed trees that pass `gearbox-check`; `.gearbox-version` = the upstream protocol fence version.

- [ ] **Step 1: Write the failing test** — `test/install.test.js`:

```js
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
```

- [ ] **Step 2: Run it and watch it fail.** Run `node --test test/*.test.js`. Expected: the first test fails — the current install transforms the upstream text with `mustReplace` and dies on `AGENTS.md template anchor missing: title`.

- [ ] **Step 3: Rewrite the install transform in `scripts/gearbox-install`.**

  **Imports.** After the `tui` import, add:

  ```js
  import { findFence, FenceError } from "./lib/fence.js";
  import { buildAgentsMd, buildContextMd } from "./lib/skeleton.js";
  import { ciYml, SYNC_YML, CHECK_YML } from "./lib/workflows.js";
  ```

  **Project name.** Replace `projectName = projectName || basename(targetDir);` with:

  ```js
  // Project name (#133): the repo's name, not whatever the clone directory is called.
  function remoteRepoName(dir) {
    try {
      const url = execSync("git remote get-url origin", { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      return url.replace(/\/+$/, "").replace(/.*[/:]/, "").replace(/\.git$/, "") || null;
    } catch {
      return null;
    }
  }
  projectName = projectName || remoteRepoName(targetDir) || basename(targetDir);
  ```

  **Fingerprint.** In the `gearboxMade` expression, add `existing.includes("<!-- gearbox:protocol") ||` as the first operand.

  **Backup plan.** Add a `gearbox-check.yml` entry after the `gearbox-sync.yml` one:

  ```js
  { src: ".github/workflows/gearbox-check.yml", bak: ".github/workflows/gearbox-check.yml.bak", merge: "re-apply its customizations onto the regenerated gearbox-check.yml" },
  ```

  **Upstream fences.** Replace the two lines `const agentsSrc = …` / `const contextSrc = …` with:

  ```js
  // Upstream fences (ADR-0050): copied verbatim — install never edits protocol text.
  let protocolFence;
  let glossaryFence;
  try {
    protocolFence = findFence(readFileSync(join(GEARBOX_DIR, "AGENTS.md"), "utf8"), "protocol");
    glossaryFence = findFence(readFileSync(join(GEARBOX_DIR, "CONTEXT.md"), "utf8"), "glossary");
  } catch (e) {
    if (!(e instanceof FenceError)) throw e;
    die(`Upstream fence is malformed: ${e.message}`, "the upstream checkout/package is broken — refresh it");
  }
  if (!protocolFence || !glossaryFence)
    die("Upstream AGENTS.md / CONTEXT.md has no gearbox fence", "this installer needs a v2 upstream (ADR-0050) — check GEARBOX_DIR");
  ```

  **Transforms → builder.** Delete the whole `mustReplace` function and every `agents = mustReplace(…)` statement through the `<maintainer>` substitution (the old section "1. AGENTS.md transform"). Put this in their place:

  ```js
  // ============== 1. AGENTS.md (v2 skeleton + protocol fence) ==============

  let agents = buildAgentsMd({ title: projectName, gate: gateCmd, maintainer, protocolBlock: protocolFence.block });
  ```

  **CONTEXT.md.** Replace section "3. CONTEXT.md transform" with:

  ```js
  // ============== 3. CONTEXT.md (glossary fence + empty project terms) ==============

  const context = buildContextMd({ title: projectName, glossaryBlock: glossaryFence.block });
  ```

  **Workflow constants.** In section "4. CLAUDE.md + ci.yml", keep `const claudeMd = "@AGENTS.md\n";`. Replace the `ciYml` template literal and the `syncYml` constant (with its comment) by `const ciYmlText = ciYml(gateCmd);`.

  **Stamp version.** Replace the whole `let upstreamVersion = env.GEARBOX_UPSTREAM_VERSION || null; if (!upstreamVersion) { … }` block with:

  ```js
  // .gearbox-version (ADR-0023, ADR-0050): the protocol version = the upstream fence's version.
  const upstreamVersion = protocolFence.version;
  ```

  **Write phase.**
  - `writeFileSync(join(targetDir, ".github/workflows/ci.yml"), ciYml)` → `…, ciYmlText)`.
  - `…gearbox-sync.yml"), syncYml)` → `…gearbox-sync.yml"), SYNC_YML)`.
  - After the `gearbox-sync.yml` step, add:

  ```js
  await tui.step("gearbox-check.yml", "(protocol check on every PR — fences, 32 KiB budget, CI == Gate, ADR-0051)", {
    minMs: 200,
    work: () => {
      mkdirSync(join(targetDir, ".github/workflows"), { recursive: true });
      writeFileSync(join(targetDir, ".github/workflows/gearbox-check.yml"), CHECK_YML);
    },
  });
  ```

  **Remaining text.**
  - CONTEXT.md step note: `"(protocol entries copied along)"` → `"(protocol glossary fence + empty project terms)"`.
  - Next steps, placeholder hint: replace the `placeholderHint` expression with

    ```js
    "(intro / Tech stack / Hard rules / Division of labor / Where to find things" + (maintainer ? "" : " / Maintainer") + (gateCmd ? ")" : " / Gate command, sync ci.yml)")
    ```

  - Next steps, last line: `"… then step 4 of the three start-of-shift steps runs …"` → `"… then run npx gearbox-agents check; step 4 of the start-of-shift steps runs …"`.
  - Header comment, "What it does" item 1: `1. AGENTS.md   v2 skeleton (project sections: Tech stack / Hard rules / Gate / Maintainer / Local protocol extensions / Division of labor / Where to find things) + the upstream protocol fence copied verbatim (ADR-0050)`.
  - Header comment, item 3: `3. CONTEXT.md  the upstream glossary fence + an empty "## Project terms" table`.
  - Header comment: add item `8. gearbox-check.yml  the protocol-check CI job (ADR-0051)`.
  - Header comment: replace the "Every transform anchors to known text…" paragraph with `Protocol text is never transformed: the fences are copied byte-for-byte from upstream (ADR-0050).`

- [ ] **Step 4: Run it and watch it pass.** Run `node --test test/*.test.js && node scripts/check-gearbox.js`. Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add scripts/gearbox-install test/install.test.js
git commit -m "feat(install): lay down the v2 layout — skeleton + verbatim fences (ADR-0050)

A dozen anchor-coupled string transforms of the protocol text are gone; install
copies the fences byte-for-byte and fills project sections, so a fresh install
passes gearbox-agents check. Adds gearbox-check.yml, pins gearbox-sync.yml to @2,
and names the project after the git remote (#133).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `gearbox-update` syncs v2 fences; fixes the stamp; `--force` / `--no-push`

**Files:**
- Modify: `scripts/gearbox-update`
- Test: `test/update.test.js`

**Interfaces:**
- Consumes:
  - `findFence`, `fenceStatus`, `replaceFence` (Task 1)
  - `CHECK_YML`, `pinSyncYml` (Task 3)
  - `runProtocolChecks` (Task 4)
- Produces:
  - Flags `--force` and `--no-push`.
  - The report headings `## Protocol fences rewritten` and `## Protocol check on this branch`.
  - A `migration` variable slot for Task 11 (always `null` here).

- [ ] **Step 1: Write the failing test** — `test/update.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { findFence } from "../scripts/lib/fence.js";
import { makeUpstream, runTool, gitInit, git, tmp, read, write, commitAll, PROTOCOL } from "./helpers.js";

function v2Downstream(up) {
  const down = tmp("gearbox-down-");
  gitInit(down);
  const r = runTool("gearbox-install", [down, "--name", "demo", "--maintainer", "octo", "--gate", "npm test"], { env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 0, r.out);
  commitAll(down, "install");
  return down;
}
const update = (down, up, args = []) => runTool("gearbox-update", ["--no-push", ...args], { cwd: down, env: { GEARBOX_DIR: up } });

test("synced: nothing to do, no branch", () => {
  const up = makeUpstream();
  const down = v2Downstream(up);
  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Nothing to do/);
  assert.equal(git(down, "branch", "--list", "docs/gearbox-backfill-*"), "");
});

test("behind: fences rewritten + stamp bumped on a backfill branch; check passes", () => {
  const down = v2Downstream(makeUpstream());
  const up2 = makeUpstream({ version: "v2.1.0", protocol: `${PROTOCOL}\n- a new rule` });
  const r = update(down, up2);
  assert.equal(r.code, 0, r.out);
  assert.match(git(down, "rev-parse", "--abbrev-ref", "HEAD"), /^docs\/gearbox-backfill-/);
  assert.equal(findFence(read(down, "AGENTS.md"), "protocol").version, "v2.1.0");
  assert.equal(read(down, ".gearbox-version").trim(), "v2.1.0");
  assert.match(read(down, "gearbox-update-report.md"), /## Protocol fences rewritten/);
  const c = runTool("gearbox-check", [], { cwd: down });
  assert.equal(c.code, 0, c.out);
});

test("stamp-only lag is fixed even when fences and ADRs already match", () => {
  const up = makeUpstream();
  const down = v2Downstream(up);
  write(down, ".gearbox-version", "v1.9.9\n");
  commitAll(down, "old stamp");
  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  assert.equal(read(down, ".gearbox-version").trim(), "v2.0.0");
  assert.match(git(down, "log", "-1", "--format=%s"), /\.gearbox-version → v2\.0\.0/);
});

test("hand-edited fence: refused without --force, re-applied with it", () => {
  const up = makeUpstream();
  const down = v2Downstream(up);
  write(down, "AGENTS.md", read(down, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  commitAll(down, "hand edit");
  const refused = update(down, up);
  assert.equal(refused.code, 1);
  assert.match(refused.out, /Hand-edited gearbox fence/);
  assert.match(refused.out, /--force/);
  const forced = update(down, up, ["--force"]);
  assert.equal(forced.code, 0, forced.out);
  assert.match(read(down, "AGENTS.md"), /Commit in small steps\./);
  assert.match(read(down, "gearbox-update-report.md"), /overwrote a hand edit/);
});
```

- [ ] **Step 2: Run it and watch it fail.** Run `node --test test/*.test.js`. Expected: FAIL — the flags are unknown (`Unknown argument: --no-push`), and the synced case prints the old "No ADRs to backfill".

- [ ] **Step 3: Implement the update changes in `scripts/gearbox-update`.**

  **3a. Imports and flags.**
  - Add to the imports:

    ```js
    import { dirname } from "node:path";
    import { fenceStatus, replaceFence } from "./lib/fence.js";
    import { CHECK_YML, pinSyncYml } from "./lib/workflows.js";
    import { runProtocolChecks } from "./lib/protocol-check.js";
    ```

    (merge `dirname` into the existing `node:path` import).
  - Add `let force = false; let noPush = false;` next to the other flags.
  - In the arg loop, add `else if (a === "--force") force = true; else if (a === "--no-push") noPush = true;`.
  - The usage string becomes `"gearbox-update [--refresh-drift] [--force-redo] [--allow-branch] [--force] [--no-push]"`.
  - In the header comment, add `--force` ("re-apply upstream's fence over a hand-edited one; the diff goes into the report") and `--no-push` ("commit locally, skip the push") to the usage block.
  - In the header comment, change the "What it does" item 5 and "What it doesn't do" bullet 1 to: `5. Rewrites the protocol fences in AGENTS.md / CONTEXT.md when upstream moved (ADR-0050) and writes gearbox-update-report.md (the PR body)` and `Doesn't touch anything in AGENTS.md / CONTEXT.md outside the fences`.

  **3b. Retire the hand-edit map.** Delete the `// ============== AGENTS.md report ==============` comment block, the whole `AGENTS_MD_IMPACT` object, and the whole old `generateReport` function.

  **3c. New helpers** — insert where `generateReport` was:

  ```js
  // ============== fences (ADR-0050) ==============

  function readOr(base, rel) {
    return existsSync(join(base, rel)) ? readFileSync(join(base, rel), "utf8") : "";
  }

  // Upstream fences + this repo's fence states. Dies when upstream predates fences or a marker
  // is malformed — both need a human, not a guess.
  function planFences(downDir) {
    const files = [
      { file: "AGENTS.md", name: "protocol", text: readOr(downDir, "AGENTS.md"), upText: readOr(GEARBOX_DIR, "AGENTS.md") },
      { file: "CONTEXT.md", name: "glossary", text: readOr(downDir, "CONTEXT.md"), upText: readOr(GEARBOX_DIR, "CONTEXT.md") },
    ];
    for (const f of files) {
      try {
        f.status = fenceStatus(f.text, f.upText, f.name);
      } catch (e) {
        die(
          `Can't read the gearbox:${f.name} fence: ${e.message}`,
          "an upstream without fences predates Gearbox v2 — refresh the gearbox package/checkout; a malformed local marker must be fixed by hand",
        );
      }
    }
    return { layout: files[0].status.state === "missing" ? "v1" : "v2", files, protocolVersion: files[0].status.upstream.version };
  }

  // Lines present on one side only — enough to show what a hand edit changed.
  function lineDiff(localContent, upstreamContent, max = 20) {
    const a = localContent.split("\n");
    const b = upstreamContent.split("\n");
    const sa = new Set(a);
    const sb = new Set(b);
    const fmt = (arr, sign) =>
      arr.slice(0, max).map((l) => `${sign} ${l}`).concat(arr.length > max ? [`${sign} … ${arr.length - max} more`] : []);
    return [...fmt(a.filter((l) => l.trim() && !sb.has(l)), "-"), ...fmt(b.filter((l) => l.trim() && !sa.has(l)), "+")].join("\n");
  }

  // Tool-owned workflow files (ADR-0051): gearbox-check.yml always matches the template;
  // gearbox-sync.yml's npx pin moves from @latest to the major version.
  function planWorkflowFixes(downDir) {
    const writes = [];
    const checkPath = ".github/workflows/gearbox-check.yml";
    const current = existsSync(join(downDir, checkPath)) ? readFileSync(join(downDir, checkPath), "utf8") : null;
    if (current !== CHECK_YML) writes.push({ path: checkPath, text: CHECK_YML, why: current === null ? "added" : "refreshed to the template" });
    const syncPath = ".github/workflows/gearbox-sync.yml";
    if (existsSync(join(downDir, syncPath))) {
      const s = readFileSync(join(downDir, syncPath), "utf8");
      const pinned = pinSyncYml(s);
      if (pinned !== s) writes.push({ path: syncPath, text: pinned, why: "npx pin @latest → @2" });
    }
    return writes;
  }

  function generateReport({
    downstreamRepo, assignments, refreshes, supersedeResult, branchName, reportDate, baseBranch,
    fenceWrites, migration, workflowWrites, protocolVersion, localStamp, checkResult, pushed,
  }) {
    const lines = [
      "# gearbox-update report",
      "",
      `- Date: ${reportDate}`,
      `- Downstream: ${downstreamRepo}`,
      `- Branch: \`${branchName}\``,
      `- Protocol version: ${localStamp || "(no stamp)"} → ${protocolVersion}`,
      "",
    ];
    if (migration) lines.push(...migrationReportLines(migration));
    if (fenceWrites.length > 0) {
      lines.push("## Protocol fences rewritten", "", "| File | Fence | From | To | Note |", "|---|---|---|---|---|");
      for (const w of fenceWrites)
        lines.push(`| ${w.file} | gearbox:${w.name} | ${w.from} | ${w.to} | ${w.state === "hand-edited" ? "⚠️ overwrote a hand edit (--force)" : "upstream moved"} |`);
      lines.push("");
      for (const w of fenceWrites.filter((x) => x.diff))
        lines.push(
          `### Hand edit overwritten in ${w.file}`,
          "",
          "Lines that differed (- local, + upstream). Re-home anything that mattered in `## Local protocol extensions` / `## Project terms`:",
          "",
          "```diff",
          w.diff,
          "```",
          "",
        );
    }
    if (refreshes.length > 0) {
      lines.push("## ADRs re-copied due to drift (--refresh-drift)", "", "⚠️ Local edits to these copies are gone — check the diff:", "", "| gearbox | slug |", "|---|---|");
      for (const a of refreshes) lines.push(`| ADR-${pad4(a.gearbox.num)} | ${a.gearbox.slug} |`);
      lines.push("");
    }
    if (assignments.length > 0) {
      lines.push("## Backfilled ADRs", "", "| gearbox | slug |", "|---|---|");
      for (const a of assignments) lines.push(`| ADR-${pad4(a.gearbox.num)} | ${a.gearbox.slug} |`);
      lines.push("");
    }
    if (supersedeResult)
      lines.push(
        "## Supersede link (gearbox 0012 → downstream 0006)",
        "",
        supersedeResult.alreadyApplied
          ? "- Downstream 0006's status is already partially superseded (idempotent, not re-applied)"
          : `- Downstream \`docs/gearbox-adr/0006-tiered-change-authority.md\`'s status changed to \`partially superseded by ADR-${pad4(supersedeResult.newNum)}\``,
        "",
      );
    if (workflowWrites.length > 0) {
      lines.push("## Workflow files", "");
      for (const w of workflowWrites) lines.push(`- \`${w.path}\` — ${w.why}`);
      lines.push("");
    }
    lines.push("## Protocol check on this branch", "");
    if (checkResult.errors.length === 0) lines.push("✅ `gearbox-agents check` passes.");
    else {
      lines.push(`❌ ${checkResult.errors.length} problem(s) — this PR's gearbox-check job stays red until they're fixed:`, "");
      for (const e of checkResult.errors) lines.push(`- [ ] ${e}`);
    }
    for (const w of checkResult.warnings) lines.push(`- ⚠️ ${w}`);
    lines.push("", "## Next steps", "");
    if (!pushed) lines.push(`- [ ] push the branch: \`git push -u origin ${branchName}\``);
    lines.push(
      "- [ ] review the diff; run the Gate and `npx gearbox-agents check`",
      `- [ ] open the PR (the scheduled gearbox-sync Action does this itself): \`gh pr create --base ${baseBranch} --head ${branchName} --body-file gearbox-update-report.md\``,
      "- [ ] merging adopts the new protocol version — L1 in this repo: wait for the maintainer's agreement",
      "- [ ] delete this report file after the PR merges",
      "",
    );
    return lines.join("\n");
  }

  // Filled in by the v1 → v2 migration task; v2-only runs never call it.
  function migrationReportLines() {
    return [];
  }
  ```

  **3d. Replace `gitOps` with:**

  ```js
  function gitOps({ downDir, assignments, refreshes, supersedeResult, branchName, protocolVersion, resume, fenceWrites, migration, workflowWrites }) {
    if (!resume) run(`git checkout -b ${branchName}`);

    for (const a of refreshes) {
      run(`git add docs/gearbox-adr/${pad4(a.gearbox.num)}-${a.gearbox.slug}.md`);
      runWithStdin(
        "git commit -F -",
        `docs(adr): drift re-copy ADR-${pad4(a.gearbox.num)} (${a.gearbox.slug})

  Upstream gearbox ADR-${pad4(a.gearbox.num)} has been revised (hash drift); rerunning the
  transform against upstream's latest content and overwriting, provenance stamp refreshed →
  sha256:${sha12(a.gearbox.content)}.
  by gearbox-update --refresh-drift (gearbox ADR-0024).
  Provenance: ${GEARBOX_GITHUB_BASE}/${pad4(a.gearbox.num)}-${a.gearbox.slug}.md`,
      );
    }

    for (const action of assignments) {
      const g = action.gearbox;
      run(`git add docs/gearbox-adr/${pad4(g.num)}-${g.slug}.md`);
      runWithStdin(
        "git commit -F -",
        `docs(adr): backfill gearbox ADR-${pad4(g.num)} (${g.slug})

  by gearbox-update tool.
  Provenance: ${GEARBOX_GITHUB_BASE}/${pad4(g.num)}-${g.slug}.md`,
      );
    }

    if (supersedeResult && !supersedeResult.alreadyApplied) {
      run("git add docs/gearbox-adr/0006-tiered-change-authority.md");
      runWithStdin(
        "git commit -F -",
        `docs(adr): sync 0006 status → partially superseded by ADR-${pad4(supersedeResult.newNum)}

  gearbox 0012 supersedes 0006; this commit syncs downstream 0006's status line to
  partially superseded. by gearbox-update tool.`,
      );
    }

    if (migration) commitMigration(migration, protocolVersion);

    if (fenceWrites.length > 0) {
      run(`git add ${fenceWrites.map((w) => w.file).join(" ")}`);
      runWithStdin(
        "git commit -F -",
        `docs(protocol): sync the gearbox fences → ${protocolVersion}

  ${fenceWrites.map((w) => `- ${w.file} gearbox:${w.name} ${w.from} → ${w.to}${w.state === "hand-edited" ? " (overwrote a hand edit, --force)" : ""}`).join("\n")}

  The fenced protocol is rewritten by tooling, never merged by hand (gearbox ADR-0050).
  by gearbox-update tool.`,
      );
    }

    if (workflowWrites.length > 0) {
      run(`git add ${workflowWrites.map((w) => w.path).join(" ")}`);
      runWithStdin(
        "git commit -F -",
        `ci: gearbox workflow files (${workflowWrites.map((w) => `${w.path.split("/").pop()} ${w.why}`).join(", ")})

  gearbox-check.yml is tool-owned and runs the protocol check on every PR (gearbox ADR-0051);
  gearbox-sync.yml pins the major version instead of @latest.
  by gearbox-update tool.`,
      );
    }

    // .gearbox-version = the protocol version (ADR-0050). Written even when nothing else
    // changed — the pre-v2 early return skipped this and stranded downstreams at v1.15.0.
    let stampUpdated = false;
    const stampPath = join(downDir, ".gearbox-version");
    const prev = existsSync(stampPath) ? readFileSync(stampPath, "utf8").trim() : null;
    if (prev !== protocolVersion) {
      writeFileSync(stampPath, protocolVersion + "\n");
      run("git add .gearbox-version");
      runWithStdin(
        "git commit -F -",
        `chore: .gearbox-version → ${protocolVersion}

  The protocol version this repo now runs (gearbox ADR-0023, ADR-0050).
  by gearbox-update tool.`,
      );
      stampUpdated = true;
    }

    let pushResult = null;
    if (!noPush)
      pushResult = tryRun(forceRedo ? `git push --force-with-lease -u origin ${branchName} 2>&1` : `git push -u origin ${branchName} 2>&1`);
    return { pushResult, stampUpdated };
  }

  // Filled in by the v1 → v2 migration task.
  function commitMigration() {}
  ```

  **3e. Rewire `main()`.**
  - Right after `const driftedSkips = …;`, insert:

  ```js
    const fences = planFences(downDir);
    const protocolVersion = fences.protocolVersion;
    const stampPath = join(downDir, ".gearbox-version");
    const localStamp = existsSync(stampPath) ? readFileSync(stampPath, "utf8").split("\n")[0].trim() : null;
    const fenceWrites = [];
    let migration = null;
    if (fences.layout === "v2") {
      const handEdited = fences.files.filter((f) => f.status.state === "hand-edited");
      if (handEdited.length > 0 && !force)
        die(
          `Hand-edited gearbox fence in ${handEdited.map((f) => f.file).join(" and ")} (ADR-0050)`,
          'move the local rules into "## Local protocol extensions" (AGENTS.md) or "## Project terms" (CONTEXT.md), then rerun with --force to re-apply upstream\'s fence.\nWhat differs from upstream:\n' +
            handEdited.map((f) => `${f.file}:\n${lineDiff(f.status.local.content, f.status.upstream.content)}`).join("\n"),
        );
      for (const f of fences.files) {
        if (f.status.state === "missing")
          die(`${f.file} has no gearbox:${f.name} fence while AGENTS.md has one`, "a half-migrated tree — copy the fence from a fresh `npx gearbox-agents install` into a scratch dir");
        if (f.status.state === "synced") continue;
        fenceWrites.push({
          file: f.file,
          name: f.name,
          state: f.status.state,
          from: f.status.local.version,
          to: f.status.upstream.version,
          diff: f.status.state === "hand-edited" ? lineDiff(f.status.local.content, f.status.upstream.content) : null,
          text: replaceFence(f.text, f.name, f.status.upstream.block),
        });
      }
    } else {
      die("This repo still has the v1 AGENTS.md layout (no gearbox fence)", "the v1 → v2 migration arrives in a later task of this change");
    }
    const workflowWrites = planWorkflowFixes(downDir);
    const stampCurrent = localStamp === protocolVersion;
  ```

  - Replace the early-return condition `if (toCopy.length === 0 && toRefresh.length === 0) {` with:

    ```js
    if (toCopy.length === 0 && toRefresh.length === 0 && fenceWrites.length === 0 && !migration && workflowWrites.length === 0 && stampCurrent) {
    ```

  - In that block, the first message becomes `C.green("✅ Nothing to do — fences, ADRs and .gearbox-version all match upstream\n\n")`.
  - After the supersede-link block (before `// git operations`), insert:

  ```js
    for (const w of fenceWrites) writeFileSync(join(downDir, w.file), w.text);
    for (const w of workflowWrites) {
      mkdirSync(dirname(join(downDir, w.path)), { recursive: true });
      writeFileSync(join(downDir, w.path), w.text);
    }
  ```

  - Delete the `const upstreamVersion = env.GEARBOX_UPSTREAM_VERSION || (UPSTREAM_URL ? … : …);` statement (and its comment).
  - The `gitOps(...)` call becomes:

    ```js
    gitOps({ downDir, assignments: toCopy, refreshes: toRefresh, supersedeResult, branchName, protocolVersion, resume, fenceWrites, migration, workflowWrites })
    ```

  - In the result printing:
    - Replace every `upstreamVersion` with `protocolVersion`.
    - Delete the `else { … upstream has no tag }` branch.
    - After the ADR lines, add `for (const w of fenceWrites) stdout.write(\`  ${C.green("✓ commit")} ${w.file} gearbox:${w.name} ${w.from} → ${w.to}\n\`);`.
    - Replace the push lines with:

    ```js
    if (noPush) stdout.write(`  ${C.dim("push skipped (--no-push)")}\n`);
    else if (pushResult) stdout.write(`  ${C.green("✓ push")} origin/${branchName}\n`);
    else stdout.write(`  ${C.yellow("⚠ push failed — local branch already created, push manually:")}\n     git push -u origin ${branchName}\n`);
    ```

  - In the `catch (e)`, the hint's `git add docs/gearbox-adr/` → `git add -A`.
  - Replace the `generateReport({...})` call with:

  ```js
    const checkResult = runProtocolChecks(downDir);
    const report = generateReport({
      downstreamRepo: downRepo, assignments: toCopy, refreshes: toRefresh, supersedeResult, branchName, reportDate, baseBranch,
      fenceWrites, migration, workflowWrites, protocolVersion, localStamp, checkResult, pushed: Boolean(pushResult),
    });
  ```

  - Replace the final "Next steps" writes with:

  ```js
    stdout.write(C.bold("Next steps:\n"));
    stdout.write(`  1. Review the branch and ${C.cyan("gearbox-update-report.md")} (the PR body)\n`);
    stdout.write(`  2. Run the Gate and ${C.cyan("npx gearbox-agents check")}\n`);
    stdout.write(`  3. Open a PR: ${C.cyan(`gh pr create --base ${baseBranch} --head ${branchName} --body-file gearbox-update-report.md`)}\n`);
    stdout.write("  4. Merging adopts the new protocol version — L1: wait for the maintainer's agreement\n\n");
  ```

  To find `pushResult` for the report, hoist `let pushResult = null;` above the `try` and assign it inside (`({ pushResult, stampUpdated } = gitOps(...))`, with `let stampUpdated = false;` hoisted as well).

- [ ] **Step 4: Run it and watch it pass.** Run `node --test test/*.test.js && node scripts/check-gearbox.js`. Expected: PASS. The self-check no longer carries assertion #9, so deleting `AGENTS_MD_IMPACT` is safe.
- [ ] **Step 5: Commit.**

```bash
git add scripts/gearbox-update test/update.test.js
git commit -m "feat(update): rewrite v2 fences, refuse hand edits, always bump the stamp (ADR-0050)

The hand-edit checklist (AGENTS_MD_IMPACT) is gone: update now rewrites both
fences on the backfill branch. A hand-edited fence is refused unless --force,
with the diff shown. .gearbox-version is written even when nothing else moved —
the old early return stranded two downstreams at v1.15.0 while the sync Action
reported success. --no-push lets tests and dry runs stay local.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `gearbox-version` reports fence states

**Files:**
- Modify: `scripts/gearbox-version`
- Test: `test/version.test.js`

**Interfaces:**
- Consumes: `fenceStatus` (Task 1); `AGENTS_MAX_BYTES` (Task 4).
- Produces: output lines containing `synced` / `behind` / `hand-edited` / `v1 layout`; the overall `✅ fully synced` only when the fences, ADRs and stamp all match.

- [ ] **Step 1: Write the failing test** — `test/version.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { makeUpstream, runTool, gitInit, tmp, read, write, commitAll, PROTOCOL } from "./helpers.js";

function installed(up) {
  const down = tmp("gearbox-ver-");
  gitInit(down);
  runTool("gearbox-install", [down, "--name", "demo", "--maintainer", "octo", "--gate", "npm test"], { env: { GEARBOX_DIR: up } });
  commitAll(down, "install");
  return down;
}
const version = (down, up) => runTool("gearbox-version", [], { cwd: down, env: { GEARBOX_DIR: up } });

test("fully synced only when fences, ADRs and stamp all match", () => {
  const up = makeUpstream();
  const r = version(installed(up), up);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md gearbox:protocol synced/);
  assert.match(r.out, /fully synced/);
});

test("behind, hand-edited and v1 layout are each reported, never as fully synced", () => {
  const up = makeUpstream();
  const behind = version(installed(up), makeUpstream({ version: "v2.1.0", protocol: `${PROTOCOL}\n- new` }));
  assert.match(behind.out, /behind \(v2\.0\.0 → v2\.1\.0\)/);
  assert.doesNotMatch(behind.out, /fully synced/);

  const edited = installed(up);
  write(edited, "AGENTS.md", read(edited, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  assert.match(version(edited, up).out, /hand-edited/);

  const v1 = installed(up);
  write(v1, "AGENTS.md", "# old\n\n## Working agreement (multi-agent)\n");
  assert.match(version(v1, up).out, /v1 layout/);
});

test("warns when AGENTS.md is over the 32 KiB budget", () => {
  const up = makeUpstream();
  const down = installed(up);
  write(down, "AGENTS.md", read(down, "AGENTS.md") + `\n${"x".repeat(33000)}\n`);
  assert.match(version(down, up).out, /over the 32768-byte budget/);
});
```

- [ ] **Step 2: Run it and watch it fail.** Run `node --test test/*.test.js`. Expected: FAIL — no fence lines in the output.

- [ ] **Step 3: Implement in `scripts/gearbox-version`.**
  - Imports: add `import { fenceStatus } from "./lib/fence.js";` and `import { AGENTS_MAX_BYTES } from "./lib/protocol-check.js";`.
  - After `localVersion` is read, and before the `console.log("")` that starts the summary, insert:

  ```js
  // Protocol fences (ADR-0050): "synced" means the fenced text equals upstream's.
  const fenceRows = [];
  let fencesSynced = true;
  let upstreamProtocolVersion = "";
  for (const [file, name] of [["AGENTS.md", "protocol"], ["CONTEXT.md", "glossary"]]) {
    const upText = existsSync(join(gearboxDir, file)) ? readFileSync(join(gearboxDir, file), "utf8") : "";
    const localText = existsSync(file) ? readFileSync(file, "utf8") : "";
    let st;
    try {
      st = fenceStatus(localText, upText, name);
    } catch (e) {
      st = { state: "error", message: e.message };
    }
    if (name === "protocol" && st.upstream) upstreamProtocolVersion = st.upstream.version;
    if (st.state !== "synced") fencesSynced = false;
    fenceRows.push({ file, name, st });
  }
  // The protocol version is the fence's (ADR-0050); fall back to the tag for a pre-v2 upstream.
  if (upstreamProtocolVersion) upstreamVersion = upstreamProtocolVersion;
  const FENCE_TEXT = {
    synced: (r) => `${GREEN}✅ ${r.file} gearbox:${r.name} synced (${r.st.local.version})${RESET}`,
    behind: (r) => `${YELLOW}⚠️  ${r.file} gearbox:${r.name} behind (${r.st.local.version} → ${r.st.upstream.version}) — run npx gearbox-agents update${RESET}`,
    "hand-edited": (r) => `${YELLOW}⚠️  ${r.file} gearbox:${r.name} hand-edited — move local rules to "## Local protocol extensions", then npx gearbox-agents update --force${RESET}`,
    missing: (r) => `${YELLOW}⚠️  ${r.file} has no gearbox:${r.name} fence (v1 layout) — run npx gearbox-agents update to migrate (ADR-0050)${RESET}`,
    error: (r) => `${YELLOW}⚠️  ${r.file} gearbox:${r.name}: ${r.st.message}${RESET}`,
  };
  ```

  - Right after the version-summary `if (upstreamVersion) { … }` block, insert:

  ```js
  for (const r of fenceRows) console.log(`${DIM}fence:${RESET}     ${FENCE_TEXT[r.st.state](r)}`);
  const agentsBytes = existsSync("AGENTS.md") ? Buffer.byteLength(readFileSync("AGENTS.md", "utf8")) : 0;
  if (agentsBytes > AGENTS_MAX_BYTES)
    console.log(`${DIM}size:${RESET}      ${YELLOW}⚠️  AGENTS.md is ${agentsBytes} bytes — over the ${AGENTS_MAX_BYTES}-byte budget (ADR-0051); move long maps to docs/INDEX.md${RESET}`);
  ```

  - Change `let upstreamVersion = "";` to stay `let` (it is reassigned above).
  - Final status: replace `if (missingCount === 0 && driftCount === 0) {` with:

    ```js
    const stampOk = !upstreamVersion || localVersion === upstreamVersion;
    if (missingCount === 0 && driftCount === 0 && fencesSynced && stampOk) {
    ```

  - In the else branch, print this before the existing "not synced" line:

  ```js
    if (!fencesSynced) console.log(`${DIM}status:${RESET}    ${YELLOW}⚠️  protocol fences not synced (see fence: lines above)${RESET}`);
    if (!stampOk) console.log(`${DIM}status:${RESET}    ${YELLOW}⚠️  .gearbox-version ${localVersion || "(missing)"} ≠ protocol ${upstreamVersion} — run npx gearbox-agents update${RESET}`);
  ```

- [ ] **Step 4: Run it and watch it pass.** Run `node --test test/*.test.js && node scripts/check-gearbox.js`. Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add scripts/gearbox-version test/version.test.js
git commit -m "feat(version): report fence states; 'fully synced' now means the protocol text matches

It used to count ADR files only, and could print 'behind by patch' and
'fully synced' in one run. Now it compares fence hashes and the protocol version,
names what to do for behind / hand-edited / v1 layout, and warns past 32 KiB.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: v1 fingerprint (`v1-known.js` + generator + JSON)

**Files:**
- Create: `scripts/lib/v1-known.js`, `scripts/dev/build-v1-known.js`, `scripts/lib/v1-known-lines.json` (generated)
- Modify: `scripts/check-gearbox.js` (require the JSON)
- Test: `test/v1-known.test.js`

**Interfaces:**
- Produces:
  - `normalizeKnownLine(line, maintainer) → string`
  - `knownLineHash(normalizedLine) → string`
  - `termKey(cell) → string`
  - `tableTerms(text) → string[]`
  - `buildKnown(texts) → { lines: Set, terms: Set }`
  - `serializeKnown(known, sources) → string`
  - `loadKnown(path?) → { lines, terms, sources }`
  - `KNOWN_PATH`, `SEPARATOR_ROW`

- [ ] **Step 1: Write the failing test** — `test/v1-known.test.js`. The last test, which reads the shipped JSON, is added in Step 6.

```js
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
  const k = buildKnown(["## Terms\n\n| Term | D |\n|---|---|\n| handoff | x |\n"]);
  assert.ok(k.lines.has(knownLineHash("## Terms")));
  const dir = tmp();
  const p = write(dir, "k.json", serializeKnown(k, { test: true }));
  const back = loadKnown(p);
  assert.ok(back.lines.has(knownLineHash("| handoff | x |")));
  assert.ok(back.terms.has("handoff"));
  assert.equal(knownLineHash("abc").length, 12);
  assert.equal(termKey(" `L1/L2 tiers` "), "l1/l2 tiers");
});
```

- [ ] **Step 2: Run it and watch it fail.** Run `node --test test/*.test.js`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** — `scripts/lib/v1-known.js`:

```js
// Known v1 upstream text (ADR-0050 migration): which lines of a v1 AGENTS.md / CONTEXT.md came
// from Gearbox rather than from the project. Shipped as hashes (v1-known-lines.json), so the
// package carries a fingerprint of the old protocol text, not the text itself.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const KNOWN_PATH = join(dirname(fileURLToPath(import.meta.url)), "v1-known-lines.json");
export const SEPARATOR_ROW = /^\|?\s*:?-{3,}/;

export function normalizeKnownLine(line, maintainer = null) {
  let l = line.trim();
  if (maintainer) l = l.split(maintainer).join("<maintainer>");
  return l;
}

export function knownLineHash(normalizedLine) {
  return createHash("sha256").update(normalizedLine).digest("hex").slice(0, 12);
}

export function termKey(cell) {
  return cell.replace(/[*`]/g, "").trim().toLowerCase();
}

export function tableTerms(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.startsWith("|") || SEPARATOR_ROW.test(l)) continue;
    if (SEPARATOR_ROW.test((lines[i + 1] || "").trim())) continue; // header row
    const cell = l.split("|")[1];
    if (cell !== undefined && termKey(cell)) out.push(termKey(cell));
  }
  return out;
}

export function buildKnown(texts) {
  const lines = new Set();
  const terms = new Set();
  for (const text of texts) {
    for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
      const n = normalizeKnownLine(raw);
      if (n) lines.add(knownLineHash(n));
    }
    for (const t of tableTerms(text)) terms.add(t);
  }
  return { lines, terms };
}

export function serializeKnown(known, sources) {
  return JSON.stringify({ format: 1, sources, lines: [...known.lines].sort(), terms: [...known.terms].sort() }) + "\n";
}

export function loadKnown(path = KNOWN_PATH) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  return { lines: new Set(data.lines), terms: new Set(data.terms), sources: data.sources };
}
```

- [ ] **Step 4: Implement the generator** — `scripts/dev/build-v1-known.js` (then `chmod +x`):

```js
#!/usr/bin/env node
// Maintainer helper (Gearbox repo only): builds scripts/lib/v1-known-lines.json for the
// v1 → v2 migration (ADR-0050). Sources — everything upstream published before v2:
//   1. every revision of AGENTS.md and CONTEXT.md up to the last v1 tag (incl. the Chinese era)
//   2. the downstream-flavored AGENTS.md / CONTEXT.md that each v1 tag's gearbox-install generates
// Run from the repo root with full history and tags. Deterministic: same history → same file.
import { execSync, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildKnown, serializeKnown, KNOWN_PATH } from "../lib/v1-known.js";

const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] });
const tags = git(["tag", "-l", "v1.*", "--sort=v:refname"]).trim().split("\n").filter(Boolean);
const lastV1 = tags.at(-1);
if (!lastV1) {
  console.error("no v1.* tags — run in the gearbox repo with tags fetched");
  process.exit(1);
}

const texts = [];
const revs = git(["log", "--format=%H", lastV1, "--", "AGENTS.md", "CONTEXT.md"]).trim().split("\n").filter(Boolean);
for (const rev of revs)
  for (const f of ["AGENTS.md", "CONTEXT.md"]) {
    try {
      texts.push(git(["show", `${rev}:${f}`]));
    } catch {
      /* file absent at that revision */
    }
  }

const installs = [];
for (const tag of tags) {
  try {
    git(["cat-file", "-e", `${tag}:scripts/gearbox-install`]);
  } catch {
    continue;
  }
  const work = mkdtempSync(join(tmpdir(), "gearbox-v1-"));
  const up = join(work, "up");
  const target = join(work, "target");
  mkdirSync(up);
  mkdirSync(target);
  try {
    execSync(`git archive ${tag} | tar -x -C "${up}"`, { stdio: "ignore" });
    execFileSync(process.execPath, [join(up, "scripts", "gearbox-install"), target, "--name", "example-project"], {
      env: { ...process.env, GEARBOX_DIR: up },
      stdio: "ignore",
      timeout: 60000,
    });
    for (const f of ["AGENTS.md", "CONTEXT.md"]) if (existsSync(join(target, f))) texts.push(readFileSync(join(target, f), "utf8"));
    installs.push(tag);
  } catch {
    /* that tag's installer can't run standalone — its text is still covered by source 1 */
  }
  rmSync(work, { recursive: true, force: true });
}

const known = buildKnown(texts);
writeFileSync(KNOWN_PATH, serializeKnown(known, { lastV1, revisions: revs.length, installs }));
console.log(`wrote ${KNOWN_PATH}: ${known.lines.size} line hashes, ${known.terms.size} terms (${revs.length} revisions; installs: ${installs.join(" ")})`);
```

- [ ] **Step 5: Generate the JSON.** Run `node scripts/dev/build-v1-known.js`.
  - Expected: `wrote …/v1-known-lines.json: N line hashes, M terms (…)`, with N in the thousands and M ≥ 20.
  - Run it twice and confirm `git diff --stat` shows no change after the second run (deterministic).
  - The file should be well under 200 KB.

- [ ] **Step 6: Add the shipped-fingerprint test** (append to `test/v1-known.test.js`):

```js
test("the shipped fingerprint knows v1 protocol text in both languages", () => {
  const k = loadKnown();
  assert.ok(k.lines.has(knownLineHash("### While working")));
  assert.ok(k.lines.has(knownLineHash("### On starting a shift (the three start-of-shift steps)")));
  assert.ok(k.lines.has(knownLineHash("### 协议自身的变更（改本文件的规则）")));
  assert.ok(k.terms.has("handoff"));
  assert.ok(k.terms.has("交接（handoff）"));
});
```

- [ ] **Step 7: Require the JSON in the upstream gate.** In `scripts/check-gearbox.js`, add `"scripts/lib/v1-known-lines.json",` to `requiredFiles` with the comment `// the v1 → v2 migration's fingerprint (ADR-0050)`.
- [ ] **Step 8: Run it and watch it pass.** Run `node scripts/check-gearbox.js && node --test test/*.test.js`. Expected: PASS.
- [ ] **Step 9: Commit.**

```bash
git add scripts/lib/v1-known.js scripts/dev/build-v1-known.js scripts/lib/v1-known-lines.json scripts/check-gearbox.js test/v1-known.test.js
git commit -m "feat(lib): fingerprint of every v1 upstream line and term (ADR-0050 migration)

The migration must tell template text from project text in hand-merged v1 files,
including installs from the Chinese era. Hashing every line upstream ever
published (plus what each v1 installer generated) makes that a set lookup, and
ships a fingerprint rather than a second copy of the old protocol.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `scripts/lib/migrate-v1.js`

**Files:**
- Create: `scripts/lib/migrate-v1.js`
- Test: `test/migrate-v1.test.js`

**Interfaces:**
- Consumes:
  - `splitByLevel`, `baseTitle`, `sectionBody` (Task 2)
  - `buildAgentsMd`, `buildContextMd`, `SOT_NOTE`, `PLACEHOLDERS`, `DEFAULT_DIVISION`, `INDEX_POINTERS`, `CONTEXT_INTRO`, `PROJECT_TERMS` (Task 3)
  - `AGENTS_MAX_BYTES` (Task 4)
  - `normalizeKnownLine`, `knownLineHash`, `termKey`, `SEPARATOR_ROW`, `buildKnown` (Task 9)
- Produces: `migrateV1({ agentsMd, contextMd, known, protocolBlock, glossaryBlock }) → { agentsMd, contextMd, indexMd: string|null, report }`, where `report` has this exact shape:

```
{ maintainer: string|null, gateMoved: boolean, gateNotes: number, divisionOfLabor: "default"|"kept",
  carried: [{ section, lines }], moved: [string], flagged: [{ section, unknown, total }],
  extraSections: [string], indexMoved: { bytes }|null, oversize: number|null,
  context: { removedTerms: number, editedTerms: string[], keptRows: number } }
```

- [ ] **Step 1: Write the failing test** — `test/migrate-v1.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { migrateV1 } from "../scripts/lib/migrate-v1.js";
import { buildKnown, normalizeKnownLine, knownLineHash } from "../scripts/lib/v1-known.js";
import { renderFence, findFence } from "../scripts/lib/fence.js";
import { sectionBody, splitByLevel } from "../scripts/lib/sections.js";

const TEMPLATE = [
  "# example-project", "",
  "<One sentence: what this project is, what counts as done, what the scope boundaries are.>", "",
  "> This file is the single source of truth for ALL AI coding agents, whatever the tool (Claude Code, Z Code, Cursor, etc.).",
  "> Rules live here and only here. Do not duplicate them elsewhere.", "",
  "## Tech stack", "", "<Project tech stack, one per line.>", "",
  "## Hard rules", "", "<Project rules that must not be violated, one per line.>", "",
  "> Any clause in the protocol body marked **Hard rule** counts as part of this section.", "",
  "## Working agreement (multi-agent)", "",
  "### On starting a shift (the three start-of-shift steps)", "", "1. Sync, then read.", "2. Check GitHub Issues.", "",
  "### While working", "", "- Commit in small steps.", "- One agent sees a task through.", "",
  "### PR disposition (merge rules)", "", "- **Who merges**: L1 waits for `<maintainer>` agreement, L2 is autonomous.", "",
  "### Gate (the hard gate — must be all-green before shift-end)", "", "```bash", "<gate command, e.g.: npx tsc --noEmit && npx vitest run>", "```", "",
  "> Fill in the gate to match your actual project.", "",
  "### Division of labor (optional, fill in as needed)", "", "1. **Fill it in**", "2. **Leave it blank**", "",
  "## Where to find things", "", "- `CONTEXT.md` — domain glossary", "",
].join("\n");
const CONTEXT_TEMPLATE = [
  "# Domain context — example-project", "", "Domain glossary.", "",
  "## Terms", "", "| Term | Definition | Notes |", "|---|---|---|", "| handoff | a baton | — |", "| gate | the command | — |", "",
  "## Key invariants", "", "- No HANDOFF file.", "",
].join("\n");
const known = buildKnown([TEMPLATE, CONTEXT_TEMPLATE]);
const protocolBlock = renderFence("protocol", "v2.0.0", "## Working agreement (multi-agent)\n\n- the new protocol");
const glossaryBlock = renderFence("glossary", "v2.0.0", "## Protocol terms\n\n| Term | Definition | Notes |\n|---|---|---|\n| handoff | x | y |");
const migrate = (agentsMd, contextMd = CONTEXT_TEMPLATE) => migrateV1({ agentsMd, contextMd, known, protocolBlock, glossaryBlock });

const nearTemplate = TEMPLATE
  .replace("# example-project", "# shop-app")
  .replace("<One sentence: what this project is, what counts as done, what the scope boundaries are.>", "A coffee-shop ordering app.")
  .replace("<Project tech stack, one per line.>", "Expo / TypeScript")
  .replace("<Project rules that must not be violated, one per line.>", "- Money is always integer cents.")
  .replace("`<maintainer>`", "`real-owner`")
  .replace("<gate command, e.g.: npx tsc --noEmit && npx vitest run>", "npx tsc --noEmit")
  .replace("1. **Fill it in**\n2. **Leave it blank**", "Single agent at a time; no routing.");

test("near-template: project content kept, protocol replaced, nothing carried", () => {
  const { agentsMd, report } = migrate(nearTemplate);
  assert.ok(agentsMd.startsWith("# shop-app\n\nA coffee-shop ordering app."));
  assert.equal(findFence(agentsMd, "protocol").block, protocolBlock);
  assert.match(sectionBody(agentsMd, 2, "Gate"), /```bash\nnpx tsc --noEmit\n```/);
  assert.match(agentsMd, /GitHub account: `real-owner`/);
  assert.match(sectionBody(agentsMd, 2, "Hard rules"), /integer cents/);
  assert.doesNotMatch(sectionBody(agentsMd, 2, "Hard rules"), /counts as part of this section/);
  assert.match(sectionBody(agentsMd, 2, "Division of labor"), /Single agent at a time/);
  assert.deepEqual([report.carried, report.moved, report.flagged], [[], [], []]);
  assert.equal(report.maintainer, "real-owner");
  assert.equal(report.divisionOfLabor, "kept");
});

test("local additions: carried lines, moved subsections, gate notes, index moved out", () => {
  const withLocal = nearTemplate
    .replace("- One agent sees a task through.", "- One agent sees a task through.\n- Search closed issues before claiming a task.")
    .replace("### PR disposition (merge rules)", "### Worktree discipline (project ADR-0149)\n\n- One worktree per lane.\n\n### PR disposition (merge rules)")
    .replace("> Fill in the gate to match your actual project.", "> Fill in the gate to match your actual project.\n\n`npm test` also type-checks mobile/.")
    .replace("- `CONTEXT.md` — domain glossary", `- \`CONTEXT.md\` — domain glossary\n${"- `src/x.ts` — a long index line\n".repeat(1200)}`);
  const { agentsMd, indexMd, report } = migrate(withLocal);
  const ext = sectionBody(agentsMd, 2, "Local protocol extensions");
  assert.match(ext, /### From v1: While working\n\n- Extends: While working\n- Upstream: undecided\n\n- Search closed issues before claiming a task\./);
  assert.match(ext, /### Worktree discipline \(project ADR-0149\)\n\n- Extends: Working agreement \(multi-agent\)\n- Upstream: undecided\n\n- One worktree per lane\./);
  assert.match(sectionBody(agentsMd, 2, "Gate"), /also type-checks mobile/);
  assert.ok(indexMd.includes("a long index line"));
  assert.match(sectionBody(agentsMd, 2, "Where to find things"), /docs\/INDEX\.md/);
  assert.ok(Buffer.byteLength(agentsMd) <= 32768);
  assert.deepEqual(report.moved, ["Worktree discipline (project ADR-0149)"]);
  assert.deepEqual(report.carried, [{ section: "While working", lines: 1 }]);
  assert.equal(report.gateNotes, 1);
  assert.ok(report.indexMoved.bytes > 32768);
});

test("translated subsection (>50% unknown) is flagged, not carried", () => {
  const translated = nearTemplate.replace("- Commit in small steps.\n- One agent sees a task through.", "- 小步提交。\n- 一个任务一个 agent 做完。\n- 本项目：先查撞车。");
  const { agentsMd, report } = migrate(translated);
  assert.deepEqual(report.flagged, [{ section: "While working", unknown: 3, total: 3 }]);
  assert.doesNotMatch(agentsMd, /小步提交/);
});

test("invariant: every unknown protocol-region line lands in the output or its section is flagged", () => {
  const withLocal = nearTemplate
    .replace("2. Check GitHub Issues.", "2. Check GitHub Issues.\n3. Say hi on the team channel.")
    .replace("- One agent sees a task through.", "- One agent sees a task through.\n- Lane names are kebab-case.");
  const { agentsMd, report } = migrate(withLocal);
  const flagged = new Set(report.flagged.map((f) => f.section));
  const wa = splitByLevel(withLocal, 2).find((c) => c.title === "Working agreement (multi-agent)");
  for (const sub of splitByLevel(wa.lines.join("\n"), 3).slice(1))
    for (const line of sub.lines) {
      const n = normalizeKnownLine(line, "real-owner");
      if (!n || n.startsWith("```") || known.lines.has(knownLineHash(n))) continue;
      assert.ok(agentsMd.includes(line) || flagged.has(sub.title), `lost: ${line}`);
    }
});

test("CONTEXT.md: protocol rows replaced by the fence, project rows kept, edits reported", () => {
  const ctx = CONTEXT_TEMPLATE.replace("| handoff | a baton | — |", "| handoff | a baton, passed at merge | — |\n| star | loyalty point | — |");
  const { contextMd, report } = migrate(nearTemplate, ctx);
  assert.equal(findFence(contextMd, "glossary").block, glossaryBlock);
  assert.match(contextMd, /## Project terms\n\n\| Term \| Definition \| Notes \|\n\|---\|---\|---\|\n\| star \| loyalty point \| — \|/);
  assert.doesNotMatch(contextMd, /\| gate \| the command/);
  assert.doesNotMatch(contextMd, /## Key invariants/);
  assert.deepEqual(report.context, { removedTerms: 2, editedTerms: ["handoff"], keptRows: 1 });
});

test("no Working agreement at all: skeleton with placeholders, gate reported missing", () => {
  const { agentsMd, report } = migrate("# hand-written\n\nSome notes.\n");
  assert.ok(findFence(agentsMd, "protocol"));
  assert.equal(report.gateMoved, false);
  assert.match(agentsMd, /<gate command/);
});
```

- [ ] **Step 2: Run it and watch it fail.** Run `node --test test/*.test.js`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** — `scripts/lib/migrate-v1.js`:

```js
// v1 → v2 migration (ADR-0050): turns a v1-layout AGENTS.md / CONTEXT.md — protocol text merged
// by hand — into the fenced v2 layout. Pure: strings in, strings + report out.
// Invariant: every line of the v1 protocol region that isn't known upstream text ends up in
// `## Gate`, in `## Local protocol extensions`, or named in the report (flagged subsections).
import { splitByLevel, baseTitle } from "./sections.js";
import {
  buildAgentsMd, buildContextMd, SOT_NOTE, PLACEHOLDERS, DEFAULT_DIVISION, INDEX_POINTERS, CONTEXT_INTRO, PROJECT_TERMS,
} from "./skeleton.js";
import { AGENTS_MAX_BYTES } from "./protocol-check.js";
import { normalizeKnownLine, knownLineHash, termKey, SEPARATOR_ROW } from "./v1-known.js";

// v1 `###` headings (baseTitle, lowercased) → canonical section. Exact match only.
const ALIASES = new Map([
  ["on starting a shift", "On starting a shift"],
  ["while working", "While working"],
  ["roles of issues & prs", "Roles of issues & PRs"],
  ["issue & pr 的角色", "Roles of issues & PRs"],
  ["pr disposition", "PR disposition"],
  ["pr 处置", "PR disposition"],
  ["changing the protocol itself", "Changing the protocol itself"],
  ["协议自身的变更", "Changing the protocol itself"],
  ["gate", "Gate"],
  ["on ending a shift", "On ending a shift"],
  ["parallel shifts", "Parallel shifts"],
  ["branch hygiene", "Branch hygiene"],
  ["分支卫生", "Branch hygiene"],
  ["division of labor", "Division of labor"],
]);

const MAINTAINER_PATTERNS = [
  /L1 waits for `([^`<>]+)` agreement/,
  /after the `([^`<>]+)` explicitly agrees/,
  /authored by the GitHub account `([^`<>]+)`/,
  /it's enough for the `([^`<>]+)` to say/,
];

function detectMaintainer(text) {
  for (const p of MAINTAINER_PATTERNS) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

function isStructural(line) {
  const t = line.trim();
  return t === "" || t.startsWith("```") || SEPARATOR_ROW.test(t) || /^(-{3,}|\*{3,})$/.test(t);
}

function trimBlank(lines) {
  const out = [...lines];
  while (out.length && out[0].trim() === "") out.shift();
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  return out;
}

function splitFirstCodeBlock(lines) {
  const start = lines.findIndex((l) => /^\s*```/.test(l));
  const end = start === -1 ? -1 : lines.findIndex((l, i) => i > start && /^\s*```/.test(l));
  if (start === -1 || end === -1) return { code: null, rest: lines };
  return { code: lines.slice(start + 1, end).join("\n"), rest: [...lines.slice(0, start), ...lines.slice(end + 1)] };
}

function extension(title, extendsSection, lines) {
  return [`### ${title}`, "", `- Extends: ${extendsSection}`, "- Upstream: undecided", "", ...trimBlank(lines)].join("\n");
}

function migrateWorkingAgreement(body, isKnown, report) {
  const out = { gate: null, gateNotes: [], divisionOfLabor: null, extensions: [] };
  const subs = splitByLevel(body, 3);
  const lead = subs[0].lines.filter((l) => !isStructural(l) && !isKnown(l));
  if (lead.length) {
    out.extensions.push(extension("From v1: Working agreement (multi-agent)", "Working agreement (multi-agent)", lead));
    report.carried.push({ section: "Working agreement (multi-agent)", lines: lead.length });
  }
  for (const s of subs.slice(1)) {
    const canonical = ALIASES.get(baseTitle(s.title).toLowerCase());
    if (!canonical) {
      out.extensions.push(extension(s.title, "Working agreement (multi-agent)", s.lines));
      report.moved.push(s.title);
      continue;
    }
    if (canonical === "Gate") {
      const { code, rest } = splitFirstCodeBlock(s.lines);
      if (code !== null) {
        out.gate = code;
        report.gateMoved = true;
      }
      out.gateNotes = rest.filter((l) => !isStructural(l) && !isKnown(l));
      report.gateNotes = out.gateNotes.length;
      continue;
    }
    const content = s.lines.filter((l) => l.trim() !== "");
    const unknown = content.filter((l) => !isStructural(l) && !isKnown(l));
    if (canonical === "Division of labor") {
      if (unknown.length) {
        out.divisionOfLabor = trimBlank(s.lines).join("\n");
        report.divisionOfLabor = "kept";
      }
      continue;
    }
    if (unknown.length === 0) continue;
    if (unknown.length / content.length > 0.5) {
      report.flagged.push({ section: canonical, unknown: unknown.length, total: content.length });
      continue;
    }
    out.extensions.push(extension(`From v1: ${canonical}`, canonical, unknown));
    report.carried.push({ section: canonical, lines: unknown.length });
  }
  return out;
}

function migrateContext(contextMd, known, isKnown, glossaryBlock, report) {
  const chunks = splitByLevel(contextMd || "", 2);
  const head = trimBlank(chunks[0].lines).join("\n") || `# Domain context\n\n${CONTEXT_INTRO}`;
  const kept = [];
  let renamed = false;
  for (const c of chunks.slice(1)) {
    const body = [];
    let rows = 0;
    for (let i = 0; i < c.lines.length; i++) {
      const line = c.lines[i];
      const t = line.trim();
      if (t.startsWith("|")) {
        const isSep = SEPARATOR_ROW.test(t);
        const isHeader = !isSep && SEPARATOR_ROW.test((c.lines[i + 1] || "").trim());
        if (isSep || isHeader) {
          body.push(line);
          continue;
        }
        const key = termKey(t.split("|")[1] || "");
        if (known.terms.has(key)) {
          report.context.removedTerms++;
          if (!isKnown(line)) report.context.editedTerms.push(key);
          continue;
        }
        body.push(line);
        rows++;
        continue;
      }
      if (!isStructural(line) && isKnown(line)) continue;
      body.push(line);
    }
    const prose = body.filter((l) => !l.trim().startsWith("|") && !isStructural(l));
    if (rows === 0 && prose.length === 0) continue;
    const cleaned = rows === 0 ? body.filter((l) => !l.trim().startsWith("|")) : body;
    let heading = c.heading;
    if (rows > 0 && !renamed && isKnown(c.heading)) {
      heading = "## Project terms";
      renamed = true;
    }
    report.context.keptRows += rows;
    kept.push([heading, "", ...trimBlank(cleaned)].join("\n"));
  }
  return buildContextMd({ head, glossaryBlock, projectTerms: kept.length ? kept.join("\n\n") : PROJECT_TERMS });
}

export function migrateV1({ agentsMd, contextMd, known, protocolBlock, glossaryBlock }) {
  const report = {
    maintainer: null, gateMoved: false, gateNotes: 0, divisionOfLabor: "default",
    carried: [], moved: [], flagged: [], extraSections: [], indexMoved: null, oversize: null,
    context: { removedTerms: 0, editedTerms: [], keptRows: 0 },
  };
  const maintainer = detectMaintainer(agentsMd);
  report.maintainer = maintainer;
  const isKnown = (line) => known.lines.has(knownLineHash(normalizeKnownLine(line, maintainer)));

  const chunks = splitByLevel(agentsMd, 2);
  let techStack = null;
  let hardRules = null;
  let whereToFind = null;
  let wa = { gate: null, gateNotes: [], divisionOfLabor: null, extensions: [] };
  const extraSections = [];
  for (const c of chunks.slice(1)) {
    const key = baseTitle(c.title).toLowerCase();
    if (key === "tech stack") techStack = trimBlank(c.lines).join("\n");
    else if (key === "hard rules")
      hardRules = trimBlank(c.lines.filter((l) => !(l.trim().startsWith(">") && isKnown(l)))).join("\n");
    else if (key === "where to find things") whereToFind = trimBlank(c.lines).join("\n");
    else if (key === "working agreement") wa = migrateWorkingAgreement(c.lines.join("\n"), isKnown, report);
    else {
      extraSections.push([c.heading, ...c.lines].join("\n"));
      report.extraSections.push(c.title);
    }
  }

  const keptPreamble = trimBlank(chunks[0].lines.filter((l) => !(l.trim().startsWith(">") && isKnown(l))));
  const head = [...keptPreamble, "", SOT_NOTE].join("\n");
  const build = (where) =>
    buildAgentsMd({
      head,
      techStack: techStack || PLACEHOLDERS.techStack,
      hardRules: hardRules || PLACEHOLDERS.hardRules,
      gate: wa.gate,
      gateNotes: wa.gateNotes.join("\n"),
      maintainer,
      protocolBlock,
      localExtensions: wa.extensions.length ? wa.extensions.join("\n\n") : PLACEHOLDERS.localExtensions,
      divisionOfLabor: wa.divisionOfLabor || DEFAULT_DIVISION,
      extraSections,
      whereToFind: where,
    });

  let agents = build(whereToFind || PLACEHOLDERS.whereToFind);
  let indexMd = null;
  if (Buffer.byteLength(agents) > AGENTS_MAX_BYTES && whereToFind) {
    indexMd = `# Index\n\n> Moved out of AGENTS.md by the Gearbox v2 migration (ADR-0051): AGENTS.md is loaded into every agent session and capped at 32 KiB. Keep one line per entry here too.\n\n${whereToFind}\n`;
    report.indexMoved = { bytes: Buffer.byteLength(whereToFind) };
    agents = build(INDEX_POINTERS);
  }
  if (Buffer.byteLength(agents) > AGENTS_MAX_BYTES) report.oversize = Buffer.byteLength(agents);

  const context = migrateContext(contextMd, known, isKnown, glossaryBlock, report);
  return { agentsMd: agents, contextMd: context, indexMd, report };
}
```

- [ ] **Step 4: Run it and watch it pass.** Run `node --test test/*.test.js`. Expected: PASS.
  - If the "local additions" size assertion fails because of the test template's size, adjust the `.repeat(900)` count so the index alone exceeds 32 KiB. Do not change the budget.

- [ ] **Step 5: Commit.**

```bash
git add scripts/lib/migrate-v1.js test/migrate-v1.test.js
git commit -m "feat(lib): v1 → v2 migration of AGENTS.md / CONTEXT.md (ADR-0050)

Project content keeps its place; the hand-merged protocol region is replaced by
the fence. Unknown lines are carried into Local protocol extensions, unknown
subsections move there whole, translated subsections are flagged rather than
duplicated, and an oversized index moves to docs/INDEX.md. A test holds the
invariant that no local line disappears silently.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `update` migrates v1 downstreams; preview helper; real-install fixture

**Files:**
- Modify: `scripts/gearbox-update`
- Create: `scripts/dev/migrate-preview.js`, `test/fixtures/v1.15.2-install/AGENTS.md`, `test/fixtures/v1.15.2-install/CONTEXT.md`
- Test: `test/update-migrate.test.js`

**Interfaces:**
- Consumes:
  - `migrateV1` (Task 10), `loadKnown` (Task 9)
  - `planFences`, `gitOps`, `generateReport` hooks (Task 7)
- Produces: a v1 repo → a v2 layout on the backfill branch, with the report section `## ⚠️ v1 → v2 layout migration (ADR-0050)`.

- [ ] **Step 1: Generate the real v1.15.2 fixture** (Gearbox's own public template text):

```bash
W=$(mktemp -d) && mkdir -p "$W/up" "$W/t" && git archive v1.15.2 | tar -x -C "$W/up" \
  && GEARBOX_DIR="$W/up" node "$W/up/scripts/gearbox-install" "$W/t" --name example-project --maintainer octo-owner --gate "npm test" </dev/null >/dev/null \
  && mkdir -p test/fixtures/v1.15.2-install && cp "$W/t/AGENTS.md" "$W/t/CONTEXT.md" test/fixtures/v1.15.2-install/ && rm -rf "$W"
grep -c "octo-owner" test/fixtures/v1.15.2-install/AGENTS.md
```

Expected: a count ≥ 3 (the maintainer was substituted).

- [ ] **Step 2: Write the failing test** — `test/update-migrate.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { findFence } from "../scripts/lib/fence.js";
import { sectionBody } from "../scripts/lib/sections.js";
import { ciYml } from "../scripts/lib/workflows.js";
import { REPO, makeUpstream, runTool, gitInit, tmp, read, write, commitAll } from "./helpers.js";

const FX = join(REPO, "test/fixtures/v1.15.2-install");
const WHILE_WORKING = "- Commit in small steps; the message should spell out the **why**, not just the what";

test("update migrates a real v1.15.2 install to the v2 layout on a backfill branch", () => {
  const up = makeUpstream();
  const down = tmp("gearbox-v1-");
  gitInit(down);
  const agentsV1 = readFileSync(join(FX, "AGENTS.md"), "utf8");
  assert.ok(agentsV1.includes(WHILE_WORKING), "fixture drifted: While working bullet not found");
  write(down, "AGENTS.md", agentsV1.replace(WHILE_WORKING, `${WHILE_WORKING}\n- Search closed issues before claiming a task (project ADR-0148)`));
  write(down, "CONTEXT.md", readFileSync(join(FX, "CONTEXT.md"), "utf8").replace("|---|---|---|\n", "|---|---|---|\n| star | loyalty point | — |\n"));
  write(down, "CLAUDE.md", "@AGENTS.md\n");
  write(down, ".github/workflows/ci.yml", ciYml("npm test"));
  write(down, ".github/workflows/gearbox-sync.yml", "run: npx -y gearbox-agents@latest update --refresh-drift\n");
  write(down, ".gearbox-version", "v1.15.2\n");
  cpSync(join(up, "docs/gearbox-adr"), join(down, "docs/gearbox-adr"), { recursive: true });
  commitAll(down, "a v1 downstream");

  const r = runTool("gearbox-update", ["--no-push"], { cwd: down, env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 0, r.out);
  const agents = read(down, "AGENTS.md");
  assert.equal(findFence(agents, "protocol").block, findFence(read(up, "AGENTS.md"), "protocol").block);
  assert.match(sectionBody(agents, 2, "Gate"), /npm test/);
  assert.match(agents, /GitHub account: `octo-owner`/);
  assert.match(sectionBody(agents, 2, "Local protocol extensions"), /Search closed issues before claiming a task/);
  assert.match(read(down, "CONTEXT.md"), /\| star \| loyalty point \| — \|/);
  assert.equal(read(down, ".gearbox-version").trim(), "v2.0.0");
  assert.ok(existsSync(join(down, ".github/workflows/gearbox-check.yml")));
  assert.match(read(down, ".github/workflows/gearbox-sync.yml"), /gearbox-agents@2/);
  assert.match(read(down, "gearbox-update-report.md"), /v1 → v2 layout migration/);
  const c = runTool("gearbox-check", [], { cwd: down });
  assert.equal(c.code, 0, c.out);
});
```

- [ ] **Step 3: Run it and watch it fail.** Run `node --test test/*.test.js`. Expected: FAIL with `This repo still has the v1 AGENTS.md layout`.

- [ ] **Step 4: Wire the migration into `scripts/gearbox-update`.**

  **Imports.** Add `import { loadKnown } from "./lib/v1-known.js";` and `import { migrateV1 } from "./lib/migrate-v1.js";`.

  **Plan the migration.** In `main()`, replace the `else { die("This repo still has the v1 AGENTS.md layout …") }` branch with:

  ```js
    } else {
      const [agentsFile, contextFile] = fences.files;
      migration = migrateV1({
        agentsMd: agentsFile.text,
        contextMd: contextFile.text,
        known: loadKnown(),
        protocolBlock: agentsFile.status.upstream.block,
        glossaryBlock: contextFile.status.upstream.block,
      });
      stdout.write(C.yellow("⚠️  v1 AGENTS.md layout — migrating to the Gearbox v2 layout (ADR-0050)\n\n"));
    }
  ```

  **Write the migrated files.** Next to the `fenceWrites` file writes, add:

  ```js
    if (migration) {
      writeFileSync(join(downDir, "AGENTS.md"), migration.agentsMd);
      writeFileSync(join(downDir, "CONTEXT.md"), migration.contextMd);
      if (migration.indexMd) {
        const indexPath = join(downDir, "docs/INDEX.md");
        mkdirSync(dirname(indexPath), { recursive: true });
        const prior = existsSync(indexPath) ? readFileSync(indexPath, "utf8").trimEnd() + "\n\n## Moved from AGENTS.md (Gearbox v2 migration)\n\n" : "";
        writeFileSync(indexPath, prior ? prior + migration.indexMd.replace(/^# Index\n\n/, "") : migration.indexMd);
      }
    }
  ```

  **Commit the migration.** Replace the placeholder `function commitMigration() {}` with:

  ```js
  function commitMigration(migration, protocolVersion) {
    const r = migration.report;
    const paths = ["AGENTS.md", "CONTEXT.md", ...(migration.indexMd ? ["docs/INDEX.md"] : [])];
    run(`git add ${paths.join(" ")}`);
    runWithStdin(
      "git commit -F -",
      `docs(protocol): migrate to the Gearbox v2 layout (${protocolVersion})

  The protocol body now sits in a tool-managed fence and project content in project
  sections (gearbox ADR-0050): ${r.carried.reduce((n, c) => n + c.lines, 0)} local line(s) carried and
  ${r.moved.length} subsection(s) moved into Local protocol extensions, ${r.flagged.length} subsection(s)
  flagged for manual review${r.indexMoved ? ", index moved to docs/INDEX.md" : ""}.
  See gearbox-update-report.md for what moved where and what needs a human.
  by gearbox-update tool.`,
    );
  }
  ```

  **Report the migration.** Replace the placeholder `function migrationReportLines() { return []; }` with:

  ```js
  function migrationReportLines(m) {
    const r = m.report;
    const L = [
      "## ⚠️ v1 → v2 layout migration (ADR-0050)",
      "",
      "This repo's AGENTS.md protocol text was merged by hand under v1. It is now a tool-managed fence, and project content lives in project sections. Every line that wasn't known upstream text is accounted for below — nothing was dropped silently, and the pre-migration text is in this branch's base commit (`git show <base>:AGENTS.md`).",
      "",
      `- Maintainer: ${r.maintainer ? `\`${r.maintainer}\`` : "**not detected — fill in `## Maintainer`**"}`,
      `- Gate command: ${r.gateMoved ? "moved to `## Gate`" : "**not found — fill in `## Gate`**"}${r.gateNotes ? ` (+${r.gateNotes} project note line(s))` : ""}`,
      `- Division of labor: ${r.divisionOfLabor === "kept" ? "your choice, kept in `## Division of labor`" : "default (claim-based ownership)"}`,
    ];
    if (r.indexMoved) L.push(`- Where to find things: moved to \`docs/INDEX.md\` (${r.indexMoved.bytes} bytes) to fit the 32 KiB budget; AGENTS.md keeps four pointer lines`);
    if (r.oversize) L.push(`- **AGENTS.md is still ${r.oversize} bytes (> 32768)** — trim Local protocol extensions or project sections (point to ADRs for detail)`);
    L.push("");
    if (r.moved.length) {
      L.push("### Subsections moved verbatim into `## Local protocol extensions`", "");
      for (const t of r.moved) L.push(`- [ ] ${t} — set its \`Upstream:\` (an upstream issue link, or \`project-specific\`); if it's a project procedure rather than a protocol extension, move it to a project section`);
      L.push("");
    }
    if (r.carried.length) {
      L.push("### Local lines carried into `## Local protocol extensions`", "");
      for (const c of r.carried) L.push(`- [ ] From v1: ${c.section} — ${c.lines} line(s). A line edited in place is carried whole: trim what the fence now says anyway, then set \`Upstream:\``);
      L.push("");
    }
    if (r.flagged.length) {
      L.push("### ⚠️ Subsections flagged for manual review (not carried)", "", "More than half their lines weren't known upstream text (translated or rewritten). Compare them with the pre-migration AGENTS.md and move any genuine project rule into `## Local protocol extensions`:", "");
      for (const f of r.flagged) L.push(`- [ ] ${f.section} — ${f.unknown}/${f.total} unknown lines`);
      L.push("");
    }
    if (r.extraSections.length) {
      L.push("### Other top-level sections kept as they were", "");
      for (const t of r.extraSections) L.push(`- ${t}`);
      L.push("");
    }
    L.push("### CONTEXT.md", "", `- ${r.context.removedTerms} protocol term row(s) replaced by the glossary fence; ${r.context.keptRows} project row(s) kept`);
    if (r.context.editedTerms.length) L.push(`- [ ] Protocol terms whose definition had been edited locally (the fence now carries upstream's): ${r.context.editedTerms.join(", ")}`);
    L.push("");
    return L;
  }
  ```

  **Header comment.** Add `6. v1 layout (no fence): migrates AGENTS.md / CONTEXT.md to the v2 layout (ADR-0050, scripts/lib/migrate-v1.js)` to "What it does".

- [ ] **Step 5: Write the preview helper** — `scripts/dev/migrate-preview.js` (then `chmod +x`):

```js
#!/usr/bin/env node
// Maintainer helper: preview the v1 → v2 migration of a downstream checkout without touching it.
// Usage (from the Gearbox repo root): node scripts/dev/migrate-preview.js <downstream-dir> <out-dir>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { findFence } from "../lib/fence.js";
import { loadKnown } from "../lib/v1-known.js";
import { migrateV1 } from "../lib/migrate-v1.js";

const [down, out] = process.argv.slice(2).map((p) => p && resolve(p));
if (!down || !out) {
  console.error("usage: node scripts/dev/migrate-preview.js <downstream-dir> <out-dir>");
  process.exit(1);
}
const root = process.cwd();
const read = (dir, f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
const m = migrateV1({
  agentsMd: read(down, "AGENTS.md"),
  contextMd: read(down, "CONTEXT.md"),
  known: loadKnown(),
  protocolBlock: findFence(read(root, "AGENTS.md"), "protocol").block,
  glossaryBlock: findFence(read(root, "CONTEXT.md"), "glossary").block,
});
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "AGENTS.md"), m.agentsMd);
writeFileSync(join(out, "CONTEXT.md"), m.contextMd);
if (m.indexMd) writeFileSync(join(out, "INDEX.md"), m.indexMd);
writeFileSync(join(out, "report.json"), JSON.stringify(m.report, null, 2) + "\n");
console.log(
  `AGENTS.md ${Buffer.byteLength(m.agentsMd)} B · maintainer ${m.report.maintainer || "?"} · carried ${m.report.carried.length} · moved ${m.report.moved.length} · flagged ${m.report.flagged.length} · index ${m.report.indexMoved ? "moved" : "kept"}${m.report.oversize ? ` · OVERSIZE ${m.report.oversize} B` : ""}`,
);
```

- [ ] **Step 6: Run it and watch it pass.** Run `node scripts/check-gearbox.js && node --test test/*.test.js`. Expected: PASS.
- [ ] **Step 7: Commit.**

```bash
git add scripts/gearbox-update scripts/dev/migrate-preview.js test/update-migrate.test.js test/fixtures/v1.15.2-install
git commit -m "feat(update): migrate v1 downstreams to the fenced layout on the backfill branch (ADR-0050)

The same update run that every downstream (and its weekly sync Action) already
performs now performs the migration, on a reviewable branch whose PR body lists
what moved where and what needs a human. Tested end to end against the real
output of the v1.15.2 installer.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Dry-run against the three real downstream repos

**Files:** none in this repo unless a bug turns up (then: a test + fix, one commit each). Outputs go to the session scratchpad.

- [ ] **Step 1: Preview all three** (read-only on the clones):

```bash
SP=/private/tmp/claude-501/-Users-stanyan-Github-gearbox--claude-worktrees-gearbox-promo-video-262514/c1f5fbdb-f596-403a-a497-897c263932bc/scratchpad
for r in Mandy-s-Bubble-Tea-App Mr-Otto Mandy-s-Bubble-Tea; do
  git -C "$SP/data/$r/repo" fetch -q origin && git -C "$SP/data/$r/repo" checkout -q origin/HEAD
  node scripts/dev/migrate-preview.js "$SP/data/$r/repo" "$SP/preview/$r"
done
```

Expected against spec §4 "The three repos":
- **App**: maintainer `real-stanyan`; carried 0 (or only the Division-of-labor choice); flagged 0.
- **Mr-Otto**: several carried sections; moved includes "Worktree discipline (project ADR-0149)"; index moved; possibly OVERSIZE.
- **Mandy web**: most subsections flagged; moved includes the Supabase migration subsection.

- [ ] **Step 2: Read each preview.**
  - Read `$SP/preview/<repo>/AGENTS.md` and `report.json` in full.
  - For each repo, check four things:
    1. `## Gate` holds the real command.
    2. No project rule vanished — diff the old WA region against the preview's Local extensions + Gate.
    3. `CONTEXT.md` kept the product terms.
    4. The size is under 32 KiB (except a noted Mr-Otto OVERSIZE).
  - Write findings to `$SP/preview/FINDINGS.md`.
- [ ] **Step 3: Fix real bugs test-first.**
  - Missing alias, heading misparse, lost line: add a failing case to `test/migrate-v1.test.js` using synthetic text that reproduces the shape (never paste private content), fix `migrate-v1.js`, rerun the gate, commit (`fix(migrate): …`).
  - Judgment calls (e.g. whether a Mandy procedure belongs in extensions) are not bugs — they're recorded for Tasks 16–18.
- [ ] **Step 4: Run the full update on disposable copies** and check the result:

```bash
for r in Mandy-s-Bubble-Tea-App Mr-Otto Mandy-s-Bubble-Tea; do
  rm -rf "$SP/trial/$r" && mkdir -p "$SP/trial" && cp -R "$SP/data/$r/repo" "$SP/trial/$r"
  (cd "$SP/trial/$r" && git checkout -q -B main origin/HEAD && GEARBOX_DIR=/Users/stanyan/Github/gearbox/.claude/worktrees/gearbox-promo-video-262514 node /Users/stanyan/Github/gearbox/.claude/worktrees/gearbox-promo-video-262514/scripts/gearbox-update --no-push; \
   node /Users/stanyan/Github/gearbox/.claude/worktrees/gearbox-promo-video-262514/scripts/gearbox-check; echo "check exit=$?")
done
```

Expected: `update` exits 0 for all three (`--no-push`, so nothing reaches GitHub). `gearbox-check` is green for App. For Mr-Otto and Mandy web, it lists exactly the manual items predicted by the report.

---

### Task 13: ADRs, README, PR template, final gate

**Files:**
- Create: `docs/gearbox-adr/0050-protocol-fence.md`, `docs/gearbox-adr/0051-protocol-check-and-size-budget.md`
- Modify: `README.md`, `.github/pull_request_template.md`, `docs/superpowers/specs/2026-09-29-protocol-fence-v2-design.md` (status line)

- [ ] **Step 1: Write ADR-0050** — `docs/gearbox-adr/0050-protocol-fence.md`:

```markdown
# ADR-0050: The protocol body is a tool-managed fence in AGENTS.md / CONTEXT.md

- Date: 2026-09-29
- Status: accepted
- Related: ADR-0017 (update never touched AGENTS.md — amended), ADR-0022 (install transforms — replaced), ADR-0023 (version stamp — amended), ADR-0013/0026 (hand-edit report — retired; pull trigger kept), ADR-0032 (protocol language), ADR-0049 (scheduled sync)

## Context

A 2026-09-29 audit of three downstream repos found that downstream protocol text was maintained by hand, and that this caused four failures.

- **Drift.** `gearbox-update` only printed a checklist of AGENTS.md sections to edit. One downstream still carried the Chinese-era protocol plus hand-translated additions; another grew about eight local clauses inside the protocol sections. Nothing could re-align them mechanically.
- **A false sync signal.** `gearbox-version` counted ADR files, so it printed "✅ fully synced" and "behind by patch" in the same run. `gearbox-update` returned early when no ADR was missing, without bumping `.gearbox-version`, which left two downstreams at v1.15.0 while their weekly sync Action reported success.
- **Version noise.** v1.15.1 and v1.15.2 changed no protocol file, yet moved the protocol version every downstream compares against.
- **Unbounded growth.** One `AGENTS.md` reached 324 KB, loaded in full into every session.

ADR-0049 drew a line — "tooling never writes AGENTS.md" — to keep automation at *prepared, reviewable* and never *applied*. That line protected against the wrong thing. The review net was always the PR, not the author of the edit, and hand edits turned out to be the main source of divergence.

## Decision

The protocol lives in two fenced blocks: `gearbox:protocol` in AGENTS.md and `gearbox:glossary` in CONTEXT.md. Both are byte-identical in every repo for a given protocol version.

- **Markers.**
  - Begin: `<!-- gearbox:<name> vX.Y.Z sha256:<12 hex>; … -->`. End: `<!-- /gearbox:<name> -->`.
  - The hash is the first 12 hex chars of sha256 of the content, normalized (LF, no trailing whitespace, no blank edges).
  - Both markers carry the protocol version; downstream `.gearbox-version` equals it.
- **Layout.**
  - Project sections sit outside the fence: `## Tech stack`, `## Hard rules`, `## Gate` (the command), `## Maintainer` (the GitHub account), `## Local protocol extensions`, `## Division of labor`, `## Where to find things`.
  - The fence contains no project value: `<maintainer>` placeholders become "the maintainer (`## Maintainer`)", and the Gate command becomes the Gate *contract*.
  - Upstream Gearbox uses the same skeleton. Its upstream-only release rules are its own local extension.
- **Local protocol extensions.** A project's deviation goes in `## Local protocol extensions` as a `###` entry with `- Extends:` and `- Upstream:` lines. It is tiered as if it were written into the section it extends (ADR-0006/0012 unchanged). Downstream repos never edit the fence.
- **Tooling.**
  - `gearbox-install` assembles the skeleton and copies the fences verbatim; its protocol-text transforms are gone.
  - `gearbox-update` rewrites both fences on a `docs/gearbox-backfill-*` branch. It refuses a hand-edited fence unless `--force` (the diff goes into the report), and it always bumps `.gearbox-version`.
  - On a v1 layout, `gearbox-update` migrates it (see below).
  - `gearbox-version` reports each fence as synced / behind / hand-edited / v1 layout. "Synced" means the fences match upstream, no ADR is missing, and the stamp is current.
- **Two version numbers.**
  - The package version (package.json = tag) moves every release.
  - The protocol version (the markers) moves only when fence content changes, and then equals that release's package version.
  - The upstream self-check enforces it: fence content that changed since the latest tag requires marker version == package.json version. `scripts/dev/rehash-fences.js` maintains the markers.
- **Migration from v1.**
  - Project content keeps its place.
  - Lines of the old protocol region that aren't known upstream text are carried into `## Local protocol extensions`. The "known" test uses a hashed fingerprint of every line upstream ever published (`scripts/lib/v1-known-lines.json`).
  - Unrecognized subsections move there whole.
  - Subsections more than half unknown (translated or rewritten) are flagged for a human rather than duplicated.
  - An oversized index moves to `docs/INDEX.md`.
  - Nothing disappears silently: every unknown line is carried or named in the PR report.
- **Language.** The fence is English (ADR-0032). Project sections may use any language.

## Consequences

- A downstream protocol update is a mechanical rewrite reviewed in a PR, not a merge task. Future protocol changes reach every downstream through the existing pull path with no per-section checklist.
- ADR-0049's boundary moves from "tooling never writes AGENTS.md" to "tooling writes only between the markers, and only on a branch": prepared and reviewable, never applied. The supply-chain exposure is unchanged in kind — the sync Action already ran package code with write access. Pinning `@2` (ADR-0051) removes the surprise-major part of it.
- Local rules can no longer hide inside the protocol text. They are visible, tiered, and labeled with their upstream status — the raw material for folding generic ones back upstream.
- The first migration of each existing downstream needs one human pass over the flagged items. Repos installed in the Chinese era get the most flags.
- **Don't** reintroduce per-project text inside the fence (names, commands, paths). One such line breaks byte-identity for every downstream.
```

- [ ] **Step 2: Write ADR-0051** — `docs/gearbox-adr/0051-protocol-check-and-size-budget.md`:

```markdown
# ADR-0051: A protocol check in every repo's CI, and a 32 KiB budget for AGENTS.md

- Date: 2026-09-29
- Status: accepted
- Related: ADR-0050 (fences), ADR-0002 (self-check as gate), ADR-0010/0020 (gate tiers), ADR-0049 (scheduled sync — amended: major pin)

## Context

Downstream CI ran only the project's own gate. Nothing verified the protocol itself: a hand-edited or translated protocol body, a Gate command CI didn't actually run, and an `AGENTS.md` that grew from 21 KB to 324 KB in six weeks all passed.

Every agent loads `AGENTS.md` whole at session start — one repo was paying about 100k tokens per session for it. Codex reads only the first 32 KiB by default and silently drops the rest. The growth was almost entirely "Where to find things": index entries written as paragraphs.

## Decision

- **`gearbox-agents check`** is an offline, read-only command that runs the same assertions downstream and (inside `scripts/check-gearbox.js`) upstream:
  1. Both fences present and unedited (hash matches its marker).
  2. Equal fence versions, and `.gearbox-version` equal to them (downstream).
  3. `AGENTS.md` ≤ 32768 bytes.
  4. The required project sections outside the fence, and the required protocol sections inside it.
  5. `CLAUDE.md` is the `@AGENTS.md` shell; there is no `HANDOFF.md`; protocol files aren't gitignored.
  6. `ci.yml` runs every line of the `## Gate` command block (trailing `# comments` stripped), and the block isn't still a placeholder.

  Warnings, which don't fail the check: a placeholder maintainer, and a local extension without an `Upstream:` line or with `Upstream: undecided`.
- **CI.** `.github/workflows/gearbox-check.yml` is tool-owned — install writes it, update refreshes it — and runs `npx -y gearbox-agents@2 check` on PRs and pushes to the default branch. The Gate contract now reads: CI's `gate` job runs the Gate command byte-for-byte; the `gearbox-check` job runs the protocol check; both green to merge and before shift-end.
- **Budgets.**
  - `AGENTS.md` ≤ 32 KiB, matching the Codex default, so every tool sees the whole file.
  - Upstream, the protocol fence itself ≤ 20 KiB, leaving at least 12 KiB for project content.
  - "Where to find things" is one line per entry; longer maps go in `docs/INDEX.md`, which is not auto-loaded.
- **Major pin.** `gearbox-sync.yml` runs `gearbox-agents@2` instead of `@latest`, and update rewrites existing copies. A new major version reaches downstreams only when a human changes the pin.
- **Gate commands.** Gearbox's own gate becomes `node scripts/check-gearbox.js && node --test test/*.test.js`: the tools now carry a `node:test` suite. The glob is shell-expanded so it works on Node 18–24 and never scans `.claude/worktrees/`.

## Consequences

- A hand edit inside the fence, a growing `AGENTS.md` or a CI/Gate mismatch turns the PR red where it happens, instead of surfacing weeks later in an audit.
- The 32 KiB line will block unrelated PRs in a repo whose `AGENTS.md` is already too large, until someone moves content out. That is intended: the cost of the bloat is paid every session, so it gets fixed first.
- The check fetches the package via npx in CI. An npm outage makes the job red — rerun it; the check itself never needs the network.
- **Don't** raise the byte budget to make a red check go away. Move rationale into ADRs and maps into `docs/INDEX.md`.
```

- [ ] **Step 3: README edits** (Edit tool, exact strings):
  - **Quick start block.** After the line `npx gearbox-agents update     # copy missing upstream ADRs into this repo, producing a review-ready branch`, add:

    ```
    npx gearbox-agents check      # offline protocol check: fences intact, AGENTS.md ≤ 32 KiB, CI == Gate (ADR-0051)
    ```

    Change that `update` line's comment to `# rewrite the protocol fences + copy new ADRs on a review-ready branch (migrates a v1 layout, ADR-0050)`.
  - **"For AI agents", step 1.** `(it has a \`## Working agreement (multi-agent)\` section)` → `(it has a \`<!-- gearbox:protocol\` marker — or, before v2, a \`## Working agreement (multi-agent)\` section)`.
  - **Step 3.** `lists them: project intro, Hard rules, Tech stack` → `lists them: project intro, Tech stack, Hard rules, Division of labor, Where to find things`.
  - **Maintainers list, item 3.** `Step 4 of the three start-of-shift steps runs` → `Step 4 of the start-of-shift steps runs`.
  - **Architecture table.** After the `AGENTS.md` row, add:

    ```
    | The `gearbox:protocol` fence | The protocol body inside `AGENTS.md` (and `gearbox:glossary` in `CONTEXT.md`): byte-identical in every repo, rewritten by `gearbox-agents update`, hash-checked by the `gearbox-check` CI job. Projects add rules in `## Local protocol extensions` (ADR-0050/0051) |
    ```

- [ ] **Step 4: PR template.**
  - In `.github/pull_request_template.md`'s Version bump comment, after `(= latest tag + bump segment, ADR-0028/0029).`, add the line `If this PR changes fence content, run node scripts/dev/rehash-fences.js after setting the version (ADR-0050); a README/site-only release keeps the protocol version.`
  - In the Gate section, `<!-- paste the output of node scripts/check-gearbox.js -->` → `<!-- paste the output of: node scripts/check-gearbox.js && node --test test/*.test.js -->`.
- [ ] **Step 5: Spec status.** Change the spec's `Status:` line to `Status: approved; implemented by docs/superpowers/plans/2026-09-29-protocol-fence-v2.md`.
- [ ] **Step 6: Final gate + budgets.** Run `node scripts/check-gearbox.js && node --test test/*.test.js && wc -c AGENTS.md`. Expected: green; `AGENTS.md` < 32768.
- [ ] **Step 7: Commit.**

```bash
git add docs/gearbox-adr/0050-protocol-fence.md docs/gearbox-adr/0051-protocol-check-and-size-budget.md README.md .github/pull_request_template.md docs/superpowers/specs/2026-09-29-protocol-fence-v2-design.md
git commit -m "docs(adr): ADR-0050 protocol fence, ADR-0051 protocol check + 32 KiB budget

Records why tooling now writes between the markers (the review net was always
the PR), the protocol/package version split, the migration's no-silent-loss rule,
and why the byte budget must not be raised to silence a red check.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Push, open the PR, request L1 approval

**Files:** none (GitHub). **Outward action** — confirm with the user before pushing if they haven't said go in this session.

- [ ] **Step 1: Push.** Run `git push -u origin claude/gearbox-improvements-d4d1d0`.
- [ ] **Step 2: Open the PR**, closing the tracking issue from Task 0:

```bash
gh pr create -R real-stanyan/gearbox --base main --head claude/gearbox-improvements-d4d1d0 \
  --title "Gearbox v2: the protocol body becomes a tool-managed fence (ADR-0050/0051)" --body "$(cat <<EOF
## What / Why / Changes

Closes #$TRACK. Downstream protocol text was merged by hand. That caused drift, a false "fully synced" signal, a stamp stuck at v1.15.0, and a 324 KB AGENTS.md. Design: \`docs/superpowers/specs/2026-09-29-protocol-fence-v2-design.md\`; plan: \`docs/superpowers/plans/2026-09-29-protocol-fence-v2.md\`.

- The protocol body sits between \`gearbox:protocol\` / \`gearbox:glossary\` markers (version + content hash); project content is in project sections (ADR-0050).
- \`gearbox-agents check\` + a tool-owned \`gearbox-check.yml\` CI job; \`AGENTS.md\` ≤ 32 KiB (ADR-0051).
- install copies fences verbatim; update rewrites them, refuses hand edits without \`--force\`, always bumps the stamp, and migrates v1 layouts; version reports fence states.
- The gate adds a \`node:test\` suite; the self-check enforces fence integrity, budgets and the protocol-version rule.

**L1** — this changes the Gate command, rewrites "Changing the protocol itself", moves the Hard-rules designation note, and removes self-check assertion #9 (the AGENTS_MD_IMPACT map is retired with the hand-edit flow). This repo has two collaborators, so under ADR-0042 approval is a PR comment \`agreed\` from @real-stanyan.

## Affects downstream

- Affects downstream: yes — every downstream migrates to the v2 layout through \`gearbox-agents update\` or its weekly sync Action (a reviewable PR; flagged items need one human pass).

## Version bump

- Version bump: major — file layout + install-anchor structure change (package.json → 2.0.0).

## Gate

\`\`\`
$(node scripts/check-gearbox.js 2>&1 | tail -1) · $(node --test test/*.test.js 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ')
\`\`\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Bind the PR** with the ccd_pr tools (`get_status`, then `bind_pr` if needed). Wait for CI to go green.
- [ ] **Step 4: Ask the user** to comment `agreed` on the PR from `real-stanyan`. Do not merge before that comment exists.
- [ ] **Step 5: Merge** — merge commit only (ADR-0007):

```bash
gh pr merge <PR#> -R real-stanyan/gearbox --merge
```

---

### Task 15: Tag v2.0.0; the maintainer publishes

- [ ] **Step 1: Tag** (after the merge), from an up-to-date main:

```bash
git fetch origin && git tag -a v2.0.0 origin/main -m "v2.0.0: protocol fence + protocol check (ADR-0050/0051)" && git push origin v2.0.0
```

- [ ] **Step 2: Ask the maintainer to publish.** Tell the user to run `npm publish` from an up-to-date main checkout (agents don't publish, ADR-0029).
- [ ] **Step 3: Verify.** After they confirm, run `npm view gearbox-agents@2 version`. Expected: `2.0.0`.
- [ ] **Step 4: Smoke-test from the registry.** Run `npx -y gearbox-agents@2 check` in a scratch copy of an installed tree. Expected: the same result as the local tool.

---

### Tasks 16–18: Migrate the three downstream repos

The procedure is the same for each repo (Mandy-s-Bubble-Tea-App first, then Mr-Otto, then Mandy-s-Bubble-Tea); only the manual pass differs. Outward actions in each repo (issue, push, PR, merge) follow that repo's own AGENTS.md. Confirm with the user before the first push in each repo.

- [ ] **Step 1: Shift start in that repo.** Run the three start-of-shift steps per its AGENTS.md. Open a Task issue "Adopt Gearbox v2 layout (ADR-0050/0051)" linking the gearbox PR, and claim it.
- [ ] **Step 2: Fresh full clone** in the scratchpad (never the user's working checkout):

```bash
SP=/private/tmp/claude-501/-Users-stanyan-Github-gearbox--claude-worktrees-gearbox-promo-video-262514/c1f5fbdb-f596-403a-a497-897c263932bc/scratchpad
git clone -q https://github.com/real-stanyan/<REPO>.git "$SP/migrate/<REPO>" && cd "$SP/migrate/<REPO>" && npx -y gearbox-agents@2 update --no-push --refresh-drift
```

- [ ] **Step 3: Manual pass.** Work through the report checklist in `gearbox-update-report.md`.
  - **App:**
    - Expect nothing flagged.
    - Set `Upstream:` on any carried entry.
    - Confirm `## Division of labor` kept "No fixed division of labor…".
  - **Mr-Otto:**
    - For each carried/moved entry, decide `Upstream:`. The generic ones — worktree discipline, collision search before claiming, Task issue before exploring, ADR-0069 context-only, CONTEXT two sections, verify "can't do", project ADR claim-at-merge — get `Upstream: undecided` replaced by a new gearbox issue link. Open one gearbox issue per mechanism, confirming with the user first (outward).
    - Trim to ≤ 32 KiB: keep rules, move rationale to the project ADRs they already cite.
    - Check that `docs/INDEX.md` holds the old index.
  - **Mandy web:**
    - For each flagged subsection, compare the pre-migration Chinese text with the Chinese-era gearbox template (`git -C <gearbox> show ab252a0:AGENTS.md`).
    - Move genuine local rules into Local protocol extensions: the "only assign Stan what only Stan can do" criterion; start-of-shift step 5 `/msg`, marked "Claude Code-specific"; the Supabase migration procedure, possibly to a project section.
    - Set `## Maintainer` to `real-stanyan` (the Chinese text names "Stan", so the migration can't detect it).
- [ ] **Step 4: Verify.** Run that repo's Gate and `npx -y gearbox-agents@2 check`, then `npx -y gearbox-agents@2 version`. Expected: check green; version prints `fully synced`.
- [ ] **Step 5: Commit the manual pass** on the backfill branch. Use a why-message and end it with the Co-Authored-By line.
- [ ] **Step 6: Push and open the PR**, with the report as the body plus a "Manual pass" section:

```bash
git push -u origin docs/gearbox-backfill-<date>
gh pr create --base main --head docs/gearbox-backfill-<date> --body-file gearbox-update-report.md --title "Adopt Gearbox v2 layout (ADR-0050/0051)"
```

- [ ] **Step 7: L1 in that repo.** Wait for CI (gate + gearbox-check) green and the maintainer's agreement.
  - Mr-Otto recorded itself as single-human (PR #1266), so in-session agreement is valid there.
  - The Mandy repos list DamianBuilds-ai as a collaborator, so the PR-comment path applies.
- [ ] **Step 8: Merge** with a merge commit and close the Task issue.
- [ ] **Step 9: Disarm the weekly Action's copy of the migration.** A migration PR on `docs/gearbox-backfill-*` suppresses the weekly sync Action only while it is open. After merge, confirm `gearbox-agents version` is synced so the next scheduled run finds nothing to do.

---

### Task 19: Wrap-up

- [ ] **Step 1: Gearbox handoff.** Open the shift's handoff issue in gearbox (or declare terminal per the protocol).
  - Body: the three migrations' outcomes, the gearbox issues opened from Mr-Otto's mechanisms, and the next sub-projects (D handoff lifecycle, C ADR numbering, B identity/L1), each needing its own spec.
  - Memory comment: five-part.
- [ ] **Step 2: Clean up.** Remove the scratchpad clones. Run `node scripts/gearbox-prune` (dry-run) in the gearbox main checkout to report leftovers.
