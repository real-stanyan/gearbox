# ADR-0041: TTY output budget — the logo stays on screen

- Date: 2026-07-22
- Status: accepted
- Related: ADR-0035 (TUI animation layer — this extends its design rules)

## Context

The tool family opens every interactive run with the pixel logo (ADR-0035, ~15 rows), but several commands then printed one line per item — `gearbox-version`'s 40-line per-ADR sync listing, `gearbox-update`'s 40-line "Already skipped" wall. On a normal terminal the walls scrolled the logo off screen immediately, defeating the point of rendering it, and the per-item lines carried no actionable information (every line said "fine").

The maintainer's call: gearbox commands should follow one principle — as few output lines as possible, so the logo is still visible when the command finishes.

## Decision

**TTY output budget**: on an interactive terminal, a gearbox command's post-logo output stays compact enough that the logo is still on screen at exit (roughly: logo ~15 rows + output ≤ ~10 rows fits a default 24–30-row terminal).

Rules of thumb, in force for every current and future tool in the family:

1. **Per-item walls collapse into one line** — a gradient progress bar (`tui.progress`) with a count-carrying done-note, or a single dim summary line. The bar is presentational: results are computed first, the bar only replays them (ADR-0035 rule 3).
2. **Only actionable lines get their own rows**: errors (`tui.fail`), drift warnings, to-copy/to-do listings, prompts. "Everything is fine" is one line, never N.
3. **Piped/CI output keeps the full per-item listing** — the budget is a TTY-only presentation rule; non-TTY output semantics never change (ADR-0035 rule 2).

## Consequences

- `gearbox-version` (PR #90) and `gearbox-update` (PR #94, then the scan bar) already conform; future tools inherit the rule via the design-rules header in `scripts/lib/tui.js`.
- Detail is not lost: full listings remain one `| cat` away, and agents (non-TTY shells) always see them.
- Tier = **L2** (tooling presentation principle; references no L1 mechanism); Version = **minor** (new protocol clause, ADR-0023).
- Provenance: Gearbox ADR-0041.
