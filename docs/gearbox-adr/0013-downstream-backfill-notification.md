# ADR-0013: Downstream backfill notification mechanism — B-3 template enforcement (scaffold protocol PRs must fill in Affects downstream)

- Date: 2026-07-19
- Status: accepted (partially revised: ADR-0026 downgrades the trigger from push to pull, retires the "no link = can't merge" hard gate, and changes the `Affects downstream` declaration to informational; the motivation and the scaffold-disconnection problem recorded by this ADR remain valid — only the solution changed from push to pull)

## Context

scaffold is a **template** (not a dependency) — after one `cp`, downstream evolves independently and disconnects from scaffold. This design is correct in itself (every project should have its own evolution pace), but it **lacks a backfill notification mechanism**, causing downstream to miss scaffold improvements.

**Evidence from real usage** (issue #24):
- Both `dryrun` and `mandys_bubble_tea_admin_app` were onboarded up to scaffold ADR-0010 (2026-07-18)
- scaffold subsequently added ADR-0011 (subagent-system) + ADR-0012 (L1/L2 boundary criterion) — **neither downstream got them**
- In particular, ADR-0012 is a security-related protocol improvement (preventing agents from expanding the protocol via L2 self-merge); downstream missing it = the same overreach risk applies to them too

## Decision

**B-3 template enforcement**: every scaffold protocol-change PR must declare `Affects downstream` before merging (enforced by making the field appear in `.github/pull_request_template.md`):

- **`no`** — this PR doesn't affect downstream (purely internal scaffold documentation / CI / ADR template formatting, etc.), merges normally
- **`yes`** — this PR affects downstream (any protocol-level change: Hard rules / Gate / Tech stack / Working agreement / index / any new content that references the L1/L2 tiering or a protocol mechanism, per the ADR-0012 criterion). **A backfill issue must be opened for each project in the `DOWNSTREAM.md` list**:
  - issue content: reference the scaffold PR + label L1/L2 (labeled by the scaffold PR's author per the ADR-0012 criterion)
  - the issue stays open, waiting for a downstream agent to encounter it via the three start-of-shift steps → downstream decides to backfill (going through its own L1) or decline (close the issue noting the reason)
  - **the PR body must attach these issue links**. **No link = this PR cannot merge** (Hard rule)

How downstream receives the notification: **downstream's AGENTS.md is not modified** — the backfill issue is opened in the downstream project itself, and a downstream agent naturally encounters it via step 2 of the three start-of-shift steps ("check GitHub Issues"). This is the protocol bootstrapping itself: downstream's existing "look for open issues first" rule automatically catches the backfill notification.

### Why the other approaches weren't chosen

| Approach | Why it wasn't chosen |
|---|---|
| **A. Automatic sync** (submodule / @import / symlink) | Destroys L1/L2 gating (downstream maintainers lose their right to consent) + ADR number collisions (scaffold 0011 ≠ dryrun 0011) + protocol bugs propagate automatically + CONTEXT.md entries overwrite each other (scaffold's are collaboration terms, downstream's are project domain terms) |
| **B-1. Pure manual, relying on memory** | Unreliable — this is exactly the problem being solved. The real-world miss in issue #24 is B-1's failure |
| **B-2. Agent semi-automatically opens issues cross-repo** | scaffold's Hard rules don't authorize an agent to write cross-repo; and an agent operating cross-repo would mix scaffold's judgment into downstream's protocol, blurring the boundary |
| **B-4. Fully automated via GitHub Actions** | (1) writing cross private-repo requires a PAT or GitHub App, with token management + expiry renewal + security risk (privilege creep) (2) adding an Action to scaffold turns it from a "pure documentation repo" into a "repo with code" — itself an L1 Tech stack change, introducing new complexity (3) Action failure modes are invisible — if a run breaks, no one may notice (4) B-4 still can't skip defining the rule (what counts as a "protocol change" still needs a Hard rule); it only automates execution |

## Consequences

- **One more step for protocol-change PRs**: the author (agent/human) must fill in the `Affects downstream` field; when `yes`, they must open an issue in each downstream project and attach the links. This is a real burden, and it's accepted
- **DOWNSTREAM.md must be maintained manually**: when a new project onboards, a line is added manually, and forgetting means missing it (but this is a low-frequency action — it happens once per onboarding). This ADR doesn't provide a mechanism for automatically discovering downstream projects (GitHub has no reverse tracking)
- **The PR template can't force a merge block**: technically, GitHub won't prevent a merge just because a field is missing. Enforcing the Hard rule relies on review + the agent's self-discipline. **The failure mode is visible** — if the PR body has no downstream issue links attached, it's obvious at a glance during review. This is an accepted boundary: trading visibility for simplicity
- **Backfilling is a suggestion, not mandatory**: after downstream receives the backfill issue, whether to actually backfill is up to the downstream maintainer. This ADR only provides "the notification lands", not "forced backfilling" — because downstream may have its own CONTEXT / Hard rules, and blind copying would cause problems
- **Downstream scale threshold**: this mechanism suits ≤5 downstream projects + protocol changes 1-2 times a week (current real-world usage). If downstream grows to 10+ or the protocol-change frequency rises, this should be upgraded to B-3.5 (manual + local script) or B-4 (Action) — via a separate ADR at that time

## Bootstrapping note

This PR, which introduces B-3, is itself a protocol change (`yes`), and by the rule it should open backfill issues for downstream. **But the B-3 process isn't in effect yet (this PR is what introduces it)** — so before it's introduced, this PR can go through the L1 process on its own (needs Stan's agreement); its first real-world run after merging is opening the 0011+0012 backfill issues for dryrun + mandys_app respectively. This is a classic bootstrapping moment of the protocol applying itself.

## Evolution signals

If, in the future, we observe:
- agents/humans frequently forget to fill in `Affects downstream` → consider B-3.5 (a local script to assist the review checklist)
- downstream frequently receives irrelevant backfill issues → tighten the criterion for "what counts as a protocol change"
- downstream frequently ignores backfill issues without handling them → consider whether backfill issues should carry a higher-priority label

Handle it via a separate ADR at that time — it's out of scope for adjustment in this ADR.
