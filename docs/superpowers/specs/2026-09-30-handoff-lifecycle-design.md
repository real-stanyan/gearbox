# Handoff lifecycle: batons only, and waits on people as Task lines (Gearbox v2) — design

Date: 2026-09-30
Status: approved in session; implementation plan `docs/superpowers/plans/2026-09-30-handoff-lifecycle.md`
Sub-project: D of four structural changes. Order: A fence (PR #144) → C ADR IDs (PR #146) → B identity/L1 (PR #150) → **D handoff lifecycle**. All four ship together as v2.0.0; the release follows D.

## Problem

The protocol has one artifact for the end of a shift: the handoff issue. Every shift must open one, unless it declares "no next shift" on the last closed issue (ADR-0009). A shift that finds no handoff and no declaration must open a Protocol-gap issue. Parallel lanes added the "context only" handoff: one with nothing to transfer, closed by its first reader (ADR-0048).

An audit of the three downstreams and Gearbox (2026-09-30) found that handoffs are used for three different jobs, and only the first works:

1. **A baton: unfinished Tasks passing to the next shift.** Gearbox uses handoffs this way, serially. Its queue never exceeds one, and each handoff is taken over.
2. **A progress note.** One downstream opened 172 handoffs in 42 days, 4.1 a day with a peak of 23. 71% were strictly context-only, and the median one lived 1.5 hours. Of 166 closed, 52 had a formulaic "read and close" comment and 13 were closed in sweeps: ten within 2–3 seconds by one pasted comment. One account creates and closes them all, so "read" can't be verified. Gearbox's own handoffs were closed by the session that wrote them 7 times out of 14.
3. **A ledger of waits on a person** (a merge, a real-device test, a release, a decision). In two downstreams, 55 of 61 open handoffs are such waits, and 10–12 are already open when a new one is written; the queue never drains. Many are stale: 16 of 22 "waiting for merge" handoffs have a later comment saying it merged, one of them 22 days earlier. One downstream carried real-device debt through 117 of its 172 handoffs and finally moved it to standing Tasks, because a handoff means "read and close" and each shift "puts them back as they were".

Two sibling downstreams also opened 12 pairs of near-identical handoffs within minutes of each other (27–36% of their handoffs, two pairs byte-identical). And #132 names the structural limit: a handoff is a serial baton, and says nothing about who is doing what now.

The mandatory handoff and the terminal-declaration check are what turn jobs 2 and 3 into handoffs: when a shift has nothing to hand over, the protocol still demands an artifact.

## Goals

1. A handoff issue exists only when a shift leaves Tasks unfinished; taking it over is claiming those Tasks.
2. Progress lives with the work (Task comments, PRs, commits), not in a shift-level issue.
3. A wait on a person is recorded once, on the Task it blocks, stays visible to that person, and is cleared as soon as it is resolved.
4. A fact that spans sibling repos is recorded in one repo.
5. The protocol fence doesn't grow (net ≤ 0 bytes).

## Non-goals

- **Tooling.** `gearbox-agents check` is offline and can't see issues; finding waits is one `gh` search. No new command.
- **A "who is working now" primitive** beyond claims (#132's present-tense question). Claims (ADR-0047) plus batons answer "whose are these Tasks"; live presence stays out of scope.
- **Changing the Memory format** (ADR-0004/0045). It stays, and now appears only on handoffs.
- **Migrating downstream issues by tool.** Each downstream's open handoffs are triaged by hand during its v2 migration (§6).

## Approach

The maintainer chose, in session:

- **Split the artifact by job.** Handoffs become batons only; progress goes to the Task or PR; waits become Task lines. Rejected: abolishing handoff issues entirely (cross-Task lane context, such as "release held until D", has no home, and single-human repos lose a guaranteed entry point); keeping per-shift handoffs and adding lifecycle rules (labels, auto-close, a copy ban) — the context-only volume and the unverifiable "read" stay.
- **A handoff opens when owned Tasks are left unfinished.** Rejected: only on a change of person (a single-human repo would then have no fixed entry point for half-done work).
- **Waits are a literal `Waiting on:` line** in the Task body, like `Blocked by:` (ADR-0044). Rejected: a `needs-human` label (a label per repo, triage permission, and it can't say who or what); assigning the person (agents act under the humans' accounts, so an assignment can't tell a person's wait from an agent's claim — ADR-0053).

## 1. Handoffs are batons

Shift-end rule 4 becomes: a shift that leaves Tasks it owns unfinished opens a handoff issue listing them. "Owns" means claimed (ADR-0047), or in a repo that skips claiming, worked on. An open PR counts as unfinished. The five-part Memory (ADR-0004) is the handoff's comment. Context that must outlive the shift goes in the handoff body, or in a standing tracking Task referenced by number (ADR-0045).

A shift that finishes everything opens no handoff. Its progress is already in the Tasks, PRs and commits, and its waits are `Waiting on:` lines (§2). There is no terminal declaration: no open handoff means nothing is in flight. ADR-0009 is superseded, and so is the start-of-shift branch that checks for a declaration and opens a Protocol gap when it's missing.

Taking over = claiming every Task the handoff lists, then closing it. The claim is the evidence the handoff was read. The "context only" handoff no longer exists (ADR-0048 amended).

## 2. `Waiting on:` lines

A Task whose next step only a person can take carries one line per wait:

```
Waiting on: stanyan — merge #158
Waiting on: stanyan — real-device test of the OTA build
```

- `<person>` is a person named in `## Roster` (ADR-0053).
- A Task with a `Waiting on:` line is **off the frontier**. No agent claims it, and it needs no handoff.
- **Clearing.** When the event is visible on GitHub (a PR merged, an issue closed), the shift that sees it deletes the line and comments the evidence. Other waits are cleared by that person: they reply that it's done, or delete the line themselves.
- **Standing debt** (device tests, releases) is one Task per item, each with its own line — never a list copied from shift to shift.
- The person finds their waits with `"Waiting on: stanyan" in:body is:open`.

## 3. Start of shift

Step 2 becomes three reads, in order:

1. **Open handoffs.** Take over at most one lane: claim its listed Tasks, close the handoff. Leave other lanes' handoffs alone (ADR-0048).
2. **Open `Waiting on:` lines.** Clear each one whose event GitHub already shows, with an evidence comment.
3. **The frontier.** Open Tasks with no open `Blocked by:` and no `Waiting on:`.

Context is rebuilt from `git log`, the Tasks and their PRs.

## 4. One fact, one repo

Work that spans sibling repos is tracked in the repo where it is done: its Task, handoff and `Waiting on:` lines. The other repos link to it and never copy it.

## 5. Protocol text

### Fence (`AGENTS.md`)

- **Start-of-shift step 2** — replace the whole item with:

  ```
  2. Check GitHub Issues, in order (ADR-0054): **open handoff issues** — each is one lane's unfinished Tasks plus its Memory (ADR-0005); take over at most one: claim its listed Tasks, then close it, and leave other lanes' handoffs alone (see "Parallel shifts"). Then **open `Waiting on:` lines**: clear each whose event GitHub already shows (a merged PR, a closed issue) — delete the line, comment the evidence. Then the **frontier** (see "Task ordering"). Rebuild context from git log, the Tasks and their PRs
  ```

- **While working** — add a bullet after the "Look up domain-term definitions" bullet:

  ```
  - **One fact, one repo**: work that spans sibling repos is tracked — its Task, handoff and `Waiting on:` lines — in the repo where it is done; the others link to it, never copy it (ADR-0054)
  ```

- **Roles table, Memory row** — replace with:

  ```
  | **Memory** (handoff memory) | On the **handoff issue** a shift opens when it leaves Tasks unfinished (see On ending a shift): it lists them and carries the five-part Memory | The next shift claims those Tasks and closes the handoff = handoff complete |
  ```

- **Task ordering** — the frontier sentence becomes "A shift claims only **frontier** tasks — open tasks with no open blockers and no `Waiting on:` line". After the paragraph, add:

  ```
  **Waiting on a person (ADR-0054)**: a Task whose next step only a person can take (a merge, a real-device test, a decision, a credential) carries one literal `Waiting on: <person> — <what>` line per wait, `<person>` as named in `## Roster`. It stays off the frontier until the line is cleared — by that person, or by a shift that sees the event already happened on GitHub (delete the line, comment the evidence). Standing debt is one Task per item, never a list copied from shift to shift.
  ```

- **Shift-end rule 4** — replace the whole item with:

  ```
  4. **Hand over unfinished Tasks** (ADR-0054): if this shift leaves Tasks it owns unfinished — claimed, or worked on where claiming is skipped; an open PR counts — open a **handoff issue** (Task type, kept open, ADR-0005) listing them, with this shift's five-part Memory (ADR-0004) as its comment; context that must outlive the shift goes in its body or a standing tracking Task. Otherwise open none: progress lives in the Tasks and PRs, waits on people in `Waiting on:` lines. No open handoff means nothing is in flight — there is no terminal declaration
  ```

- **Parallel shifts** — the "Handoff issues are per-lane" bullet becomes:

  ```
  - **Handoff issues are per-lane**: a starting shift reads **all** open handoff issues, takes over **at most one** lane (claim its listed Tasks, close its handoff), and leaves other lanes' handoffs open — closing another live lane's handoff is stealing its baton.
  ```

  and the "Terminal declarations (ADR-0009) are repo-level" bullet is deleted.

### Glossary fence (`CONTEXT.md`)

- Delete the `terminal shift` and `context-only handoff` rows.
- `frontier task`: "An open Task issue with no open blockers and no `Waiting on:` line — …", notes `ADR-0044/0054`.
- New row after `frontier task`:

  ```
  | waiting on | A literal `Waiting on: <person> — <what>` line in a Task body: a next step only that person can take (a merge, a device test, a decision). The Task is off the frontier until the line is cleared, by the person or by a shift that sees the event happened on GitHub | ADR-0054; one Task per standing debt |
  ```

### Byte budget

Deleted: the terminal branch of step 2, the "context only" and terminal sentences of rule 4, and the terminal bullet — about 1.1 KB. Added: the `Waiting on:` paragraph, the cross-repo bullet and the step-2 reads — about 0.7 KB. The requirement is net ≤ 0 against the pre-D fence (19402 B); the plan measures it.

### ADR and version

- `docs/gearbox-adr/0054-handoffs-are-batons.md`. The number is claimed at merge: if #142 lands first, D takes the next free one.
- ADR-0009: `Status: superseded by ADR-0054`. ADR-0005, ADR-0044 and ADR-0048: `amended by ADR-0054`.
- Ships inside the untagged v2.0.0. The markers stay `v2.0.0` and are re-hashed.

### Docs

- `site/index.html`: `shift.s1p` and `shift.s4p`, English and Chinese.
- README line 104 is a historical round log and stays.

## 6. Downstream migration (plan A, Tasks 17–19; local notes only)

For each downstream's v2 migration, one manual step goes into the local migration checklist (never into Gearbox):

- Triage every open handoff. Its listed Tasks are claimed or released. Each wait becomes a `Waiting on:` line on a Task, opened if none exists. Then the handoff is closed with a pointer to where its content went.
- A standing debt Task that holds a list is split into one Task per item.

## 7. Testing

The change is protocol text. The gate covers it: fence hashes and version (rehash), the fence budget, required fence headings (unchanged), and the ADR-0018 note. No code path reads the removed text: a grep shows no test or script referencing terminal shifts or context-only handoffs. The implementer re-runs that grep after the edit.

## 8. Order and release

1. A D issue (Protocol gap, L1: it changes the Working agreement's shift rules), claimed by this lane.
2. Branch `claude/gearbox-handoff-lifecycle` from main (da9782f); PR, `Affects downstream: yes`.
3. L1: the maintainer merges by hand (multi-human repo, ADR-0053).
4. Then plan A, Tasks 15–19: rerun the migration dry-run, tag v2.0.0, `npm publish` (maintainer), migrate the three downstreams with §6's extra step.
