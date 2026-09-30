# Collision-free project ADR IDs (Gearbox v2) — design

Date: 2026-09-30
Status: approved in session; implementation plan to follow (`docs/superpowers/plans/2026-09-30-adr-issue-ids.md`)
Sub-project: C of four structural changes. Order: A fence (PR #144) → **C ADR IDs** → B identity/L1 → D handoff lifecycle. All four ship together as v2.0.0; the release is held until D lands.

## Problem

Project ADRs take the next free number (`docs/adr/0001-…`, `0002-…`). Parallel lanes pick that number when they branch, and they can't see each other's branches, so two lanes pick the same number. Each PR is green on its own; the collision only appears once both are on main.

Evidence from the Mr-Otto audit:

- 93 commits in its history do nothing but renumber colliding ADRs. One ADR collided twice and was renumbered 0311 → 0314 → 0316.
- At least 5 of the 14 red runs on main came from two individually green PRs taking the same ADR number.
- Its project ADR-0074 names the real cost. Two colliding files coexist on disk; what breaks is **references**. At one point six `ADR-0068` references pointed at one file and four at the other, and readers had to guess.
- Every ADR is heavily cited: 5767 `ADR-0NNN` references across 1152 files. Renumbering rewrites references, and the audit found rewrites that edited the wrong ones.
- Mr-Otto's workaround, claim-at-merge (its ADR-0074, mirrored upstream in ADR-0048's "renumber your ADR"), moves the race from branch time to merge time. It can't close the race without "require branches to be up to date" protection, which the Mandy repos (free private repos) can't enable. Every claim still means a rewrite commit and a CI rerun.

Another downstream, dryrun, still carries 10 colliding pairs in `docs/adr/`. Mandy-s-Bubble-Tea shows the same failure in another hand-numbered sequence (two `007_` migrations, Mandy#139). That sequence is out of scope here; see Non-goals.

## Goals

1. A new project ADR gets an ID that is unique the moment it is created, with no coordination between lanes.
2. No ADR is ever renumbered, so existing references stay valid.
3. A duplicate ID can't reach main silently: the protocol check turns it red.
4. The protocol fence doesn't grow (net byte change ≤ 0), so the 515 B of headroom stays available for B and D.
5. Existing downstreams need no migration.

## Non-goals

- **Gearbox's own protocol ADRs** (`docs/gearbox-adr/`) keep sequential numbers. Only one upstream line writes them, and downstream copies are cited by those numbers. Their claim-at-merge rule stays, but moves out of the fence (§2).
- **Other hand-numbered sequences**, such as database migrations. The ADR notes that the same reasoning applies (use the issue number or a timestamp); no rule is added.
- **Online verification.** The check stays offline: it doesn't confirm that the issue exists or that it matches the header's `Issue:` line.
- **Dangling-reference detection.** Deciding whether `ADR-0050` means a protocol ADR or a project ADR can't be done reliably.
- **An `adr new` command.** The naming rule is one line; a generator is more surface to maintain and removes no collision.

## Approach

**The ID of a project ADR is the number of the issue that settles it.** GitHub assigns issue numbers from one repo-wide counter, so they are unique without coordination. Every ADR already has an issue: 60 of Mr-Otto's last 60 ADRs name theirs in the header, as do 12 of 18 in Mandy web and 2 of 2 in the App. Rejected alternatives:

- **Date + slug** (`2026-09-30-<slug>.md`): references get long, and a slug can never change.
- **Automated claim-at-merge:** the race and the reference rewrites remain.

## 1. The ID rule

- A new project ADR is `docs/adr/<issue>-<slug>.md`.
  - `<issue>` is the number of the issue that settles the decision, written without zero padding. The missing leading zero is what tells an issue ID apart from an older sequential one (§4).
  - It is cited as `ADR-<issue>`.
  - Its header carries `- Issue: #<issue>`.
- **One decision per issue.** A second decision arising from the same issue gets its own issue.
- **Existing numbered files keep their numbers. No ADR is ever renumbered.**
- **IDs compare as integers**, so `0074-x.md` and `74-y.md` are the same ID, ADR-74. If the issue behind a new decision has a number an older ADR already uses, open a fresh issue for the decision. Issue numbers created from now on are above every existing ADR number in all three audited repos (latest issue/PR numbers on 2026-09-30 vs highest ADR number: Mr-Otto #1429 vs 0333, Mandy web #549 vs 0018, App #366 vs 0003), so this only happens when an ADR comes out of an old issue.

## 2. Protocol text

### Fence, "While working"

Replace:

```
- **Project-owned** architectural decisions go in `docs/adr/` (one decision per file, starting at 0001); protocol ADRs live in `docs/gearbox-adr/`, managed by the gearbox tooling — don't hand-edit them
```

with:

```
- **Project-owned** architectural decisions go in `docs/adr/`, one decision per file, named after the issue that settles it: `docs/adr/<issue>-<slug>.md`, cited `ADR-<issue>` — issue numbers are unique, so parallel lanes never collide; older numbered files keep their numbers, and no ADR is ever renumbered (ADR-0052). Protocol ADRs live in `docs/gearbox-adr/`, managed by the gearbox tooling — don't hand-edit them
```

### Fence, "Parallel shifts"

Delete the bullet "**Protocol changes serialize at merge time**: …". Its only downstream content is renumbering, which project ADRs no longer need. Its remaining content is Gearbox-only (protocol ADR numbers and the version bump) and moves to the Gearbox repo's local extension.

### Budget

Measured: the bullet grows from 203 B to 419 B (+216 B) and the deleted bullet removes 385 B, a net of −169 B. The protocol fence goes from 19965 B to 19796 B, leaving 684 B of headroom. `rehash-fences.js` restamps both markers at v2.0.0; package.json stays 2.0.0, and the release rule allows this because v2.0.0 is still untagged.

### Gearbox's own `## Local protocol extensions` → "Upstream release process (Gearbox repo only)"

Add a paragraph:

```
**Parallel protocol PRs** (ADR-0048/0052): protocol ADR numbers and the version bump are claimed at merge, not at branch time. Before merging: re-fetch; if a competing protocol PR landed first, renumber your ADR and recompute the version (latest tag + segment, ADR-0028) inside your PR, then merge.
```

### ADRs

- New **ADR-0052** "Project ADRs are named after the issue that settles them". It records the Problem evidence, the rule, the rejected alternatives, the check (§4), and the generalization to other hand-numbered sequences.
- **ADR-0048**'s Status line gains: `amended by ADR-0052: project ADRs are named by issue, so only the Gearbox repo claims ADR numbers at merge`.

### CONTEXT.md glossary (fence)

No change. The glossary has no row about ADR numbering (checked: its "claim" row is task claiming, ADR-0047), and the fence line is the rule.

## 3. Templates and scaffolding

- **ADR template** (`docs/gearbox-adr/0001-adr-template.md`):
  - It keeps its own title `# ADR-0001: <decision title>`, because update's ADR parser reads each file's own number from its title.
  - Add `- Issue: #<issue>` under `- Date:`.
  - Add a one-line note: a copy in a project repo is named `docs/adr/<issue>-<slug>.md` and titled `# ADR-<issue>: …`; in the Gearbox repo, a protocol ADR takes the next number.
  - Only the header changes.
- **Skeleton placeholder** (`scripts/lib/skeleton.js`, both occurrences): `` - `docs/adr/` — this project's own architectural decisions, one file per decision named `<issue>-<slug>.md` (not listed here one by one) ``. The index no longer enumerates ADRs; `docs/adr/` is their index. Two parallel PRs that each append an index line conflict textually, so this removes a merge-conflict hotspot.
- **install's closing hint** (`scripts/gearbox-install`, "Write your first own decision to …"): name `docs/adr/<issue>-<slug>.md` and say it is named after the issue that settles it.
- **README:** any sentence that describes `docs/adr/` numbering follows §1.

## 4. The check

Add to `scripts/lib/protocol-check.js`, which runs in both `gearbox-agents check` (downstream CI) and `scripts/check-gearbox.js` (upstream mode):

- For each of `docs/adr/` and `docs/gearbox-adr/`, when it exists:
  - Read the file names matching `^(\d+)-.+\.md$`.
  - Parse the leading integer, so `0074` = `74`.
  - Group by it. A group with more than one file is a duplicate.
  - Files without a leading number (README, notes) are ignored.
- **`docs/adr/`: new duplicates fail, old ones warn.** A leading zero marks an older sequential ID, and no leading zero marks an issue ID (§1).
  - A duplicate group with at least one issue-ID file (no leading zero) is an error:
    `docs/adr: ADR-74 is used by 2 files: 0074-foo.md, 74-bar.md — name a new ADR after the issue that settles it (a fresh issue if that number is taken); never renumber an ADR that is already cited (ADR-0052)`
  - Duplicate groups made only of zero-padded files are older collisions. The only fix for those is renumbering, which breaks cited references, and the new rule stops them from recurring. They produce **one** summary warning, not an error:
    `docs/adr: older ADR numbers used by more than one file: ADR-45 (0045-a.md, 0045-b.md); ADR-46 (…) — references to them are ambiguous; new ADRs are named after their issue, so this can't recur (ADR-0052)`
  - Evidence that this split is needed: dryrun, one of the stamped downstreams, carries 10 such older pairs today (two `0045-…` files, two `0046-…`, and so on). As a hard error they would turn it red on arrival with no acceptable fix.
- Error text, `docs/gearbox-adr/` (every duplicate is an error; the numbers there are upstream's and unique):
  - Downstream: `… these copies are managed by gearbox-agents: delete the stray file and rerun \`npx gearbox-agents update\``.
  - Upstream: `… protocol ADR numbers are claimed at merge: renumber yours (Upstream release process)`.
- **When a duplicate is caught:**
  - With issue IDs, a duplicate needs two PRs settling the same issue.
  - A PR's check runs on the PR merged into main as it stood when the check ran. If the other PR landed first, the second PR goes red before merge. Otherwise the push-to-main run goes red at once.
  - Either way it is loud, never silent.
- **Downstream impact:** checked across all seven stamped downstreams on 2026-09-30 (`docs/adr/` and `docs/gearbox-adr/`). Mr-Otto (334 IDs), Mandy web (18), App (2), delphione_admin (2), mandys-selfheal (0) and Blackbox (5) have no duplicates. dryrun has 10 older pairs, which produce one warning. The new assertion turns nobody red on arrival.
- **Tiering:** a new, stricter assertion is L2 (ADR-0010). The fence edits make the PR L1 regardless.

## 5. Migration and downstream impact

- No migration: existing files keep their numbers, and new files follow §1.
- The v1 fingerprint already knows the old "starting at 0001" line, so the v1→v2 migration replaces it with the fence as usual.
- Mr-Otto carries a local "claim at merge" rule (its ADR-0074, carried by the migration as a `From v1` extension). With this change it is obsolete, and its manual migration pass deletes it.

## 6. Testing (`node:test`)

- **protocol-check**, one test each:
  - `0074-a.md` + `74-b.md` in `docs/adr/` → one error that names both files;
  - `1266-a.md` + `1266-b.md` → an error;
  - `0045-a.md` + `0045-b.md` → no error, and one warning that names both files;
  - distinct IDs → no error;
  - `README.md` and a non-numbered file → ignored;
  - a duplicate in `docs/gearbox-adr/` → an error carrying the downstream fix text;
  - in upstream mode → the upstream fix text.
- **check-gearbox:** the real repo still passes; the fence budget and hashes are covered by existing tests.
- **install:** the closing hint and the placeholder name `<issue>-<slug>.md`. Assert the placeholder text in the skeleton test.
- The gate stays `node scripts/check-gearbox.js && node --test test/*.test.js`.

## 7. Process

- Protocol gap issue for C, then ADR-0052, then a PR into `main`.
  - Branch `claude/gearbox-adr-issue-ids`, cut from #144's head so it has A's code. Its PR opens against `main` once #144 has merged.
  - L1: approval is real-stanyan's `agreed` PR comment (ADR-0042). Sub-project B revisits this path.
- `Version bump: major` is already declared by #144. This PR declares `Version bump: none — lands inside the unreleased v2.0.0 (package.json stays 2.0.0)`.
- `Affects downstream: yes` — the fence text changes, and the check gains an assertion.

## Risks and trade-offs

- **IDs are sparse and not contiguous.** Order by date comes from the `Date:` line, not from the ID.
- **An agent might keep numbering sequentially out of habit.** The resulting IDs are still unique, so nothing collides. The fence line and the template steer agents to the rule; the check can't tell the difference and doesn't try.
- **GitHub dependency.** IDs come from the issue tracker. Gearbox is already built on GitHub issues and PRs, and GitLab numbers its issues the same way.
