# ADR-0022: gearbox-install — Onboarding Goes From README Manual Steps to a Tool

- Date: 2026-07-19
- Status: accepted
- Related: ADR-0016/ADR-0017 (the third member of the tool family), ADR-0021 (hash stamps applied at install time)

## Context

Issue #47 (maintainer session instruction). Previously, onboarding a new project onto Gearbox relied on the README's manual process: `cp` five paths + four manual adjustment steps (fill in placeholders, swap the ci.yml command, delete/edit the PR template, delete the dogfood note). Known failure modes:

- Steps are remembered by hand, and skipping one produces **a malformed skeleton with upstream leftovers** (forget to swap the ci.yml command → CI starts red on day one; forget to delete the B-3 section → downstream inherits an obligation that doesn't apply to it)
- ADRs copied by hand carry no provenance and no stamp → entirely legacy, so ADR-0021's drift detection is inert for the new project
- When Blackbox onboarded, all of these adjustments (the receiving-end B-3 note, gate replacement) were done manually — each onboarding reinvents the same work

## Decision

`scripts/gearbox-install [target-dir] [--name] [--maintainer] [--gate]`, Node.js, zero dependencies:

1. **AGENTS.md template transformation is mechanized**: title/intro/Tech stack placeholders, deleting the dogfood note (keeping ADR-0018's designation-tiering note, rewording it for the receiving end), the B-3 section rewritten for the receiving end (following the Blackbox precedent), the Gate command filled in or left as a placeholder, maintainer substitution, cleanup of Gearbox-specific phrasing
2. **Anchor contract**: every transformation anchors to known text in the upstream AGENTS.md; a missing or non-unique anchor errors out immediately — if the upstream template changes and the tool hasn't caught up, it **fails loudly instead of producing a malformed skeleton**. The maintenance obligation is the same kind as `check-gearbox.js`'s anchor assertions
3. **Full ADR copy + hash stamp**: every upstream ADR gets a provenance line + sha256 stamp (the ADR-0021 contract), so a new project can be checked for drift by `gearbox-version` from day one; ADRs that already carry their own provenance field (0004/0005/0006, from the date-cli era) are not stamped again, and are counted as legacy under the same rule as gearbox-update
4. **ci.yml generation**: if `--gate` is given, it matches the Gate section verbatim (CI == Gate contract); if not given, it inserts a **deliberately failing** placeholder command — CI should not be green before the Gate is filled in; a green placeholder is more dangerous than a red one
5. **Not copied**: `pull_request_template.md` (the B-3 carrier, Gearbox-specific), `scripts/`, `README.md`; **does not overwrite** a directory that already has an AGENTS.md (an already-onboarded project goes through gearbox-update instead); **does not auto-commit** (a human reviews after installation)

## Consequences

- **Onboarding cost drops from "follow four README steps" to one command**, and the failure mode shifts from "a skipped step" to "an anchor breaks and errors out" — visible and fixable
- **The tool family's division of labor closes the loop**: install for onboarding / version for reading status / update for writing backfills — the three don't overlap, and all three entry points live under `scripts/`
- **Anchor maintenance obligation**: when upstream AGENTS.md template text changes and it touches one of install's anchors, update the tool in the same PR — CI does not test this (the tool has no automated tests, the same trade-off as ADR-0017), relying on sandbox installs plus loud failure
- **DOWNSTREAM.md is not auto-updated**: entering the list is a maintainer decision (three criteria); the tool only prompts at the end — consistent with B-3's "prompt, don't require"
- **Tiering**: a new tool referencing protocol mechanisms is classified L1 under ADR-0012; issue #47 + this ADR + a PR, initiated by maintainer session instruction, confirmed before merge
