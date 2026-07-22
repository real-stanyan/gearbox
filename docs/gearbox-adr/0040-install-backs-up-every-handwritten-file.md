# ADR-0040: install backs up every hand-written file it would overwrite

- Date: 2026-07-22
- Status: accepted
- Related: ADR-0039 (the AGENTS.md backup + merge-notice pattern this generalizes), ADR-0038 (provenance split, unchanged), ADR-0022 (gearbox-install)

## Context

Issue #87. ADR-0039 protected `AGENTS.md` with backup + in-file merge notice, but the install still wrote three other files unconditionally: a hand-written `CONTEXT.md` (project glossary), an existing `.github/workflows/ci.yml` (the project's live CI), and a `CLAUDE.md` with real content — all clobbered with zero backup. Same "user asset" logic, only one file protected. Surfaced in the session review of ADR-0039; maintainer directed the fix before the next npm release.

## Decision

The ADR-0039 pattern becomes a **backup plan** covering every file the install writes over:

| Existing file | Backup name | Merge guidance in the notice |
|---|---|---|
| `AGENTS.md` (hand-written) | `AGENTS-backup.md` | rules → Hard rules / Tech stack sections |
| `CLAUDE.md` (real content) | `CLAUDE-backup.md` | content → AGENTS.md (CLAUDE.md stays the `@AGENTS.md` shell) |
| `CONTEXT.md` | `CONTEXT-backup.md` | glossary entries → below the protocol entries |
| `.github/workflows/ci.yml` | `.github/workflows/ci.yml.bak` | jobs → alongside the gate job |

- **Renames happen in the write phase**, after every preflight/transform `die()` — a refused install still touches nothing.
- **Backup collisions are preflight refusals**: an existing backup file means a previous adoption is unfinished; overwriting it would be the tool's only path to destroying an original. Refusal keeps the no-destruction guarantee absolute.
- **The in-file merge notice lists every backup** with its merge destination; install is complete when the merges are done and the notice is deleted (ADR-0039's completion definition, unchanged).
- **`CLAUDE.md` that is already the `@AGENTS.md` shell is overwritten without backup** — byte-equivalent, nothing to lose.
- **`ci.yml`'s backup keeps a `.bak` extension in place**: GitHub Actions runs any `*.yml`/`*.yaml` in `workflows/`, so a `.yml`-named backup would execute; `.bak` is inert.

## Trade-off accepted

Backing up a live `ci.yml` means the project's CI is dark until the jobs are merged back — the same explicitly-marked half-adopted state ADR-0039 accepted for rules (dormant until merged). The alternative — writing the gate to a second workflow file alongside theirs — would keep their CI live but fork the protocol's `ci.yml` naming contract (ADR-0037's protected list names it) and leave two workflow files with undefined precedence. Consistency with the one-pattern adoption flow wins; the notice makes the dark CI impossible to miss.

## Consequences

- The tool now has zero silent-overwrite paths: every user asset either survives in place (refusal) or survives as a listed backup.
- `.gearbox-version` / `.gearbox-upstream` stay overwrite-without-backup: tool-owned stamps, no hand-written content to lose.
- Tier: **L2** — tool behavior + messages; no protocol-mechanism reference. Maintainer directed in-session (#87). Version bump: **minor** (extends tool behavior + new ADR) — v1.5.0 was never published, so this collapses into the next release target **v1.6.0**; publish happens once, after this lands (maintainer instruction: "fix first, then release").
