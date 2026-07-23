# ADR-0047: Claiming a Task = assigning yourself on the issue

- Date: 2026-07-23
- Status: accepted
- Related: ADR-0003 (issue roles), ADR-0044 (blocking edges + frontier claiming), ADR-0046 (shift-start sync)

## Context

The protocol's ownership model is "Task-issue claim-based ownership — whoever claims a task sees it through start to finish", but the mechanical act of *claiming* was never defined. In a single-human repo this is moot: one queue, one reader. In a multi-human repo two machines scan the same open-issue queue and can start the same frontier task simultaneously — invisible to each other until the second PR shows up. ADR-0044's frontier rule narrowed *which* tasks are claimable; this ADR defines *how* a claim is made visible.

## Decision

- **Claim = assign yourself on the Task issue** — the GitHub account the agent acts under: `gh issue edit <N> --add-assignee @me`. First assignment wins. Assignment is visible in the issue list (`gh issue list` shows assignees) and timestamped in the issue's event log.
- **Fallback**: where assignment isn't possible (no triage permission — e.g. contributing to someone else's repo), a "claiming this" comment on the issue serves the same role; first comment wins.
- **An open frontier task with no assignee and no claim comment is free.** A shift checks for claims as part of the existing step-2 issue scan — no new step.
- **Releasing**: if a shift ends with the task unfinished, the progress comment required by shift-end rule 3 states whether the claim is released (unassign) or carried (stays assigned, next shift of the same human continues). Silence + an open handoff that doesn't transfer it = released; a dangling assignment from a shift that left no comment is treated as stale, not binding.

## Consequences

- Double-starts become a race on a visible, timestamped act instead of an invisible coincidence; the loser loses seconds, not a shift's worth of work.
- Costs one API call per claim. Single-human repos may skip claiming entirely — with one queue reader, self-assignment adds information for nobody; the rule's value begins at the second human.
- Tier = **L2**: extends the Working agreement's ownership convention (ADR-0006); references Task issues and claim ownership only, no tiering mechanism (ADR-0012).
- Version = **minor** (protocol clause + new ADR, ADR-0023).
- **Considered, not adopted**: a `Claimed-by:` body line (the body belongs to the issue author; assignees are first-class GitHub metadata with an event log); labels (unscoped — don't say *who*); locking via draft PRs (heavier, and a draft PR for a not-yet-started task is noise); making claims expire after N hours (staleness needs judgment — the release rule covers it without a clock).
