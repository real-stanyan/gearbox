# ADR-0018: Hard Rules Are Tiered by Designation, Not Location — the Hard Rules Section Placeholder Stays, Plus a Note

- Date: 2026-07-19
- Status: accepted

## Context

Two structural contradictions from issue #31:

1. ADR-0013's hard rule ("no link = cannot merge") is called a Hard rule, yet it lives in the "Changing the protocol itself" subsection, not in the `## Hard rules` section — "Hard rule" carries protocol meaning (an L1-protected object); scattering it elsewhere is semantic drift: the L1 criterion (ADR-0006/ADR-0012) stakes out territory by section, and section-based staking can't reach it
2. Gearbox dogfoods itself, but its own Hard rules section is the `<placeholder>` meant for downstream to fill in — Gearbox's actual hard rules (CLAUDE.md as an empty shell, no HANDOFF, the gate's two locations staying consistent) live in gate assertions and CONTEXT.md's Key invariants, and nowhere in this section. The template role and the dogfood role fight each other inside the same file

## Decision

Choose option b (keep the placeholder, add a note) — two sentences resolve both contradictions:

1. **Gearbox's own hard rules are authoritative via gate assertions**, not restated in the Hard rules section. `check-gearbox.js` is the executable source of truth — stronger than prose (change an assertion and CI turns red immediately; change prose and nobody notices)
2. **Any clause in the protocol body marked "Hard rule" is treated as content of the Hard rules section and receives L1 protection** — the criterion anchors to the designation itself, not to the section it physically lives in. ADR-0012's mechanism-keyword criterion (the text containing `Hard rule` triggers L1) thereby gets an explicit semantic basis: wherever the keyword appears, that's where L1 territory extends

### Why not option a / c

- **a (fill Gearbox's own hard rules into the section)**: those rules already live in two places — gate assertions and CONTEXT.md's Key invariants — filling them in here would be a third copy; and when downstream copies this file away, it's easy to forget to clear it out, mistaking Gearbox's own rules for its own
- **c (collect/restate the scattered hard rules into the section)**: the same rule would live in two places, violating single source of truth — the protocol's first principle shouldn't be broken by the protocol itself. ADR-0014 just plugged the "hardcoded downstream list" hole; no more digging

## Consequences

- **Two tracks made explicit**: the template placeholder (for downstream) and the dogfood instance (pointing at the gate) are separated by a single note within the same section. The gate is the backstop — delete the note but not the assertion, and the rule still holds; the gate simultaneously gains an assertion protecting this note's key phrase ("treated as content of this section"), preventing the note from being silently removed
- **The "Hard rule" designation becomes a protected marker**: any future clause that wants to become a hard rule automatically enters L1 territory by writing the "Hard rule" designation on it; conversely, deleting or rewriting any clause carrying this designation = L1
- **Downstream can backfill this**: downstream projects that follow the tier system (e.g. dryrun) have the same "the criterion can't reach scattered hard rules" problem — the B-3 backfill notice still goes out; downstream projects that don't follow the tier system may decline
