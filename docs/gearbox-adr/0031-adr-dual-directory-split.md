# ADR-0031: ADR dual-directory split — protocol ADRs and project ADRs get separate directories, eliminating number collisions and renumbering

- Date: 2026-07-21
- Status: accepted
- Related: ADR-0021 (hash stamp), ADR-0022 (gearbox-install), ADR-0023 (version scheme), ADR-0024 (renumber-on-backfill), ADR-0016/0017 (version/update)

## Context

Downstream's single `docs/adr/` directory holds two kinds of ADRs at once: protocol ADRs (copied from upstream, carrying the `- Provenance:` stamp, ADR-0021) and the project's own ADRs. The two kinds compete for the same numbering namespace, which causes collisions — e.g. Blackbox's own ADR-0014 occupied that number, so backfilling upstream's 0014–0020 got wholesale renumbered to local 0015–0021. `gearbox-update` carried a whole "collision detection → renumber → rewrite in-text `ADR-XXXX` references" subsystem for this (`buildExistingNumMap` / `assignDownstreamNums` / `replaceAdrRefs`), which is complex and fragile: number drift means "downstream's Nth number = upstream's which number" is no longer an identity.

## Decision

Split into two parallel directories, consistent between upstream and downstream:

- `docs/gearbox-adr/` — protocol ADRs. Exclusively managed by the tools (install writes / update backfills / version reads), hands off.
- `docs/adr/` — the project's own ADRs. Human-written, starting from 0001, the tools never touch it.

In this upstream repo, all protocol ADRs live in `docs/gearbox-adr/`; upstream has no `docs/adr/` (Gearbox itself currently has no non-protocol decisions).

Because the two kinds now belong to different directories, they never collide, and downstream's `gearbox-adr/` numbering stays a **1:1 identity** with upstream. `gearbox-update`'s renumbering subsystem is removed entirely — it only ever existed because of collisions.

No migration tool is written: the current 3 downstreams (dryrun/mandys/Blackbox) are an early self-test fleet; when a real backfill happens, a manual `git mv` is enough.

## Consequences

- **Version = minor → v1.4.0**. By ADR-0023's letter, a file-layout change is major, but with **no external adopters** (all 3 existing downstreams are the self-test fleet), it produces no actual downstream breakage in practice, so the maintainer set it as minor (counted as "adding the dual-directory mechanism," ADR-0023). Touches the Gate anchor + all three tools = **L1** (ADR-0006, orthogonal to the version segment).
- `gearbox-update` simplifies substantially: collision detection/renumbering/in-text rewriting are removed; backfill becomes simply "if missing, copy into `gearbox-adr/` under its original upstream number."
- Downstream project ADRs get their own independent numbering starting from 0001, semantics are clear: `ls docs/adr/` shows only the project's own decisions, `ls docs/gearbox-adr/` shows only protocol.
- Existing downstreams need a one-time manual `git mv` (not done in this ADR); old downstreams that haven't migrated and run the new update will get protocol ADRs copied into `gearbox-adr/`, while the old protocol ADRs left behind in `docs/adr/` need to be cleaned up manually.
- **Considered but not adopted**: a subdirectory (`docs/adr/gearbox/`, one extra path level, easy to confuse), a filename prefix (`gearbox-0001-*`, still mixed in one `ls`), a migration tool (manual is enough for 3 downstreams), keeping upstream on `docs/adr/` (the tools would need separate source/destination constants, semantics wrong).
