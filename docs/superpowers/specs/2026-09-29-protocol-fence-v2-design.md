# Protocol fence (Gearbox v2) — design

Date: 2026-09-29
Status: approved in session (sections 1–5), pending spec review
Sub-project: A of four structural changes (A fence → then D handoff lifecycle, C ADR numbering, B identity/L1 — each gets its own spec)

## Problem

A downstream audit of three heavy Gearbox users (Mr-Otto, Mandy-s-Bubble-Tea, Mandy-s-Bubble-Tea-App, 2026-09-29) found that the protocol text in a downstream `AGENTS.md` is maintained by hand, and that this is the root of several failures:

- **Silent drift.** `gearbox-update` never touches `AGENTS.md`; it only writes a "hand-edit these sections" report. Downstreams diverged: one still carries the Chinese-era protocol plus hand-translated additions, another grew ~8 local clauses inside the protocol sections. Nothing can re-align them mechanically.
- **False sync signal.** `gearbox-version` reports "✅ fully synced" by counting ADR files only, and in the same run prints "behind by patch". `gearbox-update` returns early when no ADR is missing and never bumps `.gearbox-version` (`scripts/gearbox-update` ~L873), so two downstreams are stuck at v1.15.0 forever while the weekly sync Action reports success. v1.15.1/v1.15.2 changed no protocol file at all (site/README only), yet bumped the protocol version.
- **Unbounded growth.** Mr-Otto's `AGENTS.md` grew from 21 KB to 324 KB in six weeks (≈100k tokens injected into every Claude Code session via `@AGENTS.md`); 91% is "Where to find things". Codex reads only the first 32 KiB by default and silently drops the rest.

## Goals

1. The protocol text in every repo is byte-identical to upstream's for its version, rewritten by tooling, never merged by hand.
2. "Synced" means the protocol content matches upstream (hash), not "every ADR file exists".
3. A hand edit to the protocol text, an oversized `AGENTS.md`, or a CI/Gate mismatch turns CI red in the downstream repo.
4. Existing v1 downstreams migrate through the normal `update` path, without silently losing any local rule.
5. Done = gearbox v2.0.0 released, and Mandy-s-Bubble-Tea-App, Mr-Otto and Mandy-s-Bubble-Tea migrated with merged PRs and a green protocol check. The other six downstreams migrate via their own `update` / sync Action runs.

## Non-goals

Handoff lifecycle (D), collision-free ADR numbering (C), identity roster and L1 approval path (B), enforcing the downstream→upstream feedback loop beyond a warning, upstreaming Mr-Otto's local mechanisms, Gate prelude/runtime definitions, `prune` #141. Protocol *semantics* do not change in this sub-project — only where the text lives and how it is kept in sync.

## Approach

Chosen: **an in-file fence.** The protocol body sits inside `AGENTS.md` between two HTML-comment markers; `CONTEXT.md` gets the same treatment for protocol terms. Tooling replaces the fenced block wholesale.

Rejected:
- *Separate managed file + pointer from `AGENTS.md`* — tools that don't follow imports (Codex, Cursor) would only see a pointer; Claude Code's `@` import is tool-specific. Breaks "AGENTS.md is the single source every agent reads".
- *Generated `AGENTS.md` from source parts* — agents edit `AGENTS.md` directly by habit; their edits would be clobbered or turn CI red, and every rule change needs a build step.

## 1. File layout

### `AGENTS.md` (downstream and upstream alike)

```
# <Project>

<one-sentence intro>

> This file is the single source of truth for ALL AI coding agents, whatever the tool (Claude Code, Z Code, Cursor, Codex, etc.). Rules live here and only here.
> The block between the `gearbox:protocol` markers is the Gearbox protocol, managed by `gearbox-agents` — don't edit it. Project rules go in the sections outside it.

## Tech stack
## Hard rules                     (project rules only)
## Gate                           (fenced code block with the gate command + optional project notes)
## Maintainer                     (GitHub account: `<username>`)
<!-- gearbox:protocol v2.0.0 sha256:<12 hex>; managed by gearbox-agents, do not edit by hand; project additions go in "## Local protocol extensions" -->
## Working agreement (multi-agent)
### On starting a shift …
### While working
### Roles of issues & PRs
### PR disposition …
### Changing the protocol itself …
### Gate contract …
### On ending a shift …
### Parallel shifts …
### Branch hygiene (optional)
### Division of labor
<!-- /gearbox:protocol -->
## Local protocol extensions
## Division of labor              (the project's choice)
## Where to find things           (one line per entry)
```

Rules:
- Nothing inside the fence is project-specific. `<maintainer>` placeholders become "the maintainer (see `## Maintainer`)". The gate command moves to the project `## Gate` section; the fence keeps only the Gate *contract*.
- The ADR-0018 note ("a clause marked **Hard rule** counts as part of the Hard rules section and is L1") moves into the fence, covering clauses inside and outside it.
- Clauses that only apply downstream say so ("(downstream repos) 4. Run `npx gearbox-agents version` …").
- Unknown extra top-level `##` sections a project adds are allowed; they live after `## Division of labor`.
- Upstream Gearbox uses the same skeleton. Its upstream-only rules (the `Affects downstream` declaration; protocol version numbering, tagging and npm publish) move to its own `## Local protocol extensions` as "Upstream release process (Gearbox repo only)".

`## Local protocol extensions` entry format:

```
### <name>

- Extends: <fenced section it extends or replaces>
- Upstream: <owner/repo#N | project-specific | undecided>

<rule text>
```

The section opens with a note: each extension is tiered as if it were written into the section it extends (ADR-0006/0012).

### `CONTEXT.md`

```
# Domain context — <Project>

<intro line>

<!-- gearbox:glossary v2.0.0 sha256:<12 hex>; managed by gearbox-agents, do not edit by hand; project terms go in "## Project terms" -->
## Protocol terms
| Term | Definition | Notes |
…
<!-- /gearbox:glossary -->

## Project terms
| Term | Definition | Notes |
|---|---|---|
```

### Marker grammar

- Begin line, alone on its line: `<!-- gearbox:(protocol|glossary) v<semver> sha256:<12 lowercase hex>; <free text without "--"> -->`
- End line, alone on its line: `<!-- /gearbox:(protocol|glossary) -->`
- Content = the lines strictly between the two marker lines.
- Normalization before hashing: CRLF → LF, strip trailing spaces/tabs on every line, drop leading and trailing blank lines of the block.
- Hash = first 12 hex chars of sha256 of the normalized content (same width as the ADR-0021 stamp).
- A duplicate, unbalanced or nested marker is a hard error, never a guess.
- Both fences in a repo carry the same version (the protocol version). Changing either fence upstream bumps both markers' version; the hash is content-only.

### Versions

- **Protocol version** = the version in the markers = the package version at which fence content last changed.
- The package version (`package.json`, git tag) may move on its own for site/README/tooling-only releases without touching the markers.
- Downstream `.gearbox-version` keeps its single-line format and records the protocol version; it must equal the marker version.
- **Synced** = both fence hashes and marker versions equal upstream's, and no upstream ADR is missing.

## 2. Tooling

### `scripts/lib/fence.js` (new)

`findFence(text, name)`, `normalize(content)`, `hashContent(content)`, `renderFence(name, version, content)`, `replaceFence(text, name, block)`. Used by every tool below and by `check-gearbox.js`.

### `gearbox-agents check` (new: `scripts/gearbox-check`, bin route `check`)

Read-only and offline. Exit 1 on any error; warnings print but don't fail. Downstream CI and the upstream self-check share its assertions (the shared logic lives in `scripts/lib/protocol-check.js`).

Errors:
1. `AGENTS.md` has exactly one protocol fence; `CONTEXT.md` has exactly one glossary fence.
2. Each fence's content hash equals its marker hash. The message names the fix: move project rules to `## Local protocol extensions`, then re-apply upstream's fence with `npx gearbox-agents update --force`.
3. Marker versions are equal and match `.gearbox-version` (downstream only).
4. `AGENTS.md` ≤ 32768 bytes (UTF-8, matching Codex's default `project_doc_max_bytes`). The message lists per-section sizes and suggests `docs/INDEX.md`.
5. Required project headings exist as whole lines: `## Tech stack`, `## Hard rules`, `## Gate`, `## Maintainer`, `## Local protocol extensions`, `## Where to find things`. Required fence headings exist: `## Working agreement (multi-agent)`, `### On starting a shift`, `### While working`, `### Roles of issues & PRs`, `### PR disposition`, `### Changing the protocol itself`, `### Gate contract`, `### On ending a shift`. Heading matching is by line and level, never by substring.
6. `CLAUDE.md` is exactly `@AGENTS.md`; `HANDOFF.md` does not exist; protocol files are not gitignored (ADR-0037, when inside git).
7. `.github/workflows/ci.yml` contains every non-empty line of the `## Gate` command block. This is new for downstream; today only upstream checks it for itself.

Warnings:
- A `### ` entry under `## Local protocol extensions` without an `Upstream:` line, or with `Upstream: undecided`.
- The `## Maintainer` account is still the `<maintainer>` placeholder.

### `.github/workflows/gearbox-check.yml` (new, tool-owned)

Runs on `pull_request` and on `push` to the default branch; `permissions: contents: read`; one job `protocol` with `actions/checkout@v5`, `actions/setup-node@v5` (node 24), `npx -y gearbox-agents@2 check`. It is a separate file so tools never have to edit the project's `ci.yml`.

### `gearbox-install`

- Assembles the skeleton and copies both fences verbatim from the upstream files.
- Fills `## Gate` (from `--gate`, else placeholder) and `## Maintainer` (from `--maintainer` / prompt, else placeholder).
- The title comes from `--name`, else the basename of `git remote get-url origin`, else the directory name (fixes #133).
- Writes `ci.yml` (unchanged shape), `gearbox-sync.yml` (now pinned to `gearbox-agents@2`) and `gearbox-check.yml`.
- All `mustReplace` transforms on protocol text are deleted; anchor coupling remains only for the skeleton.
- ADR copying and the existing-file guards (ADR-0038/0039/0040) are unchanged.

### `gearbox-update`

- **v2 layout** (fences present):
  - If a local fence's hash ≠ its marker hash, refuse and print the diff. `--force` overwrites and saves the diff into the report.
  - Otherwise, when upstream's hash or version differs, replace both fences.
  - Copy missing ADRs (unchanged).
  - Always write `.gearbox-version` = the upstream protocol version, even when nothing else changed (fixes the early-return bug).
  - Commit to `docs/gearbox-backfill-<date>`. The report lists fence changes and ADRs; there is no hand-edit checklist.
- **v1 layout** (no fence): run the migration (section 4) on the same branch naming.
- `AGENTS_MD_IMPACT` and `check-gearbox.js` assertion #9 are removed.

### `gearbox-version`

Reports per fence one of: `synced`, `behind` (untampered, upstream hash/version differs), `hand-edited`, or `v1 layout` (run `update` to migrate). Also reports the ADR detail as today and a size warning above 32 KiB. The overall "synced" status requires both fences synced and no missing ADR, so contradictory lines can no longer print.

### Workflow templates

`gearbox-sync.yml`: `npx -y gearbox-agents@2 update --refresh-drift` (major pin instead of `@latest`). The migration rewrites an existing downstream copy's `@latest` → `@2`.

### Upstream `check-gearbox.js`

- Runs the shared protocol-check assertions against the Gearbox repo itself, except `.gearbox-version`.
- Upstream protocol fence ≤ 20480 bytes, keeping ≥ 12 KiB headroom for project content under 32 KiB.
- **Version rule:** if either fence's content differs from the latest tag's (a v1 tag without fences counts as different), the marker version must equal `package.json`'s version. Skipped outside git or without tags.
- The existing assertions stay, adapted to the new anchors: required files, CLAUDE shell, `package.json` `files`, `Affects downstream`, CI == Gate sameness, never-ignored, no HANDOFF.
- Assertion #9 (impact map) is removed.

### Tests (new, zero dependencies)

- `test/*.test.js` on `node:test`:
  - fence parse/normalize/hash/replace, and error cases;
  - `install` into a temp dir, then `check` passes;
  - `update` in the synced / behind / hand-edited / `--force` cases;
  - migration of three fixture shapes: near-template, local additions, Chinese-era protocol.
- Fixtures are synthetic. They mimic the shapes of the audited repos but copy no content from them (two are private).
- Gate command becomes `node scripts/check-gearbox.js && node --test test/*.test.js`. The glob is expanded by the shell, not by Node: this works on Node 18–24, whereas Node 22 rejects a directory argument. It also never scans `.claude/worktrees/`, which a bare `node --test` would do — the same local/CI gate mismatch Mr-Otto#30 hit.

## 3. Protocol text changes inside the fence

Only changes the fence forces; no rule semantics change.

- **Fence head:** the fence is the Gearbox protocol, identical in every repo; downstreams change it only via `update`; project deviations go in `## Local protocol extensions`. It also carries the ADR-0018 hard-rule-designation note.
- **On starting a shift, step 4 (downstream repos):** run `npx gearbox-agents version`. `behind` → run `update`. `hand-edited` → move the local rules to Local protocol extensions; never edit the fence.
- **While working, two new bullets:**
  - Never edit between the gearbox markers. Project rules go in project sections; protocol additions go in `## Local protocol extensions` with `Extends:` and `Upstream:`.
  - "Where to find things" entries are one-line pointers; `AGENTS.md` ≤ 32 KiB (enforced by `check`); longer maps go in `docs/INDEX.md`.
- **Changing the protocol itself:**
  - Opening paragraph: in the Gearbox repo the fence is edited under the tiers below; in a downstream repo it arrives only through upstream releases, and local deviations go in `## Local protocol extensions`, tiered as if written into the section they extend (ADR-0006/0012, unchanged criterion).
  - The tier table adds `## Maintainer` to L1.
  - Every `<maintainer>` becomes "the maintainer (`## Maintainer`)"; ADR-0034/0042 semantics are unchanged.
  - The upstream-only "Downstream backfill" and "Protocol version number" paragraphs move to Gearbox's own local extensions. The fence keeps a receiving-end paragraph: protocol updates arrive by pull (start-of-shift step 4, the optional weekly `gearbox-sync` Action) as a `docs/gearbox-backfill-*` PR; merging it is L1 in that repo.
  - The test-type gate and Gate-boundary paragraphs stay as they are.
- **Gate contract** (renamed from "Gate"): the command lives in `## Gate`. CI's `gate` job runs it byte-for-byte, and the `gearbox-check` job runs `gearbox-agents check`. Both must be green to merge and before shift-end.
- **On ending a shift, rule 1:** the gate and the protocol check are green.
- **Branch hygiene:** drop the upstream-only "(in this repo you can run `node scripts/gearbox-prune` directly)".
- **Division of labor:** one line — the project declares it in `## Division of labor` (ADR-0008); absent → claim-based ownership. The three-option explanation moves into install's skeleton placeholder.
- **Glossary fence:** existing protocol terms, plus three new ones: protocol fence, local protocol extension, protocol check. "Dogfood" moves to Gearbox's project terms, and the gate row drops the hardcoded `check-gearbox.js`.
- **Budget:** the fence is expected at ≈18 KB, under the 20 KiB upstream budget.

## 4. Migration v1 → v2

Triggered by `update` when `AGENTS.md` has no protocol fence. It works on `docs/gearbox-backfill-<date>`, so an open migration PR also suppresses the weekly sync Action's run. It never merges anything.

**Known-lines set.** Shipped as `scripts/lib/v1-known-lines.json`, built by a dev script from:
- `AGENTS.md` at every v1 tag;
- the Chinese-era `AGENTS.md` revisions in history (before `9408efa`);
- the downstream-flavored text that v1.15.2 `gearbox-install` generates.

Lines are normalized: trimmed, and the maintainer name replaced with `<maintainer>`. A heading-alias table (including the Chinese-era headings) maps each v1 `###` heading to its section. The same is built for `CONTEXT.md` terms.

Classification rules, fixed so every run classifies the same way:
- **Recognized heading:** a `###` heading under `## Working agreement` is recognized when its text, with any trailing parenthetical removed (both `(...)` and `（...）`), case-insensitively starts with an alias-table key.
- **Unknown line:** any line not in the known-lines set after normalization. A known line that a downstream edited in place (e.g. text appended to a step) is therefore unknown as a whole: it is carried over whole, and the fence restores the original.
- **The > 50% rule** counts non-blank lines of the subsection, heading excluded.
- **Protocol region:** from `## Working agreement (multi-agent)` (or its alias) up to the next `## ` heading.

**`AGENTS.md` mapping:**

| v1 location | goes to |
|---|---|
| Title, intro, `## Tech stack`, project bullets of `## Hard rules` | kept (known template lines, e.g. the old blockquote and the ADR-0018 note, are dropped) |
| Code block in `### Gate` | `## Gate` |
| Unknown lines in `### Gate` (project gate notes) | `## Gate`, below the command |
| Maintainer name in the v1 protocol text | `## Maintainer` |
| Unknown lines inside a recognized v1 subsection | `## Local protocol extensions` → `### From v1: <section>`, with `Extends: <section>` and `Upstream: undecided` |
| Subsection with an unrecognized heading (e.g. a project's worktree discipline, a DB-migration procedure) | moved verbatim to `## Local protocol extensions`, with `Upstream: undecided` added |
| Recognized subsection whose lines are > 50% unknown (translated or rewritten) | not carried over (that would duplicate the whole protocol); flagged in the report for manual review, with the command to view the old text (`git show <pre-migration commit>:AGENTS.md`) |
| Customized `### Division of labor` | `## Division of labor` |
| Other unknown top-level sections | kept, after `## Division of labor` |
| `AGENTS.md` still > 32 KiB after assembly | "Where to find things" body moved to `docs/INDEX.md`; `AGENTS.md` keeps four pointer lines (`CONTEXT.md`, `docs/gearbox-adr/`, `docs/adr/`, `docs/INDEX.md`) |

**Other files:**
- `CONTEXT.md`: known protocol term rows are removed and replaced by the glossary fence; the remaining rows go under `## Project terms`. Known terms whose definition was edited locally are listed in the report.
- `.gearbox-version` → `v2.0.0`; `gearbox-check.yml` is created; `gearbox-sync.yml` `@latest` → `@2`.

**Report (PR body):**
- what moved where;
- carried-over lines;
- subsections flagged for manual review;
- `CONTEXT.md` changes;
- index move with byte counts;
- the `check` result on the migrated tree;
- a manual TODO checklist.

A failing `check` is listed as a TODO; the PR's `gearbox-check` job stays red until it is fixed.

**Invariant:** every unknown line in the v1 protocol region ends up in `## Gate`, in `## Local protocol extensions`, or named in the report. Nothing disappears silently; the pre-migration text stays in git history.

### The three repos

| Repo | Expectation |
|---|---|
| Mandy-s-Bubble-Tea-App | Near-template; fully automatic; first, to validate the tool. |
| Mr-Otto | Local additions carried into extensions; gate notes into `## Gate`; the 295 KB index moves to `docs/INDEX.md`. Assembled size is estimated at 30–33 KB; if over, trim by hand (keep rules, point to ADRs for detail). |
| Mandy-s-Bubble-Tea | Chinese-era protocol: most subsections flagged. Compare section by section against the Chinese-era template and extract the genuine local rules into extensions (e.g. the "only assign Stan what only Stan can do" criterion, and start-of-shift step 5 `/msg`, marked as Claude Code-specific). |

## 5. Process, ADRs, release

- **Shift start:** read and close the context-only handoff #138. Open a gearbox issue carrying the audit evidence; the PR closes it.
- **ADR-0050 — protocol text is a tool-managed fence:** layout, markers, update/version semantics, the protocol/package version split, migration.
  - Amends ADR-0017 (update now rewrites fences), ADR-0022 (skeleton + fence copy replaces text transforms), ADR-0023 (version/stamp semantics) and ADR-0013/0026 (no hand-edit report; pull trigger unchanged).
  - Makes ADR-0032 explicit: the fence is English; project sections may use any language.
- **ADR-0051 — protocol check job and the 32 KiB budget:**
  - `check`, `gearbox-check.yml`, the Gate contract wording, the size budgets, the one-line index, and the `Upstream:` warning.
  - Amends ADR-0049: the sync workflow is pinned to `@2`.
- **Tier: L1.** This changes the Gate command, rewrites "Changing the protocol itself", moves the Hard-rules note, and deletes gate assertion #9. The Gearbox repo has a second collaborator, so under ADR-0042 approval is a PR comment `agreed` from `real-stanyan`.
- **PR body:** `Version bump: major` (`package.json` → 2.0.0) and `Affects downstream: yes` (every downstream migrates to the v2 layout via `update` or the sync Action).
- **After merge:**
  1. The author agent pushes the annotated tag `v2.0.0`.
  2. The maintainer runs `npm publish`; the downstream `gearbox-check` jobs need `@2` on npm.
  3. Migrate App → Mr-Otto → Mandy web, one PR per repo, each through that repo's own L1 flow.

## Risks

- **Misclassified local rule.** Mitigated by the invariant above, the manual-review list and human review of each migration PR; git history keeps the old text.
- **The 32 KiB hard red blocks an unrelated downstream PR.** This is intended: `AGENTS.md` bloat must be dealt with where it happens.
- **`npx` fetch failure in CI.** Transient; re-run the job.
- **Third-party adopters on `@latest` sync receive a migration PR.** It is reviewable, never auto-merged; new installs are pinned to `@2`.
- **Rollback.** Revert the Gearbox PR and publish a fix release (npm unpublish is restricted); downstream migration PRs revert individually.

## Success criteria

- Gearbox gate green, including the new tests.
- `npx gearbox-agents@2 install` produces a tree that passes `check`.
- `update` migrates all three fixture shapes per section 4.
- v2.0.0 tagged and published.
- The three downstream migration PRs are merged, with `gearbox-check` green, `AGENTS.md` ≤ 32 KiB, `gearbox-agents version` reporting synced, and every manual-review item resolved or explicitly deferred with an issue.
