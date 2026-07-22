# ADR-0007: PR disposition rules — merge commit always, author self-merges, review not mandatory

- Date: 2026-07-17
- Status: accepted

## Context

Issue #3 (one of the scaffold's earliest Protocol gaps, already referenced in ADR-0003's Context): while an agent was reviewing/merging PR #1, three questions the repo couldn't answer came up —

1. Merge strategy: merge commit / squash / rebase?
2. Can an agent other than the PR author merge it? Does it need to wait for human approval?
3. Division of labor is still a placeholder (→ split off into ADR-0008)

At the time, this was pushed through on issue #2's ad-hoc authorization. ADR-0003 formalized the issue roles, but the merge details themselves were never settled. Later, across the four rounds of the date-cli Path A experiment, practice spontaneously converged on one approach (always merge commit, author agent self-merges once CI is green, no peer review) — this ADR writes that down as a rule.

## Decision

**AGENTS.md gains a new "### PR disposition" section with four rules:**

1. **Merge method is always merge commit** — no squash, no rebase.
2. **The PR author agent self-merges once CI is green**; protocol changes are tiered per ADR-0006 (L1 waits on maintainer agreement, L2 is autonomous).
3. **A second agent's review is not mandatory.** Quality backstop = CI gate + maintainer's after-the-fact veto power (revert + reopen the issue).
4. **Don't take over someone else's open PR** — that's a mid-task handoff. Exception: the handoff issue explicitly transfers it, or the maintainer directs it.

### Why merge commit

- **The "why" behind small-step commits is protocol asset.** This protocol's foundation is "the repo is the only shared memory between sessions," and While working already requires commit messages to state the why — squashing would compress these step-by-step rationales into one, which is equivalent to deleting memory.
- **Consistency of style matters more than the style itself.** Issue #3's original concern was exactly "the next agent might pick squash, and history style would fork." Locking in one style keeps history predictable.
- **Precedent**: all 7 PRs in date-cli and all 3 PRs in this repo were already merge commits — the rule just ratifies existing practice.

### Why review is not mandatory

Under the shift model (one agent does a task start to finish), typically only one shift is present at any given time — mandatory peer review would mean every PR blocks waiting for the next shift to come online, puncturing the handoff boundary. CI is a constraint that doesn't rely on discipline, and maintainer veto power is a structural brake; together they already cover the recovery path for "a bad merge."

### Why not taking over someone else's open PR

While working already states "one agent does a task start to finish; handoffs only happen at task boundaries." An open PR means the task hasn't reached its boundary yet. This rule just makes the existing rule explicit for the PR case, closing the gap of "a PR is sitting there, and another agent helpfully merges it."

## Consequences

- **Cost**: main's history carries merge bubbles, making `git log --oneline` a bit noisier. `--first-parent` gives a clean view of the mainline.
- **Recovering from a bad PR merge**: reverting a merge commit (`git revert -m 1`) is a bit more involved than reverting a squash, which is acceptable.
- **Solo agent / solo-person projects** that find this too heavy after copying the scaffold can edit this section themselves (Working agreement is L2).
- **Risk**: author self-merge + no peer review means a single shift's mistake goes straight into main. Mitigation: the CI hard gate blocks structural errors; protocol changes have separate L1/L2 tiering; the maintainer can revert at any time.
- If multiple agents being present simultaneously becomes the norm in the future (rather than the shift model), the deadlock premise behind mandatory peer review no longer holds, and this should be reassessed via a new ADR.
