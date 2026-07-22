# ADR-0016: gearbox-version goes under version control — B-3.5's local lookup tool becomes official

- Date: 2026-07-19
- Status: accepted

## Context

`scaffold-version` (bash, checks how many ADRs downstream is behind upstream) was referenced in real usage in dryrun#40, but had no fixed home: not under version control, hadn't gone through the process (ADR-0013 said B-3.5 = manual + local script, "handle via a separate ADR at that time"), and pure filename-number comparison has a known false-positive — when downstream has its own ADR occupying the same number (dryrun 0011 = puppeteer ≠ upstream 0011 = subagent-system), it gets reported as "already synced". The gap sat on issue #30; the maintainer decided on option b (bring it under version control + fix the false positive), following ADR-0015's rename to gearbox-version.

## Decision

1. **Bring it under version control**: `scripts/gearbox-version`, added to version control. Deployment is via a symlink onto PATH (`ln -sf ~/Github/gearbox/scripts/gearbox-version ~/.local/bin/`); the old `~/.local/bin/scaffold-version` is deleted
2. **The determination algorithm changes from filename comparison to provenance-first**. An upstream ADR-NNNN is considered synced if and only if:
   - a) downstream has an ADR file with the **same slug** (copied at startup, the number may differ), or
   - b) any downstream ADR references that number from upstream (the text `scaffold|Gearbox ADR-NNNN`, or an `adr/NNNN-` link to the upstream repo's URL)
3. **Positioning = a local lookup tool, not authoritative**: the authoritative status remains `DOWNSTREAM.md`'s "currently synced to" column. The script is zero-dependency, read-only, not part of the gate, and doesn't create any obligation for downstream
4. **Add a line to Tech stack for Bash** (tooling script), add a `scripts/` entry to `Where to find things`

## Consequences

- **Eliminates the old false positive**: same number, different slug no longer counts as synced (verified in practice: dryrun's 0011 is correctly identified as backfilled via the provenance field in 0013-dryrun-subagent-routing)
- **Remaining blind spot (accepted)**: when downstream "evaluated and declined to backfill" (closed the issue declaring it won't be adopted, e.g. dryrun judged 0013 not applicable), the script can't see this and still reports "not synced". The script's output states this boundary explicitly; eliminating it would require reading GitHub issue state, introducing a network dependency, which isn't worth it
- **The provenance field becomes a soft contract**: downstream must write a `Provenance:` line (referencing the upstream number or URL) when backfilling an ADR for it to be recognized. The B-3 backfill issue template already recommends this format; it's not mandatory
- **B-3.5 only enables the "check" half**: the script doesn't open backfill issues on anyone's behalf, and doesn't modify any files. The rationale for rejecting full automation (B-4) is in ADR-0013, unchanged
