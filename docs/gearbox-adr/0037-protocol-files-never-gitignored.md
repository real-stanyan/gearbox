# ADR-0037: Protocol files must never be gitignored

- Date: 2026-07-22
- Status: accepted
- Related: ADR-0003 (issues/PRs as the shared conversation carrier — same premise), ADR-0023 (`.gearbox-version` stamp file, the likeliest ignore victim), ADR-0026 (pull-triggered backfill — `gearbox-version` runs at shift start, making it the right downstream warning point)

## Context

The protocol's premise is that **the repo is the only shared memory between shifts**. Yet nothing — no rule text, no tooling — said protocol files must stay committed. An agent could add `.gearbox-version` to `.gitignore` (treating the stamp as tool-generated cruft, the way lockfiles sometimes get ignored), or even `AGENTS.md` itself, and the protocol dies silently: the files exist in that agent's working tree but never reach the next shift's clone.

Existing backstop was partial and upstream-only: CI runs on a checkout, so this repo's `check-gearbox.js` required-file assertions would go red if a committed protocol file vanished. But downstream repos don't run `check-gearbox.js` (their gate is their own `--gate` command), and `.gearbox-version` wasn't asserted anywhere — it doesn't exist upstream at all.

Committing this class of file is also plain industry practice: CI workflows, lint configs, lockfiles, `CLAUDE.md` — team-shared configuration goes in the repo; `.gitignore` is for regenerable artifacts and machine-private files. The protocol files are all in the first category.

## Decision

Protected list: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/gearbox-adr/`, `.gearbox-version`, `.github/workflows/ci.yml`. Three layers:

1. **Rule text** (AGENTS.md, While working): one clause — protocol files stay committed, never added to `.gitignore`, with the list and the why.
2. **Upstream gate assertion** (`check-gearbox.js`): `git check-ignore -q` each protected path; any match fails the gate. `check-ignore` matches `.gitignore` patterns even for paths that don't exist yet, so `.gearbox-version` is guarded upstream despite never being written there. Skipped when not inside a git repo.
3. **Downstream warning** (`gearbox-version`): the same `check-ignore` sweep at the pull-trigger moment (shift-start self-check, ADR-0026), printed as a loud ⚠ block. Warn-only — the script is a read-only quick-check and keeps exit 0; enforcement downstream stays with the rule text and the humans/agents reading the warning.

## Considered, not adopted

- **A folder rename (`docs/` → `gearbox/`, or a `/gearbox` container dir) to signal ownership** — the load-bearing files are root-anchored by cross-tool contract (`AGENTS.md` is what every agent tool reads at the root; `CLAUDE.md` likewise; `ci.yml` is a GitHub-fixed path), so a container dir can't actually contain them; `docs/adr/` is the project's own decisions, not Gearbox's, and would be mislabeled by a `gearbox/` parent; and a layout change is a major bump (ADR-0023) with downstream migration for zero functional gain. Ownership signaling stays with the `gearbox-` name prefix (ADR-0031's dual ADR directories already separate protocol ADRs from project ADRs).
- **Failing (exit non-zero) in `gearbox-version` on a match** — the script's contract is read-only informational (it even exits 0 when offline, ADR-0027); turning it into a gate would surprise every existing caller.
- **A check in `gearbox-install`** — install usually runs before the target has a `.gitignore` (or even a git repo), so there's rarely anything to catch; the shift-start check covers the window where an ignore pattern actually appears.

## Consequences

- Upstream, a stray ignore pattern goes red in CI immediately. Downstream, it surfaces as a ⚠ at every shift start until removed — visible, not blocking.
- Downstream repos get the warning only via the npm package (`npx gearbox-agents version`), i.e. after the next publish.
- Tier: the new AGENTS.md clause is Working-agreement content referencing no protocol mechanism, and the gate change adds a new stricter assertion (ADR-0010) — both **L2**. Version bump: **minor** (new protocol clause + new tooling behavior).
