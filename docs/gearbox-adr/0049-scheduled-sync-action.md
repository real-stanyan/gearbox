# ADR-0049: Downstream auto-update via a scheduled Action that opens backfill PRs

- Date: 2026-07-23
- Status: accepted
- Related: ADR-0026 (pull-primary backfill), ADR-0025 (update's branch discipline), ADR-0024 (--refresh-drift), ADR-0028/0029 (npx distribution), ADR-0006 (L1 tiering)

## Context

The pull model (ADR-0026) triggers at shift start: an agent runs `gearbox-version`, and `gearbox-update` if behind. That covers active projects and nothing else — an idle downstream never learns the protocol moved. The maintainer asked for automatic updates.

Full automation has a hard ceiling: AGENTS.md is an L1 file and `gearbox-update` deliberately never writes it. Machinery that silently rewrites downstream rules would turn one upstream compromise into a fleet-wide rule mutation — the same supply-chain shape the CODEOWNERS publish-surface fix (#124) just closed. So "auto" must stop at *prepared, reviewable, visible* — the Dependabot shape — never at *applied*.

## Decision

`gearbox-install` scaffolds one more file: `.github/workflows/gearbox-sync.yml`.

- **Trigger**: weekly cron + `workflow_dispatch`.
- **Stacking guard**: if an open PR with a `docs/gearbox-backfill-*` head already exists, exit — merge the previous sync first (prevents duplicate parallel backfill PRs; update's same-day resume only covers same-day reruns).
- **Sync**: `npx -y gearbox-agents@latest update --refresh-drift`. `--refresh-drift` is on because the PR *is* the review net the flag's opt-in warning asks for (ADR-0024).
- **Publish**: if a backfill branch was pushed, `gh pr create` with `gearbox-update-report.md` as the body — the AGENTS.md hand-edit checklist arrives inside the PR.
- **Boundaries**: tooling still never touches AGENTS.md; the Action never merges; merge rights and the L1 flow stay in the downstream repo. Opt-out = delete the file (the shift-start self-check keeps working). Signal source is the npm registry — a release the maintainer hasn't `npm publish`ed is invisible to the fleet.

**Ride-along fix**: `gearbox-prune`'s allowlist protected the prefix `gearbox-backfill-*`, but update's branches are actually named `docs/gearbox-backfill-*` — the guard never matched anything. Both prefixes are now protected. Coupled here because the Action mints these branches on a schedule, making the dead guard operationally live.

## Consequences

- Idle downstreams get a reviewable PR within a week of `npm publish`; active ones keep the faster shift-start path. Both end at a human/agent-reviewed merge.
- A version bump that changes no ADR file and drifts none (e.g. a CONTEXT.md-only patch) produces no backfill branch, so no PR — the stamp lags until the next contentful release. Accepted: the stamp is tooling metadata, and inventing an empty PR to move it is noise.
- The workflow needs `contents: write` + `pull-requests: write` and a git identity; both are set inside the generated file, nothing to configure.
- Repos with "GitHub Actions can't create PRs" disabled at the org level will see the PR step fail loudly — the log says what to enable; the sync commits are still pushed.
- Tier = **L2**: tooling + a new scaffold file; no AGENTS.md text change (the backfill paragraph already describes the pull model; the Action is just another puller).
- Version = **minor** (new mechanism + new ADR, ADR-0023).
- **Considered, not adopted**: auto-merging the backfill PR (breaches the L1 ceiling above); a `postinstall` hook in the npm package (runs on every `npx`, wrong lifecycle, and package hooks are exactly the attack surface #124 locked); upstream pushing to known downstreams (retired direction — ADR-0026 chose pull because upstream can't know its public forks); making the workflow opt-in at install time (a prompt per file doesn't scale — opt-out by deletion matches how Branch hygiene and Division of labor are handled).
