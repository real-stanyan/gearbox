# ADR-0054: Handoffs are batons; waits on people are Task lines

- Date: 2026-09-30
- Issue: #151
- Status: accepted
- Related: ADR-0009 (terminal shift — superseded), ADR-0005 (the handoff lives in an open issue — amended: opened only when Tasks are left unfinished), ADR-0044 (blocking edges — amended: a `Waiting on:` line also keeps a Task off the frontier), ADR-0048 (parallel shifts — amended: no context-only handoffs, no terminal declarations), ADR-0004/0045 (Memory format — unchanged), ADR-0053 (the roster names the people), #132 (the serial baton)

## Context

Every shift had to end with a handoff issue, unless it declared "no next shift" on the last closed issue (ADR-0009). A starting shift that found neither had to open a Protocol-gap issue. Parallel lanes added the "context only" handoff: one with nothing to transfer, closed by its first reader (ADR-0048).

An audit of the three downstreams and Gearbox (2026-09-30) found handoffs doing three jobs:

- **A baton**: unfinished Tasks passing to the next shift. Gearbox uses them this way. Its queue never exceeds one, and each is taken over.
- **A progress note.** One downstream opened 172 handoffs in 42 days, 71% of them context-only, with a median life of 1.5 hours. Closing comments were mostly formulaic, and ten handoffs were closed within seconds by one pasted comment. One account opens and closes them all, so whether anyone read them is unknowable.
- **A ledger of waits on people**: merges, real-device tests, releases, decisions. In two downstreams, 55 of 61 open handoffs are such waits, and the queue never drains. Many had already resolved: 16 of 22 "waiting for merge" handoffs have a later comment saying it merged. One downstream carried device-test debt through 117 handoffs, each shift putting it back unchanged.

Two sibling downstreams also opened a dozen pairs of near-identical handoffs within minutes of each other.

The mandatory handoff and the terminal-declaration check turned the last two jobs into handoffs: a shift with nothing to hand over still had to leave an artifact.

## Decision

- **A handoff issue exists only when a shift leaves Tasks it owns unfinished.** "Owns" means claimed, or worked on where claiming is skipped; an open PR counts. The handoff lists those Tasks and carries the five-part Memory. Context that must outlive the shift goes in its body, or in a standing tracking Task referenced by number. A shift that finishes everything opens none.
- **Taking over = claiming the listed Tasks**, then closing the handoff. The claim is the evidence it was read. There are no context-only handoffs.
- **No terminal declaration.** No open handoff means nothing is in flight. This supersedes ADR-0009, together with the start-of-shift branch that opened a Protocol gap when a declaration was missing.
- **`Waiting on: <person> — <what>`**, a literal line in a Task body, one per wait, with `<person>` as named in `## Roster`. The Task is off the frontier until the line is cleared, either by that person or by a shift that sees the event happen on GitHub (delete the line, comment the evidence). Standing debt is one Task per item.
- **Start of shift** reads in order: open handoffs (take over at most one lane), open `Waiting on:` lines (clear the ones already resolved), then the frontier.
- **One fact, one repo**: work spanning sibling repos is tracked in the repo where it is done; the others link to it.
- Fence budget: the protocol fence went from 19402 B to 19344 B.

## Alternatives rejected

- **Abolish handoff issues.** State would live only in Tasks. Cross-Task lane context would have no home, and a single-human repo would lose a fixed entry point for half-done work.
- **Keep a handoff per shift and add lifecycle rules** (a wait label, auto-close, a copy ban). The context-only volume and the unverifiable "read" remain.
- **Open a handoff only when the person changes.** A single-human repo would have no fixed entry point.
- **A `needs-human` label.** It needs one label per repo and triage permission, and it can't say who or what.
- **Assigning the waited-on person.** Agents act under the humans' accounts (ADR-0053), so an assignment can't tell a person's wait from an agent's claim.

## Consequences

- Handoff volume should drop to the number of shifts that actually leave work unfinished. Progress moves to where the work is.
- A person sees their waits with one search (`"Waiting on: <person>" in:body is:open`), and resolved waits are cleared at the next shift start.
- Downstreams carry open handoffs from the old rule. Each is triaged by hand during its v2 migration: its Tasks are claimed or released, its waits become `Waiting on:` lines, and then it is closed.
- #132's "who is working now" stays out of scope: claims plus batons answer "whose are these Tasks", not live presence.
- Tier = **L1**: it changes Working agreement content (the criterion table, ADR-0006/0012). Version: ships inside v2.0.0. Affects downstream: yes.
