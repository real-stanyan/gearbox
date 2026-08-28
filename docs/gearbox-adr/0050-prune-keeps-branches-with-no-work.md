# ADR-0050: prune never deletes a branch with no work on it

- Status: accepted
- Date: 2026-08-28
- Issue: #141 (downstream report: real-stanyan/Mr-Otto#449)
- Related: ADR-0030 (prune, the fourth tool), ADR-0043 (worktree pass), ADR-0048 (parallel shifts)

## Context

A shift ran `npx gearbox-agents prune --apply-local` at shift-end and deleted, among ten locally merged branches, `claude/landing-page-redesign-review-a0f6c4` — the branch another live agent was working on.

No code was lost: prune uses `git branch -d`, so every deleted tip was an ancestor of the default branch. The deleted branch had no remote ref, no PR and no worktree — it was **a branch opened from the default branch that had not been committed on yet**. Precisely because "zero commits" makes a branch 100% merged in git's eyes, `-d` went through.

What was lost is the **name**. If that lane was still alive and about to commit there, its branch is gone from under it.

The allowlist (current branch / default branch / `gearbox-backfill-*` / the main worktree and the worktree the process runs in) is from the single-agent era: it protects *what I am using*, not *what somebody else is using*. Under ADR-0048's parallel lanes, a freshly opened, not-yet-committed-on branch is exactly how a lane begins — and in git that shape is **indistinguishable** from a twig that should have been cleaned up long ago.

## Decision

**A branch with no work on it is never deleted.** It is reported in its own "Kept" section with the reason, so the dry-run stays honest about why it was skipped.

Two signals, either one is enough:

- **A — the branch tip *is* `origin/<default>`'s tip.** Opened from an up-to-date default branch, no commits since.
- **B — the reflog carries no commit-ish entry**, only the `branch: Created from ...` line. This catches a branch opened from an *older* default branch, which A cannot see. A missing or expired reflog says nothing either way, so it falls through to normal handling rather than protecting the branch forever.

The trade is one-sided: deleting such a branch frees **nothing** — it owns no commit, not even an unreachable object — while the downside is stomping a live lane's starting point.

## Alternatives rejected

| Candidate | Why not |
|---|---|
| Extend the allowlist to every worktree's checkout, not just the one prune runs in | Would not have caught this case: that branch had no worktree at all |
| Peer awareness — ask the live agents on this machine which branch each is on | Depends on a harness-specific session mechanism. Gearbox is a tool layer; it must not assume which agent runtime the downstream repo runs under |
| Document it only ("with parallel agents, eyeball `--apply-local` before running it") | Hands a mechanical problem back to vigilance. Prune's whole selling point is that you can run it without thinking |

## Consequences

- Zero-commit twigs now accumulate instead of being cleaned up. They cost nothing (no objects, no disk), and the moment one gets a commit it returns to normal handling.
- The bias is deliberately conservative: prune keeps something it might have been allowed to delete, rather than deleting something somebody still needed.
- The hard constraints in the script header gain one more line; like the others it must not be relaxed.
- Not addressed: two lanes that pick the *same* branch name. That is a naming collision, not a deletion problem.
