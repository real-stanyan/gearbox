# ADR-0014: PR template references the DOWNSTREAM.md list instead of hardcoding downstream project names

- Date: 2026-07-19
- Status: accepted

## Context

When ADR-0013 was rolled out, `.github/pull_request_template.md` hardcoded the two downstream project names at the time (dryrun / mandys_bubble_tea_admin_app) directly into the "downstream backfill issue links" subsection.

This caused the same piece of information to live in two places: `DOWNSTREAM.md` is the authoritative source of the list (ADR-0013 states explicitly: "a backfill issue must be opened for each project in the DOWNSTREAM.md list"), and the PR template is a copy of it. When the downstream list changes (a new project onboards / a project is archived), DOWNSTREAM.md gets updated (required by ADR-0013's maintenance rule), but the PR template is bound to be forgotten — the template isn't on any maintenance checklist. The consequence of the drift: a PR author opens backfill issues against the stale list in the template, missing new downstream projects, and the B-3 mechanism fails in this blind spot — exactly the "missed notification" B-3 was meant to solve, returning in a different form.

## Decision

The PR template no longer lists specific project names; instead it gives an instruction: **"list them one by one, per the `DOWNSTREAM.md` 'Onboarded projects' list, one item per line"**, with a placeholder line `<repo>: <backfill issue link>`.

The single-source-of-truth principle (CONTEXT.md's first term) is applied to the protocol itself: the list lives only in DOWNSTREAM.md.

## Consequences

- **One more hop when filling out a PR**: the author has to open DOWNSTREAM.md to see the list, rather than copying from the template. Acceptable — the B-3 process already requires opening an issue per item, so reading the list is required anyway
- **The gate is unaffected**: check-gearbox.js asserts that the template keeps the `Affects downstream` field and that DOWNSTREAM.md keeps the "Onboarded projects" section — it doesn't assert specific project names
- **Less noise when downstream copies the template**: the template no longer carries Gearbox's own project names (the README's startup guide still requires downstream to delete/rewrite this template)
