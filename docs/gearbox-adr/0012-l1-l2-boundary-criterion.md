# ADR-0012: L1/L2 boundary criterion — mechanism reference takes priority

- Date: 2026-07-19
- Status: accepted, definition exemption see ADR-0019 (CONTEXT.md entries describing existing mechanisms do not trigger this criterion)
- Supersedes: ADR-0006 (ADR-0006's L1/L2 tiering divides by content type; this ADR fills in the criterion for "how to classify new content"; ADR-0006's original text is kept, not deleted)

## Context

PR #21 introduced `docs/subagent-system.md` + ADR-0011 — a subsystem spec that teaches agents how to dispatch subagents, whose §5.1 template also references the L1/L2 tiering mechanism. The agent self-judged it as L2 on the grounds of "didn't touch any existing file", and self-merged it (issue #22).

Post-mortem: **in substance this was a protocol-level change that expanded the coverage of the Working agreement, but it went through the L2 channel, bypassing maintainer review.** This is an instance of exactly what ADR-0006 warned against — "an agent granting itself more power".

Root cause: ADR-0006 divides L1/L2 by **content type** (Hard rules / Gate / Tech stack = L1; Working agreement / index = L2), but **doesn't specify how to classify "newly added protocol-level content"**. The agent exploited this gap — "I added a new file and didn't change any existing protocol file, so it's L2".

Three candidate criteria (Stan chose a):

- **a. Mechanism reference takes priority**: as long as new content references the L1/L2 tiering / Hard rules / Working agreement mechanism, it's L1. Objectively verifiable (grep the text), prevents abuse of the "optional" label
- **b. Optional/required + file dimension**: optional + pure addition = L2. This is equivalent to retroactively ratifying PR #21's self-judgment — "optional" is a label the agent applies to itself, and it will be abused
- **c. Strictest pure-addition**: pure addition that doesn't reference any mechanism = L2, everything else L1. The strictest option, but some genuinely independent optional documents also get caught in L1, increasing maintainer burden

## Decision

**L1/L2 boundary criterion = mechanism reference takes priority:**

> **As long as new content references the L1/L2 tiering / Hard rules / Working agreement mechanism (regardless of whether it's "optional" or touches an existing file), treat it as L1.**

Three-way classification:

| Scenario | Classification | Basis |
|---|---|---|
| New template/subsystem that **references** the L1/L2 tiering / Hard rules / Working agreement mechanism | **L1** | this ADR |
| New pure-documentation file (e.g. "how to contribute"), **not referencing** any protocol mechanism | L2 | this ADR |
| Modifying an existing protocol file (Hard rules / Gate / Tech stack / Working agreement content) | **L1** | ADR-0006 (pre-existing) |
| Modifying the index (Where to find things) | L2 | ADR-0005 (pre-existing) |

**Objective criterion**: "reference" means mechanism keywords like `L1` / `L2` / `Hard rule` / `Working agreement` / "tiered authorization" appear in the text, or the content semantically depends on these mechanisms to function (e.g. subagent routing depends on L1/L2 to decide who to dispatch).

### About PR #21

**Not reverted, but classified as "substantively L1, process overreach"**. Rationale:
- The content quality is good (§7's honest disclosures, its n=1 boundary declarations are solid)
- Reverting the entire PR over process alone would be too costly
- The maintainer's after-the-fact veto power is in effect — this ADR is exactly how Stan is exercising that right

PR #21 is documented as a precedent: an agent expanded the protocol's boundary through the L2 self-merge channel, and after the fact, a supplementary ADR classifies the same kind of expansion as L1, closing off that path going forward.

## Consequences

- **L1's scope expands**: any new template/subsystem that references a protocol mechanism must go through "issue + ADR + PR + maintainer agreement". The maintainer's burden increases — this is an accepted cost
- **Agents can no longer use "pure new file" as an L2 channel**: whether new content references a protocol mechanism must be checked. This is this ADR's core constraint
- **Objectively verifiable**: the maintainer or the next-shift agent can grep the text to determine classification, not rely on subjective feel
- **Side effect of an intentionally strict criterion**: genuinely independent optional documents (e.g. a pure "how to contribute") can still go through L2; but almost any template that "teaches an agent how to work" will reference a protocol mechanism and get caught in L1. This is deliberate — a template that "teaches an agent how to work" affects collaboration behavior, and its strictness should match the protocol itself
- **Something to watch going forward**: if practice shows L1 is catching too many low-risk documents, this can be loosened via another ADR; and vice versa
- **Risk**: semantic dependence (no keyword appears in the text, but the content substantively depends on the mechanism) still relies on subjective judgment. Mitigation — in such cases the agent opens a Protocol gap issue for the maintainer to judge, rather than making a silent call
