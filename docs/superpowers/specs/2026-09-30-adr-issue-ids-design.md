# Collision-free project ADR IDs (Gearbox v2) — design

Date: 2026-09-30
Status: approved in session; implementation plan to follow (`docs/superpowers/plans/2026-09-30-adr-issue-ids.md`); amended by the final review (arrival list)
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
  - `<issue>` is the number of the issue that settles the decision, written without zero padding. The check gives padding no meaning (§4).
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
- **Subagent template** (`docs/subagent-system.md`, the Doc-Walker prompt): name the ADR after its issue and never renumber one, instead of taking the next integer; don't add it to AGENTS.md's "Where to find things", because `docs/adr/` is its index. Its decision-record and ADR-template paths point at `docs/gearbox-adr/`.
- **README:** any sentence that describes `docs/adr/` numbering follows §1.

## 4. The check

Add to `scripts/lib/protocol-check.js`, which runs in both `gearbox-agents check` (downstream CI) and `scripts/check-gearbox.js` (upstream mode):

- For each of `docs/adr/` and `docs/gearbox-adr/`, when it exists:
  - Read the file names matching `^(\d+)-.+\.md$`.
  - Parse the leading integer, so `0074` = `74`.
  - Group by it. A group with more than one file is a duplicate.
  - Files without a leading number (README, notes) are ignored.
- **`docs/adr/`: duplicates recorded on arrival warn; every other duplicate fails.** Zero padding can't tell an older collision from a new one: two lanes that keep numbering by habit both write `0334-….md`. So the check ignores padding and reads an arrival list instead.
  - The list, `docs/adr/older-duplicates.md`, records the duplicate groups a repo already had when it adopted issue-numbered ADRs; only the arrival writes it (§5). Its name doesn't match the ID pattern, so it is never an ADR itself. It holds a short intro paragraph, then one line per group:
    `- ADR-45: 0045-gearbox-v1.4.0-rebuild.md, 0045-meter-all-llm-ops.md`
    The check reads the lines matching `^- ADR-(\d+): (.+)$`; the file names are comma-separated and trimmed.
  - A group is **listed** only when the list has a line for its ID and every file of the group is on that line. A third file joining a listed group makes it unlisted. A line whose group no longer exists is ignored.
  - An unlisted group is an error, whatever its padding:
    `docs/adr: ADR-74 is used by 2 files: 0074-foo.md, 74-bar.md — name a new ADR after the issue that settles it (a fresh issue if that number is taken); never renumber an ADR that is already cited (ADR-0052)`
  - Listed groups are older collisions. The only fix for those is renumbering, which breaks cited references. They produce **one** summary warning, not an error:
    `docs/adr: older duplicate ADR numbers, recorded in docs/adr/older-duplicates.md: ADR-45 (0045-a.md, 0045-b.md); ADR-46 (…) — references to them are ambiguous and they stay as they are (ADR-0052)`
  - Evidence that older collisions need the list: dryrun, one of the stamped downstreams, carries 10 such older pairs today (two `0045-…` files, two `0046-…`, and so on). As a hard error they would turn it red on arrival with no acceptable fix.
  - A legacy date-named layout (`2026-01-05-….md`) parses as its year, so ADRs from the same year share an ID. Its arrival-time collisions are recorded like any others, and new ADRs follow issue naming.
  - The ID logic lives in one module, `scripts/lib/adr-ids.js`: `duplicateAdrIds`, the list's path, its reader and its writer. A `docs/adr` that isn't a directory holds no ADRs.
- Error text, `docs/gearbox-adr/` (every duplicate is an error; the numbers there are upstream's and unique):
  - Downstream: `… these copies are managed by gearbox-agents: delete the stray file and rerun \`npx gearbox-agents update\``.
  - Upstream: `… protocol ADR numbers are claimed at merge: renumber yours (Upstream release process)`.
- **When a duplicate is caught:**
  - With issue IDs, a duplicate needs two PRs settling the same issue, or two lanes numbering by habit.
  - A PR's check runs on the PR merged into main as it stood when the check ran. If the other PR landed first, the second PR goes red before merge. Otherwise the push-to-main run goes red at once.
  - Either way it is loud, never silent.
- **Downstream impact:** checked across all seven stamped downstreams on 2026-09-30 (`docs/adr/` and `docs/gearbox-adr/`). Mr-Otto (334 IDs), Mandy web (18), App (2), delphione_admin (2), mandys-selfheal (0) and Blackbox (5) have no duplicates. dryrun has 10 older pairs; its migration records them, so they produce one warning. The new assertion turns nobody red on arrival.
- **Tiering:** a new, stricter assertion is L2 (ADR-0010). The fence edits make the PR L1 regardless.

## 5. Migration and downstream impact

- No renumbering: existing files keep their numbers, and new files follow §1.
- **The arrival writes the list** (§4), only when the repo's `docs/adr/` has duplicate groups and no list file is there yet:
  - The v1 → v2 migration (`scripts/gearbox-update`, `planMigration`) writes it as one more migration file. It is committed in the migration commit, and the recovery hint (`git add` / `git clean`) and a resumed same-day run treat it like the other migration files. The report's migration section and the migration record in the commit message say "Recorded N older duplicate ADR numbers in `docs/adr/older-duplicates.md` (ADR-0052)".
  - install writes it when the target already has such groups, and names it in its output.
  - A repo already on v2 never gets one from update: after arrival, every new duplicate is an error.
- The v1 fingerprint knows both old "starting at 0001" lines. The protocol bullet goes with the fence as usual. The "Where to find things" line (``- `docs/adr/` — this project's own architectural decisions (starting at 0001, human-authored)``) sits in a project section, which the migration used to carry through unchanged. It now replaces every known `docs/adr/` index line with the v2 line (`DOCS_ADR_LINE`, exported once by `scripts/lib/skeleton.js`) before the index is kept or moved, so neither AGENTS.md nor `docs/INDEX.md` keeps "starting at 0001". A project's own `docs/adr/` line stays as written.
- Mr-Otto carries a local "claim at merge" rule (its ADR-0074, carried by the migration as a `From v1` extension). With this change it is obsolete, and its manual migration pass deletes it.

## 6. Testing (`node:test`)

- **protocol-check**, one test each:
  - `0074-a.md` + `74-b.md` in `docs/adr/` → one error that names both files;
  - `1266-a.md` + `1266-b.md` → an error;
  - `0045-a.md` + `0045-b.md` → an error without the list; listed, no error and one warning that names both files;
  - an unlisted zero-padded pair (`0334-a.md` + `0334-b.md`, on top of 333 older ADRs) → an error, and `0074-x.md` + `0074-y.md` with no list → an error;
  - a third file joining a listed group → an error;
  - an unpadded listed pair → the warning; a list line whose group no longer exists → ignored;
  - one run with an unlisted group and a listed one → the error and the warning;
  - what `renderOlderDuplicates` writes is what `readOlderDuplicates` reads, with names comma-separated and trimmed (CRLF too);
  - a `docs/adr` that isn't a directory → no ADRs, no throw;
  - distinct IDs → no error;
  - `README.md` and a non-numbered file → ignored;
  - a duplicate in `docs/gearbox-adr/` → an error carrying the downstream fix text;
  - in upstream mode → the upstream fix text;
  - `gearbox-check --help` names the duplicate-ID check.
- **update:**
  - a v1 tree with `docs/adr/` duplicates → the list is written and committed in the migration commit, the report and the migration record name it, the check exits 0 with one warning, and a resumed same-day run's report keeps the line;
  - a v1 tree without duplicates → no list;
  - a failed migration commit → the recovery hint's `git add` and `git clean` name the list, and `--force-redo` records it again;
  - a v2 repo that gains a duplicate → update writes no list, and its report shows the error.
- **migration (index line):** migrating `test/fixtures/v1.15.2-install/` yields an AGENTS.md that holds `DOCS_ADR_LINE` and not "starting at 0001", against the test fences and against this repo's real ones; an oversize-index migration yields a `docs/INDEX.md` without "starting at 0001"; a project's own `docs/adr/` line is kept.
- **check-gearbox:** the real repo still passes; the fence budget and hashes are covered by existing tests.
- **install:** the closing hint and the placeholder name `<issue>-<slug>.md`. Assert the placeholder text in the skeleton test, as `DOCS_ADR_LINE`. A target with `docs/adr/` duplicates gets the list and passes the check with one warning; without duplicates, or with a list already there, install writes none.
- The gate stays `node scripts/check-gearbox.js && node --test test/*.test.js`.

## 7. Process

- Protocol gap issue for C, then ADR-0052, then a PR into `main`.
  - Branch `claude/gearbox-adr-issue-ids`, cut from #144's head so it has A's code. Its PR opens against `main` once #144 has merged.
  - L1: approval is real-stanyan's `agreed` PR comment (ADR-0042). Sub-project B revisits this path.
- `Version bump: major` is already declared by #144. This PR declares `Version bump: none — lands inside the unreleased v2.0.0 (package.json stays 2.0.0)`.
- `Affects downstream: yes` — the fence text changes, and the check gains an assertion.

## Risks and trade-offs

- **IDs are sparse and not contiguous.** Order by date comes from the `Date:` line, not from the ID.
- **An agent might keep numbering sequentially out of habit.** One such ADR is still unique, but two lanes doing it collide again (both write `0334-….md`), and those habit-made duplicates fail the check like any other: padding exempts nothing, and only the groups recorded on arrival warn. The fence line, the template and the subagent prompt steer agents to the rule.
- **GitHub dependency.** IDs come from the issue tracker. Gearbox is already built on GitHub issues and PRs, and GitLab numbers its issues the same way.
