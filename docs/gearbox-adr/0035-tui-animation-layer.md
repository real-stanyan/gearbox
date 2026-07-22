# ADR-0035: shared TUI animation layer; gearbox-version rewritten bash → node

- Date: 2026-07-22
- Status: accepted
- Related: ADR-0016 (gearbox-version adoption — the bash implementation choice is superseded here, the algorithm is not), ADR-0022 (gearbox-install), ADR-0017 (gearbox-update), ADR-0028 (npx dispatcher)

## Context

The tool family's output was functional but flat. The maintainer wants the install/version/update experience to carry the project's identity (the pixel gear-G logo) and read as a polished product, not a build log. Constraints that shape any solution:

- **Zero runtime dependencies** is a Tech stack hard constraint — no `ora`/`chalk`/`ink`; everything must be raw ANSI escapes.
- Agents and CI pipe these commands constantly — escape garbage in logs is unacceptable.
- `gearbox-version` was bash (ADR-0016); bash cannot reasonably share an animation library with the node tools.

## Decision

1. **`scripts/lib/tui.js`** — a shared zero-dependency animation library: truecolor gradient text, braille step spinners, gradient progress bars, a typewriter line, and the pixel logo (baked from the project logo PNG as a 26×28 half-block grid with a 4-color palette: bone/steel/iron greys + amber). Logo animation = grey pixels dissolve in (ease-out), the amber bar sweeps left→right, a gradient wordmark + tagline type in beside it.
2. **Every animation is TTY-gated**: `stdout.isTTY` false (CI, pipes, agent shells) degrades each helper to the previous plain-text output — content of the plain lines is kept byte-compatible with the pre-animation output wherever possible.
3. **Animations are presentational**: real work runs inside or before each animated wrapper; spinners only add a minimum display duration. No behavior, output semantics, or exit codes change.
4. **`gearbox-version` is rewritten bash → node** so it can share the library. The port keeps the ADR-0016 algorithm (provenance-first matching), the ADR-0021 hash-stamp comparison, the ADR-0027 upstream addressing (including offline-skip exit 0), and all output lines byte-identical in non-TTY mode (verified by diffing old/new output in a sandbox downstream). `bin/gearbox.js` routes `version` to node. ADR-0016's *algorithm* stands; only its *implementation language* is superseded.
5. All three user-facing commands open with the full logo show (maintainer's explicit call: identity over the "high-frequency commands animate less" default; the logo takes ~1.5s and only renders on interactive TTYs).

## Consequences

- One place (`tui.js`) owns palette + motion; tools stay thin.
- The Tech stack section loses its Bash line (L1 edit, ADR-0006), and gearbox-install's Tech-stack + Where-to-find-things anchors were synced in the same PR (anchor contract, ADR-0022 — same string-coupling class as ADR-0031/0034).
- npm ships the lib automatically (`files` already includes `scripts/`); the npx path needs no change beyond the ROUTES cmd.
- Agents' shift-start `gearbox-version` runs are non-TTY → zero added latency, unchanged parseable output.
- Tier = **L1** (Tech stack edit rides in the PR); Version = **minor** (new mechanism: the TUI layer). Collapses into the pending untagged v1.4.0 (ADR-0023 catch-up), `package.json` untouched.
- **Considered but not adopted**: keeping bash and shelling out to a node helper for each animation (two languages coordinating cursor state — brittle); a `--no-anim` flag / `NO_COLOR` support (YAGNI until someone asks — TTY gating already covers automation); shipping the logo PNG and decoding at runtime (asset weight + decode cost for zero visual gain over baked cells).
