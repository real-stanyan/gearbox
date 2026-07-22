# ADR-0026: Backfill trigger changes from push to pull — B-3 downgraded, DOWNSTREAM.md becomes an optional dashboard

- Date: 2026-07-20
- Status: accepted
- Related: ADR-0013 (B-3 downstream backfill reminder, downgraded by this ADR), ADR-0014 (PR template references the downstream list), ADR-0016 (gearbox-version), ADR-0017 (gearbox-update), ADR-0018 (Hard rule annotation tiering), ADR-0023 (version scheme)

## Context

Gearbox is positioned as a public GitHub template — anyone can fork it and stand up their own upstream. But the existing backfill mechanism (B-3 / ADR-0013) is **push**:

> For every protocol-change PR, before merge you must open a backfill issue on each project in the `DOWNSTREAM.md` list — **no link, no merge**.

Push only works if the upstream **knows who each downstream is, and has the right to open issues on their repo**. That only holds for "a bunch of repos the maintainer personally controls." For a public template:

1. A stranger forks gearbox for their own use → upstream has no idea they exist → can't open an issue for them.
2. Even if upstream knew, it has no right to open an issue on a stranger's repo.
3. So `DOWNSTREAM.md`'s hardcoded "Onboarded projects" list is, in substance, **private fleet-management data** that had leaked into a public template.

Core observation: **the update mechanism was already pull** — `gearbox-update` is "the downstream actively goes to upstream to find and copy back missing ADRs," `gearbox-version` is "the downstream actively compares itself against upstream to compute how far behind it is." Push (B-3's opening of issues) **is not the update mechanism, just the trigger** — it's what makes the downstream agent remember to run update. The trigger can be swapped for a downstream self-check at start of shift, with no need for upstream to know downstream in advance.

## Decision

The backfill trigger changes from **push (upstream opens an issue)** to **pull (downstream self-checks at start of shift)**. Four linked changes:

1. **Trigger migration (a new step in the downstream three start-of-shift steps)**
   Add a 4th step to the downstream three start-of-shift steps: `run gearbox-version; if behind, run gearbox-update` (read-only, zero side effects, a few seconds). If the downstream sees ⚠️/✗, it pulls on its own.
   → `gearbox-install` now scaffolds this step for new downstreams (a new anchor transform); when an existing downstream backfills this ADR via `gearbox-update`, the report uses `AGENTS_MD_IMPACT[26]` to prompt adding this step manually.
   → **Gearbox itself (upstream) does not add this step to its own three start-of-shift steps** — it is the upstream, with no upstream to check. This step is receiving-end semantics, injected into downstreams only via install.

2. **B-3 downgrade (ADR-0013, L1 core change)**
   Remove the "no link, no merge" hard gate. The PR template's `Affects downstream` declaration **remains informational** (helps judge impact scope), no longer forces an issue to be opened per downstream, and no longer blocks merge. B-3 goes from a hard rule down to "optional maintainer notification."
   → Knock-on effect: ADR-0018's "Hard rule annotation tiering" example originally used B-3's "no link, no merge"; once B-3 is downgraded that example no longer holds, so it's replaced with the "Roles of issues & PRs" section's hard rule "you must open an issue, silent judgment calls are not allowed" as the example (the install receiving-end version already uses it, so this conveniently unifies the two).

3. **DOWNSTREAM.md downgraded to an optional dashboard**
   The "Onboarded projects" table is no longer B-3's traversal target / a merge gate. Keep the "listing criteria" + "verified projects that don't qualify" sections as general-purpose documentation; the "Onboarded projects" table is now marked **non-normative, a maintainer's own fleet view** — a public template fork can wipe the whole table without breaking any mechanism. The table itself stays (the maintainer's private fleet dashboard), and `check-gearbox.js`'s assertion on the `## Onboarded projects` section stays too — it now guards "don't accidentally delete the dashboard section," not "B-3's traversal target."

4. **Tool upstream addressing (this ADR only states the direction; implementation is a separate follow-on)**
   `gearbox-version` / `gearbox-update` currently read the local `~/Github/gearbox`. A stranger's downstream has no such local copy, so pull is still unusable for them. **Remote addressing (git remote / gh / a fixed upstream URL) is the necessary condition for pull to truly serve strangers, but it's an independently large scope, split off into a follow-on ADR.** This ADR takes effect immediately for the **fleet currently sharing a local upstream** (dryrun/mandys/Blackbox all point at the same `~/Github/gearbox`); pull for public strangers' forks awaits the follow-on.

## Consequences

- **Decoupling the public template from the private fleet**: the template no longer embeds a downstream list as a gate; fleet data becomes an optional local convenience for the maintainer, deletable without breaking the protocol. This resolves "a public project shouldn't hardcode a downstream list."
- **The nature of the trigger guarantee changes (honest record)**: push was "upstream guarantees the issue exists," pull is "downstream guarantees it self-checks at start of shift." Pull looks weaker, but — ① push also only guarantees the issue exists, not that downstream acts on it; downstream still has to do the three start-of-shift steps + take action; ② for strangers, push was always a fictional guarantee; ③ pull is more robust against the failure mode "upstream forgot to open the issue." Net assessment: under a realistic threat model, pull is at least no weaker than push.
- **AGENTS.md body-level changes still need a human**: `gearbox-update`'s guardrails never touched downstream AGENTS.md anyway — that part relies on human judgment prompted by the report; push vs. pull doesn't change that for you, so switching to pull loses nothing. This ADR changes the downstream three start-of-shift steps, which is an AGENTS.md body-level change → add entry 26 to `AGENTS_MD_IMPACT` (and backfill the previously missing entry 25 = null).
- **One-time migration for existing downstreams (the last push)**: dryrun/mandys/Blackbox each need to add the 4th start-of-shift step to their own AGENTS.md. This PR itself is `Affects downstream: yes`; under **the still-in-effect B-3 of this very PR**, open one migration issue for each of the three — this is the last push before B-3 retires, conveniently used to distribute the pull migration. After migrating, they rely on self-checks and no longer depend on upstream opening issues.
- **Tier / version**: removing the B-3 "no link, no merge" hard-rule assertion = **L1** (relaxing/removing an existing gate's semantics, ADR-0010). Changing the downstream AGENTS.md three-start-of-shift-steps contract, requiring downstream to manually add a step = **major** (ADR-0023) → after v0.3.0 this becomes **v1.0.0**, which also appropriately marks "Gearbox's first breaking change / moving toward public."
- **Three-piece set**: Protocol gap issue + this ADR + branch PR, merge only after CI is green + **the maintainer "agrees"** (L1).
- **Considered but not adopted**: keeping push serving the private fleet + pull serving the public (dual-track). Rejected — dual-track means maintaining both the DOWNSTREAM.md list and the self-check step at once, doubling complexity; push's half-measure value (upstream's guarantee) has low marginal benefit once pull exists. Better to go pull-only + DOWNSTREAM.md as a purely optional dashboard.
