# ADR-0023: Protocol Version Number — a semver Variant Tag Plus a Downstream Stamp

- Date: 2026-07-19
- Status: accepted
- Related: ADR-0013 (B-3 backfill), ADR-0016/ADR-0017/ADR-0021/ADR-0022 (the tool family and the hash stamp)

## Context

Issue #49 (maintainer session instruction). Sync granularity was previously only "per-ADR + hash stamp" — precise enough to answer "which specific ones am I missing," but with no coarse-grained human-readable summary: a downstream project that wants to know "how far behind am I, how heavy is this backfill" has to read a list of 20+ lines one by one; there was also no "which version did you copy" label for outside observers.

Candidate options (discussed in session):

- **a. A semver variant, with the segment mapped to impact weight** (chosen)
- b. Segment by L1/L2 — a semantic mismatch: L1/L2 is an **authorization** tier, not an **impact** tier (a Gate command flag change is L1 but has zero downstream impact); using authorization as a stand-in for impact sends the wrong signal
- c. A monotonically increasing v1/v2 — zero judgment cost but throws away the weight signal, degenerating into a counter that duplicates the ADR numbering

## Decision

### Semantics (a semver variant)

- **major**: a cross-tool/cross-repo contract change — the hash stamp format (ADR-0021), the install anchor structure (ADR-0022), file layout, a rename. Downstream backfill needs manual intervention
- **minor**: a new mechanism added — a new ADR, a new tool, a new protocol clause. Downstream needs to read the new content
- **patch**: a revision to an existing file — wording, a status line, a typo. Downstream just recopies
- Baseline: **master 809693d is tagged `v0.0.0`**; history is not backfilled with tags

The value of the segment: downstream glances at `v0.4.2 → v0.5.0` and immediately knows the weight of the backfill (patch = just recopy, minor = read the new ADR, major = needs manual intervention) — which lines up neatly with gearbox-version's existing three detection categories (missing / drift / contract).

### Tag flow

- The PR template gains a required field `Version bump: major|minor|patch|none`; `none` needs one sentence of justification — the same declaration pattern as `Affects downstream` (ADR-0013)
- After merge, the **author agent** tags an annotated tag based on the latest tag at merge time (`git tag -a v0.x.y -m "one-line summary"`) and pushes it. Using the merge-time tag as the base is naturally serial, with no concurrency conflict
- **No CHANGELOG is maintained** — the tag message plus the ADRs are the change record; no need to build it twice

### Downstream stamp

- Downstream root gets `.gearbox-version`, one line with the version number (e.g. `v0.1.0`)
- **Written by tools, read by tools, not maintained by humans**: `gearbox-install` writes the current upstream version at install time; `gearbox-update` updates it after a successful backfill; `gearbox-version` reads it and compares against upstream's latest tag (`git describe --tags --abbrev=0`), printing a one-line summary "upstream vX / local vY (behind by N segment)"
- A missing stamp file (existing downstream projects like Blackbox) does not error; it prompts "will be written automatically on the next backfill" — no manual backfill required
- The existing per-ADR + hash comparison **is kept as-is**: the version line is a summary, the detailed list is still the source of truth; a falsely reported stamp would naturally be exposed by the detailed list

## Consequences

- Downstream can tell at a glance how far behind it is and how heavy the backfill will be; external releases get a version label
- Every protocol PR adds one segment judgment plus one tag operation — the criterion is objective (touches a contract = major / adds something = minor / revises = patch), the cost is low
- The gate adds no assertion: the tag is created after merge, so CI can't check it; the backstop is the PR template's required field plus the maintainer's after-the-fact veto
- Failure mode of forgetting to tag: the next PR's author, using "the latest tag at merge time" as its base, will naturally catch up the gap (taking the heavier of the two PRs' segments), so the version number stays monotonic; if a missed tag is discovered, open a Protocol gap issue per the protocol
- **Tiering**: this touches the PR merge process (Working agreement) + the PR template + protocol files, classified **L1** under ADR-0006/ADR-0012; issue #49 + this ADR + a PR, initiated by maintainer session instruction, confirmed before merge
