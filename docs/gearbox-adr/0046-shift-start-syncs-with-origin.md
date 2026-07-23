# ADR-0046: Shift start syncs with origin before reading history

- Date: 2026-07-23
- Status: accepted
- Related: ADR-0005 (handoff lives in an open issue), ADR-0042 (multi-human L1 path)

## Context

The three start-of-shift steps begin with `git log --oneline -10`, but no step — indeed nothing anywhere in the protocol — requires `git fetch`. On a single machine with one human this is mostly harmless: the local clone is usually current because the same clone did the last shift. In a multi-human (or multi-machine) repo it breaks: colleague A's clone is behind GitHub, the agent reads stale history, checks issues that don't mention the newest merges, and runs the gate green against an old baseline. The staleness surfaces only at PR time as a conflict — or worse, never surfaces, and a protocol decision gets made against outdated protocol text (AGENTS.md itself is version-controlled; reading a stale clone means reading stale *rules*).

The repo is the only shared memory between shifts; a shift that doesn't sync is reading somebody's cached copy of that memory.

## Decision

Step 1 of "On starting a shift" gains a sync prefix, before any history reading:

1. `git fetch origin`
2. Fast-forward the local default branch to `origin/<default>` (`git pull --ff-only` while on it).
3. **Fast-forward impossible = the local default branch has diverged** (direct local commits never pushed). Stop, open an issue (Protocol gap or Task as appropriate) describing the divergence, and don't start work on a forked base. Divergence on the *default branch* is always a protocol anomaly — normal work happens on task branches (see "While working").

Only then `git log --oneline -10` and the rest of the existing steps.

## Consequences

- Multi-human staleness is caught at minute zero of the shift instead of at PR time. Single-human single-machine repos pay one `git fetch` (near-free, and `gearbox-prune`'s stale-ref pass already assumed fetching is routine).
- Offline shift start: `git fetch` fails loudly; the agent knows it's working from a possibly-stale snapshot and can say so, instead of not knowing. The protocol doesn't forbid offline work — it forbids *unknowing* staleness.
- Tier = **L2**: edits "On starting a shift" (Working agreement, not Gate — ADR-0006).
- Version = **minor** (protocol clause + new ADR, ADR-0023).
- **Considered, not adopted**: auto-merging origin into a diverged local default (hides the anomaly the stop-and-report exists to surface); a tooling wrapper (`gearbox-sync`) — two git commands don't warrant a tool, and the failure mode (diverged) needs judgment, not automation; putting the check in the gate script (the gate also runs in CI, where checkouts are always fresh — the assertion would be theater there and the gate stays structural).
