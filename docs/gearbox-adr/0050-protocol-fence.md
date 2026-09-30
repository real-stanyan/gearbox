# ADR-0050: The protocol body is a tool-managed fence in AGENTS.md / CONTEXT.md

- Date: 2026-09-29
- Status: accepted; amended by ADR-0053 (`## Maintainer` → `## Roster`)
- Related: ADR-0017 (update never touched AGENTS.md — amended), ADR-0022 (install transforms — replaced), ADR-0023 (version stamp — amended), ADR-0028 (`GEARBOX_UPSTREAM_VERSION` — no longer the stamp's source), ADR-0013/0026 (hand-edit report — retired; pull trigger kept), ADR-0032 (protocol language), ADR-0049 (scheduled sync — its accepted stamp lag is gone), ADR-0051 (the protocol check)

## Context

A 2026-09-29 audit of three downstream repos found that downstream protocol text was maintained by hand, and that this caused four failures.

- **Drift.** `gearbox-update` only printed a checklist of AGENTS.md sections to edit. One downstream still carried the Chinese-era protocol plus hand-translated additions; another grew about eight local clauses inside the protocol sections. Nothing could re-align them mechanically.
- **A false sync signal.** `gearbox-version` counted ADR files, so it printed "✅ fully synced" and "behind by patch" in the same run. `gearbox-update` returned early when no ADR was missing, without bumping `.gearbox-version`, which left two downstreams at v1.15.0 while their weekly sync Action reported success.
- **Version noise.** v1.15.1 and v1.15.2 changed no protocol file, yet moved the protocol version every downstream compares against.
- **Unbounded growth.** One `AGENTS.md` reached 324 KB, loaded in full into every session.

ADR-0049 drew a line — "tooling never writes AGENTS.md" — to keep automation at *prepared, reviewable* and never *applied*. That line protected against the wrong thing. The review net was always the PR, not the author of the edit, and hand edits turned out to be the main source of divergence.

## Decision

The protocol lives in two fenced blocks: `gearbox:protocol` in AGENTS.md and `gearbox:glossary` in CONTEXT.md. Both are byte-identical in every repo for a given protocol version.

- **Markers** (`scripts/lib/fence.js`).
  - Begin: `<!-- gearbox:<name> vX.Y.Z sha256:<12 hex>; … -->`. End: `<!-- /gearbox:<name> -->`. Each sits alone on its line.
  - The hash is the first 12 hex chars of sha256 of the content, normalized (LF, no trailing whitespace, no blank edges).
  - Both markers carry the protocol version; downstream `.gearbox-version` equals it.
  - A malformed, duplicate, unbalanced or nested marker is an error, never a guess.
- **Layout** (`scripts/lib/skeleton.js`).
  - Project sections sit outside the fence: `## Tech stack`, `## Hard rules`, `## Gate` (the command), `## Maintainer` (the GitHub account), `## Local protocol extensions`, `## Division of labor`, `## Where to find things`.
  - The fence contains no project value: `<maintainer>` placeholders become "the maintainer (`## Maintainer`)", and the Gate command becomes the Gate *contract*.
  - Upstream Gearbox uses the same skeleton. Its upstream-only release rules are its own local extension.
- **Local protocol extensions.** A project's deviation goes in `## Local protocol extensions` as a `###` entry with `- Extends:` and `- Upstream:` lines. It is tiered as if it were written into the section it extends (ADR-0006/0012 unchanged). Downstream repos never edit the fence.
- **Tooling.**
  - `gearbox-install` assembles the skeleton and copies the fences verbatim; its protocol-text transforms are gone.
  - `gearbox-update` rewrites each fence that differs from upstream's, on a `docs/gearbox-backfill-*` branch. It refuses a hand-edited fence (content hash ≠ marker hash) unless `--force`; the overwritten lines then go into the report.
  - `gearbox-update` refuses to **downgrade** a fence, even with `--force`: a local marker semver-greater than upstream's means the upstream is stale (an old `~/Github/gearbox` checkout, an older npx package, a `.gearbox-upstream` remote that's behind). `--force` re-applies over hand edits, never over a newer fence. The hint names the refresh for the upstream actually in use.
  - `gearbox-version` reports each fence as synced / behind / NEWER than upstream / hand-edited / v1 layout / only one fence present. It says "fully synced" only when both fences are synced, no ADR is missing or revised, the stamp is current — judged by its first line — and update would write no tool-owned workflow file (ADR-0051).
- **The stamp is the protocol version.** `install` writes the fence's version to `.gearbox-version`. `update` parses the stamp once and rewrites it unless it is exactly `vX.Y.Z\n` (CRLF aside) for upstream's protocol version. It does this on every run, even when nothing else moved — the early return that stranded downstreams at v1.15.0 is gone. ADR-0028's `GEARBOX_UPSTREAM_VERSION` (the package version under npx) no longer drives the stamp; `version` keeps it only as a fallback for an upstream that predates fences.
- **Two version numbers.**
  - The package version (package.json = tag) moves every release.
  - The protocol version (the markers) moves only when fence content changes, and then equals that release's package version.
  - The release rule (`scripts/lib/fence-release.js`) is shared by the upstream self-check and `scripts/dev/rehash-fences.js`, so the check and the fix can't disagree:
    - fence content changed since the latest tag ⇒ both markers carry package.json's version, and package.json is semver-greater than the tag;
    - unchanged ⇒ the markers keep the version in the tag's markers — not the tag's name, which a README-only release moves past it;
    - no tags ⇒ skipped, except in CI, where a tagless checkout fails (ADR-0051).
  - Rehash stamps what the rule expects. It refuses, writing nothing, only when fence content changed but package.json isn't bumped past the tag.
- **Migration from v1** (`scripts/lib/migrate-v1.js`, run by `update` when AGENTS.md has no fence).
  - Project content keeps its place. The maintainer named in the v1 protocol text goes to `## Maintainer`, the v1 Gate command to `## Gate`.
  - Lines of the old protocol region that aren't known upstream text are carried into `## Local protocol extensions`. The "known" test uses a hashed fingerprint of every AGENTS.md/CONTEXT.md line upstream published through v1, plus each v1 installer's output (`scripts/lib/v1-known-lines.json`; `scripts/dev/build-v1-known.js` builds it and is the source of truth for what it covers).
  - Unrecognized subsections move there whole.
  - Subsections more than half unknown (translated or rewritten) are flagged for a human rather than duplicated.
  - An oversized index moves to `docs/INDEX.md`, appended to an existing one.
  - `CONTEXT.md`: a protocol-term row that is upstream's text word for word is removed under any heading — the glossary fence carries it. A protocol term in the project's own words is removed, and reported as edited, only under a v1 template heading. Anywhere else it stays and is reported as a collision, since a product may mean something else by "gate" or "claim". A `## Project terms` section always exists.
  - **Refused before anything is written:**
    - code fences that don't pair up — a `MigrationError` naming the line to fix, since everything after an unclosed fence would read as code;
    - only one fence present (one file fenced, the other not) — markers lost from a v2 tree, or an interrupted migration. `update`, `version` and `check` give the same advice: restore the missing markers from git history or, after an interrupted migration, the v1 file, then rerun `update`;
    - an uncommitted or untracked AGENTS.md / CONTEXT.md, whose v1 text must stay in git history;
    - an untracked `docs/INDEX.md` that the index would be appended to;
    - no AGENTS.md at all (run `install` instead).
  - Nothing disappears silently: every unknown line is carried or named in the report. The report (the PR body) is written before any commit, so a failed git step (a hook, gpg) can't lose it. The recovery hint lists exact files, never a directory that would sweep a user's own untracked files into `git add`.
- **Language.** The fence is English (ADR-0032). Project sections may use any language.

## Consequences

- A downstream protocol update is a mechanical rewrite reviewed in a PR, not a merge task. Future protocol changes reach every downstream through the existing pull path with no per-section checklist.
- A README- or tooling-only release no longer moves the protocol version, the fences or the stamp. A changed `gearbox-check.yml` template still yields a workflow-only change (an existing `gearbox-sync.yml` is only ever re-pinned, never rewritten): a local `update` run makes a backfill branch (and PR) for it, and in the sync Action it is skipped (ADR-0051). ADR-0049's accepted stamp lag is gone too — the stamp follows the protocol version, and every `update` run writes it.
- ADR-0049's boundary moves from "tooling never writes AGENTS.md" to "tooling writes only between the markers, and only on a branch": prepared and reviewable, never applied. The exception is the one-time v1 migration, which rewrites both files on the same kind of branch. The supply-chain exposure is unchanged in kind — the sync Action already ran package code with write access. Pinning `@2` (ADR-0051) removes the surprise-major part of it once the pin is written.
- A stale upstream can't downgrade a downstream: `update` refuses and `version` says NEWER. The fix is refreshing the upstream, never `--force`.
- Local rules can no longer hide inside the protocol text. They are visible, tiered, and labeled with their upstream status — the raw material for folding generic ones back upstream.
- The first migration of each existing downstream needs one human pass over the flagged items. Repos installed in the Chinese era get the most flags. `scripts/dev/migrate-preview.js` previews a migration without touching the repo.
- A stamp that passes the protocol check but isn't exactly `vX.Y.Z\n` is rewritten, so such a repo gets one stamp-only backfill PR. That is by design: one parse, one form. `version` treats the stamp as current by its first line, while `update` compares bytes — so a stamp missing only its trailing newline gets that one-time stamp-only PR even though `version` reports synced.
- **Don't** reintroduce per-project text inside the fence (names, commands, paths). One such line breaks byte-identity for every downstream.
