# Gearbox

A starter scaffold for multi-agent collaboration projects: `AGENTS.md` as the single source of truth + ADRs + a CI hard gate. For anyone who wants multiple AI coding agents (tool-agnostic — Claude Code, Z Code, Cursor, or any agent coding tool) to take turns working in the same repo without stepping on each other.

> This file is the single source of truth for ALL AI coding agents, whatever the tool (Claude Code, Z Code, Cursor, Codex, etc.). Rules live here and only here.
> The block between the `gearbox:protocol` markers is the Gearbox protocol, managed by `gearbox-agents` — don't edit it. Project rules go in the sections outside it.

## Tech stack

- Node.js ≥ 18, no runtime dependencies: the structural self-check (`scripts/check-gearbox.js`), a `node:test` suite (`test/`), and the tool family — `scripts/gearbox-install` scaffold / `scripts/gearbox-version` sync quick-check / `scripts/gearbox-update` downstream sync + v1→v2 migration / `scripts/gearbox-check` protocol check / `scripts/gearbox-prune` branch hygiene — sharing `scripts/lib/` (fence, sections, protocol-check, skeleton, workflows, v1-known, migrate-v1, the TUI animation layer) (ADR-0016/0017/0022/0030/0035/0050/0051)
- Plain Markdown documentation (AGENTS.md / CONTEXT.md / ADRs)

## Hard rules

Gearbox's own (dogfood) hard rules are its gate assertions — `scripts/check-gearbox.js` and `test/` are their executable source of truth, so they aren't repeated here. Clauses marked **Hard rule** in the protocol fence below also count as part of this section (see the fence's opening note).

## Gate

```bash
node scripts/check-gearbox.js && node --test test/*.test.js
```

> The Gate contract (what must be green, and when) is in the protocol below. This section holds only this project's command; `.github/workflows/ci.yml` runs it byte-for-byte.

This repo is the Gearbox core itself, so the gate is a **structural self-check** plus the tool test suite. `check-gearbox.js` verifies required files, the `CLAUDE.md` empty shell, both fences (hash, version, budgets), the section anchors, that `HANDOFF` never appears, and that this Gate matches CI. `node --test` runs the tool suite (`node:test`, zero dependencies). The glob is expanded by the shell, so the command works on Node 18–24 and never scans `.claude/worktrees/`.

## Maintainer

GitHub account: `real-stanyan`

<!-- gearbox:protocol v2.0.0 sha256:41ce6e214f9f; managed by gearbox-agents, do not edit by hand; project additions go in "## Local protocol extensions" -->
## Working agreement (multi-agent)

> This block is the Gearbox protocol — byte-identical in every repo that runs it (ADR-0050). In a downstream repo it changes only through `gearbox-agents update`; record project deviations in `## Local protocol extensions` instead of editing here. In the Gearbox repo itself it is edited under the tiers in "Changing the protocol itself".
>
> Any clause marked **Hard rule** — in this block, in `## Hard rules`, or in `## Local protocol extensions` — counts as part of the `## Hard rules` section and is protected under L1: the criterion anchors to the marking itself, not to where the clause lives (ADR-0018).

### On starting a shift (the start-of-shift steps)

1. **Sync, then read**: `git fetch origin` + fast-forward the local default branch (`git pull --ff-only` while on it) — the repo is the only shared memory, and an unfetched clone is somebody's stale cache of it (a stale clone even means stale *rules*: this very file is version-controlled). Fast-forward impossible = the local default branch has diverged: stop, open an issue, don't build on a forked base (ADR-0046). Then `git log --oneline -10` — see what happened recently
2. Check GitHub Issues — **first look for open handoff issues** (the previous shift's Memory is in there; reading one and closing it = taking over that lane, see ADR-0005. Several open = parallel lanes: take over at most one, leave the rest untouched — see "Parallel shifts" (ADR-0048). If none found → check whether the most recently closed issue has a "no next shift" terminal declaration: if yes = a compliant terminal shift (ADR-0009), start work normally; if no = the previous shift ended out of compliance, open a Protocol gap issue to record it — either way, rebuild context from git log + open issues), then check other open tasks and notes
3. Run the gate command (`## Gate`) to confirm the baseline is green — if it's red, fix it first or open an issue; don't start work on a broken baseline
4. (Downstream repos) Run `npx gearbox-agents version`: `behind` → run `npx gearbox-agents update` and merge its `docs/gearbox-backfill-*` PR through this repo's L1 flow (ADR-0026/0050); `hand-edited` → move the local rules into `## Local protocol extensions`, then re-apply the fence with `npx gearbox-agents update --force` — never edit the fence itself; `v1 layout` → `npx gearbox-agents update` migrates it

### While working

- Commit in small steps; the message should spell out the **why**, not just the what
- **Protocol files stay committed — never add them to `.gitignore`**: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/gearbox-adr/`, `.gearbox-version`, `.github/workflows/ci.yml`. The repo is the only shared memory between shifts; an ignored protocol file exists locally but never reaches the next agent's clone (ADR-0037)
- One agent sees a task through from start to finish; handoffs only happen at task boundaries (issue closed / PR merged), never mid-task
- Non-trivial changes go through a branch + PR; typo-level tweaks can go straight into main
- **Project-owned** architectural decisions go in `docs/adr/` (one decision per file, starting at 0001); protocol ADRs live in `docs/gearbox-adr/`, managed by the gearbox tooling — don't hand-edit them
- Look up domain-term definitions in `CONTEXT.md`; add new project terms under its `## Project terms` as they come up (protocol terms live in its fence)
- **Never edit between the `gearbox:` markers** (in `AGENTS.md` or `CONTEXT.md`). Project rules go in the project sections; additions to the protocol go in `## Local protocol extensions`, each with `- Extends:` (the section it extends) and `- Upstream:` (an upstream issue link, `project-specific`, or `undecided`) (ADR-0050)
- **Keep `AGENTS.md` within 32 KiB**: every agent loads it in full at session start, and Codex silently drops everything past its first 32 KiB. "Where to find things" gets one line per entry — a path plus what's there; longer maps go in `docs/INDEX.md`. `gearbox-agents check` enforces the budget (ADR-0051)

### Roles of issues & PRs

Issues and PRs are the timestamped, append-only, non-decaying conversation carriers between agents (and between agents and humans). In this protocol they have **three non-overlapping roles** — every issue/PR should fit into one of these:

| Role | When to use | When to close |
|---|---|---|
| **Task** | There's an actionable thing to do | The task is done and the gate is green |
| **Memory** (handoff memory) | Leave a comment on the **handoff issue** (see On ending a shift) at shift-end, five-part format | The next shift reads it and closes the handoff issue = handoff complete |
| **Protocol gap** | Hit a question the repo can't answer (rule not written, ambiguous, boundary unclear) | The gap gets folded into AGENTS.md / CONTEXT.md / an ADR |

Hard rules:

- **When you hit a question this repo can't answer, you must open an issue (Protocol gap type) — silent judgment calls are not allowed.** This is the only entry point for the protocol's self-repair — it turns gaps from "tacit understanding" into something explicit, discussable, and closeable.
- **Memory five-part format** (the minimum valid format for a handoff comment, ADR-0004): ① what's done ② what's blocked ③ what's next ④ close the issue if the task is complete ⑤ **rationale / trade-offs** — required whenever this shift made a non-default decision (what was chosen, why, and what premise failing would overturn it); if no decision was made, write "none" — don't omit it. Missing any one item means the handoff doesn't count. Across all five parts: content already captured in a durable artifact (ADR / issue / PR / commit / diff) is referenced by number or path, not restated — copies decay, references don't (ADR-0045). Inline belongs only what no artifact carries.
- **Handoff = the moment the issue closes / the PR merges**, not just feeling like things were "explained clearly." Switching agents without closing the issue is a mid-task handoff, which violates the previous section.
- **A PR is the implementation vehicle for a Task, not a separate role**: a PR references the Task issue it implements, and closes that issue on merge. New issues found during PR review get their own issue — don't pile them up in PR comments.

**Task ordering (blocking edges, ADR-0044)**: when one Task depends on another, the dependent issue's body declares each prerequisite with a literal `Blocked by: #N` line (one per blocker). A shift claims only **frontier** tasks — open tasks with no open blockers; when a blocker closes, its dependents join the frontier. Plain text, grep-able, no Projects/labels needed. This is a hygiene convention — a stale edge costs a judgment call at claim time, nothing more.

**Claiming (ADR-0047)**: a claim = assigning yourself on the Task issue (`gh issue edit <N> --add-assignee @me` — the GitHub account the agent acts under); first assignment wins, visible and timestamped. No triage permission → a "claiming this" comment instead. An open frontier task with no assignee and no claim comment is free. A shift ending with the task unfinished states in its progress comment whether the claim is released (unassign) or carried; a dangling assignment from a shift that left no comment is stale, not binding. Single-human repos may skip claiming — with one queue reader it informs nobody; its value begins at the second human.

> Why use an issue comment instead of a standalone handoff file: see `docs/gearbox-adr/0003-issue-roles.md`. Why Memory lives in an open handoff issue rather than a closed Task issue: see `docs/gearbox-adr/0005-handoff-lives-in-an-open-issue.md`.

### PR disposition (merge rules)

Four rules (ADR-0007):

- **Always merge via merge commit** — never squash, never rebase: the why behind small-step commits is a protocol asset (the repo is the only shared memory between sessions), and squashing is equivalent to deleting memory; locking in one style keeps history predictable.
- **Who merges**: the PR's author agent merges it themself once CI is green. Protocol changes follow the tier system (see "Changing the protocol itself"): L1 waits for the maintainer's agreement, L2 is autonomous.
- **A second agent's review is not mandatory**: in serial repos only one shift is present at a time, and forcing mutual review would block at handoff boundaries; parallel lanes (ADR-0048) don't change this — review stays optional, because the quality backstop never depended on serialization: the CI gate + the maintainer's after-the-fact veto (revert + reopen the issue), plus branch protection where configured (ADR-0042).
- **Don't take over someone else's open PR** — that's a mid-task handoff (see While working). Exception: the handoff issue explicitly transfers it, or the maintainer directs it.

If a PR is still hanging open at shift-end, the task isn't done: per item 3 of On ending a shift, write progress into the Task issue's comment and leave the PR open.

### Changing the protocol itself (rules for changing this file)

Where the protocol text lives decides how it changes (ADR-0050). In the **Gearbox repo**, the fenced protocol is edited under the tiers below. In a **downstream repo**, the fence changes only through upstream releases (`gearbox-agents update`); a local deviation goes in `## Local protocol extensions` and is tiered as if it were written into the section it extends — the ADR-0012 criterion applies unchanged. "The maintainer" below is the GitHub account named in `## Maintainer` (a team = a GitHub team handle, ADR-0034).

Agents can modify AGENTS.md, but **the change is tiered by its content** (ADR-0006):

| Tier | Content | Process |
|---|---|---|
| **L1 strict tier** | Hard rules / Gate command / Tech stack / Maintainer / this section itself | issue + ADR + PR, **and the agent may only merge after the maintainer explicitly agrees, in the session or in a PR comment** |
| **L2 autonomous tier** | Working agreement (except the Gate contract) / Division of labor / the index (Where to find things) | issue + ADR + PR, agent may merge autonomously |

The boundary of "Gate command" (ADR-0010): the command line itself, and **loosening/deleting/rewriting an existing gate-script assertion** = L1; **adding a new, stricter assertion** = L2, riding along with its own PR. Pure refactors (behavior unchanged) count as L2, with the burden of proof on the agent making the change.

**Test-type gates** (vitest / tsc / lint, ADR-0020): the config layer follows the rule above directly (tightening = L2 / loosening = L1 / the command line = L1); the test-content layer is tiered by **motive** — tests added/removed/changed in the same PR as the product code they follow = L2 routine development; **deleting to go green** (deleting / `.skip`-ing / weakening a test with no corresponding product-code change in the diff) = L1, and a silent skip is a violation. Deleting or skipping a test must state its motive in the commit message or PR body.

General rules (apply to both tiers):

- **All three pieces are required, none optional**: a matching issue (usually Protocol gap type) + an ADR (recording the decision and its rationale) + a branch PR (CI must be green to merge; closes the issue on merge).
- **A protocol change without an issue + ADR is out of compliance** and should be reverted, regardless of which tier it belongs to.
- **Protocol changes carry more weight than code changes**: code only needs an ADR for architectural decisions, but protocol changes always need one.
- **Humans retain an after-the-fact veto**: reverting the corresponding PR + reopening the issue undoes the change — even if it wasn't caught at the time.

**L1/L2 boundary criterion** (ADR-0012, **mechanism reference takes priority**): any new content that **references the L1/L2 tiering / Hard rules / Working agreement mechanism** (regardless of whether it's "optional" or touches an existing file) is treated as **L1**. Objective criterion — the text contains mechanism keywords like `L1` / `L2` / `Hard rule` / `Working agreement` / "tiered authorization", or semantically depends on these mechanisms to function (e.g., subagent routing that depends on L1/L2 to decide who gets assigned).

| Scenario | Classification | Basis |
|---|---|---|
| New template/subsystem that **references** a protocol mechanism | **L1** | ADR-0012 |
| New purely informational document (e.g. "how to contribute") that **references** no protocol mechanism | L2 | ADR-0012 |
| Modifying an existing protocol file (Hard rules / Gate / Tech stack / Maintainer / Working agreement content) | **L1** | ADR-0006 |
| Modifying the index (Where to find things) | L2 | ADR-0005 |
| A CONTEXT.md entry **defines** an existing mechanism (changes only CONTEXT.md + cites its source ADR + adds no new obligation/changes no process boundary — all three conditions required) | L2 | ADR-0019 |

**Definition exemption** (ADR-0019): the criterion targets **legislating** (adding/changing mechanism semantics), not **describing** (writing an already-legislated rule into the glossary). If any of the three conditions isn't met, or you're unsure → default to L1; don't grant yourself the exemption. Changing semantics under the guise of a definition is a violation — revert + reopen the issue.

> Why so strict: agents easily use "optional + purely additive" as an L2 channel to expand the protocol's boundaries (see the PR #21 retrospective — subagent-system referenced L1/L2 but self-merged as L2). This criterion closes off that path.

L1's "explicit agreement" is a weak-b form: it's enough for the maintainer to say "agreed" in the session or write "agreed" in a PR comment, and the agent presses the merge button itself. **For the PR-comment path, only a comment authored by the account `## Maintainer` names (for a team handle: one of its members) counts (ADR-0034)** — anyone else's "agreed" is not L1 approval. **In a repo with more than one human collaborator, only the PR-comment path is valid L1 approval (ADR-0042)** — in-session agreement stops counting (including in the maintainer's own session): in-session approval leaves no verifiable trace, so a merged L1 PR without the maintainer's comment would be indistinguishable from an impersonated approval. Single-human repos keep both paths. **GitHub's Approve button is not required** — the cost is that the maintainer becomes the L1 bottleneck, and that cost is accepted.

**Protocol updates** (ADR-0026/0050): pull-triggered. Start-of-shift step 4 (`gearbox-agents version`) and the optional weekly `gearbox-sync` Action run `gearbox-agents update`, which rewrites both fences, copies new protocol ADRs and bumps `.gearbox-version` on a `docs/gearbox-backfill-*` branch; merging that PR adopts the new protocol version and is L1 in the receiving repo. The fence markers and `.gearbox-version` carry the protocol version — tooling maintains them, humans don't. (The upstream-side release rules — the `Affects downstream` declaration, version bumps, tags, npm publish — are the Gearbox repo's own local extension.)

### Gate contract (must be all-green before merge and shift-end)

The Gate command lives in the project's `## Gate` section. CI's `gate` job (`.github/workflows/ci.yml`) runs it byte-for-byte — the CI == Gate contract. The `gearbox-check` job runs `npx gearbox-agents check`: fences intact, `AGENTS.md` within 32 KiB, required sections present, CI == Gate (ADR-0051; in the Gearbox repo, `scripts/check-gearbox.js` runs the same checks inside the gate). Both must be green to merge; if either is red, merging is not allowed.

### On ending a shift (shift-end rules)

1. The gate and the protocol check are green (see Gate contract)
2. commit + push
3. Close finished Task issues as usual; for half-finished ones, write progress into that issue's comment
4. **Open a handoff issue for the next shift** (Task type, kept open, ADR-0005): the body states the current state and suggestions for next steps, and this shift's Memory comment (five-part format, ADR-0004) goes here. In multi-human repos the body also lists the Task issues this lane still owns (takeover = claiming exactly those), or marks itself **"context only"** when nothing transfers (ADR-0048). **This is the only entry point the next shift is guaranteed to encounter** — Memory no longer gets buried in a casually closed Task issue. **The sole exception — a terminal shift** (ADR-0009): when archiving / confirming there's no next shift, you may skip opening one, but you must explicitly declare "no next shift" + the reason in a comment on the last closed issue. A silent terminal doesn't count as terminal. Terminal is repo-level: with another lane still live (someone else's open handoff or claimed task), a terminal declaration is invalid — that's just a lane end (ADR-0048)

### Parallel shifts (multi-human repos, ADR-0048)

Serial single-human repos need none of this — with one live shift, the rules above already suffice and every rule below degenerates to them.

- **A lane = one shift + its claimed tasks.** Parallel shifts are allowed iff each works only on frontier tasks it has claimed (ADR-0044/0047). Disjoint claims = disjoint lanes; no other lock exists or is needed — task-level overlap is prevented at claim time, file-level overlap resolves in the PR merge like any concurrent development.
- **Handoff issues are per-lane**: shift-end rule 4 unchanged in shape, but a starting shift reads **all** open handoff issues, takes over **at most one** lane (claim its listed tasks, close its handoff), and leaves other lanes' handoffs open — closing another live lane's handoff is stealing its baton. A **"context only"** handoff (lane finished, nothing transfers) is closed by its first reader after reading.
- **Terminal declarations (ADR-0009) are repo-level, not lane-level** — see On ending a shift.
- **Protocol changes serialize at merge time**: two lanes may each open a protocol PR, but ADR numbers (and, in the Gearbox repo, the version bump) are claimed at merge, not at branch time. Before merging: re-fetch; if a competing protocol PR landed first, renumber your ADR (and, in the Gearbox repo, recompute the version: latest tag + segment, ADR-0028) inside your PR, then merge.
- A stalled lane is released by the maintainer: unassign its tasks, close its handoff (the stale-claim rule in ADR-0047 already makes dangling assignments non-binding).

### Branch hygiene (optional)

Before shift-end (or when you hit stale refs at shift-start), run `npx gearbox-agents prune`. It cleans up four things (ADR-0030/0043):

- Leftover linked worktrees from agent sessions (`--apply-worktrees`, `git worktree remove` on merged + clean ones only — dirty or locked worktrees are reported, never removed; runs before the branch pass because a worktree checkout blocks `git branch -d`)
- Locally merged branches (`git branch -d` safe-deletes, fails loudly)
- stale remote-tracking refs (`git fetch --prune`)
- Remote merged branches (`--apply-remote`, prints the list + asks for confirmation before deleting)

Dry-run by default — deletes nothing; a whitelist protects the current branch / the default branch / `gearbox-backfill-*` / the main worktree and the worktree you run from; never force-deletes (`-D`, `worktree remove --force`). This doesn't replace GitHub's `delete_branch_on_merge` setting — turning that on is the recommended root fix for repo owners; the tool is a backstop (`--check-settings` checks it and prints the command to enable it, without changing it automatically).

### Division of labor

Division of labor is a project property, declared in the project's `## Division of labor` section (ADR-0008). When that section is absent or blank, the default applies: **Task-issue claim-based ownership** — whoever claims a task sees it through start to finish; tasks aren't routed by agent specialty.
<!-- /gearbox:protocol -->

## Local protocol extensions

> Project additions to the fenced protocol. Each `###` entry names the fenced section it extends (`- Extends:`) and where it stands upstream (`- Upstream:` an upstream issue link, `project-specific`, or `undecided`). An entry is tiered as if it were written into the section it extends (ADR-0006/0012).

### Upstream release process (Gearbox repo only)

- Extends: Changing the protocol itself
- Upstream: n/a — this is the upstream

**Editing the fences** (ADR-0050): after changing anything between the `gearbox:` markers in `AGENTS.md` or `CONTEXT.md`, set `package.json`'s version to this change's target version, then run `node scripts/dev/rehash-fences.js`. It rewrites both markers' hash and version: `package.json`'s version when fence content changed since the latest tag, else the version in that tag's markers — not the tag's name, which moves past it with every README-only release. It refuses, writing nothing, only when fence content changed since the tag and `package.json` isn't bumped past it. The self-check applies the same rule (`scripts/lib/fence-release.js`): it fails when a marker's hash doesn't match its content, when changed content isn't stamped with a `package.json` version bumped past the tag, and when unchanged content carries any version but the one in the tag's markers.

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
