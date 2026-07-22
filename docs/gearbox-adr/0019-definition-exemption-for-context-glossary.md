# ADR-0019: Definition Exemption for ADR-0012's Criterion — a CONTEXT.md Entry Describing an Existing Mechanism Does Not Trigger L1

- Date: 2026-07-19
- Status: accepted
- Revises: ADR-0012 (the criterion is kept, one exemption is added; ADR-0012's original text is not deleted)

## Context

Two rules collide (issue #32):

- **While working**: "look up business-term definitions in CONTEXT.md; add new terms as they appear" — a routine obligation, zero process
- **ADR-0012's objective criterion**: "if the text contains mechanism keywords such as L1/L2/Hard rule ... treat as L1"

Adding protocol terms to the glossary (e.g. "L1/L2 tiering," "backfill") inevitably contains mechanism keywords — a routine hygiene action gets dragged into L1 by the safety criterion, requiring maintainer agreement every time. Case in point: PR #35's CONTEXT.md addition, read strictly, went through L1 (compliant but overweight).

The criterion's original intent was to catch the PR #21 kind of **legislation** (using "optional + pure addition" as an L2 channel to expand the protocol's boundary), not to catch **description** (writing already-enacted law into the glossary).

## Decision

Add a **definition exemption** to ADR-0012's criterion, with three requirements, **all mandatory**:

1. **The change touches only CONTEXT.md** (adding/editing an entry; touching any line of AGENTS.md / an ADR / the gate / a template disqualifies it)
2. **The entry cites its source ADR** (it defines already-enacted law and is traceable; no source citation = possibly enacting new law)
3. **No new obligation, no changed process, no changed boundary** (the entry is a compressed restatement of an existing mechanism; if a rule not present in the source ADR surfaces in the restatement, that's legislation)

Meeting all three → **L2**, the agent may self-merge. **Failing any one, or being unsure → default to L1**; self-granting the exemption is not allowed.

**Anti-abuse clause**: using "it's just a definition" to smuggle in semantic change (the entry's meaning diverges from its source ADR) = a violation, handled the same as a protocol change lacking issue/ADR — revert + reopen the issue. The maintainer's after-the-fact veto overrides this exemption.

## Consequences

- **Routine hygiene returns to baseline**: adding to the glossary goes back to zero process (L2, self-directed); the "While working" obligation is no longer caught in the criterion's crossfire
- **The criterion's core is untouched**: mechanism keywords in AGENTS.md / an ADR / the gate / a template are still always L1; the exemption's surface is exactly one file, CONTEXT.md, pinned down by three requirements
- **Entry provenance becomes a hard requirement**: going forward, protocol terms in CONTEXT.md must carry an ADR source or they don't get the exemption — incidentally improving the glossary's traceability
- **Residual risk (accepted)**: judging "restatement vs. legislation" still leaves subjective room; the backstop is "when unsure, default to L1" plus the maintainer's revert power. If practice turns up cases of smuggling semantics via an entry, tighten or repeal this exemption (in a separate ADR)
