# ADR-0052: Project ADRs are named after the issue that settles them

- Date: 2026-09-30
- Issue: #145
- Status: accepted
- Related: ADR-0048 (parallel shifts — amended: only the Gearbox repo claims ADR numbers at merge), ADR-0051 (protocol check), ADR-0010 (gate-assertion tiers), ADR-0044/0047 (frontier claiming)

## Context

Project ADRs took the next free number. Parallel lanes pick that number when they branch and can't see each other's branches, so two lanes pick the same one. Each PR is green alone; the collision appears only once both are on main. ADR-0048 answered by claiming the number at merge and renumbering if a competing PR landed first. That moves the race to merge time without closing it: closing it needs "require branches to be up to date" protection, which free private repos can't enable, and every claim costs a rewrite commit plus a CI rerun.

The downstream audit put numbers on it. Mr-Otto has 93 commits that do nothing but renumber ADRs (one ADR moved 0311 → 0314 → 0316), and at least 5 of its 14 red runs on main were two green PRs taking the same number. The colliding files coexist fine. The damage is to references: Mr-Otto cites ADRs 5767 times across 1152 files, a collision splits those citations between two files, and renumbering rewrites them, sometimes the wrong ones. Another downstream still carries 10 colliding pairs.

## Decision

- A project ADR is named after the issue that settles it: `docs/adr/<issue>-<slug>.md`, cited `ADR-<issue>`, with `- Issue: #<issue>` in its header. The number is written without zero padding. GitHub numbers issues from one repo-wide counter, so the ID is unique the moment the issue exists, and no lane coordinates with any other.
- One decision per issue: a second decision from the same issue gets its own issue.
- Older sequentially numbered ADRs keep their numbers, and no ADR is ever renumbered. IDs compare as integers (`0074` = `74`). When a decision's issue number is already taken by an older ADR, the decision gets a fresh issue.
- The protocol check (ADR-0051) groups ADR files by ID:
  - In `docs/adr/`, every unlisted duplicate is an error, zero-padded or not: padding can't tell an older collision from two lanes that keep numbering by habit.
  - The duplicate groups a repo already has when it adopts issue-numbered ADRs are listed in `docs/adr/older-duplicates.md`, written on arrival by the v1 → v2 migration or by install, only when such groups exist and no list is there yet. Nothing writes it later. Listed groups produce one summary warning, because their only fix is the renumbering this ADR forbids. A group stays listed only while every one of its files is on its line.
  - A legacy date-named layout (`2026-01-05-….md`) parses as its year. Its arrival-time collisions are recorded like any others, and new ADRs follow issue naming.
  - In `docs/gearbox-adr/`, every duplicate is an error.
- Gearbox's own protocol ADRs stay sequential: one upstream line writes them, and every downstream copy is cited by those numbers. Their claim-at-merge rule, together with the version bump it already covered, moves out of the fence into the Gearbox repo's local extension "Upstream release process".
- The index doesn't list ADRs one by one: `docs/adr/` is their index. Two parallel PRs that each append an index line conflict for no reason.

## Alternatives rejected

- **Date + slug** (`2026-09-30-<slug>.md`): unique without coordination too, but every citation becomes long and a slug can never change.
- **Automated claim-at-merge** (a `gearbox-agents adr claim` command): keeps dense numbers, but the race and the reference rewrites stay.

## Consequences

- Parallel lanes never collide on project ADR numbers, and ADR-0048's "renumber your ADR" no longer applies downstream.
- IDs are sparse and not in decision order; the `Date:` line orders them.
- A duplicate can still arise when two PRs settle the same issue, or when two lanes keep numbering by habit (both writing `0334-….md`). Unlisted, it is an error either way. If the other PR merged before the check ran, the PR's own check is red; otherwise the push to main is.
- A repo that arrives with older duplicates starts green: the migration or install records them, and they warn once. After arrival, every new duplicate is an error.
- The same reasoning applies to any hand-numbered sequence (database migrations are the other one the audit found). This ADR adds no rule for them.
- **Don't** renumber a listed ADR to clear the warning: the references it would break are the reason this ADR exists. Don't add a group to `docs/adr/older-duplicates.md` to clear an error either: the list records what a repo had on arrival, and a new ADR is named after its issue.
