# ADR-0004: Memory comment upgraded from a four-part format to five parts (adds "rationale / trade-offs")

- Date: 2026-07-17
- Status: accepted
- Provenance: this decision originated in the date-cli Path A experiment (originally date-cli ADR-0006), and backfilled into the scaffold after being validated in real multi-agent collaboration

## Context

The four-part Memory comment format established by ADR-0003 (what's done / what's blocked / what's next / whether to close the issue) ran through 4 handoff rounds in date-cli. The problem it hit: **when the previous shift made a non-obvious call (chose a over b, picked a particular implementation path), the four-part format has no slot for "why this was chosen."**

Concretely, this is exactly the information most prone to rotting away at handoff time:
- No place to write it down → the agent either crams it into "what's done" (blurring the structure) or passes it along verbally (lost once the session ends)
- Put it in an ADR? No good — ADRs hold long-term architectural decisions; scheduling-level trade-offs would drown out the real architectural ones.

## Decision

The Memory comment is upgraded to a **five-part format**, with part 5 being "rationale / trade-offs":

① what's done ② what's blocked ③ what's next ④ close the issue if the task is done ⑤ **rationale / trade-offs** — mandatory whenever this shift made a non-obvious call (what was chosen, why, and what premise failing would mean it should be overturned); **if no such call was made, write "none" — never omit this part**.

"Write 'none' if no decision was made" is the key clause: omitting part 5 would leave the next shift unable to tell "no decision was made" apart from "a decision was made but not recorded."

## Consequences

- **Cost**: Memory comments get longer and heavier to write.
- **Payoff**: scheduling-level decisions no longer rot away, and ADRs stay uncontaminated (an ADR keeps its single responsibility of holding "long-term architectural decisions").
- **The "what premise failing would mean it should be overturned" part is especially valuable** — it tells the next shift under what conditions this judgment call should *not* be inherited, preventing blind reuse.
- When to upgrade again: if practice shows part 5 is always written as "none" (meaning the protocol is stable and there are no scheduling-level calls left to make), rolling this back could be considered — but there's no such signal yet.
