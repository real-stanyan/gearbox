# ADR-0020: Tier Mapping for Test-Type Gates — Configuration Layer Follows ADR-0010, Content Layer Is Tiered by Motive

- Date: 2026-07-19
- Status: accepted
- Revises: ADR-0010 (fills the gap it left undefined for test-type gates; the original criterion for structural-self-check-type gates is unchanged)

## Context

ADR-0010's assertion tiering (tightening = L2 / loosening or removing = L1) was written against a **structural-self-check-type** gate (`check-gearbox.js`) — its assertions are a protocol contract: few, stable, and don't move with features. Downstream projects run **test-type** gates (vitest / tsc / lint) — tests are a product-behavior spec: many, frequently added/removed/changed, and they move with features. Applying the tiering directly would mean "every deleted stale test needs maintainer agreement" — unworkable. The gap sat in issue #19.

The tiering's original intent: **don't quietly loosen the gate in order to pass it**. For test-type gates, the threat model is "the agent deletes/skips a failing test to turn it green," not "the agent does normal test maintenance."

## Decision

Test-type gates are tiered on two layers:

### 1. Gate configuration layer — apply ADR-0010 directly

| Action | Tier |
|---|---|
| The gate command line itself (`vitest run` / `tsc --noEmit` etc.) | **L1** |
| Tightening config: turning on a strict flag, raising a coverage threshold, adding a lint rule | L2, rides with its own PR |
| Loosening config: turning off a flag, lowering a threshold, disabling a rule, adding an exclude/skip pattern | **L1** |

### 2. Test content layer — the criterion shifts from "action" to "motive"

| Action | Tier |
|---|---|
| Tests **follow product code changes** in the same PR (adds/removes/edits) — a feature was removed so its tests follow, behavior changed so assertions follow | L2, routine development, zero ceremony |
| **Deleted purely to go green**: deleting / `.skip`ping / weakening a test, with **no corresponding product-code change** in the diff | **L1**; a silent skip = a violation, subject to revert |

A reviewable, objective signal: a PR that contains `.skip` / `.todo` / a deleted test file with no matching product diff → triggers L1 review.

### 3. Enforcement — a declared obligation, not scripted

Test counts fluctuate normally and can't be asserted by script the way the structural gate can. Enforcement relies on a declared obligation: **deleting/skipping a test must state its motive in the commit message or PR body**. The failure mode is visible (a one-glance review catches it) — the same trade-off as B-3 (ADR-0013): trading visibility for simplicity.

## Consequences

- **Downstream gets a usable criterion**: all 3 downstream projects run test-type gates; this ADR was written to fill that gap for them, and takes effect via the AGENTS.md template copy
- **Zero new ceremony for routine development**: test add/remove/edit that follows a feature needs no extra action; only the narrow case of "deleted a test without changing product code" needs a declared motive
- **The boundary is stated honestly**: the tiering governs "don't quietly loosen," not "are the tests well-written"; "all green ≠ correct" (already acknowledged in the README) remains unaddressed
- **Residual space (accepted)**: judging "a corresponding product-code change" still leaves subjective room (a large refactor can blur the correspondence). Same backstop as ADR-0019: when unsure, default to L1, plus the maintainer's after-the-fact veto
