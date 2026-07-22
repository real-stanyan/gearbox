# ADR-0025: gearbox-update start-up guardrails — report exemption / auto-switch to main / --force-redo

- Date: 2026-07-20
- Status: accepted
- Related: ADR-0017 (gearbox-update), ADR-0024 (--refresh-drift)

## Context

Issue #53. Blackbox's first real re-run hit three pitfalls in a row (maintainer hands-on retro):

1. The leftover `gearbox-update-report.md` (untracked) from the previous run blocked the clean check.
2. Re-running on an old backfill branch, the new branch forked from HEAD, **inheriting a wrong copy of the old tool** — the tool only warned "not on main/master" without blocking; the warning was ignored, the output was untrustworthy and hard to notice after the fact (a wrong reference isn't hash drift, so `--refresh-drift` can't rescue it).
3. If today's branch already exists, it just errors out; cleanup requires three manual commands.

Common thread across all three: the preflight check pushes responsibility onto the human, and in a "just re-run it" mindset the human inevitably skips careful reading.

## Decision

Tiered automation — risk determines what runs automatically vs. what needs a flag:

1. **Report-file exemption (unconditional, automatic)**: the clean check ignores `gearbox-update-report.md`; it's this tool's own artifact, the docs already say to discard it after the PR, and it's overwritten on every run. Zero risk.
2. **Auto-switch to main (automatic by default, `--allow-branch` escape hatch)**: if not on main/master at start-up → `git checkout main` (fall back to `master` if no `main`, error if neither exists). The clean check runs first, so the switch is necessarily safe; the tool already moves HEAD (creating a new branch) — bringing the starting point under management is the same kind of operation. If you genuinely need to base off another branch (rare), add `--allow-branch`.
3. **`--force-redo` (explicit flag, not default)**: if today's branch already exists → still errors by default (**the branch may carry manual L1 edits** — the workflow is to hand-edit AGENTS.md on the backfill branch and then open a PR; auto-deleting could destroy manual work); only with the flag does it `git branch -D` and rebuild, switching push from `-u` to `--force-with-lease` to overwrite the remote. **Never auto-deletes the remote branch** — `--force-with-lease` is a gentle equivalent, and it keeps the remote reflog as a backstop.

## Consequences

- The three pitfalls disappear / collapse into one command; the failure mode of silently producing bad output from a wrong base branch is replaced by a hard block.
- `--allow-branch` users take on responsibility for base-branch correctness themselves (the tool no longer backstops it).
- `--force-with-lease` will refuse if someone else has pushed commits to the backfill branch — this is a feature, not a bug (a backfill branch is in principle a single person's artifact; someone else's commit means something went wrong).
- Tier: pure tool behavior (ADR-0017 precedent), doesn't touch AGENTS.md; issue #53 + this ADR + PR, self-merge once CI is green; Version bump: minor
