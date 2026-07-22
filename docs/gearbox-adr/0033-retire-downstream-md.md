# ADR-0033: Retire DOWNSTREAM.md — the fleet dashboard leaves the template

- Date: 2026-07-22
- Status: accepted
- Related: ADR-0013 (downstream backfill), ADR-0026 (pull-primary downgrade), ADR-0022 (gearbox-install)

## Context

ADR-0026 switched backfill to pull-primary: downstream repos self-check with `gearbox-version` at shift start and run `gearbox-update` when behind. That downgrade left `DOWNSTREAM.md` with zero mechanism function:

- The backfill trigger never traverses the list — it lives entirely downstream.
- `gearbox-install` never copies the file downstream; the npm `files` allowlist never ships it.
- Its only remaining content was the maintainer's private fleet notes (which repos synced to what) — personal bookkeeping, not protocol.

Yet upstream still carried the file, the gate asserted its existence plus its `## Onboarded projects` section, and six surfaces referenced it. Upstream shipped an architecture downstream never receives, violating the design premise that upstream and downstream are the same architecture (the maintainer shares the exact system they run).

## Decision

Remove `DOWNSTREAM.md` entirely and scrub every reference:

- Delete the file (the fleet notes survive in git history).
- Gate: drop `DOWNSTREAM.md` from `requiredFiles` and delete the `## Onboarded projects` assertion (loosening two assertions = **L1**, ADR-0010).
- Scrub references in the PR template, `CONTEXT.md`, `AGENTS.md` (downstream-backfill clause), `gearbox-install` next-steps output, `gearbox-version` comments and status message, and a `gearbox-update` mapping comment.
- **Keep** the `Affects downstream` PR-template field and its gate assertion — the informational declaration (ADR-0026) never depended on the list.

A maintainer who wants a fleet dashboard keeps it outside the template (private notes, an issue, a gist) — it is no longer part of the protocol.

## Consequences

- Upstream and downstream file layouts are now identical in kind; nothing in the template exists "for upstream only."
- **Version = minor → target v1.4.0 at PR-open time** (latest tag was v1.3.0 with two untagged minors pending; per ADR-0023 catch-up the segments collapse to the heavier = minor. If v1.4.0 is tagged before this merges, this becomes v1.5.0 and `package.json` is bumped in the PR).
- Tier = **L1**: deletes a gate required-file and two assertions (ADR-0006/0010).
- Existing downstreams are unaffected — they never had the file.
- The optional "maintainer may open notification issues" clause in AGENTS.md survives, now phrased without the list.
- **Considered but not adopted**: keeping the file but dropping only the gate assertions (still ships an upstream-only artifact — half-measure); moving the dashboard into README (same asymmetry, worse discoverability).
