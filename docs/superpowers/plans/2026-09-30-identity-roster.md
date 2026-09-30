# Identity Roster and Verifiable L1 Approval — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `## Maintainer` with a `## Roster` of GitHub accounts, check it offline, add `gearbox-agents approval <PR>` to verify L1 approvals online, and rewrite the fenced L1 rule to match (ADR-0053).

**Architecture:** A pure parser (`scripts/lib/roster.js`) is the single reader of `## Roster`. The offline protocol check (`scripts/lib/protocol-check.js`) and a pure approval evaluator (`scripts/lib/approval.js`) both consume it. A thin CLI (`scripts/gearbox-approval`) fetches PR data through the `gh` CLI and prints the evaluator's verdict. The protocol text change lands last, after the tool it names exists.

**Tech Stack:** Node.js ≥ 18, ES modules (`"type": "module"`), zero runtime dependencies, `node:test` + `node:assert/strict`, the `gh` CLI (runtime only for `approval`).

**Spec:** `docs/superpowers/specs/2026-09-30-identity-roster-design.md`

## Global Constraints

- Gate (run after every task, must be green): `node scripts/check-gearbox.js && node --test test/*.test.js`
- No runtime dependencies; no new devDependencies.
- `AGENT_LOGIN` = the GitHub login of the machine account the maintainer created for agents. **The controller substitutes the real value before dispatching Task 2.** It appears only in gearbox's own `AGENTS.md` roster; tests never use it.
- Roster line forms, byte-exact (em dash `—` U+2014, one space either side):
  - `` - `<login>` — human: <person> `` optionally followed by ` — maintainer`
  - `` - `<login>` — shared: <person> `` optionally followed by ` — maintainer`
  - `` - `<login>` — agent, run by <person> ``
  - The parser also accepts ` - ` (ASCII hyphen with spaces) wherever ` — ` appears.
- Protocol ADR: `docs/gearbox-adr/0053-identity-roster.md`, cited `ADR-0053`.
- Fence markers stay `v2.0.0` (package.json is already `2.0.0`, latest tag `v1.15.2`); after any fence edit run `node scripts/dev/rehash-fences.js`.
- Net protocol-fence byte change for the whole plan ≤ 0 (baseline 19797 B, measured in Task 6).
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
| `test/helpers.js` | modify | `v2Repo({ roster })`; `fakeGh()` |
| `test/protocol-check.test.js`, `test/skeleton.test.js`, `test/check-gearbox.test.js`, `test/migrate-v1.test.js` | modify | follow the section rename |
| `AGENTS.md` (project section, outside the fence) | modify | gearbox's own `## Roster` |
| `scripts/gearbox-install`, `scripts/gearbox-update` | modify | prompt / placeholder hint / report checkbox wording |
| `test/update-migrate.test.js` | modify | report checkbox wording |
| `scripts/lib/approval.js` | create | `evaluateApproval` (pure) |
| `test/approval.test.js` | create | evaluator unit tests + CLI tests with a fake `gh` |
| `scripts/gearbox-approval` | create | the CLI: args, `gh` calls, printing, exit codes |
| `bin/gearbox.js` | modify | `approval` route + help line |
| `AGENTS.md` fence, `CONTEXT.md` fence | modify | L1 rule, roster definition, glossary row |
| `docs/gearbox-adr/0053-identity-roster.md` | create | the decision |
| `docs/gearbox-adr/0034-…`, `0042-…` | modify | `Status:` amended-by note |
| `README.md`, `site/index.html`, `.github/pull_request_template.md`, `.github/CODEOWNERS`, `AGENTS.md` Tech stack | modify | docs follow the rule |

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
- Modify: `scripts/lib/skeleton.js` (the `PLACEHOLDERS.maintainer` entry and `buildAgentsMd`)
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
Expected: FAIL — heading list still has `Maintainer`.

- [ ] **Step 3: Implement the skeleton change**

In `scripts/lib/skeleton.js`, add at the top (after the header comment):

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

In `test/helpers.js`, change the `v2Repo` signature and its `buildAgentsMd` call to pass `roster` through:

```js
export function v2Repo({ gate = "npm test", ci = null, version = "v2.0.0", glossaryVersion = version, stamp = version, maintainer = "octo", roster, localExtensions, whereToFind } = {}) {
  const dir = tmp("gearbox-v2-");
  write(dir, "AGENTS.md", buildAgentsMd({ title: "demo", gate, maintainer, roster, localExtensions, whereToFind, protocolBlock: renderFence("protocol", version, PROTOCOL) }));
```

(the rest of `v2Repo` is unchanged).

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

test("a single-human roster with a shared maintainer and no agent account is clean", () => {
  const { errors, warnings } = runProtocolChecks(v2Repo({ roster: "- `octo` — shared: Octo — maintainer\n- `octo2` — human: Octo" }));
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("multi-human: a shared maintainer account is an error", () => {
  const dir = v2Repo({ roster: "- `a` — shared: Ann — maintainer\n- `b` — human: Bob\n- `bot` — agent, run by Ann" });
  const errs = errorsOf(dir).join("\n");
  assert.match(errs, /`a` is a maintainer account but `shared` — in a multi-human repo \(2 people\)/);
  assert.doesNotMatch(errs, /no `agent` account/);
});

test("multi-human: no agent account is an error", () => {
  const dir = v2Repo({ roster: "- `a` — human: Ann — maintainer\n- `b` — shared: Bob" });
  assert.match(errorsOf(dir).join("\n"), /"## Roster" lists 2 people but no `agent` account/);
});

test("multi-human with a human maintainer and an agent account is clean", () => {
  const { errors, warnings } = runProtocolChecks(v2Repo({ roster: "- `a` — human: Ann — maintainer\n- `b` — shared: Bob\n- `bot` — agent, run by Ann" }));
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
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
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("- `RicksZhang` — human: stanyan", "- `<second-account>` — human: stanyan"));
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
// The identity roster (ADR-0053). A missing section is already a PROJECT_HEADINGS error.
function rosterFindings(outside, errors, warnings) {
  const roster = parseRoster(outside);
  if (!roster.found) return;
  errors.push(...roster.errors);
  if (roster.placeholder)
    warnings.push('"## Roster" still holds a placeholder account — L1 approval has nothing to verify against (ADR-0053)');
  const maintainers = roster.entries.filter((e) => e.maintainer);
  if (maintainers.length === 0)
    errors.push('"## Roster" marks no account `— maintainer` — L1 approval has no account to come from (ADR-0053)');
  if (roster.multiHuman) {
    const n = roster.people.length;
    for (const m of maintainers.filter((e) => e.kind !== "human"))
      errors.push(`"## Roster": \`${m.login}\` is a maintainer account but \`${m.kind}\` — in a multi-human repo (${n} people) a maintainer account is \`human\`, so no agent can have produced its approvals (ADR-0053)`);
    if (!roster.entries.some((e) => e.kind === "agent" && !e.placeholder))
      errors.push(`"## Roster" lists ${n} people but no \`agent\` account — in a multi-human repo agents act only under agent accounts (ADR-0053)`);
  }
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

with (substitute the real `AGENT_LOGIN`):

```
## Roster

> One line per GitHub account: `human: <person>` (only that person), `shared: <person>` (the person and their agents) or `agent, run by <person>`; `— maintainer` marks the accounts whose actions approve L1 (ADR-0053).

- `real-stanyan` — human: stanyan — maintainer
- `RicksZhang` — human: stanyan
- `DamianBuilds-ai` — shared: Damian
- `AGENT_LOGIN` — agent, run by stanyan
```

This section is outside the fence: no rehash. (The fence still says `## Maintainer` until Task 6; the check doesn't read that text.)

- [ ] **Step 9: Run the gate**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: green. If an install/update/version test still asserts `GitHub account:` or `## Maintainer`, update that assertion to the roster line `` - `octo` — shared: octo — maintainer `` — but leave the update *report* wording (`(## Maintainer)`, `set ## Maintainer`) to Task 3.

- [ ] **Step 10: Commit**

```bash
git add scripts/lib/skeleton.js scripts/lib/protocol-check.js test/ AGENTS.md
git commit -m "feat(check): ## Roster replaces ## Maintainer

The roster records every account and whether a human, an agent or both act
under it, so the check can derive the human count instead of trusting a
self-assessment (ADR-0042), and can require what makes an approval
attributable in a multi-human repo: human-only maintainer accounts and a
separate agent account (ADR-0053). gearbox itself is multi-human, so its
own roster lists the agent account.

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
  - detected: ``- [ ] confirm `<login>` is the maintainer account in ## Roster — `shared` while agents act under it; a second person makes this a multi-human repo, which needs a `human` maintainer account and an `agent` account (ADR-0053)``
  - not detected: `- [ ] set the maintainer line in ## Roster`

- [ ] **Step 1: Update the failing assertions**

In `test/update-migrate.test.js`, line 160, replace the asserted string with:

```js
  assert.ok(report.includes("- [ ] confirm `octo-owner` is the maintainer account in ## Roster — `shared` while agents act under it; a second person makes this a multi-human repo, which needs a `human` maintainer account and an `agent` account (ADR-0053)\n"), report);
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
      ? `- [ ] confirm \`${r.maintainer}\` is the maintainer account in ## Roster — \`shared\` while agents act under it; a second person makes this a multi-human repo, which needs a \`human\` maintainer account and an \`agent\` account (ADR-0053)`
      : "- [ ] set the maintainer line in ## Roster",
```

`scripts/gearbox-install`:
- In `promptMaintainer`, replace `"L1 approvals are verified against this GitHub account (ADR-0034)."` with `"It becomes the maintainer line of ## Roster: L1 approvals are verified against it (ADR-0053)."`
- In `placeholderHint`, replace `" / Maintainer"` with `" / Roster"`.

- [ ] **Step 4: Run the gate**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add scripts/gearbox-install scripts/gearbox-update test/update-migrate.test.js
git commit -m "feat(install, update): point the maintainer prompt and report at ## Roster

The migration writes a shared maintainer line, which is right for a
single-human repo; the report's checkbox now says what changes when a
second person joins, so a downstream learns the multi-human requirements
where it confirms the account (ADR-0053).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The approval evaluator

**Files:**
- Create: `scripts/lib/approval.js`
- Test: `test/approval.test.js`

**Interfaces:**
- Consumes: `parseRoster`, `findAccount` (Task 1).
- Produces:

```
evaluateApproval({
  roster,                 // parseRoster(...) result
  login,                  // string: the session's GitHub login
  pr,                     // { merged: boolean, mergedBy: string|null, headSha: string }
  headCommittedAt,        // ISO string: the head commit's committer date
  reviews,                // [{ login, state, commitId, submittedAt }]
  comments,               // [{ login, body, createdAt }]
}) → {
  identityError: string|null,
  actions: [{ login, form: "merge"|"review"|"comment", at: string|null, counted: boolean, current: boolean, note: string }],
  approved: boolean,
}
```

  `note` is one of `covers head`, `stale (commits after it)`, `not counted (<login> is not a maintainer account)`, `merged`.

- [ ] **Step 1: Write the failing tests**

Create `test/approval.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseRoster } from "../scripts/lib/roster.js";
import { evaluateApproval } from "../scripts/lib/approval.js";

const roster = (...lines) => parseRoster(["## Roster", "", ...lines, ""].join("\n"));
const MULTI = roster("- `ann` — human: Ann — maintainer", "- `bob` — shared: Bob", "- `bot` — agent, run by Ann");
const SINGLE = roster("- `ann` — shared: Ann — maintainer");
const HEAD = "abc123";
const base = { pr: { merged: false, mergedBy: null, headSha: HEAD }, headCommittedAt: "2026-09-30T10:00:00Z", reviews: [], comments: [] };
const run = (over) => evaluateApproval({ roster: MULTI, login: "bot", ...base, ...over });

test("multi-human: a session under a human account is an identity error", () => {
  for (const login of ["ann", "bob"]) {
    const r = run({ login });
    assert.match(r.identityError, new RegExp(`this session acts as .*account ${login}`));
    assert.match(r.identityError, /agents act only under agent accounts in a multi-human repo \(ADR-0053\)/);
  }
});

test("a login missing from the roster is an identity error in any repo", () => {
  assert.match(run({ login: "stranger" }).identityError, /`stranger` is not in ## Roster/);
  assert.match(evaluateApproval({ roster: SINGLE, login: "stranger", ...base }).identityError, /not in ## Roster/);
});

test("single-human: the shared maintainer account may run the session", () => {
  assert.equal(evaluateApproval({ roster: SINGLE, login: "ann", ...base }).identityError, null);
});

test("an Approve review on the head commit approves; on an older commit it is stale", () => {
  const cur = run({ reviews: [{ login: "ann", state: "APPROVED", commitId: HEAD, submittedAt: "2026-09-30T11:00:00Z" }] });
  assert.equal(cur.approved, true);
  assert.deepEqual(cur.actions.map((a) => [a.form, a.counted, a.current, a.note]), [["review", true, true, "covers head"]]);
  const old = run({ reviews: [{ login: "ann", state: "APPROVED", commitId: "old999", submittedAt: "2026-09-30T11:00:00Z" }] });
  assert.equal(old.approved, false);
  assert.equal(old.actions[0].note, "stale (commits after it)");
});

test("reviews that aren't APPROVED are ignored", () => {
  const r = run({ reviews: [{ login: "ann", state: "COMMENTED", commitId: HEAD, submittedAt: "2026-09-30T11:00:00Z" }] });
  assert.deepEqual(r.actions, []);
  assert.equal(r.approved, false);
});

test("an agreed comment after the head commit approves; before it, it is stale", () => {
  const cur = run({ comments: [{ login: "ann", body: "  Agreed — ship it", createdAt: "2026-09-30T10:30:00Z" }] });
  assert.equal(cur.approved, true);
  assert.equal(cur.actions[0].note, "covers head");
  const old = run({ comments: [{ login: "ann", body: "agreed", createdAt: "2026-09-30T09:00:00Z" }] });
  assert.equal(old.approved, false);
  assert.equal(old.actions[0].note, "stale (commits after it)");
});

test("comments that don't start with agreed are ignored", () => {
  const r = run({ comments: [{ login: "ann", body: "not agreed yet", createdAt: "2026-09-30T10:30:00Z" }, { login: "ann", body: "agreeable", createdAt: "2026-09-30T10:31:00Z" }] });
  assert.deepEqual(r.actions, []);
});

test("agreed and Approve from non-maintainer accounts are listed but not counted", () => {
  const r = run({
    comments: [{ login: "bob", body: "agreed", createdAt: "2026-09-30T10:30:00Z" }, { login: "bot", body: "agreed", createdAt: "2026-09-30T10:31:00Z" }],
    reviews: [{ login: "bob", state: "APPROVED", commitId: HEAD, submittedAt: "2026-09-30T11:00:00Z" }],
  });
  assert.equal(r.approved, false);
  assert.deepEqual(r.actions.map((a) => [a.login, a.counted, a.note]), [
    ["bob", false, "not counted (bob is not a maintainer account)"],
    ["bob", false, "not counted (bob is not a maintainer account)"],
    ["bot", false, "not counted (bot is not a maintainer account)"],
  ]);
});

test("merged by a maintainer account approves; merged by anyone else doesn't", () => {
  const byAnn = run({ pr: { merged: true, mergedBy: "ann", headSha: HEAD } });
  assert.equal(byAnn.approved, true);
  assert.deepEqual(byAnn.actions.map((a) => [a.form, a.note]), [["merge", "merged"]]);
  const byBot = run({ pr: { merged: true, mergedBy: "bot", headSha: HEAD } });
  assert.equal(byBot.approved, false);
  assert.equal(byBot.actions[0].note, "not counted (bot is not a maintainer account)");
});

test("logins compare case-insensitively", () => {
  const r = run({ login: "BOT", comments: [{ login: "Ann", body: "agreed", createdAt: "2026-09-30T10:30:00Z" }] });
  assert.equal(r.identityError, null);
  assert.equal(r.approved, true);
});

test("nothing on the PR: not approved, no actions", () => {
  const r = run({});
  assert.equal(r.approved, false);
  assert.deepEqual(r.actions, []);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/approval.test.js`
Expected: FAIL — `Cannot find module '…/scripts/lib/approval.js'`.

- [ ] **Step 3: Implement `scripts/lib/approval.js`**

```js
// L1 approval evaluation (ADR-0053). Pure: scripts/gearbox-approval fetches the PR through `gh` and
// passes plain data in. Only actions by `maintainer` accounts in ## Roster count: merging the PR, an
// Approve review on the head commit, or an `agreed` comment newer than the head commit.
import { findAccount } from "./roster.js";

const AGREED = /^agreed\b/i;

function identityError(roster, login) {
  const me = findAccount(roster, login);
  if (!me) return `the session's GitHub account \`${login}\` is not in ## Roster — add it, or switch \`gh\` to an account that is (ADR-0053)`;
  if (roster.multiHuman && me.kind !== "agent")
    return `this session acts as ${me.kind} account ${me.login} — agents act only under agent accounts in a multi-human repo (ADR-0053)`;
  return null;
}

export function evaluateApproval({ roster, login, pr, headCommittedAt, reviews = [], comments = [] }) {
  const isMaintainer = (l) => findAccount(roster, l)?.maintainer === true;
  const notCounted = (l) => `not counted (${l} is not a maintainer account)`;
  const actions = [];
  if (pr.merged && pr.mergedBy) {
    const counted = isMaintainer(pr.mergedBy);
    actions.push({ login: pr.mergedBy, form: "merge", at: null, counted, current: counted, note: counted ? "merged" : notCounted(pr.mergedBy) });
  }
  for (const r of reviews.filter((r) => r.state === "APPROVED")) {
    const counted = isMaintainer(r.login);
    const current = counted && r.commitId === pr.headSha;
    actions.push({ login: r.login, form: "review", at: r.submittedAt, counted, current, note: !counted ? notCounted(r.login) : current ? "covers head" : "stale (commits after it)" });
  }
  const head = Date.parse(headCommittedAt);
  for (const c of comments.filter((c) => AGREED.test(String(c.body).trim()))) {
    const counted = isMaintainer(c.login);
    const current = counted && Date.parse(c.createdAt) > head;
    actions.push({ login: c.login, form: "comment", at: c.createdAt, counted, current, note: !counted ? notCounted(c.login) : current ? "covers head" : "stale (commits after it)" });
  }
  return { identityError: identityError(roster, login), actions, approved: actions.some((a) => a.current) };
}
```

Note the test "agreed and Approve from non-maintainer accounts" expects review actions before comment actions — the order above (merge, reviews, comments) produces `bob` review, then `bob` comment, then `bot` comment.

- [ ] **Step 4: Run the tests**

Run: `node --test test/approval.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the gate, then commit**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js` — green.

```bash
git add scripts/lib/approval.js test/approval.test.js
git commit -m "feat(approval): evaluate L1 approvals against the roster

A pure evaluator, so every rule is unit-tested without GitHub: only
maintainer accounts count, an Approve review must be on the head commit,
an agreed comment must postdate it, and in a multi-human repo the session
itself must be an agent account (ADR-0053).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `gearbox-agents approval <PR>`

**Files:**
- Create: `scripts/gearbox-approval` (mode 755)
- Modify: `bin/gearbox.js` (`ROUTES`, help text, the header comment's command list)
- Modify: `test/helpers.js` (add `fakeGh`)
- Test: `test/approval.test.js` (append CLI tests)

**Interfaces:**
- Consumes: `parseRoster` (Task 1), `evaluateApproval` (Task 4).
- Produces: the CLI. Exit 0 = approved; 1 = no current approval; 2 = roster/identity/`gh` error. `gh` calls, exact argument vectors:
  - `["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]` (only when `<PR>` is a bare number)
  - `["api", "user", "--jq", ".login"]`
  - `["api", "repos/<owner>/<repo>/pulls/<n>"]`
  - `["api", "repos/<owner>/<repo>/pulls/<n>/commits?per_page=100&page=<p>"]`
  - `["api", "repos/<owner>/<repo>/pulls/<n>/reviews?per_page=100&page=<p>"]`
  - `["api", "repos/<owner>/<repo>/issues/<n>/comments?per_page=100&page=<p>"]`
  Paging stops at the first page with fewer than 100 items.
- `fakeGh(responses: Record<string, string|object>) → { PATH: string }` in `test/helpers.js`: the key is the argument vector joined by single spaces; a string value is printed as-is, an object value as JSON. An unknown key whose last argument contains `page=` with a page > 1 prints `[]`; any other unknown key prints `gh: no fake response for <key>` on stderr and exits 1.

- [ ] **Step 1: Add the `fakeGh` helper**

Append to `test/helpers.js`:

```js
// A fake `gh` first on PATH: prints canned responses keyed by the joined argument vector. Later pages
// of a paged endpoint default to "[]"; anything else unknown fails like gh does (exit 1, stderr).
export function fakeGh(responses) {
  const dir = tmp("gearbox-fakegh-");
  write(dir, "responses.json", JSON.stringify(responses));
  write(dir, "gh", [
    "#!/usr/bin/env node",
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const responses = JSON.parse(fs.readFileSync(path.join(__dirname, "responses.json"), "utf8"));',
    'const key = process.argv.slice(2).join(" ");',
    "if (Object.prototype.hasOwnProperty.call(responses, key)) {",
    "  const v = responses[key];",
    '  process.stdout.write(typeof v === "string" ? v : JSON.stringify(v));',
    "  process.exit(0);",
    "}",
    "const page = key.match(/[?&]page=(\\d+)/);",
    'if (page && Number(page[1]) > 1) { process.stdout.write("[]"); process.exit(0); }',
    'process.stderr.write("gh: no fake response for " + key + "\\n");',
    "process.exit(1);",
    "",
  ].join("\n"));
  chmodSync(join(dir, "gh"), 0o755);
  // CommonJS inside an ESM package: give the fake its own package.json so `require` works.
  write(dir, "package.json", '{"type":"commonjs"}');
  return { PATH: `${dir}:${process.env.PATH}` };
}
```

- [ ] **Step 2: Write the failing CLI tests**

Append to `test/approval.test.js`:

```js
import { v2Repo, runTool, runBin, fakeGh, tmp } from "./helpers.js";

const MULTI_ROSTER = "- `ann` — human: Ann — maintainer\n- `bob` — shared: Bob\n- `bot` — agent, run by Ann";
const P = "repos/o/r/pulls/7";
const pageOf = (path) => `api ${path}?per_page=100&page=1`;
function ghFor({ user = "bot", merged = false, mergedBy = null, reviews = [], comments = [] } = {}) {
  return fakeGh({
    "repo view --json nameWithOwner --jq .nameWithOwner": "o/r\n",
    "api user --jq .login": `${user}\n`,
    [`api ${P}`]: { head: { sha: "abc123" }, merged, merged_by: mergedBy ? { login: mergedBy } : null },
    [pageOf(`${P}/commits`)]: [{ sha: "abc123", commit: { committer: { date: "2026-09-30T10:00:00Z" } } }],
    [pageOf(`${P}/reviews`)]: reviews,
    [pageOf("repos/o/r/issues/7/comments")]: comments,
  });
}
const approval = (dir, args, gh) => runTool("gearbox-approval", args, { cwd: dir, env: gh });

test("approval CLI: a current agreed comment by the maintainer exits 0 and says who", () => {
  const dir = v2Repo({ roster: MULTI_ROSTER });
  const r = approval(dir, ["7"], ghFor({ comments: [{ user: { login: "ann" }, body: "agreed", created_at: "2026-09-30T11:00:00Z" }] }));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ann — agreed comment — 2026-09-30T11:00:00Z — covers head/);
  assert.match(r.out, /L1 approved by ann \(agreed comment\)/);
});

test("approval CLI: a PR URL skips the repo lookup; an Approve review on head counts", () => {
  const dir = v2Repo({ roster: MULTI_ROSTER });
  const r = approval(dir, ["https://github.com/o/r/pull/7"], ghFor({ reviews: [{ user: { login: "ann" }, state: "APPROVED", commit_id: "abc123", submitted_at: "2026-09-30T11:00:00Z" }] }));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ann — Approve review — .* — covers head/);
});

test("approval CLI: nothing current exits 1; the in-session hint appears only in a single-human repo", () => {
  const multi = approval(v2Repo({ roster: MULTI_ROSTER }), ["7"], ghFor({ comments: [{ user: { login: "ann" }, body: "agreed", created_at: "2026-09-30T09:00:00Z" }] }));
  assert.equal(multi.code, 1, multi.out);
  assert.match(multi.out, /stale \(commits after it\)/);
  assert.match(multi.out, /no current L1 approval on PR #7/);
  assert.doesNotMatch(multi.out, /in-session agreement/);
  const single = approval(v2Repo({ roster: "- `ann` — shared: Ann — maintainer" }), ["7"], ghFor({ user: "ann" }));
  assert.equal(single.code, 1, single.out);
  assert.match(single.out, /in-session agreement also counts in a single-human repo \(ADR-0042\)/);
});

test("approval CLI: merged by the maintainer exits 0", () => {
  const r = approval(v2Repo({ roster: MULTI_ROSTER }), ["7"], ghFor({ merged: true, mergedBy: "ann" }));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /L1 approved by ann \(merged\)/);
});

test("approval CLI: a human session in a multi-human repo exits 2 before fetching the PR", () => {
  const gh = fakeGh({ "repo view --json nameWithOwner --jq .nameWithOwner": "o/r\n", "api user --jq .login": "ann\n" });
  const r = approval(v2Repo({ roster: MULTI_ROSTER }), ["7"], gh);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /this session acts as human account ann/);
});

test("approval CLI: roster errors, a missing roster and a failing gh exit 2", () => {
  assert.equal(approval(v2Repo({ roster: "- `x` — owner: X" }), ["7"], ghFor()).code, 2);
  assert.equal(approval(tmp(), ["7"], ghFor()).code, 2);
  const broken = approval(v2Repo({ roster: MULTI_ROSTER }), ["7"], fakeGh({}));
  assert.equal(broken.code, 2, broken.out);
  assert.match(broken.out, /gh .* failed/);
});

test("approval CLI: usage errors exit 2; --help exits 0; bin routes the subcommand", () => {
  assert.equal(approval(v2Repo(), [], ghFor()).code, 2);
  assert.equal(approval(v2Repo(), ["not-a-pr"], ghFor()).code, 2);
  const help = approval(tmp(), ["--help"], {});
  assert.equal(help.code, 0);
  assert.match(help.out, /gearbox-approval <PR number \| PR URL>/);
  const viaBin = runBin(["approval", "--help"], { cwd: tmp() });
  assert.equal(viaBin.code, 0, viaBin.out);
  assert.match(runBin(["--help"]).out, /approval +verify a PR's L1 approval/);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test test/approval.test.js`
Expected: the new CLI tests FAIL (`scripts/gearbox-approval` doesn't exist); the Task 4 tests still pass.

- [ ] **Step 4: Implement `scripts/gearbox-approval`**

```js
#!/usr/bin/env node
// gearbox-approval — verify a PR's L1 approval against ## Roster (ADR-0053). Online, read-only,
// through the `gh` CLI. Exit 0: approved (a maintainer account merged it, approved the head commit,
// or commented `agreed` after it). Exit 1: no current approval. Exit 2: the roster, the session's
// identity or `gh` stopped the check. An agent runs this before merging an L1 PR.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { argv, cwd, exit } from "node:process";
import { parseRoster } from "./lib/roster.js";
import { evaluateApproval } from "./lib/approval.js";

const USAGE = "gearbox-approval <PR number | PR URL> — verify a PR's L1 approval against ## Roster (ADR-0053; online, read-only, uses gh)";
const FORM = { merge: "merged", review: "Approve review", comment: "agreed comment" };

function die(msg) {
  console.error(`✖ ${msg}`);
  exit(2);
}

function gh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    if (e.code === "ENOENT") die("the gh CLI isn't installed — https://cli.github.com (ADR-0053)");
    const why = String(e.stderr || e.message).trim().split("\n").pop();
    die(`gh ${args.join(" ")} failed: ${why}`);
  }
}
const ghJson = (args) => JSON.parse(gh(args));
function ghPages(path) {
  const all = [];
  for (let page = 1; ; page++) {
    const items = ghJson(["api", `${path}?per_page=100&page=${page}`]);
    all.push(...items);
    if (items.length < 100) return all;
  }
}

const args = argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  exit(0);
}
if (args.length !== 1) die(`usage: ${USAGE}`);

let repo;
let number;
const url = args[0].match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
if (url) [, repo, number] = url;
else if (/^\d+$/.test(args[0])) number = args[0];
else die(`not a PR number or URL: ${args[0]}\nusage: ${USAGE}`);

const agentsPath = join(cwd(), "AGENTS.md");
if (!existsSync(agentsPath)) die("no AGENTS.md here — run from the repo root");
const roster = parseRoster(readFileSync(agentsPath, "utf8"));
if (!roster.found) die('AGENTS.md has no "## Roster" section (ADR-0053)');
if (roster.errors.length) die(roster.errors.join("\n  "));

const login = gh(["api", "user", "--jq", ".login"]).trim();
const identity = evaluateApproval({ roster, login, pr: { merged: false, mergedBy: null, headSha: "" }, headCommittedAt: "1970-01-01T00:00:00Z" }).identityError;
if (identity) die(identity);

if (!repo) repo = gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).trim();
const base = `repos/${repo}`;
const pull = ghJson(["api", `${base}/pulls/${number}`]);
const headSha = pull.head.sha;
const commits = ghPages(`${base}/pulls/${number}/commits`);
const headCommit = commits.find((c) => c.sha === headSha) ?? commits[commits.length - 1];
const result = evaluateApproval({
  roster,
  login,
  pr: { merged: Boolean(pull.merged), mergedBy: pull.merged_by?.login ?? null, headSha },
  headCommittedAt: headCommit?.commit?.committer?.date ?? "1970-01-01T00:00:00Z",
  reviews: ghPages(`${base}/pulls/${number}/reviews`).map((r) => ({ login: r.user?.login ?? "", state: r.state, commitId: r.commit_id, submittedAt: r.submitted_at })),
  comments: ghPages(`${base}/issues/${number}/comments`).map((c) => ({ login: c.user?.login ?? "", body: c.body ?? "", createdAt: c.created_at })),
});

console.log(`PR #${number} (${repo}), head ${headSha.slice(0, 7)}, checked as ${login}`);
for (const a of result.actions) console.log(`  ${a.current ? "✓" : a.counted ? "✗" : "·"} ${a.login} — ${FORM[a.form]} — ${a.at ?? "-"} — ${a.note}`);
const winner = result.actions.find((a) => a.current);
if (winner) {
  console.log(`✅ L1 approved by ${winner.login} (${FORM[winner.form]})`);
  exit(0);
}
console.log(`✖ no current L1 approval on PR #${number} — a maintainer account in ## Roster must comment agreed, approve the head commit, or merge (ADR-0053)`);
if (!roster.multiHuman) console.log("  in-session agreement also counts in a single-human repo (ADR-0042)");
exit(1);
```

Then: `chmod 755 scripts/gearbox-approval`.

Note: the identity check runs before the repo lookup and the PR fetch, so a human session exits 2 without touching the PR (the test's fake has no PR responses).

- [ ] **Step 5: Register the subcommand in `bin/gearbox.js`**

- In `ROUTES`, after the `check` entry: `approval: { cmd: "node", file: "scripts/gearbox-approval" }, // online L1 approval check (ADR-0053)`
- In the help text, after the `check` line: `"  approval  verify a PR's L1 approval against ## Roster (online, uses gh, ADR-0053)\n" +`
- In the header comment, `<install|version|update|check|prune>` → `<install|version|update|check|approval|prune>`, and "all five subcommands" → "all six subcommands".

- [ ] **Step 6: Run the tests and the gate**

Run: `node --test test/approval.test.js` — PASS (18 tests).
Run: `node scripts/check-gearbox.js && node --test test/*.test.js` — green.

- [ ] **Step 7: Commit**

```bash
git add scripts/gearbox-approval bin/gearbox.js test/helpers.js test/approval.test.js
git commit -m "feat(approval): gearbox-agents approval <PR>

The agent's pre-merge check for an L1 PR becomes a command with an exit
code: it refuses a session running under a human account in a multi-human
repo, lists every approval-shaped action on the PR, and says which one (if
any) covers the head commit (ADR-0053). Tests drive it with a fake gh.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The protocol text and ADR-0053

**Files:**
- Modify: `AGENTS.md` fence (lines 92, 98, 118, 124, 126 as of `f91ac46`)
- Modify: `CONTEXT.md` fence (the `L1/L2 tiers` row; a new `roster` row after it)
- Create: `docs/gearbox-adr/0053-identity-roster.md`
- Modify: `docs/gearbox-adr/0034-maintainer-anchors-github-username.md`, `docs/gearbox-adr/0042-multi-human-l1-comment-path.md` (`Status:` line)

**Interfaces:**
- Consumes: the `approval` command (Task 5) — the fence names it.
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
Identities come from `## Roster`: one line per GitHub account — `human`, `shared` (a human and their agents) or `agent` — and `maintainer` marks the accounts whose actions approve L1 (ADR-0053).
```

(b) The L1 tier-table row: replace

```
| **L1 strict tier** | Hard rules / Gate command / Tech stack / Maintainer / this section itself | issue + ADR + PR, **and the agent may only merge after the maintainer explicitly agrees, in the session or in a PR comment** |
```

with

```
| **L1 strict tier** | Hard rules / Gate command / Tech stack / Roster / this section itself | issue + ADR + PR, **and the agent may only merge after the maintainer's approval (below)** |
```

(the old cell's "in the session or in a PR comment" contradicts the new rule).

(c) The criterion-table row: `Modifying an existing protocol file (Hard rules / Gate / Tech stack / Maintainer / Working agreement content)` → `Modifying an existing protocol file (Hard rules / Gate / Tech stack / Roster / Working agreement content)`.

(d) Delete the line starting `> Why so strict: agents easily use` and the blank line before it (ADR-0012 already records the PR #21 precedent).

(e) Replace the whole paragraph starting `L1's "explicit agreement" is a weak-b form:` (one line, ending `and that cost is accepted.`) with:

```
L1's explicit agreement counts only from a `maintainer` account in `## Roster` (ADR-0053): an `agreed` PR comment, an Approve review, or that account merging the PR itself. An approval covers the commits it saw; a later push needs a new one. Before merging an L1 PR, the agent runs `npx gearbox-agents approval <PR>`. **Multi-human repos** (more than one person in the roster): maintainer accounts are `human`, agents act only under `agent` accounts, and in-session agreement is not approval (ADR-0042). Single-human repos also accept in-session agreement. GitHub's Approve button stays optional; the maintainer as L1 bottleneck is an accepted cost.
```

- [ ] **Step 3: Edit the CONTEXT.md fence**

In the `L1/L2 tiers` row, `Hard rules / Gate / Tech stack / Maintainer /` → `Hard rules / Gate / Tech stack / Roster /`. Insert directly after that row:

```
| roster | AGENTS.md's `## Roster`: one line per GitHub account — `human` (only that person), `shared` (the person and their agents) or `agent` (only agents, run by a named person); `— maintainer` marks the accounts whose actions approve L1. The human count is the number of distinct people on `human`/`shared` lines; more than one = a multi-human repo | ADR-0053; there, maintainer accounts are `human` and agents act only under `agent` accounts |
```

- [ ] **Step 4: Re-stamp and measure**

Run: `node scripts/dev/rehash-fences.js` — expect it to rewrite both markers at `v2.0.0`.
Re-run the Step 1 command. Required: `AGENTS.md` fence ≤ 19797 (net ≤ 0; ≈ 19450 expected). Record both numbers for the ADR. If the AGENTS.md fence grew, stop and report — don't trim other sections to make it fit.

- [ ] **Step 5: Write `docs/gearbox-adr/0053-identity-roster.md`**

Use the exact numbers from Step 4 where `<before>`/`<after>` appear, and the B issue number (the controller supplies it) for `<ISSUE_B>`:

```markdown
# ADR-0053: An identity roster, and L1 approvals that can be attributed

- Date: 2026-09-30
- Issue: #<ISSUE_B>
- Status: accepted
- Related: ADR-0006 (weak-b agreement — amended), ADR-0034 (maintainer anchors a GitHub account — amended: team handles dropped), ADR-0042 (multi-human repos use the PR-comment path — amended: the human count comes from the roster, and the comment must come from a human-only account), ADR-0012 (the "Why so strict" note moved here from the fence), ADR-0051 (fence budget)

## Context

ADR-0034 anchored L1 approval to the maintainer's GitHub account, and ADR-0042 made a PR comment from that account the only valid approval in a multi-human repo. Both assume only the maintainer acts under that account. In practice agents act under the humans' accounts: the downstream audit (2026-09-28) found every agent working under a human login, no L1 PR approved through a PR comment, and an agent-written "approval record". In the Gearbox repo itself, the handoff Memory for #148 was posted by an agent under the maintainer's account, and #144 was merged by the maintainer's hand after an agent's merge was refused by its tool — two acts GitHub can't tell apart. An `agreed` comment or a merge from a shared account attributes nothing.

ADR-0042 also switched on "more than one human collaborator", which nothing recorded; #132 names the same hole from the other side (the repo owner is an unmodeled actor). And no rule said an approval covers only the commits it saw.

## Decision

- **`## Roster` replaces `## Maintainer`** (an L1 project section). One line per GitHub account: `human: <person>` (only that person acts under it), `shared: <person>` (the person and their agents), or `agent, run by <person>` (only agents). `— maintainer` on a human or shared line marks the accounts whose actions approve L1. `scripts/lib/roster.js` is the only parser; `gearbox-agents check` reports unreadable lines, duplicates and a roster with no maintainer.
- **Human count** = distinct people on `human`/`shared` lines; more than one = a multi-human repo. This replaces ADR-0042's self-assessment.
- **Multi-human repos**: maintainer accounts are `human`, at least one `agent` account is listed (both checked offline), and agents act only under `agent` accounts (checked by `approval` against the session's login). Other people's accounts may be `shared`: their actions never approve L1.
- **Three approval forms**, all from a maintainer account: an `agreed` PR comment, an Approve review, or that account merging the PR. An approval covers the commits it saw: a review must be on the head commit, a comment newer than the head commit's committer date.
- **`gearbox-agents approval <PR>`** (online, read-only, via `gh`) is the agent's pre-merge check: exit 0 approved, 1 no current approval, 2 roster/identity/`gh` error.
- **Single-human repos** are unchanged in practice: the default line is `shared … — maintainer`, and in-session agreement stays valid.
- **Team handles are dropped** (ADR-0034 allowed one): a line names one account; a team lists its members.
- **Fence budget**: the fence went from <before> B to <after> B. The "Why so strict" blockquote was deleted from the fence; its precedent (PR #21) lives in ADR-0012: agents use "optional + purely additive" as an L2 channel to widen the protocol, and the mechanism-reference criterion closes it.

## Consequences

- In a multi-human repo, an L1 approval is attributable: it comes from an account no agent uses.
- Each multi-human repo needs a machine account for its agents, with credentials the maintainer sets up; the maintainer's own token must not be reachable from agent sessions. This is the maintainer's setup, not something agents do.
- **The Gearbox repo**: its agents move to a machine account, a non-admin collaborator. Branch protection is unchanged (required check `gate`, code-owner review on the protocol surface, not enforced on admins), so every agent PR touching the protocol surface — nearly all of them — needs the maintainer's Approve review. For L1 that review is one of the approval forms; for L2 it is an extra click, accepted. Rejected: a ruleset bypass for the agent (a user-owned repo has no Maintain role, and bypassing by Write role also exempts the other collaborator); making the agent an admin; dropping code-owner review; moving the repo into an organization. A GitHub App identity is the later path if the click becomes a bottleneck.
- A forged older committer date defeats the comment staleness check; forgery is outside the threat model (ADR-0042's: honest mistakes and one human impersonating another). The after-the-fact veto (ADR-0006/0007) still applies.
- Tier = **L1** (the weak-b clause, the Maintainer → Roster section). Version: ships inside v2.0.0 (the `## Maintainer` → `## Roster` layout change is part of the v2 major). Affects downstream: yes — v1 → v2 migration and install write `## Roster`.
```

- [ ] **Step 6: Mark ADR-0034 and ADR-0042 amended**

In each, change `- Status: accepted` to `- Status: accepted; amended by ADR-0053 (the roster)`.

- [ ] **Step 7: Run the gate**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: green. (If a test pins fence content from the real `AGENTS.md`, e.g. via `gearboxRepo`, it re-stamps; a failure there means the rehash was skipped.)

- [ ] **Step 8: Commit**

```bash
git add AGENTS.md CONTEXT.md docs/gearbox-adr/
git commit -m "docs(protocol): L1 approval comes from a maintainer account in ## Roster (ADR-0053)

The weak-b clause now names the three approval forms, makes an approval
expire with a later push, and has the agent run gearbox-agents approval
before merging. The Why-so-strict note leaves the fence (ADR-0012 holds
its precedent), so the fence shrinks overall and D keeps its headroom.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs follow the rule

**Files:**
- Modify: `AGENTS.md` `## Tech stack` (line 10, outside the fence)
- Modify: `README.md` (the first install code block, the quote lines after it, `:54`)
- Modify: `site/index.html:954` (en `guard.g1a`) and `:1189` (zh `guard.g1a`)
- Modify: `.github/pull_request_template.md:9`
- Modify: `.github/CODEOWNERS` header comment (lines 1-5)

**Interfaces:**
- Consumes: everything above. No code.

- [ ] **Step 1: Tech stack**

In `AGENTS.md` line 10: after `` `scripts/gearbox-check` protocol check / `` insert `` `scripts/gearbox-approval` L1 approval check / ``; in the `scripts/lib/` module list, after `adr-ids,` insert ` roster, approval,`; in the ADR list, append `/0053` after `0052`.

- [ ] **Step 2: README**

Line 54: replace the bullet with:

```
   - `--maintainer` = the user's **GitHub username**. It becomes the maintainer line of `## Roster` (`shared`, since agents act under it in a single-human repo); L1 approvals are verified against it (ADR-0053). Ask the user if you don't know it.
```

In the first code block (the `npx gearbox-agents check` line is its last command), add after that line:

```
npx gearbox-agents approval 42  # before merging an L1 PR: a maintainer account in ## Roster approved the head commit? (online, uses gh, ADR-0053)
```

And after the `> All commands are node, cross-platform …` line, add a new quote line:

```
> A repo with a second person lists every account in `## Roster`; agents then work under their own `agent` account, so an L1 approval is attributable to the maintainer (ADR-0053).
```

- [ ] **Step 3: site**

Line 954, replace `explicitly agrees, verified against their GitHub account.</p>` with `explicitly agrees, verified with <code>gearbox-agents approval</code> against the maintainer accounts in ## Roster.</p>`.
Line 1189, replace `并对照其 GitHub 账号核验。',` with `并用 <code>gearbox-agents approval</code> 对照 ## Roster 里的 maintainer 账号核验。',`.

- [ ] **Step 4: PR template**

Line 9: `… merge it yourself (L2) or wait for maintainer agreement (L1). -->` → `… merge it yourself (L2), or for L1 wait for a maintainer account's approval and run \`npx gearbox-agents approval <PR>\` first. -->`

- [ ] **Step 5: CODEOWNERS header**

Replace lines 1-5 with:

```
# Protocol-surface code owners (ADR-0042 companion hardening; ADR-0053).
# With branch protection's "require review from Code Owners" on (enforce_admins off), a
# non-admin collaborator's PR touching these paths needs the maintainer's review. Agents work
# under a non-admin machine account (ADR-0053), so their PRs here need it too: for L1 that
# Approve review is the approval itself; for L2 it is an accepted extra click.
# Mapping is by file path, deliberately one notch coarser than the L1/L2 semantic boundary.
```

- [ ] **Step 6: Run the gate, then commit**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js` — green.

```bash
git add AGENTS.md README.md site/index.html .github/pull_request_template.md .github/CODEOWNERS
git commit -m "docs: README, site, PR template and CODEOWNERS follow the roster

Every place that told a reader how L1 approval is verified now points at
## Roster and the approval command, and CODEOWNERS no longer promises
agent self-merge, which a non-admin agent account doesn't get (ADR-0053).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 (controller): Final review and PR

- [ ] Dispatch a final whole-branch review against the spec.
- [ ] Gate green; `git push -u origin claude/gearbox-identity-roster`.
- [ ] If #146 has merged: merge `origin/main` into the branch (merge commit), rerun the gate, recheck the ADR number (0053 still free) and the fence version rule, then open the PR: `Closes #<ISSUE_B>`, `Affects downstream: yes`, `Version bump: none` (ships inside the untagged v2.0.0; `package.json` already `2.0.0`), and the L1 note (the maintainer comments `agreed` from a maintainer account, approves, or merges). If #146 is still open, push and wait.
- [ ] Before any merge, run `npx gearbox-agents approval <PR>` (or `node scripts/gearbox-approval <PR>`). If `gh pr merge` is refused, ask the maintainer to merge.
