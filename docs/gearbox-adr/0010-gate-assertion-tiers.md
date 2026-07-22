# ADR-0010: Layering gate-script assertions — tightening is L2, loosening/removing/rewriting existing ones is L1

- Date: 2026-07-17
- Status: accepted, the mapping for test-type gates is in ADR-0020 (this ADR's criterion only covers structural self-check gates)
- Revises: ADR-0006 (refines the boundary of "Gate command" in its L1 table, does not overturn the tiering itself)

## Context

issue #9: ADR-0006's L1 strict tier lists "Gate command", referring to the command line in the Gate section (`node scripts/check-scaffold.js`). But the substance of the gate lives in the script's **content** — when handling #3, we needed to add an anchor assertion to `check-scaffold.js`; the command line stays the same but the script changes — does that count as L1, or does it ride along with its PR? The repo can't answer that.

Two prior instances were both handled as "rides along with the PR" (PR #7 added an anchor assertion, PR #11 added an anchor assertion), but both were undecided, ad hoc judgment calls.

## Decision

**Asymmetric tiering (the proposed approach from issue #9):**

| Gate script change | Tier | Rationale |
|---|---|---|
| **Adding an assertion (tightening)** | **L2**, rides along with its PR | the agent is locking itself down; risk is low; forcing L1 would block every PR that adds an anchor, waiting on the maintainer |
| **Loosening, removing, or rewriting an existing assertion** | **L1**, needs the maintainer's explicit agreement | an agent dismantling its own gate = the agent defining for itself "what counts as done" — exactly why ADR-0006 put the Gate under L1 |
| **Changing the command line in the Gate section itself** | **L1** (unchanged) | ADR-0006's original intent |

"Rewriting" is read conservatively: any change that makes an existing assertion no longer fail on an input it previously would have failed on counts as loosening. Pure refactoring (behavior completely unchanged, e.g. rewording an error message, extracting a function) counts as tightening-side L2 — but the burden of proof is on the agent making the change; the commit message must explain clearly why the behavior is unchanged.

### Ratification

The anchor additions in PR #7 and PR #11 are retroactively ratified as compliant L2 under this ADR.

### Why asymmetric instead of uniform

- **All-L1**: every PR that wants to casually add an anchor has to wait for the maintainer, punishing exactly the behavior that makes the gate stronger.
- **All-L2**: an agent could delete an assertion that's in its way and merge, turning the gate into a rubber stamp, and reviving ADR-0006's core concern unchanged.
- The asymmetric rule spends the maintainer's attention on the only direction that's actually dangerous.

## Consequences

- Tightening assertions is friction-free; the gate can only monotonically strengthen, unless the maintainer agrees to loosen it.
- "Pure refactoring counts as L2" relies on the agent's self-attestation, which leaves room for abuse. Mitigation: assertion changes are plainly visible in the PR diff; the maintainer's after-the-fact veto power (revert + reopen the issue) covers this; if abuse shows up in practice, this clause gets tightened then (which would itself be an L1 change).
- This ADR refines the L1 boundary of the "Changing the protocol itself" section, and is itself an L1 self-referential change as defined by ADR-0006 — merging requires the maintainer's explicit agreement (weak-b form).
