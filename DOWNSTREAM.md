# Downstream projects

> **This table is a non-normative, optional dashboard (ADR-0026).** Backfill is pull-driven — downstream repos self-check with `gearbox-version` when starting a shift, and run `gearbox-update` if they're behind; upstream doesn't push. This table is no longer a merge gate, nor the traversal target of any hard rule. It's just the **maintainer's private fleet view**, recording which sync point each of these repos is at. **When you carry Gearbox off to build your own upstream, the entire "Onboarded projects" table can be wiped**—the onboarding criteria and "not onboarded" sections are generic documentation and can stay.

The list of projects running this Gearbox protocol (the maintainer's fleet). Protocol-change PRs still declare `Affects downstream` in the PR body (informational, ADR-0013 → ADR-0026); the maintainer may **optionally** open a notification issue against the projects listed below, but it isn't mandatory — downstream repos will hit staleness on their own via self-check at the start of a shift anyway.

## Onboarding criteria (all must hold to be listed)

1. `AGENTS.md` exists at the repo root and contains `### Roles of issues & PRs` (proves it's the Gearbox protocol, not a same-named file)
2. `CLAUDE.md` exists at the repo root and equals `@AGENTS.md` (the empty-shell contract)
3. A `docs/gearbox-adr/` directory exists (where protocol ADRs land)

## Onboarded projects

| repo | onboarded | currently synced to | backfill notes |
|---|---|---|---|
| [`real-stanyan/dryrun`](https://github.com/real-stanyan/dryrun) | 2026-07-18 | ADR-0013 (own, subagent routing) | Backfilled Gearbox 0012 (= dryrun 0012) + 0011 §5.1 (= dryrun 0013); 0013 (B-3) doesn't apply (dryrun has no downstream); see [dryrun#38](https://github.com/real-stanyan/dryrun/issues/38) + [dryrun#40](https://github.com/real-stanyan/dryrun/pull/40) |
| [`real-stanyan/mandys_bubble_tea_admin_app`](https://github.com/real-stanyan/mandys_bubble_tea_admin_app) | 2026-07-18 | ADR-0011 (own, native-swiftui) | Missing Gearbox 0011+0012; backfill reminder already opened → [mandys_app#1](https://github.com/real-stanyan/mandys_bubble_tea_admin_app/issues/1) |
| [`real-stanyan/Blackbox`](https://github.com/real-stanyan/Blackbox) | 2026-07-19 | **Gearbox 0001–0020 in full** (0014–0020 renumbered locally to 0015–0021) + ADR-0014 (own, tsc gate) | Backfilled 2026-07-19 via [Blackbox#5](https://github.com/real-stanyan/Blackbox/pull/5) (first real-world run of gearbox-update); four AGENTS.md items backfilled (rename/0018/0019/0020); backfill issues #1–#4 closed |

## Maintenance

- **Onboarding a new project:** the PR that introduces the protocol also adds a row here manually
- **After a backfill issue merges:** update that row's "currently synced to" column
- **Project retired:** keep the row but annotate "archived, no longer backfilled"
- **Local quick-check:** run `~/Github/gearbox/scripts/gearbox-version` from the downstream repo's root (prefers provenance-based detection, ADR-0016, plus hash-drift detection, ADR-0021). The quick-check isn't authoritative — this file is; it can't see downstream repos that "evaluated and declined to backfill," and unstamped legacy copies' drift isn't detectable
- **Bulk backfill:** run `~/Github/gearbox/scripts/gearbox-update` from the downstream repo's root (ADR-0017) — copies missing ADRs, renumbers, and pushes a review-ready branch. Guardrails: never touches AGENTS.md, never auto-PRs, never auto-merges; the endpoint is still the downstream repo's own L1 process

## Not onboarded (verified)

- `mise` / `sparklab` / `atlas-dashboard` — their AGENTS.md is the Next.js `nextjs-agent-rules` convention, unrelated to Gearbox
- 10 other repos — missing all three criteria (AGENTS.md / CLAUDE.md / docs/adr/), not onboarded
