# Handoff Lifecycle (Batons Only, Waiting-on Lines) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the fenced shift rules so a handoff issue exists only when a shift leaves Tasks unfinished, waits on people become `Waiting on:` lines on Tasks, sibling repos don't duplicate records, and the terminal declaration is retired (ADR-0054).

**Architecture:** Protocol text only. The `AGENTS.md` protocol fence and the `CONTEXT.md` glossary fence are edited, then re-stamped with `scripts/dev/rehash-fences.js`. A new protocol ADR records the decision, and four older ADRs get status notes. The site's two shift strings follow. No code path reads the removed text.

**Tech Stack:** Markdown; the gate is Node.js (`scripts/check-gearbox.js`, `node:test`).

**Spec:** `docs/superpowers/specs/2026-09-30-handoff-lifecycle-design.md`

## Global Constraints

- Gate (run after every task, must be green): `node scripts/check-gearbox.js && node --test test/*.test.js`
- Fence markers stay `v2.0.0` (package.json is already `2.0.0`, latest tag `v1.15.2`). After any fence edit, run `node scripts/dev/rehash-fences.js`.
- Net protocol-fence byte change ≤ 0 against the pre-D baseline: `AGENTS.md` protocol fence **19402 B** (CONTEXT.md glossary 6760 B, informational).
- Protocol ADR: `docs/gearbox-adr/0054-handoffs-are-batons.md`, cited `ADR-0054`. `<ISSUE_D>` = the D issue number, which the controller supplies.
- Public repo: never name or quote the private downstream repos. Use audit numbers only as the spec states them ("one downstream", "two downstreams").
- Every commit message explains the why and ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Merge commits only. Nothing in this plan merges, tags or publishes.

## File map

| File | Change |
|---|---|
| `AGENTS.md` (protocol fence) | start step 2, While-working bullet, Roles Memory row, Task ordering + Waiting-on paragraph, shift-end rule 4, Parallel-shifts bullets |
| `CONTEXT.md` (glossary fence) | delete 2 rows, amend `frontier task`, add `waiting on` |
| `docs/gearbox-adr/0054-handoffs-are-batons.md` | create |
| `docs/gearbox-adr/0005-…`, `0009-…`, `0044-…`, `0048-…` | `Status:` notes |
| `site/index.html` | `shift.s1p`, `shift.s4p` (en + zh) |

---

### Task 1: Fenced shift rules, glossary and ADR-0054

**Files:**
- Modify: `AGENTS.md` (inside `<!-- gearbox:protocol … -->`)
- Modify: `CONTEXT.md` (inside `<!-- gearbox:glossary … -->`)
- Create: `docs/gearbox-adr/0054-handoffs-are-batons.md`
- Modify: `docs/gearbox-adr/0005-handoff-lives-in-an-open-issue.md`, `0009-terminal-shift-exemption.md`, `0044-task-blocking-edges.md`, `0048-parallel-shifts.md` (line 4, `- Status:`)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: fence text naming `Waiting on:` and ADR-0054, used by Task 2's site strings.

- [ ] **Step 1: Measure the baseline**

```bash
node -e 'import("./scripts/lib/fence.js").then(({findFence})=>{const fs=require("fs");for(const [f,n] of [["AGENTS.md","protocol"],["CONTEXT.md","glossary"]])console.log(f,Buffer.byteLength(findFence(fs.readFileSync(f,"utf8"),n).content))})'
```

Expected: `AGENTS.md 19402`, `CONTEXT.md 6760`.

- [ ] **Step 2: Edit the AGENTS.md fence** — each replacement is exact; each "old" text occurs exactly once.

(a) Start-of-shift step 2. Replace the whole line that begins `2. Check GitHub Issues — **first look for open handoff issues**` (it ends `then check other open tasks and notes`) with:

```
2. Check GitHub Issues, in order (ADR-0054): **open handoff issues** — each is one lane's unfinished Tasks plus its Memory (ADR-0005); take over at most one: claim its listed Tasks, then close it, and leave other lanes' handoffs alone (see "Parallel shifts"). Then **open `Waiting on:` lines**: clear each whose event GitHub already shows (a merged PR, a closed issue) — delete the line, comment the evidence. Then the **frontier** (see "Task ordering"). Rebuild context from git log, the Tasks and their PRs
```

(b) While working. After the line

```
- Look up domain-term definitions in `CONTEXT.md`; add new project terms under its `## Project terms` as they come up (protocol terms live in its fence)
```

insert the line

```
- **One fact, one repo**: work that spans sibling repos is tracked — its Task, handoff and `Waiting on:` lines — in the repo where it is done; the others link to it, never copy it (ADR-0054)
```

(c) Roles table. Replace

```
| **Memory** (handoff memory) | Leave a comment on the **handoff issue** (see On ending a shift) at shift-end, five-part format | The next shift reads it and closes the handoff issue = handoff complete |
```

with

```
| **Memory** (handoff memory) | On the **handoff issue** a shift opens when it leaves Tasks unfinished (see On ending a shift): it lists them and carries the five-part Memory | The next shift claims those Tasks and closes the handoff = handoff complete |
```

(d) Task ordering. In the paragraph beginning `**Task ordering (blocking edges, ADR-0044)**`, replace

```
A shift claims only **frontier** tasks — open tasks with no open blockers; when a blocker closes, its dependents join the frontier.
```

with

```
A shift claims only **frontier** tasks — open tasks with no open blockers and no `Waiting on:` line; when a blocker closes, its dependents join the frontier.
```

and insert, as a new paragraph directly after that paragraph (one blank line before and after):

```
**Waiting on a person (ADR-0054)**: a Task whose next step only a person can take (a merge, a real-device test, a decision, a credential) carries one literal `Waiting on: <person> — <what>` line per wait, `<person>` as named in `## Roster`. It stays off the frontier until the line is cleared — by that person, or by a shift that sees the event already happened on GitHub (delete the line, comment the evidence). Standing debt is one Task per item, never a list copied from shift to shift.
```

(e) Shift-end rule 4. Replace the whole line that begins `4. **Open a handoff issue for the next shift**` (it ends `that's just a lane end (ADR-0048)`) with:

```
4. **Hand over unfinished Tasks** (ADR-0054): if this shift leaves Tasks it owns unfinished — claimed, or worked on where claiming is skipped; an open PR counts — open a **handoff issue** (Task type, kept open, ADR-0005) listing them, with this shift's five-part Memory (ADR-0004) as its comment; context that must outlive the shift goes in its body or a standing tracking Task. Otherwise open none: progress lives in the Tasks and PRs, waits on people in `Waiting on:` lines. No open handoff means nothing is in flight — there is no terminal declaration
```

(f) Parallel shifts. Replace the bullet beginning `- **Handoff issues are per-lane**: shift-end rule 4 unchanged in shape` (it ends `is closed by its first reader after reading.`) with:

```
- **Handoff issues are per-lane**: a starting shift reads **all** open handoff issues, takes over **at most one** lane (claim its listed Tasks, close its handoff), and leaves other lanes' handoffs open — closing another live lane's handoff is stealing its baton.
```

and delete the whole line

```
- **Terminal declarations (ADR-0009) are repo-level, not lane-level** — see On ending a shift.
```

- [ ] **Step 3: Edit the CONTEXT.md fence**

- Delete the whole row beginning `| terminal shift |`.
- Delete the whole row beginning `| context-only handoff |`.
- In the row beginning `| frontier task |`: replace `An open Task issue with no open blockers` with `An open Task issue with no open blockers and no \`Waiting on:\` line`, and replace its notes cell `ADR-0044` with `ADR-0044/0054`.
- Insert directly after the `frontier task` row:

```
| waiting on | A literal `Waiting on: <person> — <what>` line in a Task body: a next step only that person can take (a merge, a device test, a decision). The Task is off the frontier until the line is cleared, by the person or by a shift that sees the event happened on GitHub | ADR-0054; one Task per standing debt |
```

- [ ] **Step 4: Check that nothing else references the removed concepts**

```bash
grep -rn -i -E "terminal shift|terminal declaration|context.only|no next shift" AGENTS.md CONTEXT.md scripts test bin .github site README.md
```

Expected: the only `AGENTS.md` hit is rule 4's new "there is no terminal declaration". README line 104 (historical) may match. Any other hit in `scripts/`, `test/`, `bin/` or `.github/`: stop and report it.

- [ ] **Step 5: Re-stamp and measure**

Run `node scripts/dev/rehash-fences.js`, then the Step 1 command again. Required: the `AGENTS.md` fence is ≤ 19402 B. Record both numbers. If it grew, stop and report; don't trim other text.

- [ ] **Step 6: Write `docs/gearbox-adr/0054-handoffs-are-batons.md`**

Fill `<ISSUE_D>` with the issue number, and `<before>`/`<after>` with the Step 1 and Step 5 AGENTS.md numbers.

```markdown
# ADR-0054: Handoffs are batons; waits on people are Task lines

- Date: 2026-09-30
- Issue: #<ISSUE_D>
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
- Fence budget: the protocol fence went from <before> B to <after> B.

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
```

- [ ] **Step 7: ADR status notes** (line 4 of each file)

- `0009-terminal-shift-exemption.md`: `- Status: accepted` → `- Status: superseded by ADR-0054 (no terminal declaration: no open handoff means nothing is in flight)`
- `0005-handoff-lives-in-an-open-issue.md`: `- Status: accepted` → `- Status: accepted; amended by ADR-0054 (opened only when Tasks are left unfinished)`
- `0044-task-blocking-edges.md`: `- Status: accepted` → `- Status: accepted; amended by ADR-0054 (a \`Waiting on:\` line also keeps a Task off the frontier)`
- `0048-parallel-shifts.md`: the Status line currently ends `…only the Gearbox repo claims ADR numbers at merge)`. Append, directly after that closing parenthesis, `; amended by ADR-0054 (no context-only handoffs, no terminal declarations)`.

- [ ] **Step 8: Run the gate**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add AGENTS.md CONTEXT.md docs/gearbox-adr/
git commit -m "docs(protocol): handoffs are batons; waits on people are Task lines (ADR-0054)

A handoff now exists only when a shift leaves Tasks unfinished, and taking
it over is claiming them. Progress stays with the Tasks and PRs, a wait on
a person is a Waiting-on line that keeps its Task off the frontier until
it clears, and sibling repos link instead of copying. The terminal
declaration goes: with no mandatory handoff there is nothing to excuse.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Site shift strings

**Files:**
- Modify: `site/index.html:885` (en `shift.s1p`), `:900` (en `shift.s4p`), `:1164` (zh `shift.s1p`), `:1170` (zh `shift.s4p`)

**Interfaces:**
- Consumes: the rule from Task 1. No code.

- [ ] **Step 1: Replace the four strings** (keep the surrounding markup and quoting exactly)

- en `shift.s1p` text: `Fetch and fast-forward, read recent commits, then find the open handoff issue — the previous shift's memory lives there.` → `Fetch and fast-forward, read recent commits, then take over an open handoff if there is one, clear the waits that have resolved, and pick from the frontier.`
- en `shift.s4p` text: `Open a handoff issue with a five-part memory: done, blocked, next, closures, and the rationale behind every non-default decision.` → `Left Tasks unfinished? Hand them over in a handoff issue with a five-part memory. Waiting on a person? Say so on the Task, in one line.`
- zh `shift.s1p` text: `fetch 并快进，读最近的提交，然后找那个开着的交接 issue —— 上一班的记忆就在里面。` → `fetch 并快进，读最近的提交；有开着的交接 issue 就接手，清掉已经等到的事，再从 frontier 里挑任务。`
- zh `shift.s4p` text: `开一个交接 issue，写五段式记忆：做完了什么、卡在哪、下一步、关掉了什么，以及每个非默认决定背后的理由。` → `有没做完的任务，就开交接 issue 转交，写五段式记忆；在等人，就在 Task 里写一行。`

- [ ] **Step 2: Run the gate, then commit**

Run: `node scripts/check-gearbox.js && node --test test/*.test.js` — green.

```bash
git add site/index.html
git commit -m "docs(site): the shift steps follow ADR-0054

The landing page told every shift to open a handoff issue; now a handoff
carries unfinished Tasks and a wait on a person is a line on its Task.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 (controller): Final review and PR

- [ ] Dispatch a final whole-branch review against the spec.
- [ ] Gate green. Push `claude/gearbox-handoff-lifecycle`.
- [ ] Before opening the PR: re-fetch. If #142 (or another protocol PR) has landed an ADR-0054, renumber this ADR to the next free number inside this branch, and update every `ADR-0054` citation in the fence, glossary, ADR statuses and site. Then rehash and rerun the gate.
- [ ] Open the PR: `Closes #<ISSUE_D>`, `Affects downstream: yes`, `Version bump: major` (inside the untagged v2.0.0; `package.json` already `2.0.0`). L1: the maintainer merges by hand. Never merge it as an agent.
