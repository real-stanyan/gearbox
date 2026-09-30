# Domain context — Gearbox

Domain glossary. All agents' understanding of domain terms is grounded here; code naming stays consistent with the terms defined here.

<!-- gearbox:glossary v2.0.0 sha256:935686c8e1e5; managed by gearbox-agents, do not edit by hand; project terms go in "## Project terms" -->
## Protocol terms

| Term | Definition | Notes |
|---|---|---|
| single source of truth | Rules are written in exactly one place (`AGENTS.md`); other agent configs (e.g. `CLAUDE.md`) only `@`-reference it, never copy it | Prevents rules from drifting across multiple locations |
| empty-shell contract | `CLAUDE.md`'s content is exactly one line, `@AGENTS.md` — a physical guarantee that Claude Code and Z Code read the same rules | The protocol check (`gearbox-agents check`) asserts this |
| handoff | One shift passes its unfinished Tasks to another — **complete only when the next shift claims them and closes the handoff issue**, never by conversation | It isn't a handoff just because things were "explained clearly" — ADR-0005/0054 |
| protocol gap | A question the repo's persistent artifacts (AGENTS.md / ADR / CONTEXT.md) can't answer | Hitting one requires opening an issue — silent judgment calls are not allowed |
| The three issue roles | The three non-overlapping uses of issues/PRs in this protocol: **Task** / **Memory** (handoff memory) / **Protocol gap** | Every issue should fall into exactly one of these — see AGENTS.md |
| gate | The command that must be all-green before merging and before ending a shift. Each repo writes its own in the `## Gate` section of AGENTS.md | CI runs the same command (CI == Gate contract) — red means no merge |
| L1/L2 tiers | Two authorization tiers for protocol changes: **L1 strict tier** (Hard rules / Gate / Tech stack / Roster / the "Changing the protocol itself" section itself) requires explicit maintainer agreement before merging; **L2 autonomous tier** (the rest of Working agreement / Division of labor / indexes) the agent can merge on its own | ADR-0006; boundary criteria in ADR-0012 |
| roster | AGENTS.md's `## Roster`: one line per GitHub account — `human` (only that person), `shared` (the person and their agents) or `agent` (only agents, run by a named person); `— maintainer` marks the maintainer's accounts. The human count is the number of distinct people on `human`/`shared` lines; more than one = a multi-human repo | ADR-0053; in a multi-human repo only the maintainer's own merge approves L1 |
| Mechanism reference (criterion) | Any new content that references L1/L2, Hard rules, Working agreement, or other protocol mechanisms (by keyword or semantic dependency) is treated as L1 | ADR-0012, "mechanism reference takes priority"; guards against using "optional + pure addition" as an L2 loophole to expand the protocol |
| Memory five-part format | The minimum valid format for a handoff comment: ① what's done ② what's blocked ③ what's next ④ close the issue if the task is complete ⑤ rationale/trade-offs (write "none" if no decision was made) | ADR-0004; missing any item makes the handoff invalid |
| blocking edge | A literal `Blocked by: #N` line in a dependent Task issue's body, declaring one prerequisite Task per line | ADR-0044; a hygiene convention — a stale edge costs a judgment call, not a violation |
| frontier task | An open Task issue with no open blockers and no `Waiting on:` line — the only kind of task a shift may claim; when a blocker closes, its dependents join the frontier unless waiting | ADR-0044/0054 |
| waiting on | A literal `Waiting on: <person> — <what>` line in a Task body: a next step only that person can take (a merge, a device test, a decision). The Task needs no handoff and is off the frontier until the line is cleared, by the person or by a shift that sees the event happened on GitHub | ADR-0054; one Task per standing debt |
| claim | Self-assignment on a Task issue (`gh issue edit <N> --add-assignee @me`), first wins; a "claiming this" comment where assignment isn't possible. An open frontier task with no assignee and no claim comment is free | ADR-0047; single-human repos may skip — the value begins at the second human |
| lane | One shift plus the tasks it has claimed; parallel shifts are allowed iff lanes are disjoint (each works only on frontier tasks it claimed) | ADR-0048; handoff issues are per-lane |
| downstream | A project that runs the Gearbox protocol: its fences come from upstream releases (`gearbox-agents update`); its own rules live in project sections and `## Local protocol extensions`. Sync status is self-checked via `gearbox-version` (pull-primary, ADR-0026 — the upstream fleet dashboard was retired in ADR-0033) | See ADR-0026; fences per ADR-0050 |
| backfill | Downstream pulls Gearbox protocol improvements; **pull-triggered** — downstream runs `gearbox-version` at the start of a shift and `gearbox-update` if it's behind (or the weekly `gearbox-sync` Action does), which rewrites both fences and copies new protocol ADRs on a backfill branch; it's alignment, not enforcement — merging the PR is the downstream's L1 decision | ADR-0013 → ADR-0026 → ADR-0050 |
| protocol version number | A semver-variant version: **major** = cross-tool/cross-repo contract change; **minor** = a new mechanism added; **patch** = revision of an existing file. Two numbers: the package version (package.json = tag) moves every release; the protocol version (the fence markers, mirrored in downstream `.gearbox-version`) moves only when fence content changes | ADR-0023, split by ADR-0050; baseline v0.0.0 |
| protocol fence | The tool-managed block between `<!-- gearbox:protocol … -->` and `<!-- /gearbox:protocol -->` in AGENTS.md (and `gearbox:glossary` in CONTEXT.md): the Gearbox protocol, byte-identical in every repo for a given protocol version; its marker records the version and a content hash | ADR-0050; downstream never edits it — `gearbox-agents update` rewrites it |
| local protocol extension | A project's addition to the fenced protocol, written as a `###` entry under `## Local protocol extensions` with `- Extends:` and `- Upstream:` lines | ADR-0050; tiered as if written into the section it extends (ADR-0006/0012) |
| protocol check | `gearbox-agents check`: offline, read-only verification that the fences are intact, AGENTS.md is within 32 KiB, required sections exist and CI runs the Gate command | ADR-0051; the `gearbox-check` CI job downstream, inside `check-gearbox.js` upstream |

### Key invariants

- `AGENTS.md` is always the single source of rules; `CLAUDE.md` is always just the `@AGENTS.md` empty shell
- No `HANDOFF.md` is created — handoffs happen via issue comments (append-only, timestamped)
- The gate command must be byte-identical in AGENTS.md and ci.yml (CI == Gate contract)
- One agent completes a task from start to finish; an unfinished task changes hands only through a handoff issue
<!-- /gearbox:glossary -->

## Project terms

| Term | Definition | Notes |
|---|---|---|
| Dogfood | This repo develops itself using the protocol it defines | It's a verification method, not the goal itself |
