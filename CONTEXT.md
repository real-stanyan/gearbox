# Domain context — Gearbox

Domain glossary. All agents' understanding of domain terms is grounded here; code naming stays consistent with the terms defined here.

## Terms

| Term | Definition | Notes |
|---|---|---|
| single source of truth | Rules are written in exactly one place (`AGENTS.md`); other agent configs (e.g. `CLAUDE.md`) only `@`-reference it, never copy it | Prevents rules from drifting across multiple locations |
| empty-shell contract | `CLAUDE.md`'s content is exactly one line, `@AGENTS.md` — a physical guarantee that Claude Code and Z Code read the same rules | The structural self-check script asserts this |
| handoff | One agent passes a task to another agent — **this only happens the moment an issue closes / a PR merges**, never mid-task | It isn't a handoff just because things were "explained clearly" — it's a handoff only when the issue closes |
| protocol gap | A question the repo's persistent artifacts (AGENTS.md / ADR / CONTEXT.md) can't answer | Hitting one requires opening an issue — silent judgment calls are not allowed |
| The three issue roles | The three non-overlapping uses of issues/PRs in this protocol: **Task** / **Memory** (handoff memory) / **Protocol gap** | Every issue should fall into exactly one of these — see AGENTS.md |
| gate | The command that must be all-green before ending a shift. In this repo: `node scripts/check-gearbox.js` | CI runs the same command — red means no merge |
| Dogfood | This repo develops itself using the protocol it defines | It's a verification method, not the goal itself |
| L1/L2 tiers | Two authorization tiers for protocol changes: **L1 strict tier** (Hard rules / Gate / Tech stack / the "Changing the protocol itself" section itself) requires explicit maintainer agreement before merging; **L2 autonomous tier** (the rest of Working agreement / indexes) the agent can merge on its own | ADR-0006; boundary criteria in ADR-0012 |
| Mechanism reference (criterion) | Any new content that references L1/L2, Hard rules, Working agreement, or other protocol mechanisms (by keyword or semantic dependency) is treated as L1 | ADR-0012, "mechanism reference takes priority"; guards against using "optional + pure addition" as an L2 loophole to expand the protocol |
| Memory five-part format | The minimum valid format for a handoff comment: ① what's done ② what's blocked ③ what's next ④ close the issue if the task is complete ⑤ rationale/trade-offs (write "none" if no decision was made) | ADR-0004; missing any item makes the handoff invalid |
| terminal shift | The form a shift ends in when archiving / confirming there's no next shift: a handoff issue may be skipped, but the last closed issue must explicitly declare "no next shift" + a reason. Repo-level, not lane-level — invalid while another lane is still live | ADR-0009; a silent ending doesn't count as terminal; repo-level scope per ADR-0048 |
| blocking edge | A literal `Blocked by: #N` line in a dependent Task issue's body, declaring one prerequisite Task per line | ADR-0044; a hygiene convention — a stale edge costs a judgment call, not a violation |
| frontier task | An open Task issue with no open blockers — the only kind of task a shift may claim; when a blocker closes, its dependents join the frontier | ADR-0044 |
| claim | Self-assignment on a Task issue (`gh issue edit <N> --add-assignee @me`), first wins; a "claiming this" comment where assignment isn't possible. An open frontier task with no assignee and no claim comment is free | ADR-0047; single-human repos may skip — the value begins at the second human |
| lane | One shift plus the tasks it has claimed; parallel shifts are allowed iff lanes are disjoint (each works only on frontier tasks it claimed) | ADR-0048; handoff issues are per-lane |
| context-only handoff | A handoff issue whose lane finished with nothing to transfer — kept for its Memory comment, closed by its first reader after reading | ADR-0048 |
| downstream | A project that copies this Gearbox protocol and then evolves independently; sync status is self-checked downstream via `gearbox-version` (pull-primary, ADR-0026 — the upstream fleet dashboard was retired in ADR-0033) | See ADR-0026 |
| backfill | Downstream pulls Gearbox protocol improvements into its local copy; **pull-triggered** — downstream runs `gearbox-version` at the start of a shift to self-check, and `gearbox-update` if it's behind, with no dependency on upstream pushing; it's alignment, not enforcement — downstream can decline | ADR-0013 → ADR-0026 (push-triggered was downgraded to pull-triggered) |
| protocol version number | A semver-variant tag: **major** = cross-tool/cross-repo contract change; **minor** = a new mechanism added; **patch** = revision of an existing file. Every protocol PR declares a `Version bump`; the author tags after merge; the downstream local version is recorded in the `.gearbox-version` stamp (written and read by tooling) | ADR-0023; baseline v0.0.0 |

## Key invariants

- `AGENTS.md` is always the single source of rules; `CLAUDE.md` is always just the `@AGENTS.md` empty shell
- No `HANDOFF.md` is created — handoffs happen via issue comments (append-only, timestamped)
- The gate command must be byte-identical in AGENTS.md and ci.yml (CI == Gate contract)
- One agent completes a task from start to finish; handoffs only happen at task boundaries
