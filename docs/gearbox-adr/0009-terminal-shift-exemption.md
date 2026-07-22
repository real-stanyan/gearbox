# ADR-0009: Terminal shift ending can be exempted from the handoff issue — but must explicitly declare "no next shift"

- Date: 2026-07-17
- Status: accepted
- Revises: ADR-0005 (does not overturn its body, adds a boundary clause)

## Context

issue #8: the backfill shift for this repo (PR #7) merged ADR-0005 (ending a shift must open a handoff issue for the next shift), but the shift itself ended without opening one. When the next shift started work, following step 2 of "On starting a shift" it could not find a handoff issue, and couldn't distinguish between two cases:

- **(a) Non-compliant shift ending** — the rule was in effect, and the previous shift didn't follow it
- **(b) Terminal shift ending** — the work had run its course, and there was never supposed to be a next shift. This is exactly what happened when date-cli was archived: open issues dropped to zero, and the final comment declared "no next shift needed" without opening a handoff issue

ADR-0005 didn't define a terminal boundary, so both readings hold, and the protocol can't tell right from wrong.

## Decision

**Exemption + explicit declaration (option 1 from issue #8):**

1. **Terminal shift endings** (explicit archiving / a judgment call that there is no next shift) **may skip opening a handoff issue**, but must leave a comment on the last-closed issue explicitly declaring "no next shift" + a reason. A silent terminal ending doesn't count as terminal.
2. **Non-terminal shift endings get no exemption, period.** If no handoff issue can be found and the most recently closed issue has no terminal declaration = non-compliant shift ending, handle per step 2 of "On starting a shift" (open a Protocol gap issue to record it + reconstruct from git log).
3. **Step 2 of "On starting a shift" gets a branch added**: when no handoff issue is found, first check whether the most recently closed issue has a terminal declaration — if yes, it's a compliant terminal ending, start work normally from git log + open issues; if no, it's non-compliant, record it.

### Ratifying cases that already happened

- **date-cli #17**: the final comment explicitly stated "path A verified, no next shift needed to take over" + a reason → **retroactively ratified as a compliant terminal ending**. This clause simply formalizes that practice.
- **This repo's backfill shift (PR #7)**: at shift end, #3 was still open (the work hadn't run its course), so it wasn't terminal; and no terminal declaration was left → **ruled non-compliant**, already recorded in #8. No retroactive penalty — it's the experimental data that exposed this gap, and closing the gap is the resolution.

### Why option 2 (no exemption, ever) wasn't chosen

Forcing a "definitely orphaned" open issue at the terminal moment either leaves it hanging forever (polluting the "On starting" scan) or gets opened and immediately self-closed (ritualistic). The rule's purpose (guaranteeing the next shift an entry point) doesn't hold when there is no next shift, so enforcing it anyway is form without substance.

## Consequences

- Whether something counts as "terminal" is judged by the agent ending the shift, and can be misjudged (thinking there's no next shift when there is). Mitigation: the cost of misjudgment is low — the next shift, on encountering the terminal declaration, reconstructs from git log + open issues exactly the same way as the non-compliant-recovery path under "On starting a shift"; and the declaration must state a reason, so misjudgment can be audited.
- The terminal declaration becomes a new protocol action that depends on the agent's self-discipline. Mitigation: the gate can't assert GitHub issue state anyway — this already relies on the protocol text + oversight by the next shift, consistent with the enforcement mechanism of ADR-0005's main body.
- ADR-0005's main body is unchanged: under normal circumstances, ending a shift still requires opening a handoff issue.
