# Collision-free project ADR IDs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project ADRs are named after the issue that settles them (`docs/adr/<issue>-<slug>.md`, cited `ADR-<issue>`), and the protocol check turns new duplicate IDs red.

**Architecture:**
- A new assertion in the shared protocol check (`scripts/lib/protocol-check.js`) groups ADR files by numeric ID.
  - Downstream it runs in `gearbox-agents check`; upstream, in the Gearbox self-check.
  - In `docs/adr/`, duplicates that involve an issue ID fail, and older zero-padded duplicates produce one warning.
  - In `docs/gearbox-adr/`, every duplicate fails.
- The protocol fence's While-working bullet states the rule. The Parallel-shifts "renumber your ADR" bullet leaves the fence for the Gearbox repo's own local extension.
- ADR-0052 records the decision. The ADR template, the skeleton, install's closing hint and the README follow the new naming.

**Tech Stack:** Node.js ≥ 18 ESM, zero dependencies, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-30-adr-issue-ids-design.md`

## Global Constraints

- **Dependencies and tests:** zero runtime dependencies (only `node:` built-ins). Tests are `test/*.test.js` on `node:test`.
- **Gate command**, green at every commit: `node scripts/check-gearbox.js && node --test test/*.test.js`.
- **Fence edits:** edit between the `gearbox:` markers only in Task 2, only with that task's exact text, then run `node scripts/dev/rehash-fences.js`.
- **Budgets:** protocol fence content ≤ 20480 bytes; `AGENTS.md` ≤ 32768 bytes.
- **Versions:** `package.json` stays `2.0.0`, and both markers stay `v2.0.0`. v2.0.0 is unreleased; C lands inside it.
- **Language:** all repo text is English (ADR-0032).
- **Commits:** small; the message says *why*; every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Outward actions** (issues, PRs, push, merge) happen only in the controller tasks (0 and 4), and each is confirmed with the user at execution time.
- **Workspace:** worktree `/Users/stanyan/Github/gearbox/.claude/worktrees/gearbox-promo-video-262514`, branch `claude/gearbox-adr-issue-ids`. Never bare `git stash`.

---

### Task 0: Protocol gap issue (controller)

**Files:** none (GitHub). **Outward action:** confirm with the user first.

- [ ] **Step 1: Open the issue and claim it.**

```bash
gh issue create -R real-stanyan/gearbox --title "Protocol gap: parallel lanes collide on sequential project ADR numbers" --body "$(cat <<'EOF'
Project ADRs take the next free number at branch time, so parallel lanes pick the same one and the collision surfaces only once both PRs are on main.

Evidence:
- Mr-Otto: 93 renumbering commits; >=5 of its 14 red mains were two green PRs taking the same number; 5767 ADR references across 1152 files are at risk on every renumber.
- dryrun: 10 colliding pairs still in docs/adr/.

ADR-0048's "renumber at merge" moves the race without closing it.

Design: docs/superpowers/specs/2026-09-30-adr-issue-ids-design.md — project ADRs are named after the issue that settles them, and the protocol check fails on new duplicate IDs. Lands in the unreleased v2.0.0.
EOF
)" && gh issue edit <N> -R real-stanyan/gearbox --add-assignee @me
```

Record the issue number as `ISSUE_C` in the ledger.

---

### Task 1: Duplicate ADR IDs in the protocol check

**Files:**
- Modify: `scripts/lib/protocol-check.js`
  - line 4: the import from `node:fs` gains `readdirSync`;
  - add `duplicateAdrIds` above `runProtocolChecks`;
  - add the new assertions right before `return { errors, warnings, protocol, glossary };`.
- Test: `test/protocol-check.test.js` (append).

**Interfaces:**
- Consumes: `runProtocolChecks(root, { upstream })` returns `{ errors: string[], warnings: string[], protocol, glossary }` (existing).
- Produces: `export function duplicateAdrIds(root, dir) → Array<{ id: number, files: string[] }>`.
  - Returns only groups of two or more.
  - Groups are ordered by `id` ascending, and each group's `files` are sorted.
  - `dir` is relative to `root`. A missing directory returns `[]`.

- [ ] **Step 1: Write the failing tests.** Append to `test/protocol-check.test.js`. It already imports `runProtocolChecks`, `v2Repo`, `write` and `errorsOf`.

```js
test("docs/adr: a duplicate ADR ID fails — IDs compare as numbers, and issue IDs are never exempt (ADR-0052)", () => {
  const mixed = v2Repo();
  write(mixed, "docs/adr/0074-a.md", "# a\n");
  write(mixed, "docs/adr/74-b.md", "# b\n");
  assert.deepEqual(errorsOf(mixed), [
    "docs/adr: ADR-74 is used by 2 files: 0074-a.md, 74-b.md — name a new ADR after the issue that settles it (a fresh issue if that number is taken); never renumber an ADR that is already cited (ADR-0052)",
  ]);
  const issueIds = v2Repo();
  write(issueIds, "docs/adr/1266-a.md", "# a\n");
  write(issueIds, "docs/adr/1266-b.md", "# b\n");
  const errs = errorsOf(issueIds);
  assert.equal(errs.length, 1, errs.join("\n"));
  assert.match(errs[0], /^docs\/adr: ADR-1266 is used by 2 files: 1266-a\.md, 1266-b\.md — /);
});

test("docs/adr: distinct IDs pass; README, notes and other non-numbered files aren't ADRs", () => {
  const dir = v2Repo();
  for (const f of ["0001-first.md", "0002-second.md", "1266-issue-id.md", "1267-next.md", "README.md", "notes.md", "draft-1268.md"])
    write(dir, `docs/adr/${f}`, "# x\n");
  const r = runProtocolChecks(dir);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("docs/adr: duplicates among older zero-padded IDs warn once instead of failing — renumbering would break their references", () => {
  const dir = v2Repo();
  for (const f of ["0045-a.md", "0045-b.md", "0046-c.md", "0046-d.md", "0047-e.md"]) write(dir, `docs/adr/${f}`, "# x\n");
  const r = runProtocolChecks(dir);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, [
    "docs/adr: older ADR numbers used by more than one file: ADR-45 (0045-a.md, 0045-b.md); ADR-46 (0046-c.md, 0046-d.md) — references to them are ambiguous; new ADRs are named after their issue, so this can't recur (ADR-0052)",
  ]);
});

test("docs/gearbox-adr: any duplicate fails, with the fix for the mode — downstream copies vs upstream numbers", () => {
  const dir = v2Repo();
  write(dir, "docs/gearbox-adr/0050-a.md", "# a\n");
  write(dir, "docs/gearbox-adr/0050-b.md", "# b\n");
  assert.deepEqual(errorsOf(dir).filter((e) => e.startsWith("docs/gearbox-adr")), [
    "docs/gearbox-adr: ADR-50 is used by 2 files: 0050-a.md, 0050-b.md — these copies are managed by gearbox-agents: delete the stray file and rerun `npx gearbox-agents update`",
  ]);
  assert.deepEqual(errorsOf(dir, { upstream: true }).filter((e) => e.startsWith("docs/gearbox-adr")), [
    "docs/gearbox-adr: ADR-50 is used by 2 files: 0050-a.md, 0050-b.md — protocol ADR numbers are claimed at merge: renumber yours (Upstream release process)",
  ]);
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `node --test test/protocol-check.test.js`
Expected: the four new tests FAIL. In the mixed case `errorsOf` returns `[]` instead of the expected array, and there is no older-duplicate warning. Every existing test still passes.

- [ ] **Step 3: Implement.** In `scripts/lib/protocol-check.js`:
  - line 4 becomes `import { readFileSync, existsSync, readdirSync } from "node:fs";`
  - add this function above `export function runProtocolChecks`:

```js
// ADR files in `dir` grouped by their numeric ID (ADR-0052): "0074-x.md" and "74-y.md" are both
// ADR-74. Only groups of two or more come back, ordered by ID, file names sorted. A file without
// a leading number (README, notes) isn't an ADR.
export function duplicateAdrIds(root, dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const byId = new Map();
  for (const name of readdirSync(abs)) {
    const m = name.match(/^(\d+)-.+\.md$/);
    if (!m) continue;
    const id = Number(m[1]);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(name);
  }
  return [...byId]
    .filter(([, files]) => files.length > 1)
    .sort(([a], [b]) => a - b)
    .map(([id, files]) => ({ id, files: files.sort() }));
}
```

Then insert immediately before `return { errors, warnings, protocol, glossary };`:

```js
  // Project ADRs are named after their issue (ADR-0052). A duplicate involving an issue ID (no
  // leading zero) is new and fails. Duplicates among older zero-padded sequential IDs can only be
  // fixed by renumbering, which breaks cited references — they warn, once for all of them.
  const older = [];
  for (const { id, files } of duplicateAdrIds(root, "docs/adr")) {
    if (files.every((f) => f.startsWith("0"))) older.push(`ADR-${id} (${files.join(", ")})`);
    else
      errors.push(
        `docs/adr: ADR-${id} is used by ${files.length} files: ${files.join(", ")} — name a new ADR after the issue that settles it (a fresh issue if that number is taken); never renumber an ADR that is already cited (ADR-0052)`,
      );
  }
  if (older.length)
    warnings.push(
      `docs/adr: older ADR numbers used by more than one file: ${older.join("; ")} — references to them are ambiguous; new ADRs are named after their issue, so this can't recur (ADR-0052)`,
    );
  for (const { id, files } of duplicateAdrIds(root, "docs/gearbox-adr"))
    errors.push(
      `docs/gearbox-adr: ADR-${id} is used by ${files.length} files: ${files.join(", ")} — ${
        upstream
          ? "protocol ADR numbers are claimed at merge: renumber yours (Upstream release process)"
          : "these copies are managed by gearbox-agents: delete the stray file and rerun `npx gearbox-agents update`"
      }`,
    );
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `node --test test/protocol-check.test.js`
Expected: every test passes, the four new ones included.

- [ ] **Step 5: Run the full gate.**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: `✅ Gearbox self-check passed`, then `# fail 0`. The Gearbox repo's own `docs/gearbox-adr/` (0001–0051) has no duplicates.

- [ ] **Step 6: Commit.**

```bash
git add scripts/lib/protocol-check.js test/protocol-check.test.js
git commit -F - <<'EOF'
feat(check): a duplicate ADR ID is red; older zero-padded duplicates warn

Project ADRs are now named after the issue that settles them (ADR-0052), so
a duplicate ID means two PRs settled the same issue — fail it before or at
merge. Duplicates among older sequential IDs can only be fixed by
renumbering, which breaks cited references, so they warn once instead of
turning a migrating downstream red (dryrun carries 10 such pairs).
docs/gearbox-adr numbers are upstream's and unique: every duplicate fails.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Protocol text, ADR-0052, ADR-0048, the ADR template

**Files:**
- Modify: `AGENTS.md`
  - the fence: the While-working bullet, and deleting one Parallel-shifts bullet;
  - the "Upstream release process (Gearbox repo only)" local extension: a new paragraph.
- Create: `docs/gearbox-adr/0052-project-adrs-are-named-after-their-issue.md`
- Modify: `docs/gearbox-adr/0048-parallel-shifts.md` (line 4, the Status line only)
- Modify: `docs/gearbox-adr/0001-adr-template.md`

**Interfaces:**
- Consumes: `node scripts/dev/rehash-fences.js`, which rewrites both markers' hash and version.
- Produces: fence content of 19796 bytes, marker `<!-- gearbox:protocol v2.0.0 sha256:40527e301942; … -->`, and ADR-0052, which Task 3's texts cite.

- [ ] **Step 1: Edit the While-working bullet** inside the fence in `AGENTS.md`. Replace this exact line:

```
- **Project-owned** architectural decisions go in `docs/adr/` (one decision per file, starting at 0001); protocol ADRs live in `docs/gearbox-adr/`, managed by the gearbox tooling — don't hand-edit them
```

with this exact line:

```
- **Project-owned** architectural decisions go in `docs/adr/`, one decision per file, named after the issue that settles it: `docs/adr/<issue>-<slug>.md`, cited `ADR-<issue>` — issue numbers are unique, so parallel lanes never collide; older numbered files keep their numbers, and no ADR is ever renumbered (ADR-0052). Protocol ADRs live in `docs/gearbox-adr/`, managed by the gearbox tooling — don't hand-edit them
```

- [ ] **Step 2: Delete this exact line** (and its newline) from "Parallel shifts" inside the fence:

```
- **Protocol changes serialize at merge time**: two lanes may each open a protocol PR, but ADR numbers (and, in the Gearbox repo, the version bump) are claimed at merge, not at branch time. Before merging: re-fetch; if a competing protocol PR landed first, renumber your ADR (and, in the Gearbox repo, recompute the version: latest tag + segment, ADR-0028) inside your PR, then merge.
```

- [ ] **Step 3: Add the Gearbox-only rule to the local extension.**
  - This is outside the fence. In `## Local protocol extensions` → `### Upstream release process (Gearbox repo only)`, the last paragraph starts with `**Version numbers** (ADR-0023, split by ADR-0050):`.
  - After that paragraph, add a blank line and then this exact paragraph, before `## Division of labor`:

```
**Parallel protocol PRs** (ADR-0048/0052): protocol ADR numbers and the version bump are claimed at merge, not at branch time. Before merging: re-fetch; if a competing protocol PR landed first, renumber your ADR and recompute the version (latest tag + segment, ADR-0028) inside your PR, then merge.
```

- [ ] **Step 4: Restamp the fences.**

Run: `node scripts/dev/rehash-fences.js`
Expected: `AGENTS.md: gearbox:protocol v2.0.0 sha256:40527e301942` (restamped) and `CONTEXT.md: gearbox:glossary v2.0.0 sha256:83ed9a6f206c (unchanged)`.
A different protocol hash means Steps 1–2 don't match the exact text. Diff the fence against the lines above and fix it before continuing.

Verify the size: `node --input-type=module -e 'import {findFence} from "./scripts/lib/fence.js"; import {readFileSync} from "fs"; console.log(Buffer.byteLength(findFence(readFileSync("AGENTS.md","utf8"),"protocol").content))'`
Expected: `19796`.

- [ ] **Step 5: Create `docs/gearbox-adr/0052-project-adrs-are-named-after-their-issue.md`** with exactly:

````markdown
# ADR-0052: Project ADRs are named after the issue that settles them

- Date: 2026-09-30
- Status: accepted
- Related: ADR-0048 (parallel shifts — amended: only the Gearbox repo claims ADR numbers at merge), ADR-0051 (protocol check), ADR-0010 (gate-assertion tiers), ADR-0044/0047 (frontier claiming)

## Context

Project ADRs took the next free number. Parallel lanes pick that number when they branch and can't see each other's branches, so two lanes pick the same one. Each PR is green alone; the collision appears only once both are on main. ADR-0048 answered with "claim the number at merge and renumber if a competing PR landed first". That moves the race to merge time without closing it: closing it needs "require branches to be up to date" protection, which free private repos can't enable, and every claim costs a rewrite commit plus a CI rerun.

The audit of three downstreams put numbers on it. Mr-Otto has 93 commits that do nothing but renumber ADRs (one ADR moved 0311 → 0314 → 0316), and at least 5 of its 14 red runs on main were two green PRs taking the same number. The colliding files coexist fine. The damage is to references: Mr-Otto cites ADRs 5767 times across 1152 files, a collision splits those citations between two files, and renumbering rewrites them, sometimes the wrong ones. Another downstream still carries 10 colliding pairs.

## Decision

- A project ADR is named after the issue that settles it: `docs/adr/<issue>-<slug>.md`, cited `ADR-<issue>`, with `- Issue: #<issue>` in its header. The number is written without zero padding. GitHub numbers issues from one repo-wide counter, so the ID is unique the moment the issue exists, and no lane coordinates with any other.
- One decision per issue: a second decision from the same issue gets its own issue.
- Older sequentially numbered ADRs keep their numbers, and no ADR is ever renumbered. IDs compare as integers (`0074` = `74`). When a decision's issue number is already taken by an older ADR, the decision gets a fresh issue.
- The protocol check (ADR-0051) groups ADR files by ID:
  - In `docs/adr/`, a duplicate involving an issue ID (no leading zero) is an error.
  - Duplicates among older zero-padded IDs produce one summary warning, because their only fix is the renumbering this ADR forbids.
  - In `docs/gearbox-adr/`, every duplicate is an error.
- Gearbox's own protocol ADRs stay sequential: one upstream line writes them, and every downstream copy is cited by those numbers. Their claim-at-merge rule, together with the version bump it already covered, moves out of the fence into the Gearbox repo's local extension "Upstream release process".
- The index doesn't list ADRs one by one: `docs/adr/` is their index. Two parallel PRs that each append an index line conflict for no reason.

## Alternatives rejected

- **Date + slug** (`2026-09-30-<slug>.md`): unique without coordination too, but every citation becomes long and a slug can never change.
- **Automated claim-at-merge** (a `gearbox-agents adr claim` command): keeps dense numbers, but the race and the reference rewrites stay.

## Consequences

- Parallel lanes never collide on project ADR numbers, and ADR-0048's "renumber your ADR" no longer applies downstream.
- IDs are sparse and not in decision order; the `Date:` line orders them.
- A duplicate can still arise when two PRs settle the same issue. If the other PR merged first, the PR's own check is red; otherwise the push to main is.
- The same reasoning applies to any hand-numbered sequence (database migrations are the other one the audit found). This ADR adds no rule for them.
- **Don't** renumber an older ADR to clear the warning: the references it would break are the reason this ADR exists.
````

- [ ] **Step 6: Amend ADR-0048's Status line.** In `docs/gearbox-adr/0048-parallel-shifts.md`, replace the exact line `- Status: accepted` with:

```
- Status: accepted (amended by ADR-0052: project ADRs are named by issue, so only the Gearbox repo claims ADR numbers at merge)
```

- [ ] **Step 7: Update the ADR template.** In `docs/gearbox-adr/0001-adr-template.md`, keep the title line `# ADR-0001: <decision title>`, because update's ADR parser reads the file's own number from it. Replace the header block, the lines from `- Date:` through `- Status:`, with exactly:

```
- Date: <YYYY-MM-DD>
- Issue: #<issue>
- Status: accepted | superseded by ADR-XXXX

> Copy this file to start an ADR. In a project repo, name the copy `docs/adr/<issue>-<slug>.md` after the issue that settles the decision and title it `# ADR-<issue>: …` (ADR-0052); in the Gearbox repo, a protocol ADR takes the next number.
```

- [ ] **Step 8: Run the full gate.**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: `✅ Gearbox self-check passed`, then `# fail 0`.

- [ ] **Step 9: Commit.**

```bash
git add AGENTS.md docs/gearbox-adr/0052-project-adrs-are-named-after-their-issue.md docs/gearbox-adr/0048-parallel-shifts.md docs/gearbox-adr/0001-adr-template.md
git commit -F - <<'EOF'
docs(protocol): project ADRs are named after the issue that settles them (ADR-0052)

Sequential project ADR numbers collide between parallel lanes (93
renumbering commits in Mr-Otto alone), and renumbering breaks the
references that make ADRs useful. An issue number is unique the moment it
exists, so the While-working rule names project ADRs after their issue and
forbids renumbering. The Parallel-shifts "renumber your ADR" bullet only
ever mattered for the Gearbox repo's own ADR numbers and version, so it
leaves the fence for Gearbox's local extension — the fence shrinks 169 B
(19965 → 19796). The ADR template shows the Issue line and the naming.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Skeleton, install hint, README

**Files:**
- Modify: `scripts/lib/skeleton.js`: the `docs/adr/` line in `INDEX_POINTERS` (line 22) and in `PLACEHOLDERS.whereToFind` (line 44).
- Modify: `scripts/gearbox-install:488` (the "Write your first own decision" hint).
- Modify: `README.md:68`.
- Test: `test/skeleton.test.js` (append), `test/install.test.js` (first test).

**Interfaces:**
- Consumes: ADR-0052 (Task 2), cited in the texts.
- Produces: `INDEX_POINTERS` and `PLACEHOLDERS.whereToFind` both contain the line below; downstream installs and migrations use it.

```
- `docs/adr/` — this project's own architectural decisions, one file per decision named `<issue>-<slug>.md` after the issue that settles it (ADR-0052; not listed here one by one)
```

- [ ] **Step 1: Write the failing tests.**
  - `test/skeleton.test.js` already imports `PLACEHOLDERS`. Add `INDEX_POINTERS` to that import from `../scripts/lib/skeleton.js`, then append:

```js
test("the docs/adr index line names ADRs after their issue and doesn't list them one by one (ADR-0052)", () => {
  const line =
    "- `docs/adr/` — this project's own architectural decisions, one file per decision named `<issue>-<slug>.md` after the issue that settles it (ADR-0052; not listed here one by one)";
  assert.ok(INDEX_POINTERS.split("\n").includes(line), INDEX_POINTERS);
  assert.ok(PLACEHOLDERS.whereToFind.split("\n").includes(line), PLACEHOLDERS.whereToFind);
});
```

  - In `test/install.test.js`, test "install lays down a v2 tree that passes gearbox-check": right after `assert.equal(r.code, 0, r.out);`, add:

```js
  assert.match(r.out, /docs\/adr\/<issue>-<slug>\.md/, "the closing hint names project ADRs after their issue (ADR-0052)");
  assert.doesNotMatch(r.out, /docs\/adr\/0001-/);
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `node --test test/skeleton.test.js test/install.test.js`
Expected: the new skeleton test FAILS because the line isn't in `INDEX_POINTERS`, and the install test FAILS on the `docs/adr/<issue>-<slug>.md` match.

- [ ] **Step 3: Implement.**
  - In `scripts/lib/skeleton.js`, replace both occurrences of `` "- `docs/adr/` — this project's own architectural decisions", `` (lines 22 and 44, keeping each line's own indentation) with:

```js
"- `docs/adr/` — this project's own architectural decisions, one file per decision named `<issue>-<slug>.md` after the issue that settles it (ADR-0052; not listed here one by one)",
```

  - In `scripts/gearbox-install`, replace line 488 with:

```js
await tui.typeLine(`  ${step++}. Write your first own decision to ${C.cyan("docs/adr/<issue>-<slug>.md")} ${C.dim("(named after the issue that settles it, ADR-0052; protocol ADRs live in docs/gearbox-adr/, format in 0001-adr-template.md)")}`);
```

  - In `README.md`, replace line 68 with:

```
2. Write your first project-specific architectural decision into `docs/adr/`, named after the issue that settles it — `docs/adr/<issue>-<slug>.md`, cited `ADR-<issue>` (issue numbers never collide between parallel lanes, ADR-0052); protocol ADRs live in `docs/gearbox-adr/` (tool-managed; format shown in its `0001-adr-template.md`)
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `node --test test/skeleton.test.js test/install.test.js`
Expected: all pass.

- [ ] **Step 5: Run the full gate.**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: `✅ Gearbox self-check passed`, then `# fail 0`.

- [ ] **Step 6: Commit.**

```bash
git add scripts/lib/skeleton.js scripts/gearbox-install README.md test/skeleton.test.js test/install.test.js
git commit -F - <<'EOF'
docs(install): new repos name project ADRs after their issue (ADR-0052)

The skeleton's "Where to find things" line, install's closing hint and the
README still said "starting at 0001" — the numbering that collides between
parallel lanes. They now say docs/adr/<issue>-<slug>.md, and the index line
says ADRs aren't listed one by one: every appended index line was a merge
conflict waiting between parallel PRs.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: PR, L1, merge (controller)

**Files:** none (GitHub). **Outward actions:** confirm with the user before pushing.

- [ ] **Step 1: Wait for #144.** It must be merged into `main`, because this branch is cut from its head.
- [ ] **Step 2: Push** `claude/gearbox-adr-issue-ids` and open the PR against `main`:
  - title: `Project ADRs are named after the issue that settles them (ADR-0052)`
  - body per `.github/pull_request_template.md`:
    - `Closes #<ISSUE_C>`;
    - an L1 note (fence edits);
    - `Affects downstream: yes — fence text changes and the check gains an assertion; no migration`;
    - `Version bump: none — lands inside the unreleased v2.0.0 (package.json stays 2.0.0)`;
    - the gate output.
- [ ] **Step 3: Bind the PR** with the ccd_pr tools. CI must be green, and real-stanyan must comment `agreed` (ADR-0042).
- [ ] **Step 4: Merge** with a merge commit only: `gh pr merge <PR#> -R real-stanyan/gearbox --merge`. Then start sub-project B from `main`.
