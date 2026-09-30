# Identity roster and a verifiable L1 approval path (Gearbox v2) — design

Date: 2026-09-30
Status: approved in session; implementation plan to follow (`docs/superpowers/plans/2026-09-30-identity-roster.md`)
Sub-project: B of four structural changes. Order: A fence (PR #144) → C ADR IDs (PR #146) → **B identity/L1** → D handoff lifecycle. All four ship together as v2.0.0; the release is held until D lands.

## Problem

L1 approval is anchored to a GitHub account (ADR-0034), and in multi-human repos only the PR-comment path counts (ADR-0042). Both rules assume the maintainer's account is used only by the maintainer. It isn't:

- **Agents act under the humans' accounts.** The downstream audit (2026-09-28) found every agent working under a human's GitHub login. In the audited repos no L1 PR was approved through a PR comment, and one downstream carries an agent-written "approval record". An `agreed` comment from the maintainer's account proves nothing when an agent can post it with the same token.
- **The same holds for merges.** When PR #144 was ready, an agent's `gh pr merge` was refused by the tool's permission classifier, and the maintainer merged it by hand after approving in-session. On GitHub, that merge and an agent's merge look identical.
- **The human count is self-assessed.** ADR-0042 switches paths on "more than one human collaborator", which nothing records. gearbox has two people (the maintainer, whose accounts are `real-stanyan` and `RicksZhang`, and `DamianBuilds-ai`), and nothing in the repo says so. #132 names the same hole from the other side: the repo owner is an unmodeled actor.
- **An approval never expires.** After an `agreed`, an agent can push further commits and merge; nothing says the approval covered only what it saw.

## Goals

1. Every GitHub account that acts in a repo is recorded once, with whether a human, an agent, or both act under it.
2. In a multi-human repo, an L1 approval is an artifact a reviewer can attribute to the maintainer: it comes from an account no agent uses.
3. The repo's human count is derived from that record, not guessed.
4. An approval covers the commits it saw; a later push needs a new one.
5. The agent's pre-merge check is a command with an exit code, not a judgment.
6. The protocol fence doesn't grow: rationale moves into ADRs to pay for new text (net ≤ 0).

## Non-goals

- **Forgery by an agent.** The threat model is honest mistakes and one human impersonating another, as in ADR-0042. An agent that backdates a commit or steals a human's token defeats the checks; the after-the-fact veto (ADR-0006/0007) still applies.
- **Mechanical enforcement in CI.** CI can't tell an L1 PR from an L2 one. A repo can add branch protection or rulesets on top (see §6); the protocol doesn't require it.
- **Separate agent accounts in single-human repos.** With one human, "who approved" has one answer. Single-human repos may keep agents under the human's account (`shared`), and in-session approval stays valid there.
- **Git commit identity.** Which name and email agents commit under is #140, not this sub-project.
- **Team handles as maintainer.** ADR-0034 allowed one. The roster lists member accounts instead (§1).

## Approach

Three decisions, each made by the maintainer in session:

- **Agents get their own accounts in multi-human repos.** Only then can an approval be attributed. Rejected: keeping shared accounts and making L1 "human merges only, agents never approve" (still unverifiable); a per-account mode where shared-only repos fall back to that (more rules, same gap in those repos).
- **Three approval forms, all from a maintainer account.** An `agreed` PR comment, an Approve review, or that account merging the PR. Each is attributable on GitHub. Rejected: Approve review only (reverses ADR-0006's weak-b trade-off, and private repos on free plans can't enforce it); comment or merge only (leaves out the native button, which now works because the PR author is the agent account).
- **One project section, `## Roster`, replaces `## Maintainer`.** Rejected: keeping `## Maintainer` plus an `## Agents` section (leaves humans unrecorded, so the count stays a guess); a separate YAML file (not loaded at session start, and one more protocol file).

## 1. The roster

`## Roster` is a project section outside the fence. It replaces `## Maintainer`, and it is L1 like `## Maintainer` was. One line per GitHub account, in one of three forms:

```
- `real-stanyan` — human: stanyan — maintainer
- `RicksZhang` — human: stanyan
- `DamianBuilds-ai` — shared: Damian
- `stanyan-agent` — agent, run by stanyan
```

- **`human: <person>`**: only that person acts under the account.
- **`shared: <person>`**: that person and their agents both act under it. This is the default for a single-human repo.
- **`agent, run by <person>`**: only agents act under it; `<person>` answers for it.
- **`— maintainer`** may end a `human` or `shared` line. Actions by those accounts count as L1 approval. More than one line may carry it.
- `<person>` is a free-text name, compared exactly. It exists so one person's several accounts count as one human.

**Human count** = the number of distinct `<person>` names on `human` and `shared` lines. More than one = a **multi-human repo** (replaces ADR-0042's self-assessment).

**Multi-human requirements**:

1. Every `maintainer` account is `human`, not `shared`.
2. At least one `agent` account is listed.
3. Agents act only under `agent` accounts.

Requirements 1 and 2 are checked offline (§4); requirement 3 is checked by `approval` (§5) against the session's own login.

Other humans' accounts may be `shared`: their actions never count as L1 approval, so sharing them doesn't weaken it.

**Team handles** (ADR-0034) are dropped: a line names one account. A team lists its members.

## 2. Protocol text

### Fence, "Changing the protocol itself", the maintainer definition

Replace:

```
"The maintainer" below is the GitHub account named in `## Maintainer` (a team = a GitHub team handle, ADR-0034).
```

with:

```
Identities come from `## Roster`: one line per GitHub account — `human`, `shared` (a human and their agents) or `agent` — and `maintainer` marks the accounts whose actions approve L1 (ADR-0053).
```

### Fence, the weak-b paragraph

Replace the paragraph beginning `L1's "explicit agreement" is a weak-b form` with:

```
L1's explicit agreement counts only from a `maintainer` account in `## Roster` (ADR-0053): an `agreed` PR comment, an Approve review, or that account merging the PR itself. An approval covers the commits it saw; a later push needs a new one. Before merging an L1 PR, the agent runs `npx gearbox-agents approval <PR>`. **Multi-human repos** (more than one person in the roster): maintainer accounts are `human`, agents act only under `agent` accounts, and in-session agreement is not approval (ADR-0042). Single-human repos also accept in-session agreement. GitHub's Approve button stays optional; the maintainer as L1 bottleneck is an accepted cost.
```

### Fence, other mentions

- The L1 row of the tier table and the "Modifying an existing protocol file" row of the criterion table: `Maintainer` → `Roster`. The L1 row's process cell also drops "in the session or in a PR comment", which the new clause contradicts: it becomes "after the maintainer's approval (below)".
- **Delete** the `> Why so strict: …` blockquote. ADR-0012 already records the PR #21 precedent it cites, so this is a deletion, not a move.

### Glossary fence (`CONTEXT.md`)

- The `L1/L2 tiers` row: `Maintainer` → `Roster`.
- A new row, `roster`: the `## Roster` section; the three account kinds; the `maintainer` mark; human count = distinct people on `human`/`shared` lines, more than one = multi-human; ADR-0053.

### Byte budget

| Change | Bytes (approx.) |
|---|---|
| Weak-b paragraph, 905 → ~720 | −185 |
| Maintainer definition | +80 |
| `Why so strict` blockquote deleted | −245 |
| Table cells | 0 |
| **Net** | **≈ −350** |

The fence goes from 19797 B to about 19450 B, leaving about 1030 B for D. The plan measures the real numbers; the requirement is net ≤ 0.

### Version and ADR number

B ships inside the untagged v2.0.0: the markers keep `v2.0.0`, and `rehash-fences.js` rewrites the hashes. The protocol ADR is `docs/gearbox-adr/0053-identity-roster.md`, a number claimed at merge (the Upstream release process extension). ADR-0034 and ADR-0042 get a `Status:` note that ADR-0053 amends them.

## 3. `scripts/lib/roster.js`

`parseRoster(agentsText)` returns:

```
{
  entries: [{ login, kind: "human" | "shared" | "agent", person, maintainer: boolean, line }],
  people: string[],          // distinct persons on human/shared lines
  multiHuman: boolean,
  errors: string[],          // unparseable lines, duplicate logins, no section
  placeholder: boolean,      // a `<maintainer>` placeholder line is present
}
```

- The parser is strict. A list item in the section that matches none of the three forms is an error naming the line; nothing is guessed. Non-list lines (prose, blank lines) are ignored.
- Logins compare case-insensitively (GitHub logins are case-insensitive); the backticks are required.
- The dash between fields may be an em dash `—` or ` - `, so a hand-typed roster parses.
- Pure: no I/O. `check` and `approval` both call it.

## 4. `check` (offline)

In `scripts/lib/protocol-check.js`:

- `PROJECT_HEADINGS`: `Maintainer` → `Roster`.
- `maintainerAccount()` is replaced by `parseRoster()`.
- **Errors**: any parser error; no `maintainer` line; and, in a multi-human repo, a `maintainer` account that isn't `human`, or no `agent` account.
- **Warnings**: the `<maintainer>` placeholder is still present (replaces the ADR-0034 warning); an `agent` line whose `run by` person appears on no `human`/`shared` line.

`scripts/check-gearbox.js` runs the same checks upstream. gearbox is multi-human, so its roster must list an agent account before B can merge (§6).

## 5. `gearbox-agents approval <PR>`

A new tool, `scripts/gearbox-approval`, registered in `bin/gearbox.js`. It is online and read-only, and it calls the `gh` CLI (a missing or unauthenticated `gh` is exit 2 with the reason). `<PR>` is a number (the repo is the current one, via `gh repo view`) or a PR URL.

1. **Roster.** Parse the local `AGENTS.md`. Parser errors or a missing section: exit 2.
2. **Identity.** `gh api user` gives the session's login. In a multi-human repo, a login that isn't an `agent` account is exit 2: `this session acts as human account <login> — agents act only under agent accounts in a multi-human repo (ADR-0053)`. A login missing from the roster is exit 2 in any repo.
3. **Fetch.** The PR's head SHA, state and `merged_by`; its commits (the head commit's committer date); its reviews; its issue comments.
4. **Match.** Only actions by `maintainer` accounts count:
   - **Merged** by a maintainer account: approved.
   - **Approve review** (`state: APPROVED`): current if its `commit_id` is the head SHA.
   - **`agreed` comment**: the body, trimmed, starts with `agreed` (case-insensitive). Current if it was created after the head commit's committer date.
5. **Report.** One line per counted action: account, form, time, and `covers head` or `stale (commits after it)`. Exit 0 if one is current or the PR was merged by a maintainer; exit 1 otherwise. In a single-human repo, exit 1 adds: `in-session agreement also counts in a single-human repo (ADR-0042)`.

`agreed` comments and reviews from non-maintainer accounts are listed as `not counted (<login> is not a maintainer account)`. The listing shows the agent why someone's `agreed` didn't count.

**Known limit.** GitHub's API doesn't expose when a commit was pushed, so comment staleness uses the head commit's committer date. A commit with a forged older date passes; that is forgery, outside the threat model (Non-goals). Reviews are exact (`commit_id`).

## 6. install, migration, docs, gearbox's own setup

- **Skeleton** (`scripts/lib/skeleton.js`): `## Roster` with `` - `X` — shared: X — maintainer `` from `--maintainer X`, or a placeholder line `` - `<maintainer>` — shared: <maintainer> — maintainer `` without it. The install prompt's wording points at the roster. No `--agent` flag: a multi-human repo adds its lines by hand.
- **v1→v2 migration** (`scripts/lib/migrate-v1.js`, `scripts/gearbox-update`): a detected maintainer becomes the same `shared` line. The report checkbox reads `confirm … (## Roster)`.
- **No `## Maintainer` compatibility.** No downstream runs a v2 layout yet, so nothing reads the old section.
- **Help and docs**: `bin/gearbox.js` help, `README.md`, `site/index.html`, `.github/pull_request_template.md` and `.github/CODEOWNERS`'s header comment (its "agent self-merge stays intact" stops being true, see below).
- **gearbox's own roster** (in this PR):

  ```
  - `real-stanyan` — human: stanyan — maintainer
  - `RicksZhang` — human: stanyan
  - `DamianBuilds-ai` — shared: Damian
  - `<agent login>` — agent, run by stanyan
  ```

  The maintainer creates the machine account, invites it as a collaborator, and switches this machine's `gh` and git to it, logging `real-stanyan` out of `gh`. Agents never handle credentials. Until the agent line is filled in, the self-check is red, on purpose.
- **gearbox branch protection stays as is**: required check `gate`, code-owner review on the protocol surface, not enforced on admins. The agent account is a non-admin collaborator, so every agent PR touching the protocol surface — nearly every gearbox PR — needs the maintainer's Approve review. For L1 that review is one of the three approval forms; for L2 it is an extra click, accepted. Rejected alternatives: a ruleset bypass for the agent (a user-owned repo has no Maintain role, and bypassing by Write role also exempts `DamianBuilds-ai`); making the agent account an admin; dropping code-owner review; moving the repo to an organization (changes the upstream URL). A GitHub App identity is the later path if the click becomes a bottleneck. ADR-0053 records this; downstreams choose their own settings.

## 7. Testing

- `test/roster.test.js`: the three forms, both dash styles, the `maintainer` mark, case-insensitive duplicates, the person count, placeholders, prose lines ignored, malformed items reported with their line.
- `test/protocol-check.test.js`: each new error and warning; single-human `shared` maintainer is fine; multi-human without an agent is red.
- `test/approval.test.js`: a fake `gh` on `PATH` returns canned JSON by argument. Cases: human login in a multi-human repo (exit 2), unknown login (exit 2), a current Approve review, a stale review, a current and a stale `agreed`, `agreed` from a non-maintainer, merged by a maintainer, nothing (exit 1, with the single-human hint only in a single-human repo), `gh` missing.
- Install, migration, update and self-check tests updated for `## Roster`.
- The gate stays `node scripts/check-gearbox.js && node --test test/*.test.js`.

## 8. Order and release

1. A B issue (Protocol gap, L1), claimed by this lane.
2. Implementation on `claude/gearbox-identity-roster`, cut from PR #146's head. After #146 merges, main is merged in (merge commit) and the PR opens.
3. The PR declares `Affects downstream: yes` (the `## Maintainer` → `## Roster` layout change) and ships inside v2.0.0.
4. L1: the maintainer comments `agreed` from `real-stanyan`, approves, or merges by hand.
5. Then D. After D, plan A's Tasks 15–19: rerun the migration dry-run, tag, publish, migrate the three downstreams. They are single-human, so each gets one `shared` maintainer line.
