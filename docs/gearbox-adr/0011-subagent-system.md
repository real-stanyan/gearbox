# ADR-0011: Add a Subagent System template to scaffold (docs/subagent-system.md)

- Date: 2026-07-18
- Status: accepted

## Context

Scaffold's existing multi-agent protocol (ADR-0003 ~ 0010) solves shift-based collaboration **between agents** — handoff, Memory, PR disposition, protocol-change tiering. But one layer isn't covered: **how to use subagents within a single agent's session**.

The actual need comes from ZCode (a Claude-Code-like tool made by z.ai) — it supports subagents: the main agent (controller) can dispatch tasks to child agents with independent context, and the child agent's tool results don't flow back into the main conversation. This solves a specific pain point: **quadratic token accumulation in the main conversation**. Every step adds a bit to the context, and every subsequent round gets re-billed at "the total size at that point"; going 10 steps from 10k up to 50k costs a total of ≈ 300k.

But ZCode's subagent system has several traits that **make it costly for each downstream project to figure out on its own**:

1. **Global configuration** — subagent definitions live in `~/.zcode/v2/agents-state.json`, applying to all workspaces, with **no workspace scope**. Project-level differences can't be handled via config overrides
2. **Scattered configuration entry points** — UI (Settings → Subagents) + file layer (agents-state.json) + a restart is required for changes to take effect; easy to trip over without documentation
3. **The SDD skill provides implementer/reviewer templates but no rollout guide** — the superpowers plugin's `subagent-driven-development` skill has ready-made prompt templates (roughly 100-130 lines each), but it covers "how to dispatch a subagent", not "how many subagents a project should have, how to divide labor, how to route by task"
4. **Model cost tiering needs an explicit basis** — there's no reference for dividing cheap tier (mechanical tasks) vs. flagship tier (judgment tasks) work, so every maintainer just guesses

Candidate approaches:

- **A. Write the subagent system into AGENTS.md as part of the protocol** — bloats the protocol; and the subagent system is an optional practice, not every project uses ZCode, so putting it in hard rules is inappropriate
- **B. Add a standalone `docs/subagent-system.md` to scaffold as an optional template** — whether downstream copies it is voluntary; keeps AGENTS.md's status as hard rules intact, with the subagent system as a reference for "if you use this, configure it like so"
- **C. Don't define it in scaffold, let each project write its own** — inconsistent, the figuring-out cost gets paid over and over, and violates scaffold's positioning as a "starting-point skeleton"

## Decision

Adopt **B**: add `docs/subagent-system.md` to scaffold as an **optional template** (not a Hard rule); whether downstream copies it is voluntary. This ADR is added at the same time to record the decision.

The template defines **5 subagents**:

| Subagent | Model tier | Role |
|---|---|---|
| Explore | Cheap tier | Read-only search / locate / audit |
| Implementer | Flagship tier | SDD task implementation |
| Reviewer | Flagship tier | SDD task review |
| Debugger | Flagship tier | Systematic debugging |
| Doc-Walker | Cheap tier | Code → ADR/CONTEXT.md |

Alongside it: a **task-routing decision tree** (the main agent judges who to dispatch based on size + type) + **SDD routes by task size** (Trivial/Small don't require SDD, Medium/Large do) + **project-level routing** (relying on the project's AGENTS.md as a soft rule, compensating for ZCode's lack of workspace scope) + **rollout steps** (a ZCode UI configuration guide).

**Key sub-decisions**:

1. **Why 5** — corresponds to the 4 high-frequency tasks "code exploration / new feature development / lightweight fixes / complex debugging" + 1 documentation-rollout task (Doc-Walker). The final-reviewer recommended by the SDD skill isn't given its own slot; it reuses the Reviewer subagent (having it run branch-wide instead of task-scoped)
2. **Why Implementer/Reviewer reference the superpowers skill template instead of copying it inline** — keeps a single source of truth. superpowers' templates are validated by the skill's author; copying them into this scaffold would let the two drift apart; a reference lets upstream updates propagate automatically. Fallback: users without superpowers installed inline the template into the UI field
3. **Why Explore/Debugger/Doc-Walker are written from scratch** — there's no ready-made template to reference; the self-written prompts borrow the style of the superpowers templates (uppercase English HARD CONSTRAINTS, explicit ANTI-PATTERNS, structured REPORTING)
4. **Why AGENTS.md isn't changed** — the subagent system is an optional practice, not required at project startup; writing it into AGENTS.md would bloat the protocol and blur the line between Hard rules and recommended practices
5. **Why README.md's architecture table isn't changed** — same as above; subagent-system.md isn't a required file at startup, and downstream maintainers decide for themselves whether to copy it

## Consequences

**Costs**:

- The maintainer has to manually configure 5 subagents in the ZCode UI (one-time work, about 15 minutes)
- Downstream projects gain one more decision point: "whether to use this setup"
- The template document itself needs maintaining — when the superpowers skill template updates, this scaffold's reference may point to stale content (mitigation: the template states the reference path explicitly, and the maintainer checks for the latest version when copying)
- The division of labor across the 5 subagents is a design inference, not battle-tested at scale — if practice reveals some subagent is never used (e.g. Doc-Walker), or a role is missing (e.g. a dedicated Planner is needed), come back and revise this ADR

**What this buys**:

- Consistent subagent naming / division of labor / routing logic across projects
- An explicit basis for model cost tiering (cheap tier vs. flagship tier vs. when to dispatch which)
- The SDD skill is no longer just documentation on "how to dispatch" — there's now a template for "how to roll this out in my project"
- Several of ZCode's pitfalls (global configuration, restart required to take effect, no tool allowlist) are explicitly documented, so downstream doesn't have to rediscover them
- The protocol layer (AGENTS.md) and the practice layer (subagent-system.md) are separated, each doing its own job

**Conditions for overturning this** (a future agent wanting to change this ADR should first confirm whether these premises still hold):

1. **ZCode supports workspace-scoped subagents** — §5's project-level routing section would need rewriting, upgrading from "relying on AGENTS.md soft rules" to "a real config-layer override"
2. **ZCode supports a UI tool allowlist** — the HARD CONSTRAINTS in §2's per-subagent system prompts could be upgraded from "soft constraints" to "hard tool restrictions", and the corresponding prompts could be simplified
3. **The 5-subagent division of labor is falsified in practice** — if some role sits idle long-term, or some common task has no subagent to dispatch to, come back and adjust the list
4. **The superpowers skill template is deprecated or changes substantially** — the reference strategy for Implementer/Reviewer needs re-evaluating, and may require inlining a frozen version
5. **ZCode subagent configuration supports bulk import/export** (e.g. a JSON file) — §6's rollout steps could simplify to "import agents-state.json", without manual UI configuration

**Honest list of unverified boundaries** (also in the template's §7, consolidated here):

- n=1 user design; the 5-subagent division of labor hasn't been verified at scale in practice
- There's no objective threshold for judging cheap tier vs. flagship tier
- The tool allowlist relies on soft system-prompt constraints; whether subagents actually "comply" hasn't been verified at scale
- The ZCode UI field length limit is unknown; an overly long prompt might not fit
- Stan has only actually run simple tasks with Explore (Turbo) + Implementer/Reviewer (GLM-5.2); Debugger and Doc-Walker have zero real-world runs
