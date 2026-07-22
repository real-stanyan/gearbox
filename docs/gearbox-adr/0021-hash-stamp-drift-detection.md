# ADR-0021: Sync Tools Gain a Hash Stamp — Upstream Drift on Already-Synced ADRs Becomes Detectable

- Date: 2026-07-19
- Status: accepted
- Revises: ADR-0016 / ADR-0017 (adds one behavior to each tool; the original contract is unchanged)

## Context

Issue #45: when upstream revises the body of an ADR **that downstream has already copied**, neither sync tool can see it — `gearbox-version` reports ✅ as long as the slug exists, and `gearbox-update` only copies missing files. "Already synced" actually means "was copied," not "matches upstream."

This drift is not incidental — it's **structural**: Gearbox's convention is that a new ADR revising an old one appends a status-line pointer to the old ADR (0006, 0010, and 0012 have all had this happen to them). As the protocol keeps evolving, the status lines of already-synced ADRs keep changing. Case in point: during Blackbox PR #5 verification, only a human eyeballing it caught that downstream's 0010/0012 were missing the two pointer lines upstream had just added.

Three candidates (the maintainer chose c):

- **a. Content diff**: downstream copies have been renumbered and had their cross-references rewritten, so a diff would first need to reverse `replaceAdrRefs` to restore the original — complex and fragile to implement, not worth it for a status-line-level signal
- **b. Pure declaration, honest boundary**: the backstop is "remember to note it in the backfill issue" — this exact case is one a human eye caught; handing structural drift to process memory just replays the same failure mode
- **c. Hash stamp**: detection is automated, the fix stays manual, the cost is a few lines, and it matches the tools' guardrail of "only produce signals awaiting review, never auto-edit"

## Decision

**Hash stamp (option c):**

1. **`gearbox-update` (write side)**: when copying an ADR, the machine-generated provenance line appends the first 12 hex characters of the sha256 of the upstream file's content:

   ```
   - Provenance: backfilled from [gearbox ADR-0014](…) (synced by the gearbox-update tool, upstream sha256:xxxxxxxxxxxx)
   ```

2. **`gearbox-version` (read side)**: for a slug-matched copy, extract the stamp and compare it against the upstream file's current hash:
   - Match → ✅ in sync (unchanged)
   - Mismatch → **⚠️ upstream has been revised** (drift — prompts a manual diff or recopy)
   - No stamp → ✅ as before, the summary line reports the legacy count (drift not detectable)

3. **Existing copies are not backfilled**: the hash appears naturally as future backfills happen; the legacy status is counted explicitly rather than being hidden.

## Consequences

- **Structural drift now has an automatic signal**: when upstream edits an already-synced ADR, downstream's next `gearbox-version` run reports ⚠️, no longer dependent on a human eye
- **Honest boundary (the residual value of option b)**: hash-level detection only reports "it changed," not whether the change is worth backfilling — that judgment still belongs to a human/downstream agent; provenance-by-reference sync (not a copy) carries no stamp and is not checked
- **Tiering**: the tool behavior is tightened (reports more, not less), which by analogy with ADR-0010's tightening side = L2, rides with its PR; the choice of option was decided in a maintainer session (issue #45 chose c)
- **The stamp format becomes a contract between the two tools**: `sha256:[0-9a-f]{12}`; changing the format requires updating both sides, and the burden of proof is on the agent making the change
