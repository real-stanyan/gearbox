# ADR-0039: install auto-backs-up a hand-written AGENTS.md and proceeds

- Date: 2026-07-22
- Status: accepted
- Related: ADR-0038 (the provenance split this amends — its hand-written branch is superseded, the fingerprint split itself stands), ADR-0022 (gearbox-install)

## Context

ADR-0038 gave hand-written-AGENTS.md projects a correct adoption path, but kept it manual: the guard refused and printed `mv AGENTS.md AGENTS.md.bak` → re-run → merge. Maintainer decision (issue #85, in-session): the manual `mv` friction isn't worth what it buys. The rename is **non-destructive** — the user's file survives byte-identical under a new name; nothing is deleted, which is what separated this from the rejected overwrite-prompt path (ADR-0038's worst case was data loss; this path has none).

## Decision

The hand-written branch of the guard now acts instead of refusing:

- **No fingerprint** (hand-written): rename `AGENTS.md` → `AGENTS-backup.md`, proceed with the normal install, and make "merge your rules from `AGENTS-backup.md` into the generated Hard rules / Tech stack sections, then delete the backup" the **first** Next step in the closing output.
- **In-file merge notice**: the generated `AGENTS.md` additionally carries a ⚠️ blockquote at its very top stating the same task (merge from `AGENTS-backup.md` → delete the backup → delete the notice). Rationale: the terminal output is ephemeral, but `AGENTS.md` is auto-loaded by every agent tool — the notice guarantees the next shift (human or agent) encounters the unfinished merge without anyone pointing at it. **The install is defined as complete when the notice is gone**; while it's present, the project is in an explicitly-marked half-adopted state.
- **`AGENTS-backup.md` already exists**: hard refusal — a previous adoption is unfinished (merge or remove the backup first). A backup is never overwritten, so repeated runs can't silently eat the original file.
- **Fingerprint found** (Gearbox-made): unchanged refusal — use `gearbox-update`.

The rename happens in the write phase (first step, before `AGENTS.md` is written), not in preflight: every earlier `die()` — missing anchors, bad flags — still exits with the target untouched.

## Trade-off accepted

The refusal was a consent gate: agent tools auto-read `AGENTS.md`, so the moment it's renamed the project's own rules go dormant until a human merges them — and the manual `mv` forced a human to be in that loop. Auto-backup removes that gate; an agent running install on the user's behalf displaces the user's ruleset in one step. Accepted knowingly (maintainer call): the file itself is never lost, the collision guard blocks compounding, the merge reminder is the loudest line of the closing output, and README's agent instructions still tell agents to ask the user before installing over a hand-written file — consent moves from the tool to the agent instructions.

## Consequences

- Adoption is one command: install backs up, scaffolds, and points at the merge step.
- `AGENTS.md.bak` (ADR-0038's suggested name) is replaced by `AGENTS-backup.md` as the tool-written name.
- ADR-0038's "Considered, not adopted — overwrite prompt" reasoning is untouched: there is still no interactive destructive question and no data-destroying path in the tool.
- Tier: **L2** — tool guard behavior + messages; no protocol-mechanism reference; AGENTS.md protocol body untouched. Maintainer explicitly directed it in-session regardless. Version bump: **minor** (new tool behavior + new ADR), target v1.5.0.
