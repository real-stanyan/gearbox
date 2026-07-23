# Gearbox

A starter scaffold for multi-agent collaboration projects: `AGENTS.md` as the single source of truth + ADRs + a CI hard gate. For anyone who wants multiple AI coding agents (tool-agnostic — Claude Code, Z Code, Cursor, or any agent coding tool) to take turns working in the same repo without stepping on each other.

> This file is the single source of truth for ALL AI coding agents, whatever the tool (Claude Code, Z Code, Cursor, etc.).
> Rules live here and only here. Do not duplicate them elsewhere.

## Tech stack

- Node.js (structural self-check script + the full tool family: `scripts/gearbox-install` scaffold / `scripts/gearbox-version` sync quick-check / `scripts/gearbox-update` downstream backfill / `scripts/gearbox-prune` branch hygiene, plus the shared TUI animation layer `scripts/lib/tui.js`, no runtime dependencies, ADR-0016/0017/0022/0030/0035)
- Plain Markdown documentation (AGENTS.md / CONTEXT.md / ADRs)

## Hard rules

<Project rules that must not be violated, one per line. Example: money is always cents + BigInt; never expose SECRET_* to the client.>

> **Gearbox's own (dogfood) hard rules are not repeated in this section** — the gate assertions are the source of truth (`scripts/check-gearbox.js` is the executable source of truth). Any clause in the protocol body marked **Hard rule** (e.g., the "must open an issue, no silent judgment" hard rule in the "Roles of issues & PRs" section, ADR-0003) **counts as part of this section and is protected under L1**: the criterion anchors to the marking itself, not to which section the clause physically lives in (ADR-0018).
> When you copy this Gearbox: delete this note and replace the placeholder with your project's hard rules.

## Working agreement (multi-agent)

### On starting a shift (the three start-of-shift steps)

1. `git log --oneline -10` — see what happened recently
2. Check GitHub Issues — **first look for an open handoff issue** (the previous shift's Memory is in there; reading it and closing it = taking over, see ADR-0005. If none found → check whether the most recently closed issue has a "no next shift" terminal declaration: if yes = a compliant terminal shift (ADR-0009), start work normally; if no = the previous shift ended out of compliance, open a Protocol gap issue to record it — either way, rebuild context from git log + open issues), then check other open tasks and notes
3. Run the gate command (see below) to confirm the baseline is green — if it's red, fix it first or open an issue; don't start work on a broken baseline

### While working

- Commit in small steps; the message should spell out the **why**, not just the what
- **Protocol files stay committed — never add them to `.gitignore`**: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/gearbox-adr/`, `.gearbox-version`, `.github/workflows/ci.yml`. The repo is the only shared memory between shifts; an ignored protocol file exists locally but never reaches the next agent's clone (ADR-0037)
- One agent sees a task through from start to finish; handoffs only happen at task boundaries (issue closed / PR merged), never mid-task
- Non-trivial changes go through a branch + PR; typo-level tweaks can go straight into main
- **Project-owned** architectural decisions go in `docs/adr/` (one decision per file, starting at 0001); protocol ADRs live in `docs/gearbox-adr/`, managed by the gearbox tooling — don't hand-edit them
- Look up domain-term definitions in `CONTEXT.md`; add new terms as they come up

### Roles of issues & PRs

Issues and PRs are the timestamped, append-only, non-decaying conversation carriers between agents (and between agents and humans). In this protocol they have **three non-overlapping roles** — every issue/PR should fit into one of these:

| Role | When to use | When to close |
|---|---|---|
| **Task** | There's an actionable thing to do | The task is done and the gate is green |
| **Memory** (handoff memory) | Leave a comment on the **handoff issue** (see On ending a shift) at shift-end, five-part format | The next shift reads it and closes the handoff issue = handoff complete |
| **Protocol gap** | Hit a question the repo can't answer (rule not written, ambiguous, boundary unclear) | The gap gets folded into AGENTS.md / CONTEXT.md / an ADR |

Hard rules:

- **When you hit a question this repo can't answer, you must open an issue (Protocol gap type) — silent judgment calls are not allowed.** This is the only entry point for the protocol's self-repair — it turns gaps from "tacit understanding" into something explicit, discussable, and closeable.
- **Memory five-part format** (the minimum valid format for a handoff comment, ADR-0004): ① what's done ② what's blocked ③ what's next ④ close the issue if the task is complete ⑤ **rationale / trade-offs** — required whenever this shift made a non-default decision (what was chosen, why, and what premise failing would overturn it); if no decision was made, write "none" — don't omit it. Missing any one item means the handoff doesn't count.
- **Handoff = the moment the issue closes / the PR merges**, not just feeling like things were "explained clearly." Switching agents without closing the issue is a mid-task handoff, which violates the previous section.
- **A PR is the implementation vehicle for a Task, not a separate role**: a PR references the Task issue it implements, and closes that issue on merge. New issues found during PR review get their own issue — don't pile them up in PR comments.

> Why use an issue comment instead of a standalone handoff file: see `docs/gearbox-adr/0003-issue-roles.md`. Why Memory lives in an open handoff issue rather than a closed Task issue: see `docs/gearbox-adr/0005-handoff-lives-in-an-open-issue.md`.

### PR disposition (merge rules)

Four rules (ADR-0007):

- **Always merge via merge commit** — never squash, never rebase: the why behind small-step commits is a protocol asset (the repo is the only shared memory between sessions), and squashing is equivalent to deleting memory; locking in one style keeps history predictable.
- **Who merges**: the PR's author agent merges it themself once CI is green. Protocol changes follow the tier system (see "Changing the protocol itself"): L1 waits for `<maintainer>` agreement, L2 is autonomous.
- **A second agent's review is not mandatory**: under the shift system, normally only one shift is present at a time, and forcing mutual review would block at handoff boundaries. Quality backstop = the CI gate + the `<maintainer>`'s after-the-fact veto (revert + reopen the issue).
- **Don't take over someone else's open PR** — that's a mid-task handoff (see While working). Exception: the handoff issue explicitly transfers it, or the `<maintainer>` directs it.

If a PR is still hanging open at shift-end, the task isn't done: per item 3 of On ending a shift, write progress into the Task issue's comment and leave the PR open.

### Changing the protocol itself (rules for changing this file)

Agents can modify AGENTS.md, but **the change is tiered by its content** (ADR-0006):

| Tier | Content | Process |
|---|---|---|
| **L1 strict tier** | Hard rules / Gate command / Tech stack / this section itself | issue + ADR + PR, **and the agent may only merge after the `<maintainer>` explicitly agrees, in the session or in a PR comment** |
| **L2 autonomous tier** | Working agreement (except Gate) / the index (Where to find things) | issue + ADR + PR, agent may merge autonomously |

> **When you copy this Gearbox: replace `<maintainer>` with your GitHub username (a team = a GitHub team handle).** A display name anchors nothing an agent can verify; the GitHub account is what async approval is checked against (ADR-0034). See ADR-0006.

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
| Modifying an existing protocol file (Hard rules / Gate / Tech stack / Working agreement content) | **L1** | ADR-0006 |
| Modifying the index (Where to find things) | L2 | ADR-0005 |
| A CONTEXT.md entry **defines** an existing mechanism (changes only CONTEXT.md + cites its source ADR + adds no new obligation/changes no process boundary — all three conditions required) | L2 | ADR-0019 |

**Definition exemption** (ADR-0019): the criterion targets **legislating** (adding/changing mechanism semantics), not **describing** (writing an already-legislated rule into the glossary). If any of the three conditions isn't met, or you're unsure → default to L1; don't grant yourself the exemption. Changing semantics under the guise of a definition is a violation — revert + reopen the issue.

> Why so strict: agents easily use "optional + purely additive" as an L2 channel to expand the protocol's boundaries (see the PR #21 retrospective — subagent-system referenced L1/L2 but self-merged as L2). This criterion closes off that path.

L1's "explicit agreement" is a weak-b form: it's enough for the `<maintainer>` to say "agreed" in the session or write "agreed" in a PR comment, and the agent presses the merge button itself. **For the PR-comment path, only a comment authored by the GitHub account `<maintainer>` names counts (ADR-0034)** — anyone else's "agreed" is not L1 approval. **In a repo with more than one human collaborator, only the PR-comment path is valid L1 approval (ADR-0042)** — in-session agreement stops counting (including in the maintainer's own session): in-session approval leaves no verifiable trace, so a merged L1 PR without the maintainer's comment would be indistinguishable from an impersonated approval. Single-human repos keep both paths. **GitHub's Approve button is not required** — the cost is that the `<maintainer>` becomes the L1 bottleneck, and that cost is accepted.

**Downstream backfill** (ADR-0013, pull trigger see ADR-0026): backfill is **pull-primary** — when a downstream project starts a shift, it runs `gearbox-version` to self-check the protocol version, and runs `gearbox-update` if it's behind (the trigger doesn't depend on upstream knowing about downstream, which fits public forks). On the upstream side: every protocol-change PR still declares `Affects downstream` in the PR body (`yes`/`no` + one reason), but this is now **downgraded to informational — it helps gauge blast radius, and no longer opens an issue per downstream project or blocks merge** ("no link = can't merge" was retired along with ADR-0026). A maintainer running a private fleet may **optionally** open notification issues against known downstream projects; this is not mandatory (the `DOWNSTREAM.md` fleet dashboard was retired in ADR-0033 — fleet notes live outside the template).

**Protocol version number** (ADR-0023): a semver variant, baseline `v0.0.0`. Segment criterion — **major** = a cross-tool/cross-repo contract change (hash stamp format, install-anchor structure, file layout, renames) that needs manual intervention for downstream backfill; **minor** = a new mechanism (new ADR / new tool / new protocol clause); **patch** = a revision to an existing file (wording, a status line, a typo). Process (ADR-0029 completes it through npm launch) — the PR body must declare `Version bump: major|minor|patch|none` (`none` needs one reason, enforced via the PR template); **in the same PR, the author sets `package.json`'s `version` to this change's target version (= latest tag + segment, held equal to the git tag, ADR-0028)**; after merge, **the author agent** tags an annotated tag based on the latest tag at merge time and pushes it; **then the maintainer runs `npm publish` to release the npx package (ADR-0028/0029; this hits an external registry and needs credentials, so agents don't run it on the maintainer's behalf)**. A `none` segment triggers no tag/publish and doesn't touch `package.json`'s version. No CHANGELOG is maintained — the tag message + the ADR serve as the change record. Downstream local versions are recorded in the `.gearbox-version` stamp file, written and read by tooling (install writes it at scaffold time / update refreshes it during backfill / version reads it to compare) — humans don't maintain it.

### Gate (the hard gate — must be all-green before shift-end)

```bash
node scripts/check-gearbox.js
```

> This repo is a documentation-only template (the Gearbox core itself), so the gate doesn't run vitest/tsc/lint — it runs a **structural self-check script**: it verifies required files exist, `CLAUDE.md` is still the `@AGENTS.md` empty shell, the key section anchors haven't been renamed, `HANDOFF` never appears, and this Gate section actually runs this script (guarding against "CI and AGENTS.md running different things" contract drift).

CI (`.github/workflows/ci.yml`) runs the same set of commands; if it's red, merging is not allowed.

### On ending a shift (shift-end rules)

1. The gate is all-green
2. commit + push
3. Close finished Task issues as usual; for half-finished ones, write progress into that issue's comment
4. **Open a handoff issue for the next shift** (Task type, kept open, ADR-0005): the body states the current state and suggestions for next steps, and this shift's Memory comment (five-part format, ADR-0004) goes here. **This is the only entry point the next shift is guaranteed to encounter** — Memory no longer gets buried in a casually closed Task issue. **The sole exception — a terminal shift** (ADR-0009): when archiving / confirming there's no next shift, you may skip opening one, but you must explicitly declare "no next shift" + the reason in a comment on the last closed issue. A silent terminal doesn't count as terminal

### Branch hygiene (optional)

Before shift-end (or when you hit stale refs at shift-start), run `npx gearbox-agents prune` (in this repo you can run `node scripts/gearbox-prune` directly). It cleans up three things (ADR-0030):

- Locally merged branches (`git branch -d` safe-deletes, fails loudly)
- stale remote-tracking refs (`git fetch --prune`)
- Remote merged branches (`--apply-remote`, prints the list + asks for confirmation before deleting)

Dry-run by default — deletes nothing; a whitelist protects the current branch / the default branch / `gearbox-backfill-*`; never force-deletes (`-D`). This doesn't replace GitHub's `delete_branch_on_merge` setting — turning that on is the recommended root fix for repo owners; the tool is a backstop (`--check-settings` checks it and prints the command to enable it, without changing it automatically).

### Division of labor (optional, fill in as needed)

Division of labor is a project-level property; the template doesn't presume one (ADR-0008). When you copy this, pick one of three:

1. **Fill it in**: which kind of task goes to which agent (split by capability, not tied to a specific tool). <Unvalidated candidate example: mechanical bulk edits, filling in tests → an agent good at bulk execution; architectural design, hard bugs → an agent good at deep reasoning>
2. **Leave it blank**: the default rule = **Task-issue claim-based ownership** — whoever claims a task sees it through start to finish (see While working); tasks aren't routed by agent specialty.
3. **Single-agent project**: delete this whole section (it's not a gate anchor, so deleting it won't break `check-gearbox.js`).

## Where to find things

- `CONTEXT.md` — domain glossary
- `docs/gearbox-adr/` — protocol ADRs (copied from Gearbox, managed by tooling — don't hand-edit)
- `docs/adr/` — this project's own architectural decisions (starting at 0001)
- `scripts/` — gate self-check (check-gearbox.js) + the downstream tool family (gearbox-install scaffold / gearbox-version read / gearbox-update write / gearbox-prune branch hygiene, ADR-0016/0017/0022/0030) + the shared TUI animation layer (`scripts/lib/tui.js`, ADR-0035)
- <other module documentation directories, e.g. docs/modules/>
