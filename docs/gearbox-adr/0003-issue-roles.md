# ADR-0003: The three issue roles (Task / Memory / Protocol gap), no HANDOFF.md

- Date: 2026-07-17
- Status: accepted

## Context

The core of this repo's protocol is "the only shared memory between sessions is the repo itself." The handoff in issue #2 proved the mechanism works, but also exposed a gap: **the protocol never formally defined how issues should be used.**

Three concrete problems came up:

1. The issue #2 comment (an acceptance report Claude Code left behind) was good practice, but **without codifying it, it would be lost** — the next agent wouldn't automatically inherit that handoff format.
2. When Claude Code hit "no agreed merge strategy," it opened issue #3 on the strength of issue #2's **ad-hoc authorization**, not a protocol rule. A different context could easily have led to a silent judgment call instead.
3. "Why we don't use HANDOFF.md" was only written in README.md (for template users), not in AGENTS.md (the protocol itself).

Candidate approaches:

- **A. HANDOFF.md**: a single file, overwritten each time. Advantage: one place to look. Disadvantages: later writes overwrite earlier ones, old context is lost, no timestamps, no author, can't be closed/archived, can't be referenced.
- **B. Issue comments**: append-only, timestamped, authored, referenceable via `#N`, closeable/archivable, tied to a specific task. Downside: scattered across multiple issues (but this is actually the point — context stays bound to its task instead of drifting).
- **C. Formally define three issue roles** (Task / Memory / Protocol gap): builds on B by formalizing "when to open an issue, which kind, and when to close it."

## Decision

Adopt C: explicitly define **three non-overlapping issue roles** in AGENTS.md — Task / Memory / Protocol gap — and establish as a hard rule that "hitting a protocol gap requires opening an issue; silent judgment calls are not allowed." The Memory role is carried by issue comments; **no HANDOFF.md is created.**

Boundaries of the three roles:

| Role | When to use | When to close |
|---|---|---|
| Task | There's an actionable piece of work to do | The task is done and the gate is green |
| Memory | Leave a comment at end of shift (what's done / what's blocked / what's next) | Done once the next shift picks it up |
| Protocol gap | Hit a question the repo can't answer | Done once the gap is folded into AGENTS.md / an ADR / CONTEXT.md |

The minimum format for a Memory comment is set at four parts: what's done / what's blocked / what's next / whether to close the issue. Missing any one part means the handoff doesn't count.

## Consequences

- **Cost**: the protocol gets thicker. Every time an agent opens an issue, it has to judge which role applies. Formalization itself has a maintenance cost.
- **Payoff**:
  - Good practice gets codified instead of relying on word of mouth — this is the bedrock of "the repo is the only shared memory."
  - "Hit a gap, open an issue" is upgraded from a tacit norm to a hard rule, lowering the risk of silent judgment calls.
  - The three-role taxonomy gives later agents a ready-made framework instead of reinventing one each time.
- **Risk**: building a full taxonomy from n=1 experience risks premature abstraction. Mitigation — the taxonomy is **descriptive** (summarizing what already happened in issues #2/#3), not **prescriptive** (no new process was invented).
- **Boundary**: PRs are not a separate role — a PR is the implementation vehicle for a Task, and merging it closes the Task issue. New problems found during PR review get their own issue rather than piling up in PR comments.
- If some issue type (e.g. Protocol gap) turns out to be extremely rare or extremely frequent in the future, adjust the taxonomy via a new ADR rather than editing this one in place.
