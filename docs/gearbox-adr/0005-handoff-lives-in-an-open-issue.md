# ADR-0005: Handoff Memory lives in an open handoff issue, not buried in a closed Task issue

- Date: 2026-07-17
- Status: accepted
- Provenance: this decision originated in the date-cli Path A experiment (originally date-cli ADR-0007), and backfilled into the scaffold after being validated in real multi-agent collaboration

## Context

ADR-0003 specifies that the end-of-shift Memory comment goes on "the comment of the corresponding issue." Path A's third round hit a problem: **the "corresponding issue" is usually the Task issue that was just closed, but the next shift's three start-of-shift steps scan open issues — it never sees Memory sitting in a closed Task.**

Concretely: Memory sinks into a closed issue, and the next shift entering the repo has no way to know which issue to read — it has to be pointed there by a person ("go look at the comment on #1"). **This breaks "the repo is the only shared memory" — the memory exists, but there's no entry point to it.**

Candidate approaches:
- **A. Have the next shift dig through git log + closed issues to find Memory** — findable, but relies on someone remembering "which issue has the Memory," unreliable.
- **B. Open a new open "handoff issue" at the end of each shift**, Memory lives there, and the next shift closes it = handoff complete.
- **C. Go back to HANDOFF.md** — already rejected by ADR-0003 (overwritten each time, no timestamps).

## Decision

Adopt B: **at the end of a shift, open an open handoff issue (Task type, titled something like "Shift N handoff: X → next shift").**

- The body states the current state + a suggested next step
- The Memory comment (five-part format, ADR-0004) is left on this issue
- The next shift, entering the repo, naturally hits it via step 2 of the three start-of-shift steps (checking open issues)
- The next shift reads it and closes it = handoff recorded as complete

Accompanying changes:
- "On starting a shift" step 2 is refined: first look for the open handoff issue. **If none is found, the previous shift ended out of compliance** — open a gap issue to record this, then reconstruct context from git log + other open issues.
- "On ending a shift" gains a step 4: open the next shift's handoff issue.

## Consequences

- **Cost**: one more action per shift (opening the handoff issue). Closing a Protocol gap issue also gains a step — after closing your own issue, if a handoff is still needed, you have to open a handoff issue.
- **Payoff**: the handoff chain no longer breaks. The next shift **doesn't need to already know this rule to find the entry point** — the handoff issue is open, and the three start-of-shift steps naturally scan it. This is the key to the protocol being self-bootstrapping.
- **"Not found = out of compliance"** gives the protocol an **observable failure signal**: if some shift forgets to open a handoff issue, the next shift discovers it immediately (no entry point found at start-of-shift), instead of silently starting work on stale context.
- Risk: if some shift is repeatedly out of compliance (habitually forgetting to open the handoff issue), it produces noise of "non-compliance → open a gap → yet another open issue." Mitigation — non-compliance should be rare, since opening the handoff issue is one of the standard end-of-shift actions.
