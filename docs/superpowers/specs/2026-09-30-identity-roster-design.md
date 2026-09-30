# Identity roster and an honest L1 approval path (Gearbox v2) — design

Date: 2026-09-30
Status: approved in session (revised the same day: no separate agent accounts); implementation plan `docs/superpowers/plans/2026-09-30-identity-roster.md`
Sub-project: B of four structural changes. Order: A fence (PR #144) → C ADR IDs (PR #146) → **B identity/L1** → D handoff lifecycle. All four ship together as v2.0.0; the release is held until D lands.

## Problem

L1 approval is anchored to a GitHub account (ADR-0034), and in multi-human repos only the PR-comment path counts (ADR-0042). Both rules assume the maintainer's account is used only by the maintainer. It isn't:

- **Agents act under the humans' accounts.** The downstream audit (2026-09-28) found every agent working under a human's GitHub login. In the audited repos no L1 PR was approved through a PR comment, and one downstream carries an agent-written "approval record". An `agreed` comment from the maintainer's account proves nothing when an agent can post it with the same token.
- **The same holds for merges.** When PR #144 was ready, an agent's `gh pr merge` was refused by the tool's permission classifier, and the maintainer merged it by hand after approving in-session. On GitHub, that merge and an agent's merge look identical.
- **The human count is self-assessed.** ADR-0042 switches paths on "more than one human collaborator", which nothing records. gearbox has two people — the maintainer (accounts `real-stanyan` and `RicksZhang`) and `DamianBuilds-ai` — and nothing in the repo says so. #132 names the same hole from the other side: the repo owner is an unmodeled actor.
- **An approval never expires.** After an `agreed`, an agent can push further commits and merge; nothing says the approval covered only what it saw.

## Goals

1. Every GitHub account that acts in a repo is recorded once, with whether a human, an agent, or both act under it.
2. The repo's human count is derived from that record, not guessed.
3. The L1 rule stops claiming a verifiability it doesn't have: in a multi-human repo, an L1 PR is approved by the maintainer's own merge, and agents never merge one.
4. Agents never produce approval-shaped artifacts, in any repo.
5. An approval covers the commits it saw; a later push needs a new one.
6. The protocol fence doesn't grow: rationale moves into ADRs to pay for new text (net ≤ 0).

## Non-goals

- **Attributable approvals.** With agents under the humans' accounts, no GitHub artifact proves a human made it. Making approvals attributable needs a separate agent account; the maintainer declined that (see Approach). ADR-0053 records it as the upgrade path.
- **Mechanical enforcement.** CI can't tell an L1 PR from an L2 one. The backstops stay what they are: the tool's own permission prompts, and the maintainer's after-the-fact veto (ADR-0006/0007).
- **An `approval` command.** With merge-only approval in multi-human repos there is nothing for it to check that the agent can act on.
- **Git commit identity** (#140).
- **Team handles as maintainer.** ADR-0034 allowed one. The roster lists member accounts instead (§1).

## Approach

The maintainer's decisions, in session:

- **No separate agent accounts.** Agents keep working under the humans' accounts. Rejected: a new machine account for agents (makes approvals attributable, but costs an extra account, credential setup per machine, and in gearbox a required Approve click on every agent PR, because a non-admin account can't bypass code-owner review and a user-owned repo has no Maintain role); `RicksZhang` as a human-only approval account (same effect with an existing account, but agents have used it).
- **Accept that approval can't be verified; accept only the maintainer's own merge in multi-human repos.** This is the path #144 actually took. Rejected: keeping ADR-0042's comment path (it proves nothing under shared accounts); supporting both modes by account kind (more rules for a mode no repo would use).
- **One project section, `## Roster`, replaces `## Maintainer`.** Rejected: `## Maintainer` plus an `## Agents` section (humans unrecorded, so the count stays a guess); a separate YAML file (not loaded at session start, and one more protocol file).

## 1. The roster

`## Roster` is a project section outside the fence. It replaces `## Maintainer`, and it is L1 like `## Maintainer` was. One line per GitHub account, in one of three forms:

```
- `real-stanyan` — shared: stanyan — maintainer
- `RicksZhang` — shared: stanyan
- `DamianBuilds-ai` — shared: Damian
- `some-bot` — agent, run by stanyan
```

- **`human: <person>`**: only that person acts under the account.
- **`shared: <person>`**: that person and their agents both act under it. The usual case, and the default install and the v1 migration write.
- **`agent, run by <person>`**: only agents act under it; `<person>` answers for it.
- **`— maintainer`** may end a `human` or `shared` line: the maintainer's accounts. More than one line may carry it.
- `<person>` is a free-text name, compared exactly. It makes one person's several accounts count as one human.

**Human count** = the number of distinct `<person>` names on `human` and `shared` lines. More than one = a **multi-human repo** (replaces ADR-0042's self-assessment).

The kinds are a record, not a gate: nothing is required of them beyond being readable. They tell a reader — and #132's owner-as-actor problem — which accounts may be an agent at work.

## 2. The L1 rule

- **Every repo**: an L1 approval comes only from the maintainer (a `maintainer` account in the roster), as an `agreed` PR comment, an Approve review, or in the session. It covers the commits it saw; a later push needs a new one.
- **Multi-human repos**: only the maintainer's own merge approves an L1 PR, and agents never merge one. The agent opens the PR and stops; per the existing rule, an open PR at shift-end means the Task issue gets a progress comment and the PR stays open. In-session agreement and the comment path no longer count here (ADR-0042 amended): agents act under the humans' accounts, so neither proves who approved.
- **Every repo**: an agent never writes an approval — no `agreed` comment, no Approve review, no approval record — for anyone, under any account.

**Known limit** (in ADR-0053): GitHub shows a merge by `real-stanyan`, not whether the maintainer's hand or an agent pressed it. The rule relies on agents obeying it; the tool's permission prompts and the after-the-fact veto are the backstops.

## 3. Protocol text

### Fence, "Changing the protocol itself", the maintainer definition

Replace:

```
"The maintainer" below is the GitHub account named in `## Maintainer` (a team = a GitHub team handle, ADR-0034).
```

with:

```
The maintainer's accounts are the `maintainer` lines of `## Roster`, which lists every account as `human`, `shared` (a human and their agents) or `agent` (ADR-0053).
```

### Fence, the weak-b paragraph

Replace the paragraph beginning `L1's "explicit agreement" is a weak-b form` with:

```
L1's explicit agreement comes only from the maintainer: an `agreed` PR comment or an Approve review from a `maintainer` account, or agreement in the session. It covers the commits it saw; a later push needs a new one. **Multi-human repos** (more than one person on the `human`/`shared` lines of `## Roster`): only the maintainer's own merge approves, and agents never merge an L1 PR — agents act under the humans' accounts, so no comment or review proves who wrote it (ADR-0042/0053). In every repo, an agent never writes an approval — no `agreed`, no Approve, no approval record — for anyone. GitHub's Approve button stays optional; the maintainer as L1 bottleneck is an accepted cost.
```

### Fence, other mentions

- The L1 row of the tier table: `Maintainer` → `Roster`, and the process cell's "after the maintainer explicitly agrees, in the session or in a PR comment" → "after the maintainer's approval (below)" (the old wording contradicts the multi-human rule).
- The "Modifying an existing protocol file" row of the criterion table: `Maintainer` → `Roster`.
- The "Who merges" bullet of PR disposition: "L1 waits for the maintainer's agreement" → "L1 waits for the maintainer's approval — in a multi-human repo the maintainer merges it" (same contradiction as the tier cell).
- **Delete** the `> Why so strict: …` blockquote. ADR-0012 already records the PR #21 precedent it cites.

### Glossary fence (`CONTEXT.md`)

- The `L1/L2 tiers` row: `Maintainer` → `Roster`.
- A new row, `roster`: the section; the three kinds; the `maintainer` mark; the human count; ADR-0053.

### Byte budget

| Change | Bytes (approx.) |
|---|---|
| Weak-b paragraph, 905 → ~770 | −135 |
| Maintainer definition | +40 |
| L1 table cell | −30 |
| `Why so strict` blockquote deleted | −245 |
| **Net** | **≈ −370** |

The plan measures the real numbers; the requirement is net ≤ 0.

### Version and ADR number

B ships inside the untagged v2.0.0: the markers keep `v2.0.0`, and `rehash-fences.js` rewrites the hashes. The protocol ADR is `docs/gearbox-adr/0053-identity-roster.md`, a number claimed at merge. ADR-0034 and ADR-0042 get a `Status:` note that ADR-0053 amends them.

## 4. `scripts/lib/roster.js`

`parseRoster(agentsText)` returns:

```
{
  found: boolean,
  entries: [{ login, kind: "human" | "shared" | "agent", person, maintainer: boolean, placeholder: boolean }],
  people: string[],          // distinct persons on human/shared lines
  multiHuman: boolean,
  errors: string[],          // unreadable list items, duplicate logins
  placeholder: boolean,      // a `<…>` placeholder login is present
}
```

- Strict: a list item in the section that matches none of the three forms is an error naming the line. Prose, blank lines and fenced blocks are ignored.
- Logins compare case-insensitively; the backticks are required.
- The separator may be an em dash `—` or ` - `, so a hand-typed roster parses.
- Pure: no I/O.

`rosterLine(login, kind, person, { maintainer })` renders a line; `findAccount(roster, login)` looks one up.

## 5. `check` (offline)

In `scripts/lib/protocol-check.js`:

- `PROJECT_HEADINGS`: `Maintainer` → `Roster`; `maintainerAccount()` goes.
- **Errors**: any parser error; no `maintainer` line.
- **Warnings**: a placeholder account is still present (replaces the ADR-0034 warning); an `agent` line whose `run by` person appears on no `human`/`shared` line.

`scripts/check-gearbox.js` runs the same checks upstream.

## 6. install, migration, docs, gearbox's own roster

- **Skeleton** (`scripts/lib/skeleton.js`): `## Roster` with a one-line note and `` - `X` — shared: X — maintainer `` from `--maintainer X`, or `` - `<maintainer>` — shared: <maintainer> — maintainer `` without it. A `roster` option takes a whole list verbatim. The install prompt points at the roster.
- **v1→v2 migration**: a detected maintainer becomes the same `shared` line. The report checkbox: confirm the account, and that a second person in the roster means only the maintainer's own merge approves L1.
- **No `## Maintainer` compatibility**: no downstream runs a v2 layout yet.
- **Docs**: `README.md` (the `--maintainer` bullet), `site/index.html` (both `guard.g1a` strings), `.github/pull_request_template.md` line 9, `AGENTS.md`'s Tech stack module list. `.github/CODEOWNERS` is unchanged: agents stay on the admin account, so L2 self-merge is intact.
- **gearbox's own roster** (in this PR):

  ```
  - `real-stanyan` — shared: stanyan — maintainer
  - `RicksZhang` — shared: stanyan
  - `DamianBuilds-ai` — shared: Damian
  ```

  gearbox is multi-human, so from this PR on its L1 PRs are merged by the maintainer's hand.

## 7. Testing

- `test/roster.test.js`: the three forms, both separators, the `maintainer` mark, case-insensitive duplicates, the person count, placeholders, prose and fenced lines ignored, unreadable items reported with their line, `rosterLine` round-trip.
- `test/protocol-check.test.js`: the section rename, no-maintainer error, parser errors, placeholder warning, run-by warning, a clean single- and multi-human roster.
- Skeleton, migration, update-report and self-check tests updated for `## Roster`.
- The gate stays `node scripts/check-gearbox.js && node --test test/*.test.js`.

## 8. Order and release

1. A B issue (Protocol gap, L1), claimed by this lane.
2. Implementation on `claude/gearbox-identity-roster`, cut from PR #146's head. After #146 merges, main is merged in (merge commit) and the PR opens.
3. The PR declares `Affects downstream: yes` (the `## Maintainer` → `## Roster` layout change) and ships inside v2.0.0.
4. L1: gearbox is multi-human under the new rule and the current one alike in practice — the maintainer merges by hand.
5. Then D. After D, plan A's Tasks 15–19: rerun the migration dry-run, tag, publish, migrate the three downstreams (single-human: one `shared` maintainer line each).
