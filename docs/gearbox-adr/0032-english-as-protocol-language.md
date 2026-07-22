# ADR-0032: English as the protocol language

- Date: 2026-07-22
- Status: accepted
- Related: ADR-0015 (rename), ADR-0023 (version scheme)

## Context

The repo's protocol prose (`AGENTS.md`, `CONTEXT.md`, all 31 `docs/gearbox-adr/` files, `README.md`, `DOWNSTREAM.md`, `.github/pull_request_template.md`) and the tool-coupled strings inside the four scripts (`check-gearbox.js`, `gearbox-install`, `gearbox-version`, `gearbox-update`) were written in Chinese. That's fine for a single-maintainer, single-language fleet, but it caps who can adopt Gearbox: any English-reading team, and any agent coding tool whose defaults or user base skew English, hits a language barrier before the protocol mechanics even matter. Gearbox's premise is "single source of truth for ALL coding agents" — a premise the source text itself was working against.

The translation was done glossary-first: `CONTEXT.md` was translated first to lock canonical English terms (single source of truth, hard gate, handoff, provenance, backfill, tier, stamp, protocol gap, etc.), then `AGENTS.md` + its gate anchors, then the three doc-coupled tools (sandbox-verified so `mustReplace`/anchor/regex couplings didn't silently break), then the remaining docs and all 31 ADRs in batches — so terminology stayed consistent across 36 markdown files and 4 scripts instead of drifting per-file.

## Decision

All markdown protocol docs, and all Chinese strings in the tool scripts (console output, error messages, comments, and text the tools inject into downstream files), are now English. This includes tool-coupled strings that other code or downstream output depends on byte-for-byte:

- `check-gearbox.js`'s `requiredAnchors` array — resynced to the translated `AGENTS.md` headings (e.g. `### Roles of issues & PRs`, `### PR disposition`, `### Changing the protocol itself`) and the `DOWNSTREAM.md` section-heading assertion (`## Onboarded projects`).
- `gearbox-install`'s `mustReplace` FROM/TO pairs — resynced to the English `AGENTS.md`/`CONTEXT.md` source text, and the injected downstream placeholder text translated.
- `gearbox-version` and `gearbox-update`'s provenance phrasing and detection regex — the `- Provenance:` field name, the `copied from` / `backfilled from` stamp lines, and the `hasProvenanceField`/parse regex all agree on the English form.

Git history is **not** rewritten — commits before this work stay Chinese (append-only per ADR-0007); only new commits and the current file contents are English.

## Consequences

- **Tier: L1.** This changes Gate anchor strings — a cross-tool contract (`check-gearbox.js` assertions, `gearbox-install`'s `mustReplace` couplings, the provenance write/read regex pair) — so it falls under ADR-0006/ADR-0012 regardless of "just a translation" framing.
- **Version: minor → v1.5.0.** By ADR-0023's letter, a Gate-anchor-string change leans major (cross-tool contract), but with no external adopters yet and no mechanism change (no new tool, no new protocol clause, no behavior change — the same anchors/regex/mustReplace couplings, just retargeted to English strings), it's counted as minor, consistent with the ADR-0031 precedent (dual-directory split, also anchor-contract-touching, also set to minor for the same no-external-adopters reason).
- Downstream: fresh installs via `gearbox-install` now get an English scaffold end to end (`AGENTS.md`, `CONTEXT.md`, ADRs, tool output). Existing downstreams that already backfilled Chinese content are unaffected until their next `gearbox-update` pulls the English source.
- Glossary-first sequencing (CONTEXT.md translated before everything else) kept terminology consistent across all 36 markdown files and 4 scripts — no per-file re-deriving of what "handoff" or "hard gate" should be called.
- **Considered but not adopted**:
  - Leave the tool scripts Chinese while translating only the docs — rejected: produces a half-English repo where the protocol prose promises English-team usability but the tools an agent actually runs still speak Chinese.
  - Machine-translate without a locked glossary — rejected: term drift (e.g. "handoff" vs "handover" vs "transfer" across different files) defeats the point of a single source of truth.
  - Rewrite git history to make old commits English too — rejected: violates the append-only handling of commit history (ADR-0007); the record of *why* stays intact, only the current-state text changes.
