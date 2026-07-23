# ADR-0045: Memory comments reference existing artifacts, don't restate them

- Date: 2026-07-23
- Status: accepted
- Related: ADR-0004 (Memory five-part format), ADR-0003 (issue roles)

## Context

Handoff Memory comments tend to restate content that already lives in durable artifacts — a paragraph summarizing an ADR, a re-description of a PR's diff. Two costs:

1. **Decay**: the artifact evolves (ADR superseded, PR amended), the restatement doesn't. The next shift reads the Memory first and trusts the stale copy over the live source.
2. **Noise**: the five-part format's value is density; restated prose buries the three signals that only the Memory carries (what's blocked, what's next, why non-default choices were made).

The rule is borrowed from mattpocock/skills' `handoff` skill ("Do not duplicate content already captured in other artifacts… Reference them by path or URL instead"). That skill compacts a session into a temp-dir file; here the same discipline applies to the Memory comment, whose carrier (a GitHub issue, ADR-0003/0005) is already durable and linkable — making references strictly better than copies.

## Decision

One sentence appended to the Memory five-part hard-rule bullet in AGENTS.md: across all five parts, content already captured in a durable artifact (ADR / issue / PR / commit / diff) is **referenced by number or path, not restated**. What belongs inline is exactly what no artifact carries — state, blockers, next steps, and the rationale behind non-default choices.

## Consequences

- Memory comments get shorter and stay truthful by construction — a `#N` or a path cannot go stale the way a paraphrase can.
- The five-part structure itself is unchanged: this constrains *how* each part is written, not *what* parts exist. An over-restated Memory is a style violation, not a missing-part violation — it still counts as a handoff.
- Tier = **L1**: amends the hard-rule-marked Memory bullet (ADR-0018 anchors protection to the marking). Maintainer approved in session on 2026-07-23; the repo is single-human, so the in-session path is valid (ADR-0042).
- Version = **minor** (protocol clause + new ADR, ADR-0023).
- **Considered, not adopted**: making it part ⑥ (it is a cross-cutting style constraint, not a sixth content slot — a numbered part would imply "missing = invalid handoff", over-weighting style); requiring links to be full URLs (issue/PR numbers and repo paths are already unambiguous inside the repo).
