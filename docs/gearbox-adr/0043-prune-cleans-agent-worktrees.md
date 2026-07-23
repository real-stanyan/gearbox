# ADR-0043: gearbox-prune cleans up leftover agent worktrees

- Date: 2026-07-23
- Status: accepted
- Related: ADR-0030 (gearbox-prune branch hygiene)

## Context

Agent coding tools routinely open a linked git worktree per session and a branch per feature. After the PR merges, both linger — nothing in the agent's loop is responsible for tearing them down. Two costs compound:

1. **Worktree litter**: stale directories (often under `.claude/worktrees/` or similar) accumulate indefinitely. This repo itself had one at the time of this ADR.
2. **Cascading prune failure**: `git branch -d` refuses to delete a branch that is checked out in any worktree. So the more worktrees pile up, the lower gearbox-prune's cleanup rate — the existing tool degrades precisely in the environment it was built for.

A companion request — "help merge these branches automatically" — was considered and rejected: merging is a task-level decision carried by the PR flow (ADR-0003/0007). A hygiene tool that silently merges makes judgment calls on the agent's behalf and turns conflicts into disasters. The ceiling for unmerged branches remains *reporting*, which the existing dry-run already does by omission (anything not listed as merged is by definition still live).

## Decision

Extend `gearbox-prune` with a **worktree pass**, same philosophy as the branch passes (dry-run default, allowlist, never force):

- Parse `git worktree list --porcelain`. Only **linked** worktrees are considered — never the main worktree, never the worktree the process is standing in, never locked ones, never those checked out on an allowlisted branch.
- **Candidate** = the worktree's HEAD (branch tip, or the detached commit — agent tools often leave detached HEADs) is an ancestor of `origin/<default>` **and** `git status --porcelain` in it is empty.
- Merged-but-dirty worktrees are **reported, never removed** (uncommitted work might matter). Unmerged worktrees are untouched and unlisted, mirroring the unmerged-branch rule.
- New flag `--apply-worktrees` executes `git worktree remove` (never `--force` — git itself refuses dirty/locked worktrees, a second safety layer under our precheck) followed by `git worktree prune` for stale admin files.
- The worktree pass runs **before** the local-branch pass, so a single `--apply-worktrees --apply-local` invocation first frees a branch from its worktree and then deletes it.

The AGENTS.md "Branch hygiene" section updates from three cleanup targets to four.

## Consequences

- The root fix remains upstream of this tool: agent harnesses should remove their own worktrees, and GitHub's `delete_branch_on_merge` should be on (`--check-settings` already nags). The pass is a backstop, consistent with ADR-0030's framing.
- Removing a worktree deletes its working directory from disk. Safety stack: merged-check + clean-check + git's own refusal to remove dirty/locked worktrees without `--force` (which is never passed). Untracked files make a worktree dirty, so nothing uncommitted is ever deleted.
- Tier = **L2**: script gains a stricter/new capability (ADR-0010 "adding a new assertion" analog) and the AGENTS.md edit touches only the Working agreement's optional Branch hygiene section (ADR-0006).
- Version = **minor** (new mechanism in an existing tool + new ADR, ADR-0023).
- **Considered, not adopted**: auto-merging unmerged branches (see Context); age-based deletion of unmerged worktrees ("stale after N days" guesses intent — the merged/unmerged line is objective, staleness is not); removing worktrees whose branch has an open PR (state lives on GitHub, adds a gh dependency to a pure-git pass, and the merged-check already covers the closed-PR case).
