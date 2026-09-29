# ADR-0051: A protocol check in every repo's CI, and a 32 KiB budget for AGENTS.md

- Date: 2026-09-29
- Status: accepted
- Related: ADR-0050 (fences), ADR-0002 (self-check as gate), ADR-0010/0020 (gate tiers), ADR-0049 (scheduled sync — amended: major pin, workflow files skipped in Actions, a PR step that fails loudly)

## Context

Downstream CI ran only the project's own gate. Nothing verified the protocol itself: a hand-edited or translated protocol body, a Gate command CI didn't actually run, and an `AGENTS.md` that grew from 21 KB to 324 KB in six weeks all passed.

Every agent loads `AGENTS.md` whole at session start — one repo was paying about 100k tokens per session for it. Codex reads only the first 32 KiB by default and silently drops the rest. The growth was almost entirely "Where to find things": index entries written as paragraphs.

## Decision

- **`gearbox-agents check`** (`scripts/gearbox-check`; the assertions live in `scripts/lib/protocol-check.js`) is an offline, read-only command. Downstream it is the CI job below; upstream, `scripts/check-gearbox.js` runs the same assertions in upstream mode. It fails on:
  1. A missing or edited fence (content hash ≠ marker hash).
  2. Unequal fence versions, or (downstream) a `.gearbox-version` that differs from them.
  3. An `AGENTS.md` over 32768 bytes, counted on LF content as CI checks it out (a `core.autocrlf` checkout adds a byte per line on disk); the message lists the largest sections.
  4. A missing required project section outside the fence, or protocol section inside it — matched by heading level and title, never by substring.
  5. A `CLAUDE.md` that isn't the `@AGENTS.md` shell, a `HANDOFF.md`, or a gitignored protocol file.
  6. A broken CI == Gate contract: `ci.yml` must contain every command line of the `## Gate` block, and the block must not still be the placeholder. The block is read the CommonMark way — the first ``` or ~~~ fence, closed by the same character at least as long. `# comments` are stripped, whole-line and trailing, because downstream Gate blocks annotate their lines.

  Warnings, which don't fail the check: a placeholder maintainer; a local extension without an `Upstream:` value or with `Upstream: undecided`; and, downstream, a `gearbox-check.yml` that is missing or differs from the template (see CI below).
- **CI.**
  - `.github/workflows/gearbox-check.yml` is tool-owned: install writes it, and update rewrites it whenever it differs from the template. It runs `npx -y gearbox-agents@2 check` on pull requests and on pushes to `main`/`master`, with `contents: read`.
  - GitHub refuses a push made with the Actions `GITHUB_TOKEN` that creates or updates a file under `.github/workflows/`, and no `permissions:` key can grant it. So in GitHub Actions (`GITHUB_ACTIONS=true`) update never writes, commits or pushes a workflow file. Each skipped change is an unchecked TODO in the report — run `npx gearbox-agents@2 update` locally after merging — and a `::warning::` line. When workflow changes are all that's pending, update makes no branch and exits 0. Fences, ADRs, the stamp and the v1 migration proceed as usual. Until a local run writes the files, `version` names them and doesn't report "fully synced", and `check` warns about a missing or outdated `gearbox-check.yml` — the shift-start signal an unattended downstream otherwise lacks.
  - A failed push is exit 1: update prints git's decisive lines and the retry command, and keeps the committed branch and the report. It used to print a yellow line and exit 0, so a refused push was a green sync job with no PR, every week.
  - `gearbox-sync.yml`'s PR step prints `::error::` and exits 1 when `gh pr create` fails, where it used to `|| echo` and stay green — ADR-0049's PR step no longer fails silently. A run with no backfill branch still exits 0 ("Nothing to sync"), and after a failed push the step doesn't run at all.
  - The workflow templates (`scripts/lib/workflows.js`: `ci.yml`, `gearbox-sync.yml`, `gearbox-check.yml`) use `actions/checkout@v5` and `actions/setup-node@v5` on Node 24, up from `@v4`. A downstream's existing `ci.yml` is its own and keeps its versions.
  - install writes a simple single-line Gate command into `ci.yml` as a plain `- run:` line. Anything else (several lines, `: `, ` #`, a leading `!`) goes into a `run: |` block, which YAML passes through verbatim.
  - The Gate contract now reads: CI's `gate` job runs the Gate command byte-for-byte; the `gearbox-check` job runs the protocol check; both green to merge and before shift-end.
- **Upstream.** Gearbox's self-check adds the protocol-fence budget and ADR-0050's release rule. That rule compares against the latest tag, so with `CI` set a checkout without tags fails ("CI checkout has no tags — use fetch-depth: 0 on actions/checkout, or the fence version rule has no tag to compare against (ADR-0050)") instead of quietly skipping it. Gearbox's own `ci.yml` checks out with `fetch-depth: 0`.
- **Budgets.**
  - `AGENTS.md` ≤ 32 KiB, matching the Codex default, so every tool sees the whole file.
  - Upstream, the protocol fence itself ≤ 20 KiB, leaving at least 12 KiB for project content.
  - "Where to find things" is one line per entry; longer maps go in `docs/INDEX.md`, which is not auto-loaded.
- **Major pin.** `gearbox-sync.yml` runs `gearbox-agents@2` instead of `@latest`, and update rewrites existing copies (in a local run — see CI above). The scheduled Action never crosses a major on its own. The start-of-shift steps run the unpinned package on purpose, so a new major arrives as a backfill PR that a human merges under L1, or when a human changes the pin.
- **Gate commands.** Gearbox's own gate becomes `node scripts/check-gearbox.js && node --test test/*.test.js`, and `npm test` runs the same: the tools now carry a `node:test` suite. The glob is shell-expanded so it works on Node 18–24 and never scans `.claude/worktrees/`.

## Consequences

- A hand edit inside the fence, a growing `AGENTS.md` or a CI/Gate mismatch turns the PR red where it happens, instead of surfacing weeks later in an audit.
- The 32 KiB line will block unrelated PRs in a repo whose `AGENTS.md` is already too large, until someone moves content out. That is intended: the cost of the bloat is paid every session, so it gets fixed first.
- The check fetches the package via npx in CI. An npm outage makes the job red — rerun it; the check itself never needs the network.
- A shallow CI checkout of the Gearbox repo fails its self-check. Fix the checkout with `fetch-depth: 0`; don't let the rule skip in CI — a skipped release rule is a switched-off one.
- **Don't** raise the byte budget to make a red check go away. Move rationale into ADRs and maps into `docs/INDEX.md`.
