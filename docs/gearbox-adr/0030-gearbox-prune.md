# ADR-0030: gearbox-prune — tooling for branch cleanup

- Date: 2026-07-20
- Status: accepted
- Related: ADR-0016/0017/0022 (the tool family's fourth member), ADR-0007 (merge rules), ADR-0028 (npx distribution, the dispatcher adds a prune route)

## Context

The gearbox tool family already has three members: install (onboarding) / version (reading state) / update (writing backfills), covering "onboarding" and "evolution" in the protocol lifecycle. But **branch hygiene at the two moments of ending/starting a shift** still relies on humans remembering:

- GitHub repos default to `delete_branch_on_merge=false`, so head branches aren't auto-deleted after a PR merges.
- Nobody remembers to run `git fetch --prune` to clean up stale tracking refs — branches long deleted on the remote just sit there as local tracking refs.
- Across many shifts, each incoming agent should have a clean starting point; in practice, accumulated branches need manual tidying every few shifts (the 2026-07-19 dryrun instance: 9 local + 18 remote branches, 12 of them stale).

Candidate approaches:

- **A. Write only a soft rule in AGENTS.md, relying on agents to run native git commands** — workable, but each shift has to memorize a pile of commands, and stale-ref details are easy to miss.
- **B. Build a `scripts/gearbox-prune` tool + an AGENTS.md soft rule, dual-track** — one command covers local/remote/stale/settings-check, matches the tool family's style, lowest cognitive load.
- **C. Skip the tool, just recommend turning on `delete_branch_on_merge`** — treats the symptom not the cause; doesn't clear stale refs or the existing backlog.

## Decision

Adopt **B**: add `scripts/gearbox-prune`, zero-dependency node (`node:child_process` + `node:fs` + `node:readline`), matching the style of install/update/version. Four behavior tiers:

1. **Default (dry-run)**: lists local merged branches to be cleaned + stale tracking refs + remote merged branches + the current value of `delete_branch_on_merge`, **doesn't actually delete anything**.
2. **`--apply-local`**: executes local branch `git branch -d` + `git fetch --prune` (purely local side effects).
3. **`--apply-remote`**: executes remote `git push origin --delete` (outward-facing, prints the list + asks for interactive confirmation; `--yes` skips confirmation, for non-TTY/CI).
4. **`--check-settings`**: read-only check of `delete_branch_on_merge`; when `false`, prints the suggested command to turn it on (doesn't auto-change it — repo settings are the owner's call).

Guardrails (hard constraints, written into the script's top-of-file comment):

- Permanently forbids `git branch -D` (force delete) — force delete loses unmerged work, violating "protect in-progress task branches."
- Whitelist protection: current branch / default branch (main/master) / the `gearbox-backfill-*` prefix (in-progress backfill branches).
- Not a git repo, or no origin remote → errors loudly and exits, no silent degradation.
- `gh` not installed/not authenticated → only the settings-check tier degrades to a hint; branch cleanup proceeds as normal (branch operations are pure git, not dependent on gh).

**One deviation from the feature prompt**: the prompt suggested using the GitHub API's `branches/:branch` endpoint's `merged` field to determine whether a remote branch is merged — that endpoint actually **has no** `merged` field (only name/commit/protected). Switched to `git merge-base --is-ancestor origin/<branch> origin/<default>` for the determination (a local check after fetch, zero API calls, zero pagination issues). A side effect is that the `gh` dependency shrinks down to just the `--check-settings` tier — thinner than the original design.

Add a "Branch hygiene (optional)" soft-rule subsection to AGENTS.md's Working agreement (not placed under Hard rules, see below). The npx dispatcher (`bin/gearbox.js`, ADR-0028) adds a `prune` route, so strangers can use `npx gearbox-agents prune`.

## Consequences

- **Cognitive load**: shift-end hygiene goes from "remember to clean up branches" to one command, sitting alongside "commit + push + open the handoff issue."
- **The tool family closes out**: install / update / version / prune, four tools covering onboarding / evolution / reading state / hygiene.
- **Tier = L1**: the soft rule references the protocol moments "before ending a shift / starting a shift," which, under ADR-0012's mechanism-reference criterion, is classified L1; not placed under Hard rules — hard rules are product contracts (violating them means failure), branch cleanup is a hygiene habit (missing it just makes the repo messy).
- **Version = minor**: new tool + new ADR (ADR-0023's segment rules) → v1.3.0.
- **Gate adds no assertion**: check-gearbox.js gates the protocol, not the tools; install/update/version aren't in requiredFiles either — keeping responsibilities single-purpose.
- **Optional for downstream forks**: the tool does pure git/gh operations, doesn't depend on gearbox protocol files, and works in any repo; newly installed downstreams get the soft-rule subsection automatically (install passes it through as-is), existing downstreams decide whether to adopt it based on the AGENTS_MD_IMPACT hint.
- **Doesn't replace the GitHub setting**: `delete_branch_on_merge=true` is still the recommended root-cause fix; the tool only surfaces it via `--check-settings`.
- **Out of scope**: automatically changing repo settings / cleaning up branches from closed-but-unmerged PRs (might be abandoned work, needs human judgment) / branch naming conventions / reflog cleanup / worktree cleanup.
