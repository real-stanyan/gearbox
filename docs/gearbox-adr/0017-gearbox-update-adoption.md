# ADR-0017: gearbox-update Onboarding — the Write-Side Backfill Tool Graduates, Guardrails Become Contract

- Date: 2026-07-19
- Status: accepted

## Context

`scaffold-update` (Node.js, produced by Z Code on 2026-07-19) is the write-side downstream sync tool: scan downstream for missing upstream ADRs → auto-renumber on number collision → single-pass full-text cross-reference replacement → supersede status linkage → one commit per ADR → push to a new downstream branch → produce a report. Complements the read-only gearbox-version (ADR-0016).

Problem (issue #39): no fixed home, no criterion for a "personal tool" to self-classify its tier, and tension with ADR-0013's rejected option A (automatic sync). The maintainer decided on option a: onboard it.

## Decision

1. **Onboard**: `scripts/gearbox-update`, renamed and brought under version control. Deploy a symlink onto PATH; remove the old `~/.local/bin/scaffold-update`
2. **Guardrails upgrade from comment to contract** — the following three are the core of this ADR; weakening any one of them = an L1 protocol change, and must go through issue + ADR + maintainer agreement:
   - **Never touch downstream AGENTS.md** (an L1 file — only report, never write)
   - **Never auto-open a PR** (left to a human / lead agent to review and open manually)
   - **Never auto-merge** (L1 requires maintainer agreement; the weak-b form is unchanged)
3. **Boundary with ADR-0013's option A**: A was rejected because "automatic sync destroys L1/L2 gating." gearbox-update is triggered by hand, repo by repo, produces only **a branch awaiting review**, and the endpoint is still downstream's own L1 process — gating is preserved; only the mechanical labor (copying / renumbering / reference replacement) is automated. This boundary holds only as long as the three guardrails hold; if a guardrail breaks, we're back to A — reread ADR-0013's rejection rationale
4. **Four incidental fixes made during onboarding**: the provenance-detection regex now accepts both the scaffold/Gearbox generations of the field; the PR base branch changed from a hardcoded `main` to auto-detection (main/master); the `AGENTS_MD_IMPACT` table gained rows for 0014–0017 and a maintenance contract (every new upstream ADR must add a row; `null` = does not touch AGENTS.md); everything renamed to gearbox (branch name `docs/gearbox-backfill-*`, report `gearbox-update-report.md`, env `GEARBOX_DIR`)

## Consequences

- **Backfill's mechanical labor drops to zero**, judgment labor is preserved: the AGENTS.md manual-edit checklist, diff review, the gate, and L1 agreement all remain with the human / lead agent
- **Known hardcoding (accepted)**: supersede linkage only recognizes the one pair "upstream 0012 → downstream 0006"; if upstream produces a new supersede relationship in future, the script must be edited. Same for `AGENTS_MD_IMPACT`. Both spots have a comment flagging the maintenance obligation
- **Not part of the gate**: if the tool breaks, what's affected is backfill efficiency, not protocol correctness; the authority remains DOWNSTREAM.md + downstream's L1 process
- **Tested** (mandys_app sandbox, local bare remote): 6 ADRs backfilled, chained renumbering on collision (0011→0012 cascading through 0012→0013...0016→0017), single-pass cross-reference replacement, 0006's supersede pointer targeting the renumbered destination — all correct
