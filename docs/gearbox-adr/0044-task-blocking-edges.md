# ADR-0044: Task issues declare blocking edges; shifts claim the frontier only

- Date: 2026-07-23
- Status: accepted
- Related: ADR-0003 (issue roles), ADR-0005 (handoff lives in an open issue)

## Context

Task issues form a flat queue. Nothing in the protocol expresses "task B needs task A merged first", so a shift scanning open issues can claim a task whose prerequisite is still open. Costs: wasted work (built on a base that then shifts), or two parallel efforts colliding on the same dependency chain.

The idea is borrowed from mattpocock/skills' `to-tickets` skill (tracer-bullet ticket decomposition with declared blocking edges, agents claim only the frontier). That skill operates inside a single session with local ticket files; here the same edge-and-frontier concept is re-hosted on GitHub issues, the protocol's existing task carrier (ADR-0003).

## Decision

- A dependent Task issue declares each prerequisite in its **body** with a literal line `Blocked by: #N` (one line per blocker).
- A shift claims only **frontier** tasks: open Task issues with no open blockers. When a blocker closes, its dependents join the frontier.
- The convention is plain text and grep-able (`gh issue view N` shows it; `gh search issues "Blocked by: #N"` finds dependents). No GitHub Projects, no labels, no API beyond what the protocol already uses.
- The clause lands in AGENTS.md "Roles of issues & PRs" as a normal note, **not** marked as a hard rule — a stale or missing edge should cost a judgment call, not a compliance violation.

## Consequences

- The open-issue list becomes a dependency map instead of a flat queue; the three start-of-shift steps need no change — reading open issues already surfaces the `Blocked by:` lines.
- Edges are declared manually and can go stale (a blocker closed as "won't do" leaves a dangling edge). Accepted: the reader sees the closed state right next to the reference; self-heals at claim time.
- Tier = **L2**: adds a note to the collaboration-agreement section outside any hard-rule marking (ADR-0006/0018); the text references only Task issues and claim-based ownership, not the tiering mechanism (ADR-0012).
- Version = **minor** (new protocol clause + new ADR, ADR-0023).
- **Considered, not adopted**: GitHub's native task-lists / Projects dependencies (plan-gated, API-unstable, invisible to a plain `gh issue view`); a `Blocks: #N` reverse edge (redundant — one direction suffices and two directions drift apart); making the rule a hard rule (over-weighting a hygiene convention).
