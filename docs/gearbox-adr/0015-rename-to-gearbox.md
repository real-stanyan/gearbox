# ADR-0015: Rename the protocol and repo as a whole, scaffold → Gearbox

- Date: 2026-07-19
- Status: accepted

## Context

This multi-agent collaboration protocol never had a formal name — "scaffold" was originally just a description of the vehicle (the skeleton copied at startup), but in practice it had become the de facto name for the protocol across DOWNSTREAM.md, downstream ADRs, and everyday conversation. The maintainer (Stan) instructed in the 2026-07-19 session: formally name it **Gearbox**, and rename the repo to match.

## Decision

1. **Protocol name = Gearbox**; repo name `agents-md-scaffold` → `gearbox` (GitHub rename, old URLs redirect automatically with a 301)
2. **All living documents are renamed throughout**: AGENTS.md / README / CONTEXT.md / DOWNSTREAM.md / PR template / package.json
3. **The Gate script follows the rename**: `scripts/check-scaffold.js` → `scripts/check-gearbox.js`; the AGENTS.md Gate section, ci.yml, and the script's own self-assertion are updated together in all three places (a Gate command-line change = L1, ADR-0010)
4. **Historical ADRs (0001–0014) are not rewritten**: they're an append-only record, and the "scaffold" in them reflects the fact at the time of writing. This ADR is the sole record of the rename
5. **The README keeps a note of the former name**: to make it easy to trace old references

## Consequences

- **Downstream references still use the old name for now**: dryrun / mandys_app / Blackbox's ADR provenance fields and AGENTS.md still say "scaffold". Old URLs redirect, so this isn't a fault; a backfill notification issue is opened for each per B-3, and downstream updates its terminology at its own pace (or doesn't — the notification isn't mandatory)
- **Local path change**: `~/Github/agents-md-scaffold` → `~/Github/gearbox`; local tools that reference the old path (the global CLAUDE.md startup guide, the scaffold-version script's default path) need to be synced — handled alongside this rename, but they live outside this repo and aren't covered by this repo's gate
- **The `scaffold-version` script name becomes legacy**: after the rename, the script's own name is also outdated; folded into #30 (script has no fixed home) to be decided together
