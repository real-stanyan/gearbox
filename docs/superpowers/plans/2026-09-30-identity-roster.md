# Identity Roster and an Honest L1 Approval Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `## Maintainer` with a `## Roster` of GitHub accounts, check it offline, and rewrite the fenced L1 rule so that multi-human repos approve L1 only by the maintainer's own merge and agents never write approvals (ADR-0053).

**Architecture:** A pure parser (`scripts/lib/roster.js`) is the single reader of `## Roster`. The offline protocol check (`scripts/lib/protocol-check.js`) consumes it; the skeleton (`scripts/lib/skeleton.js`) writes it for install and the v1 → v2 migration. The protocol text change lands after the tooling.

**Tech Stack:** Node.js ≥ 18, ES modules (`"type": "module"`), zero runtime dependencies, `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-09-30-identity-roster-design.md`

## Global Constraints

- Gate (run after every task, must be green): `node scripts/check-gearbox.js && node --test test/*.test.js`
- No runtime dependencies; no new devDependencies.
- Roster line forms, byte-exact (em dash `—` U+2014, one space either side):
  - `` - `<login>` — human: <person> `` optionally followed by ` — maintainer`
  - `` - `<login>` — shared: <person> `` optionally followed by ` — maintainer`
  - `` - `<login>` — agent, run by <person> ``
  - The parser also accepts ` - ` (ASCII hyphen with spaces) wherever ` — ` appears.
- Protocol ADR: `docs/gearbox-adr/0053-identity-roster.md`, cited `ADR-0053`. `<ISSUE_B>` = the B issue number; the controller supplies it before Task 4.
- Fence markers stay `v2.0.0` (package.json is already `2.0.0`, latest tag `v1.15.2`); after any fence edit run `node scripts/dev/rehash-fences.js`.
- Net protocol-fence byte change for the whole plan ≤ 0 (baseline 19797 B, measured in Task 4).
- Commit messages explain the why; end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never write Mandy / Mr-Otto private-repo content into any file (gearbox is public).
- Merge commits only; nothing in this plan merges, tags or publishes.

## File map

| File | Change | Responsibility |
|---|---|---|
| `scripts/lib/roster.js` | create | `parseRoster`, `rosterLine`, `findAccount`, `ROSTER_NOTE` |
| `test/roster.test.js` | create | parser unit tests |
| `scripts/lib/skeleton.js` | modify | `## Roster` replaces `## Maintainer`; `roster` option |
| `scripts/lib/protocol-check.js` | modify | required section `Roster`; roster errors/warnings; drop `maintainerAccount` |
| `test/helpers.js` | modify | `v2Repo({ roster })` |
| `test/protocol-check.test.js`, `test/skeleton.test.js`, `test/check-gearbox.test.js`, `test/migrate-v1.test.js` | modify | follow the section rename |
| `AGENTS.md` (project section, outside the fence) | modify | gearbox's own `## Roster` |
| `scripts/gearbox-install`, `scripts/gearbox-update` | modify | prompt / placeholder hint / report checkbox wording |
| `test/update-migrate.test.js` | modify | report checkbox wording |
| `AGENTS.md` fence, `CONTEXT.md` fence | modify | L1 rule, roster definition, glossary row |
| `docs/gearbox-adr/0053-identity-roster.md` | create | the decision |
| `docs/gearbox-adr/0034-…`, `0042-…` | modify | `Status:` amended-by note |
| `README.md`, `site/index.html`, `.github/pull_request_template.md`, `AGENTS.md` Tech stack | modify | docs follow the rule |

---

### Task 1: The roster parser

**Files:**
- Create: `scripts/lib/roster.js`
- Test: `test/roster.test.js`

**Interfaces:**
- Consumes: `fenceRun(line)` and `sectionBody(text, level, title)` from `scripts/lib/sections.js` (existing).
- Produces:
  - `ROSTER_NOTE: string`
  - `rosterLine(login: string, kind: "human"|"shared"|"agent", person: string, opts?: { maintainer?: boolean }): string`
  - `parseRoster(agentsText: string): { found: boolean, entries: Entry[], people: string[], multiHuman: boolean, errors: string[], placeholder: boolean }` where `Entry = { login, kind, person, maintainer: boolean, placeholder: boolean }`
  - `findAccount(roster, login: string): Entry | null` (case-insensitive)

- [ ] **Step 1: Write the failing tests**

Create `test/roster.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseRoster, rosterLine, findAccount, ROSTER_NOTE } from "../scripts/lib/roster.js";

const md = (...lines) => ["# demo", "", "## Roster", "", ...lines, "", "## Next", "", "- `ignored` — human: nobody", ""].join("\n");

test("the three forms parse, with the maintainer mark on human and shared lines", () => {
  const r = parseRoster(md(
    "- `real-stanyan` — human: stanyan — maintainer",
    "- `RicksZhang` — human: stanyan",
    "- `DamianBuilds-ai` — shared: Damian",
    "- `stanyan-agent` — agent, run by stanyan",
  ));
  assert.equal(r.found, true);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.entries.map(({ login, kind, person, maintainer }) => [login, kind, person, maintainer]), [
    ["real-stanyan", "human", "stanyan", true],
    ["RicksZhang", "human", "stanyan", false],
    ["DamianBuilds-ai", "shared", "Damian", false],
    ["stanyan-agent", "agent", "stanyan", false],
  ]);
});

test("people are distinct persons on human and shared lines; more than one is multi-human", () => {
  const one = parseRoster(md("- `a` — human: Ann — maintainer", "- `a2` — shared: Ann", "- `bot` — agent, run by Bob"));
  assert.deepEqual(one.people, ["Ann"]);
  assert.equal(one.multiHuman, false);
  const two = parseRoster(md("- `a` — human: Ann — maintainer", "- `b` — shared: Bob"));
  assert.deepEqual(two.people, ["Ann", "Bob"]);
  assert.equal(two.multiHuman, true);
});

test("an ASCII ' - ' separator parses like the em dash", () => {
  const r = parseRoster(md("- `a` - shared: Ann - maintainer", "* `bot` - agent, run by Ann"));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.entries.map((e) => [e.login, e.kind, e.person, e.maintainer]), [
    ["a", "shared", "Ann", true],
    ["bot", "agent", "Ann", false],
  ]);
});

test("prose, notes, blank lines and fenced blocks in the section are ignored", () => {
  const r = parseRoster(md(ROSTER_NOTE, "", "Some prose.", "```", "- not an entry", "```", "- `a` — shared: Ann — maintainer"));
  assert.deepEqual(r.errors, []);
  assert.equal(r.entries.length, 1);
});

test("a list item that matches no form is an error naming the line; nothing is guessed", () => {
  for (const bad of [
    "- real-stanyan — human: stanyan",          // no backticks
    "- `a` — owner: Ann",                        // unknown kind
    "- `a` — human:",                            // no person
    "- `bot` — agent, run by Ann — maintainer", // an agent can't be a maintainer
    "- `a b` — human: Ann",                      // space in login
  ]) {
    const r = parseRoster(md(bad));
    assert.equal(r.errors.length, 1, bad);
    assert.match(r.errors[0], /"## Roster": can't read/, bad);
    assert.ok(r.errors[0].includes(bad.trim()), bad);
    assert.equal(r.entries.length, 0, bad);
  }
});

test("a login listed twice, in any case, is an error", () => {
  const r = parseRoster(md("- `Octo` — human: Ann — maintainer", "- `octo` — agent, run by Ann"));
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /`octo` is listed twice/);
});

test("a <placeholder> login is flagged", () => {
  const r = parseRoster(md("- `<maintainer>` — shared: <maintainer> — maintainer"));
  assert.deepEqual(r.errors, []);
  assert.equal(r.placeholder, true);
  assert.equal(r.entries[0].placeholder, true);
});

test("no section: found is false and nothing else is reported", () => {
  const r = parseRoster("# demo\n\n## Maintainer\n\nGitHub account: `octo`\n");
  assert.equal(r.found, false);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.entries, []);
});

test("rosterLine renders each form so parseRoster reads it back", () => {
  const lines = [
    rosterLine("a", "human", "Ann", { maintainer: true }),
    rosterLine("b", "shared", "Bob"),
    rosterLine("bot", "agent", "Ann"),
  ];
  assert.deepEqual(lines, [
    "- `a` — human: Ann — maintainer",
    "- `b` — shared: Bob",
    "- `bot` — agent, run by Ann",
  ]);
  const r = parseRoster(md(...lines));
  assert.deepEqual(r.errors, []);
  assert.equal(r.entries.length, 3);
});

test("findAccount matches logins case-insensitively", () => {
  const r = parseRoster(md("- `Real-Stanyan` — human: stanyan — maintainer"));
  assert.equal(findAccount(r, "real-stanyan").login, "Real-Stanyan");
  assert.equal(findAccount(r, "someone"), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/roster.test.js`
Expected: FAIL — `Cannot find module '…/scripts/lib/roster.js'`.

- [ ] **Step 3: Implement `scripts/lib/roster.js`**

```js
// The identity roster (ADR-0053): AGENTS.md's project section "## Roster", one list item per GitHub
// account. Pure — no I/O. The protocol check and `gearbox-agents approval` both read it through
// parseRoster, so the two can never disagree about who is who.
import { fenceRun, sectionBody } from "./sections.js";

export const ROSTER_NOTE =
  "> One line per GitHub account: `human: <person>` (only that person), `shared: <person>` (the person and their agents) or `agent, run by <person>`; `— maintainer` marks the accounts whose actions approve L1 (ADR-0053).";

const FORMS =
  "expected `- `login` — human: <person>`, `- `login` — shared: <person>` (either may end `— maintainer`) or `- `login` — agent, run by <person>` (ADR-0053)";
const ITEM = /^\s*[-*]\s+`([^`\s]+)`\s+(?:—|-)\s+(.+?)\s*$/;
const HUMANISH = /^(human|shared):\s*(.+?)(?:\s+(?:—|-)\s+maintainer)?$/;
const MAINTAINER_TAIL = /\s+(?:—|-)\s+maintainer$/;
const AGENT = /^agent,\s*run by\s+(.+)$/;
const isPlaceholder = (login) => /^<.+>$/.test(login);

export function rosterLine(login, kind, person, { maintainer = false } = {}) {
  if (kind === "agent") return `- \`${login}\` — agent, run by ${person}`;
  return `- \`${login}\` — ${kind}: ${person}${maintainer ? " — maintainer" : ""}`;
}

function parseItem(line) {
  const m = line.match(ITEM);
  if (!m) return null;
  const [, login, rest] = m;
  const h = rest.match(HUMANISH);
  if (h) return { login, kind: h[1], person: h[2].trim(), maintainer: MAINTAINER_TAIL.test(rest) };
  const a = rest.match(AGENT);
  if (a && !MAINTAINER_TAIL.test(rest)) return { login, kind: "agent", person: a[1].trim(), maintainer: false };
  return null;
}

export function parseRoster(agentsText) {
  const body = sectionBody(agentsText, 2, "Roster");
  const out = { found: body !== null, entries: [], people: [], multiHuman: false, errors: [], placeholder: false };
  if (body === null) return out;
  const seen = new Set();
  let open = null; // the enclosing ``` / ~~~ block, if any
  for (const line of body.split("\n")) {
    const run = fenceRun(line);
    if (run) {
      if (!open) open = run;
      else if (run.char === open.char && run.len >= open.len) open = null;
      continue;
    }
    if (open || !/^\s*[-*]\s/.test(line)) continue;
    const entry = parseItem(line);
    if (!entry) {
      out.errors.push(`"## Roster": can't read \`${line.trim()}\` — ${FORMS}`);
      continue;
    }
    const key = entry.login.toLowerCase();
    if (seen.has(key)) {
      out.errors.push(`"## Roster": \`${entry.login}\` is listed twice — one line per GitHub account (ADR-0053)`);
      continue;
    }
    seen.add(key);
    entry.placeholder = isPlaceholder(entry.login);
    if (entry.placeholder) out.placeholder = true;
    out.entries.push(entry);
  }
  out.people = [...new Set(out.entries.filter((e) => e.kind !== "agent").map((e) => e.person))];
  out.multiHuman = out.people.length > 1;
  return out;
}

export function findAccount(roster, login) {
  const key = String(login).toLowerCase();
  return roster.entries.find((e) => e.login.toLowerCase() === key) ?? null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/roster.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Run the gate**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: green (nothing else uses the module yet).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/roster.js test/roster.test.js
git commit -m "feat(roster): parse the ## Roster section of AGENTS.md

One strict parser for the identity roster (ADR-0053), so the offline check
and the online approval command read accounts the same way. A list item
that matches none of the three forms is an error, never a guess.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `## Roster` replaces `## Maintainer` (skeleton, check, gearbox's own AGENTS.md)

**Files:**
- Modify: `scripts/lib/skeleton.js` (`buildAgentsMd`)
- Modify: `scripts/lib/protocol-check.js:14` (`PROJECT_HEADINGS`), `:49-53` (`maintainerAccount`), `:157-160` (maintainer warning)
- Modify: `test/helpers.js:98-101` (`v2Repo`)
- Modify: `test/protocol-check.test.js` (tests named below), `test/skeleton.test.js`, `test/check-gearbox.test.js`, `test/migrate-v1.test.js:40`
- Modify: `AGENTS.md` lines 27-29 (the `## Maintainer` project section — outside the fence)

**Interfaces:**
- Consumes: `parseRoster`, `rosterLine`, `ROSTER_NOTE` from Task 1.
- Produces:
  - `buildAgentsMd({ …, maintainer = null, roster = null })` — `roster` is the raw list text; when null, one line `rosterLine(maintainer || "<maintainer>", "shared", maintainer || "<maintainer>", { maintainer: true })`.
  - `PROJECT_HEADINGS` contains `"Roster"` in place of `"Maintainer"`.
  - `maintainerAccount` is **removed** from `protocol-check.js`.
  - `v2Repo({ …, maintainer = "octo", roster })` — `roster` passed through to `buildAgentsMd`.

- [ ] **Step 1: Update the skeleton tests to the new section (failing)**

In `test/skeleton.test.js`, in "buildAgentsMd lays sections out in the v2 order with the fence verbatim": change `"Maintainer"` in the heading list to `"Roster"`, and replace `assert.ok(md.includes("GitHub account: \`octo\`"));` with:

```js
  assert.ok(md.includes("- `octo` — shared: octo — maintainer"));
  assert.ok(md.includes(ROSTER_NOTE));
```

In "buildAgentsMd defaults to placeholders and keeps gate notes and extra sections", replace `assert.ok(md.includes("GitHub account: \`<maintainer>\`"));` with:

```js
  assert.ok(md.includes("- `<maintainer>` — shared: <maintainer> — maintainer"));
```

Add at the end of the file:

```js
test("buildAgentsMd takes a whole roster verbatim", () => {
  const roster = "- `a` — human: Ann — maintainer\n- `bot` — agent, run by Ann";
  const md = buildAgentsMd({ protocolBlock: PROTOCOL, maintainer: "ignored", roster });
  assert.ok(md.includes(`## Roster\n\n${ROSTER_NOTE}\n\n${roster}\n`));
  assert.ok(!md.includes("ignored"));
});
```

Add `import { ROSTER_NOTE } from "../scripts/lib/roster.js";` to the imports.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/skeleton.test.js`
Expected: FAIL — the heading list still has `Maintainer`.

- [ ] **Step 3: Implement the skeleton change**

In `scripts/lib/skeleton.js`, add after the header comment:

```js
import { ROSTER_NOTE, rosterLine } from "./roster.js";
```

Add `roster = null,` to `buildAgentsMd`'s parameter list right after `maintainer = null,`, and replace the line

```js
      `## Maintainer\n\nGitHub account: \`${maintainer || PLACEHOLDERS.maintainer}\``,
```

with

```js
      `## Roster\n\n${ROSTER_NOTE}\n\n${(roster ?? rosterLine(maintainer || PLACEHOLDERS.maintainer, "shared", maintainer || PLACEHOLDERS.maintainer, { maintainer: true })).trim()}`,
```

- [ ] **Step 4: Run the skeleton tests**

Run: `node --test test/skeleton.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing protocol-check tests**

In `test/helpers.js`, change `v2Repo`'s signature and its `buildAgentsMd` call to pass `roster` through (the rest of `v2Repo` is unchanged):

```js
export function v2Repo({ gate = "npm test", ci = null, version = "v2.0.0", glossaryVersion = version, stamp = version, maintainer = "octo", roster, localExtensions, whereToFind } = {}) {
  const dir = tmp("gearbox-v2-");
  write(dir, "AGENTS.md", buildAgentsMd({ title: "demo", gate, maintainer, roster, localExtensions, whereToFind, protocolBlock: renderFence("protocol", version, PROTOCOL) }));
```

In `test/protocol-check.test.js`:

1. Remove `maintainerAccount` from the import on line 5.
2. In "missing project sections and missing fence headings are errors" and "project sections are looked up outside the protocol fence only": replace every `"## Maintainer\n"` with `"## Roster\n"`, every `/missing the project section "## Maintainer"/` with `/missing the project section "## Roster"/`, and the smuggled text `` `\n\n## Maintainer\n\nGitHub account: \`smuggled\`` `` with `` `\n\n## Roster\n\n- \`smuggled\` — shared: x — maintainer` ``.
3. In "each required project section is enforced, as a level-2 heading": `"Maintainer"` → `"Roster"` in the title list.
4. In "warnings: placeholder maintainer, undecided / missing Upstream lines": `/names no GitHub account/` → `/"## Roster" still holds a placeholder account/`.
5. Replace the test "a Maintainer section without an account line warns too" with:

```js
test("a roster with no maintainer mark is an error", () => {
  const dir = v2Repo({ roster: "- `octo` — shared: octo" });
  assert.match(errorsOf(dir).join("\n"), /"## Roster" marks no account `— maintainer`/);
});

test("roster parse errors are check errors", () => {
  const dir = v2Repo({ roster: "- `octo` — shared: octo — maintainer\n- `x` — owner: X" });
  assert.match(errorsOf(dir).join("\n"), /"## Roster": can't read `- `x` — owner: X`/);
});

test("single- and multi-human rosters of shared accounts are clean", () => {
  for (const roster of [
    "- `octo` — shared: Octo — maintainer\n- `octo2` — shared: Octo",
    "- `a` — shared: Ann — maintainer\n- `b` — shared: Bob\n- `bot` — agent, run by Ann",
  ]) {
    const { errors, warnings } = runProtocolChecks(v2Repo({ roster }));
    assert.deepEqual(errors, [], roster);
    assert.deepEqual(warnings, [], roster);
  }
});

test("an agent run by a person with no human or shared line warns", () => {
  const { errors, warnings } = runProtocolChecks(v2Repo({ roster: "- `a` — shared: Ann — maintainer\n- `bot` — agent, run by Zed" }));
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, ['"## Roster": agent `bot` is run by "Zed", who has no human or shared line (ADR-0053)']);
});
```

6. Replace the test "gateCommand and maintainerAccount read the project sections" with:

```js
test("gateCommand reads the project Gate section", () => {
  const md = read(v2Repo({ gate: "npm test  # x\nnpx tsc --noEmit" }), "AGENTS.md");
  assert.deepEqual(gateCommand(md), ["npm test", "npx tsc --noEmit"]);
});
```

7. In the two CLI tests near the end (`runBin(["check"] …` and "gearbox-check prints warnings without failing…"): `/⚠ "## Maintainer" names no GitHub account/` → `/⚠ "## Roster" still holds a placeholder account/`.

In `test/check-gearbox.test.js`, in "warnings from the shared protocol check are printed before the verdict and don't fail the gate", replace the `write(…)` line and the warning assertion with:

```js
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("- `RicksZhang` — shared: stanyan", "- `<second-account>` — shared: stanyan"));
  const r = check(dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /⚠ "## Roster" still holds a placeholder account/);
```

In `test/migrate-v1.test.js:40`, `SKELETON_H2`: `"Maintainer"` → `"Roster"`.

- [ ] **Step 6: Run to verify they fail**

Run: `node --test test/protocol-check.test.js`
Expected: FAIL — `PROJECT_HEADINGS` still requires `Maintainer`, no roster messages.

- [ ] **Step 7: Implement the check**

In `scripts/lib/protocol-check.js`:

1. Add `import { parseRoster } from "./roster.js";` after the `adr-ids.js` import.
2. `PROJECT_HEADINGS`: replace `"Maintainer"` with `"Roster"`.
3. Delete the whole `maintainerAccount` function.
4. Replace

```js
    const m = maintainerAccount(agents);
    if (!m || m === "<maintainer>")
      warnings.push('"## Maintainer" names no GitHub account yet — L1 approval has nothing to verify against (ADR-0034)');
```

with

```js
    rosterFindings(outside, errors, warnings);
```

5. Add this function above `runProtocolChecks`:

```js
// The identity roster (ADR-0053). A missing section is already a PROJECT_HEADINGS error. The kinds
// are a record, not a gate: only readability and a maintainer line are required.
function rosterFindings(outside, errors, warnings) {
  const roster = parseRoster(outside);
  if (!roster.found) return;
  errors.push(...roster.errors);
  if (roster.placeholder)
    warnings.push('"## Roster" still holds a placeholder account — fill in the real GitHub logins (ADR-0053)');
  if (!roster.entries.some((e) => e.maintainer))
    errors.push('"## Roster" marks no account `— maintainer` — L1 approval has no one to come from (ADR-0053)');
  for (const a of roster.entries.filter((e) => e.kind === "agent" && !roster.people.includes(e.person)))
    warnings.push(`"## Roster": agent \`${a.login}\` is run by "${a.person}", who has no human or shared line (ADR-0053)`);
}
```

- [ ] **Step 8: Convert gearbox's own `AGENTS.md` project section**

Replace lines 27-29 of `AGENTS.md`:

```
## Maintainer

GitHub account: `real-stanyan`
```

with:

```
## Roster

> One line per GitHub account: `human: <person>` (only that person), `shared: <person>` (the person and their agents) or `agent, run by <person>`; `— maintainer` marks the accounts whose actions approve L1 (ADR-0053).

- `real-stanyan` — shared: stanyan — maintainer
- `RicksZhang` — shared: stanyan
- `DamianBuilds-ai` — shared: Damian
```

This section is outside the fence: no rehash. (The fence still says `## Maintainer` until Task 4; the check doesn't read that text.)

- [ ] **Step 9: Run the gate**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: green. If an install/update/version test still asserts `GitHub account:` or a `## Maintainer` heading in generated files, update that assertion to the roster line `` - `octo` — shared: octo — maintainer `` — but leave the update *report* wording (`(## Maintainer)`, `set ## Maintainer`) to Task 3.

- [ ] **Step 10: Commit**

```bash
git add scripts/lib/skeleton.js scripts/lib/protocol-check.js test/ AGENTS.md
git commit -m "feat(check): ## Roster replaces ## Maintainer

The roster records every account and whether a human, an agent or both act
under it, so the human count that picks the L1 path is read from the repo
instead of self-assessed (ADR-0042 -> ADR-0053). The check requires only
what it can judge offline: readable lines and a maintainer line.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: install and update wording follow the roster

**Files:**
- Modify: `scripts/gearbox-install:250` (prompt subtitle), `:504` (placeholder hint)
- Modify: `scripts/gearbox-update:856-858` (report checkbox)
- Test: `test/update-migrate.test.js:160`, `:330`

**Interfaces:**
- Consumes: `buildAgentsMd` with the roster (Task 2).
- Produces: report lines, exact:
  - detected: ``- [ ] confirm `<login>` is the maintainer account in ## Roster (`shared` while agents act under it); with a second person in the roster, only the maintainer's own merge approves L1 (ADR-0053)``
  - not detected: `- [ ] set the maintainer line in ## Roster`

- [ ] **Step 1: Update the failing assertions**

In `test/update-migrate.test.js`, line 160, replace the asserted string with:

```js
  assert.ok(report.includes("- [ ] confirm `octo-owner` is the maintainer account in ## Roster (`shared` while agents act under it); with a second person in the roster, only the maintainer's own merge approves L1 (ADR-0053)\n"), report);
```

and at line 330:

```js
  assert.match(report, /^- \[ \] set the maintainer line in ## Roster$/m);
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/update-migrate.test.js`
Expected: FAIL on those two assertions.

- [ ] **Step 3: Implement**

`scripts/gearbox-update`, replace

```js
    r.maintainer
      ? `- [ ] confirm \`${r.maintainer}\` is the GitHub account whose PR comment counts as L1 approval (## Maintainer)`
      : "- [ ] set ## Maintainer",
```

with

```js
    r.maintainer
      ? `- [ ] confirm \`${r.maintainer}\` is the maintainer account in ## Roster (\`shared\` while agents act under it); with a second person in the roster, only the maintainer's own merge approves L1 (ADR-0053)`
      : "- [ ] set the maintainer line in ## Roster",
```

`scripts/gearbox-install`:
- In `promptMaintainer`, replace `"L1 approvals are verified against this GitHub account (ADR-0034)."` with `"It becomes the maintainer line of ## Roster (ADR-0053)."`
- In `placeholderHint`, replace `" / Maintainer"` with `" / Roster"`.

- [ ] **Step 4: Run the gate**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add scripts/gearbox-install scripts/gearbox-update test/update-migrate.test.js
git commit -m "feat(install, update): point the maintainer prompt and report at ## Roster

The migration writes a shared maintainer line, right for a single-human
repo; the report's checkbox now says what changes when a second person
joins, so a downstream learns the merge-only L1 path where it confirms
the account (ADR-0053).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The protocol text and ADR-0053

**Files:**
- Modify: `AGENTS.md` fence (lines 92, 98, 118, 124, 126 as of `f91ac46`)
- Modify: `CONTEXT.md` fence (the `L1/L2 tiers` row; a new `roster` row after it)
- Create: `docs/gearbox-adr/0053-identity-roster.md`
- Modify: `docs/gearbox-adr/0034-maintainer-anchors-github-username.md`, `docs/gearbox-adr/0042-multi-human-l1-comment-path.md` (`Status:` line)

**Interfaces:**
- Consumes: the roster (Tasks 1–3); `<ISSUE_B>` from the controller.
- Produces: fence text; ADR-0053.

- [ ] **Step 1: Measure the baseline**

```bash
node -e 'import("./scripts/lib/fence.js").then(({findFence})=>{const fs=require("fs");for(const [f,n] of [["AGENTS.md","protocol"],["CONTEXT.md","glossary"]])console.log(f,Buffer.byteLength(findFence(fs.readFileSync(f,"utf8"),n).content))})'
```

Expected: `AGENTS.md 19797` (record the CONTEXT.md number too).

- [ ] **Step 2: Edit the AGENTS.md fence**

Each replacement is exact.

(a) In the paragraph starting `Where the protocol text lives decides how it changes (ADR-0050).`, replace the sentence

```
"The maintainer" below is the GitHub account named in `## Maintainer` (a team = a GitHub team handle, ADR-0034).
```

with

```
The maintainer's accounts are the `maintainer` lines of `## Roster`, which lists every account as `human`, `shared` (a human and their agents) or `agent` (ADR-0053).
```

(b) The L1 tier-table row: replace

```
| **L1 strict tier** | Hard rules / Gate command / Tech stack / Maintainer / this section itself | issue + ADR + PR, **and the agent may only merge after the maintainer explicitly agrees, in the session or in a PR comment** |
```

with

```
| **L1 strict tier** | Hard rules / Gate command / Tech stack / Roster / this section itself | issue + ADR + PR, **and the agent may only merge after the maintainer's approval (below)** |
```

(c) The criterion-table row: `Modifying an existing protocol file (Hard rules / Gate / Tech stack / Maintainer / Working agreement content)` → `Modifying an existing protocol file (Hard rules / Gate / Tech stack / Roster / Working agreement content)`.

(d) Delete the line starting `> Why so strict: agents easily use` and the blank line before it (ADR-0012 already records the PR #21 precedent).

(e) Replace the whole paragraph starting `L1's "explicit agreement" is a weak-b form:` (one line, ending `and that cost is accepted.`) with:

```
L1's explicit agreement comes only from the maintainer: an `agreed` PR comment or an Approve review from a `maintainer` account, or agreement in the session. It covers the commits it saw; a later push needs a new one. **Multi-human repos** (more than one person in `## Roster`): only the maintainer's own merge approves, and agents never merge an L1 PR — agents act under the humans' accounts, so no comment or review proves who wrote it (ADR-0042/0053). In every repo, an agent never writes an approval — no `agreed`, no Approve, no approval record — for anyone. GitHub's Approve button stays optional; the maintainer as L1 bottleneck is an accepted cost.
```

- [ ] **Step 3: Edit the CONTEXT.md fence**

In the `L1/L2 tiers` row, `Hard rules / Gate / Tech stack / Maintainer /` → `Hard rules / Gate / Tech stack / Roster /`. Insert directly after that row:

```
| roster | AGENTS.md's `## Roster`: one line per GitHub account — `human` (only that person), `shared` (the person and their agents) or `agent` (only agents, run by a named person); `— maintainer` marks the maintainer's accounts. The human count is the number of distinct people on `human`/`shared` lines; more than one = a multi-human repo | ADR-0053; in a multi-human repo only the maintainer's own merge approves L1 |
```

- [ ] **Step 4: Re-stamp and measure**

Run: `node scripts/dev/rehash-fences.js` — expect it to rewrite both markers at `v2.0.0`.
Re-run the Step 1 command. Required: the `AGENTS.md` fence ≤ 19797 (net ≤ 0; ≈ 19430 expected). Record both numbers for the ADR. If the AGENTS.md fence grew, stop and report — don't trim other sections to make it fit.

- [ ] **Step 5: Write `docs/gearbox-adr/0053-identity-roster.md`**

Fill `<before>`/`<after>` with the Step 4 numbers and `<ISSUE_B>` with the issue number:

```markdown
# ADR-0053: An identity roster, and an L1 rule that doesn't claim what it can't verify

- Date: 2026-09-30
- Issue: #<ISSUE_B>
- Status: accepted
- Related: ADR-0006 (weak-b agreement — amended), ADR-0034 (maintainer anchors a GitHub account — amended: the roster replaces `## Maintainer`, team handles dropped), ADR-0042 (multi-human repos use the PR-comment path — amended: the human count comes from the roster, and the path becomes the maintainer's own merge), ADR-0012 (the "Why so strict" note moved out of the fence), ADR-0051 (fence budget)

## Context

ADR-0034 anchored L1 approval to the maintainer's GitHub account, and ADR-0042 made a PR comment from that account the only valid approval in a multi-human repo. Both assume only the maintainer acts under that account. In practice agents act under the humans' accounts: the downstream audit (2026-09-28) found every agent working under a human login, no L1 PR approved through a PR comment, and an agent-written "approval record". In the Gearbox repo, the handoff Memory for #148 was posted by an agent under the maintainer's account, and #144 was merged by the maintainer's hand after an agent's merge was refused by its tool — two acts GitHub shows identically. An `agreed` comment from a shared account proves nothing.

ADR-0042 also switched on "more than one human collaborator", which nothing recorded; #132 names the same hole from the other side (the repo owner is an unmodeled actor). And no rule said an approval covers only the commits it saw.

## Decision

- **`## Roster` replaces `## Maintainer`** (an L1 project section). One line per GitHub account: `human: <person>` (only that person acts under it), `shared: <person>` (the person and their agents), or `agent, run by <person>` (only agents). `— maintainer` on a human or shared line marks the maintainer's accounts. `scripts/lib/roster.js` is the only parser; `gearbox-agents check` reports unreadable lines, duplicates and a roster with no maintainer line. The kinds are a record, not a gate.
- **Human count** = distinct people on `human`/`shared` lines; more than one = a multi-human repo. This replaces ADR-0042's self-assessment.
- **Every repo**: L1 agreement comes only from the maintainer — an `agreed` PR comment or an Approve review from a maintainer account, or agreement in the session — and covers the commits it saw; a later push needs a new one.
- **Multi-human repos**: only the maintainer's own merge approves an L1 PR, and agents never merge one. The comment path and in-session agreement stop counting there: under shared accounts neither shows who approved.
- **Every repo**: an agent never writes an approval — no `agreed` comment, no Approve review, no approval record — for anyone, under any account.
- **Team handles are dropped** (ADR-0034 allowed one): a line names one account; a team lists its members.
- **Fence budget**: the fence went from <before> B to <after> B. The "Why so strict" blockquote was deleted from the fence; its precedent lives in ADR-0012: agents use "optional + purely additive" as an L2 channel to widen the protocol (PR #21), and the mechanism-reference criterion closes it.

## Alternatives rejected

- **A separate agent account** (a machine user; agents work only under it, and the maintainer's human-only account makes approvals attributable). Declined by the maintainer: an extra account and its credentials on every agent machine, and in the Gearbox repo a required Approve click on every agent PR — a non-admin account can't bypass code-owner review, and a user-owned repo has no Maintain role to grant a narrower bypass. This is the upgrade path if attributable approvals become necessary.
- **The maintainer's second account as a human-only approval account.** Same effect without a new account, but agents have used it.
- **Keeping the comment path under shared accounts.** It proves nothing, and the audit found it unused.
- **An `approval` command** that checks a PR for a current approval. With merge-only approval in multi-human repos, it has nothing to check that the agent can act on.

## Consequences

- The L1 rule now states what it relies on: agents obeying it. GitHub shows a merge by the maintainer's account, not whose hand pressed it. The backstops are the agent tool's own permission prompts and the after-the-fact veto (ADR-0006/0007).
- In a multi-human repo an agent opens an L1 PR and stops; per the existing rules, an open PR at shift-end gets a progress comment on its Task issue.
- Single-human repos are unchanged except that an approval now expires with a later push.
- The Gearbox repo is multi-human (two people), so its L1 PRs are merged by the maintainer's hand. Its L2 flow and branch protection are unchanged.
- Tier = **L1** (the weak-b clause, the Maintainer → Roster section). Version: ships inside v2.0.0 (the `## Maintainer` → `## Roster` layout change is part of the v2 major). Affects downstream: yes — the v1 → v2 migration and install write `## Roster`.
```

- [ ] **Step 6: Mark ADR-0034 and ADR-0042 amended**

In each, change `- Status: accepted` to `- Status: accepted; amended by ADR-0053 (the roster)`.

- [ ] **Step 7: Run the gate**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: green. (Tests that copy the real `AGENTS.md` via `gearboxRepo` re-stamp it; a failure there means the rehash was skipped.)

- [ ] **Step 8: Commit**

```bash
git add AGENTS.md CONTEXT.md docs/gearbox-adr/
git commit -m "docs(protocol): multi-human L1 is the maintainer's own merge (ADR-0053)

Agents act under the humans' accounts, so a PR comment or review from the
maintainer's account can't show who wrote it. The weak-b clause now says
so: in a multi-human repo only the maintainer's own merge approves L1,
agents never write an approval anywhere, and an approval expires with a
later push. The Why-so-strict note leaves the fence (ADR-0012 holds its
precedent), so the fence shrinks overall and D keeps its headroom.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Docs follow the rule

**Files:**
- Modify: `AGENTS.md` `## Tech stack` (line 10, outside the fence)
- Modify: `README.md:54`
- Modify: `site/index.html:954` (en `guard.g1a`) and `:1189` (zh `guard.g1a`)
- Modify: `.github/pull_request_template.md:9`

**Interfaces:**
- Consumes: everything above. No code.

- [ ] **Step 1: Tech stack**

In `AGENTS.md` line 10, in the `scripts/lib/` module list, after `adr-ids,` insert ` roster,`; in the ADR list, append `/0053` after `0052`.

- [ ] **Step 2: README**

Line 54: replace the bullet with:

```
   - `--maintainer` = the user's **GitHub username**. It becomes the maintainer line of `## Roster` (`shared`, since agents act under it); a repo with a second person lists every account there, and its L1 PRs are then merged by the maintainer's own hand (ADR-0053). Ask the user if you don't know it.
```

- [ ] **Step 3: site**

Line 954, replace `explicitly agrees, verified against their GitHub account.</p>` with `explicitly agrees; with a second person in the repo, only the maintainer's own merge counts.</p>`.
Line 1189, replace `并对照其 GitHub 账号核验。',` with `仓库里有第二个人时，只认 maintainer 亲手合并。',`.

- [ ] **Step 4: PR template**

Line 9: `… merge it yourself (L2) or wait for maintainer agreement (L1). -->` → `… merge it yourself (L2), or for L1 wait for the maintainer's agreement — in a multi-human repo the maintainer merges it. -->`

- [ ] **Step 5: Run the gate, then commit**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js` — green.

```bash
git add AGENTS.md README.md site/index.html .github/pull_request_template.md
git commit -m "docs: README, site and PR template follow the roster

Every place that told a reader how L1 approval is verified now points at
## Roster and says who merges in a multi-human repo (ADR-0053).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 (controller): Final review and PR

- [ ] Dispatch a final whole-branch review against the spec.
- [ ] Gate green; `git push -u origin claude/gearbox-identity-roster`.
- [ ] If #146 has merged: merge `origin/main` into the branch (merge commit), rerun the gate, recheck the ADR number (0053 still free) and the fence version rule, then open the PR: `Closes #<ISSUE_B>`, `Affects downstream: yes`, `Version bump: none` (ships inside the untagged v2.0.0; `package.json` already `2.0.0`), and the L1 note: gearbox is multi-human, so the maintainer merges it by hand. If #146 is still open, push and wait.
- [ ] Never merge the PR as an agent; ask the maintainer to merge.
