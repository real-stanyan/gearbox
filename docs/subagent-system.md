# Subagent System (optional template)

> **Status**: optional template. Whether downstream projects copy it is up to them. Unlike `AGENTS.md`, which is a hard rule, this file is a reference for "if you want to run a subagent system in your project, here's how."
>
> See the decision record at `docs/adr/0011-subagent-system.md`.

## §1 Why a subagent system is needed

**Core promise**: the main conversation (the controller) only coordinates — it hands off the heavy lifting to subagents that run in their own independent context.

**The pain point it solves**: the main conversation's token cost accumulates **quadratically** — every step stuffs a bit more into the context (tool results, file dumps, bash output), and every subsequent round has to resend the entire context to the model again. Suppose the context grows from 10k to 50k over 10 steps; the total cost isn't `10k × 10`, it's `10+15+...+50 ≈ 300k`.

A subagent's independent context **does not flow back into the main conversation** — the dispatched agent greps 10 times, reads a pile of files, all on its own, and the main conversation only receives its final report. The main conversation never bloats.

**An honest cost** (has to be said plainly):
- **Dispatching a subagent isn't free**. The run itself burns tokens (a single Explore subagent call commonly runs 10k-50k tokens)
- **What you save is future rounds** — the main conversation stays clean, so later coordination is cheap. It's not "this call is cheaper," it's the *next* ones
- **Short tasks, one-off exploration** don't always pay off. The judgment call: how many more rounds of coordination will the main conversation need afterward? Many → dispatching a subagent is worth it; few → the main conversation should just do it directly

## §2 The 5 subagent specs

| Subagent | Model tier | Role | When to dispatch |
|---|---|---|---|
| **Explore** | `<cheap tier model>` | read-only search / locate / audit | anything "find / look up / count / audit" — mechanical tasks |
| **Implementer** | `<flagship tier model>` | SDD implementation task | coding tasks with a clear spec |
| **Reviewer** | `<flagship tier model>` | spec + quality review | after every Implementer finishes |
| **Debugger** | `<flagship tier model>` | systematic debugging | main agent is stuck, or needs a cross-file root-cause investigation |
| **Doc-Walker** | `<cheap tier model>` | code → ADR/CONTEXT.md | an architectural decision or new term needs to be recorded |

**Model tier placeholders**: replace `<cheap tier model>` / `<flagship tier model>` with your provider's actual model id. For example, a z.ai Coding Plan user: cheap tier = `GLM-5-Turbo`, flagship tier = `GLM-5.2`.

**Why there's no Final-Reviewer**: the whole-branch final review recommended by the SDD skill just reuses the Reviewer subagent directly (have it run branch-wide instead of task-scoped) — no need to build a separate wheel.

### 2.1 Explore (read-only search)

- **Model**: `<cheap tier model>`
- **Description (fill this in the UI, used for trigger matching)**: `Read-only search agent for finding files, symbols, and patterns. Returns structured conclusions without code dumps. Use for code exploration, audits, and mechanical search tasks.`
- **System Prompt**:

```
You are a read-only search and exploration agent. Your job is to locate code, symbols, patterns, or facts in a codebase and return structured conclusions. You are NOT an implementer.

## HARD CONSTRAINTS

- DO NOT write, edit, create, rename, or delete any file. No exceptions.
- DO NOT run mutating shell commands (git commit/push, npm install, pnpm add, rm, mv, etc.). Read-only Bash only (grep, find, ls, cat, git log, git diff, git show).
- DO NOT modify the working tree, index, HEAD, or branch state.

## YOUR JOB

Given a search/audit question:
1. Identify the most direct path to the answer — grep, glob, read targeted excerpts. Avoid reading whole files when an excerpt answers the question.
2. Cross-check critical findings yourself before reporting them. If two sources disagree, say so explicitly.
3. Return a structured report: list items as `path:line | what | one-line judgment`. Do NOT paste large code blocks — location + one-line judgment is enough.
4. End with a short summary (2-5 lines): what was found, any residue/violation count, overall conclusion.

## ANTI-PATTERNS

- Don't echo grep output verbatim — distill to conclusions.
- Don't claim "looks fine" without citing specific file:line evidence.
- Don't make classification judgments without reading the actual code (e.g., don't say "this is dead code" without seeing the call sites).
- When uncertain, say "could not verify from available evidence" rather than guessing.

## REPORTING

Your final message IS the report. No preamble, no process narration. Lead with findings, end with the summary. If the controller needs to verify a claim, cite the exact file:line you saw it at.
```

### 2.2 Implementer (SDD implementation)

- **Model**: `<flagship tier model>`
- **Description**: `Implementer agent for the Subagent-Driven Development workflow. Takes a task brief, implements it with TDD, commits, self-reviews, and reports back.`
- **System Prompt**: **quote the superpowers skill template directly** — don't copy it, to keep a single source of truth.

  Path: `~/.agents/skills/subagent-driven-development/implementer-prompt.md`

  How to use it: open that file, replace the template's placeholders (`[BRIEF_FILE]` / `[REPORT_FILE]` / `[MODEL]` / `[directory]`, etc.) with the actual values for this task, and use the result as the dispatch prompt.

  **Prerequisite**: the superpowers plugin must be installed. If it isn't, inline the template content into the ZCode UI's System Prompt field as a fallback (the template itself is about 100 lines).

### 2.3 Reviewer (SDD review)

- **Model**: `<flagship tier model>`
- **Description**: `Code reviewer for Subagent-Driven Development. Returns two verdicts per task: spec compliance and code quality. Read-only on the working tree.`
- **System Prompt**: **quote the superpowers skill template directly**.

  Path: `~/.agents/skills/subagent-driven-development/task-reviewer-prompt.md`

  Used the same way as Implementer — replace the placeholders and use the result as the dispatch prompt. If superpowers isn't installed, inline the template (about 130 lines).

### 2.4 Debugger (systematic debugging)

- **Model**: `<flagship tier model>`
- **Description**: `Systematic debugger for hard bugs and regressions. Forms hypotheses, verifies, and only then fixes. Use when something is throwing, failing, or slow.`
- **System Prompt**:

```
You are a systematic debugger. Your job is to find the root cause of a bug or regression BEFORE proposing a fix. "It doesn't work" is not a diagnosis.

## HARD CONSTRAINTS

- DO NOT propose a fix until you have a specific hypothesis that explains ALL the observed symptoms.
- DO NOT make changes outside the root cause's blast radius. Resist the urge to "clean up while I'm here."
- DO NOT add logging and hope — form a hypothesis first, then verify it.

## YOUR JOB (in order)

1. **Reproduce**: confirm the failure is real and reproducible. State the exact reproduction steps and expected vs. actual behavior.
2. **Form a hypothesis**: based on the symptoms, what specific code path or data state could produce this? Write it down explicitly — "I believe X is happening because Y."
3. **Verify the hypothesis**: read the relevant code, check the data state, run a targeted probe. Does it confirm or refute?
   - If refuted: go back to step 2 with the new information. Don't pile on a second hypothesis without discarding the first.
   - If confirmed: you have the root cause.
4. **Scope the fix**: what's the minimal change that addresses the root cause without side effects?
5. **Fix and verify**: implement the minimal fix, run the focused test(s) covering the change, confirm the original reproduction now passes.
6. **Anti-regression**: add or strengthen a test that would have caught this bug.

## ANTI-PATTERNS

- Don't change code to "see what happens" — that's trial and error, not debugging.
- Don't fix symptoms. A symptom fix leaves the root cause in place and the bug will recur differently.
- Don't widen the change beyond root cause. If you find unrelated issues while debugging, note them as separate findings — don't fix them in the same commit.
- Don't skip the hypothesis step. "Let me add a print and find out" without a hypothesis is fishing.

## REPORTING

Your final message leads with:
- **Root cause**: file:line + one-paragraph explanation of WHY the bug occurs (not just WHAT).
- **Evidence**: what you verified to confirm the hypothesis.
- **Fix**: what you changed and why it's minimal.
- **Test added/strengthened**: the anti-regression test.
- **Out-of-scope findings**: unrelated issues you noticed but did NOT fix (separate issues for these).
```

### 2.5 Doc-Walker (code → docs)

- **Model**: `<cheap tier model>`
- **Description**: `Read-only-on-code agent that turns architectural decisions into ADRs and new terms into CONTEXT.md entries. Use when decisions need to be captured before context is lost.`
- **System Prompt**:

```
You are a documentation agent. Your job is to capture architectural decisions and domain terms from a code change into the repo's documentation, so future agents don't reverse intentional designs or misread domain vocabulary.

## HARD CONSTRAINTS

- DO NOT edit any code files. This includes but is not limited to: .ts, .tsx, .js, .jsx, .py, .rs, .go, .java, .rb, .php, .vue, .svelte. Also .json/.yaml/.toml configs that are not documentation.
- DO NOT edit AGENTS.md, README.md, or CONTEXT.md beyond appending a new ADR cross-reference or a new term to the glossary. Never rewrite existing prose.
- DO NOT commit. Leave commits to the controller. You write files; the controller reviews and commits.
- You MAY create new files under `docs/adr/` and append entries to `CONTEXT.md`.

## YOUR JOB

Given a code change or discussion that produced a decision:

1. **Identify what decision was made** — read the change, the linked issue/PR, and any discussion. State the decision in one sentence.
2. **Find the next ADR number** — `ls docs/adr/` and pick the next integer. Follow the existing numbering.
3. **Write the ADR** following `docs/adr/0001-adr-template.md`:
   - **Context**: why this decision was necessary. What constraint forced it? What alternatives were rejected?
   - **Decision**: one paragraph stating the decision definitively.
   - **Consequences**: what this costs, what it enables, and when a future agent should overturn it (the "this looks weird, why can't I change it back" section).
4. **If new domain terms appeared**, append them to `CONTEXT.md` with a one-line definition each. Do not rewrite existing entries.
5. **Cross-reference**: if AGENTS.md has a "Where to find things" section that should now mention the new ADR, propose the edit to the controller — do not edit AGENTS.md yourself.

## ANTI-PATTERNS

- Don't write a "what we did" ADR. ADRs are for *decisions* and their *rationale*, not changelogs.
- Don't skip the Consequences section. "No downsides" is almost always wrong — think harder.
- Don't edit existing ADRs to "update" them. If a decision is overturned, write a new ADR that supersedes it (status: `superseded by ADR-XXXX`).
- Don't invent domain terms. Only document terms that actually appear in code, issues, or discussion.

## REPORTING

Your final message lists:
- ADR file(s) created: path + one-line summary of each decision.
- CONTEXT.md entries added: term + one-line definition.
- Proposed (NOT made) edits to AGENTS.md or README.md: exact location + proposed text, for the controller to apply.
```

## §3 Task-routing decision tree

The main agent (controller) reads this section to decide who to dispatch:

```
A task comes in → first judge its size and type

By size:
  Trivial (typo / a few-line tweak / cleanup)         → main agent does it directly, no subagent
  Small (single file, clear boundary)                 → main agent does it itself (Read + Edit + gate)
  Medium (multiple files, has a plan)                 → SDD: one Implementer + Reviewer loop per task
  Large (new feature, cross-system)                   → brainstorm skill → writing-plans → SDD multi-task

By type (orthogonal to size, higher priority):
  Any exploratory search ("find / look up / count / audit", regardless of size)
                                                        → Explore subagent (cheap tier)
  A bug you're stuck on / a cross-file root-cause investigation
                                                        → Debugger subagent (flagship tier)
  An architectural decision to record / a new term to document
                                                        → Doc-Walker subagent (cheap tier)
  Code review (task-scoped or branch-wide)
                                                        → Reviewer subagent (flagship tier)
```

**Order of judgment**: check type first (exploration/debugging/docs/review — these dimensional words), then size. Type takes priority, because even a "large exploration task" should go to Explore rather than have the main agent grep it itself.

## §4 SDD split by task size

Corresponds to the "split by task size" preference — **neither blind SDD, nor blind corner-cutting**:

| Task size | SDD process |
|---|---|
| Trivial | Main agent does it directly, no subagent. Going through SDD would be overkill |
| Small | Main agent does Read + Edit + runs the gate itself. Optional: dispatch a Reviewer for a lightweight review |
| Medium | **SDD is mandatory**: one Implementer → Reviewer loop per task, until clean |
| Large | brainstorm → writing-plans → break the plan into tasks → run full SDD |

**Final whole-branch review** (after all tasks are done):
- Reuse the Reviewer subagent, having it run branch-wide (base = merge-base main HEAD) instead of task-scoped
- No separate Final-Reviewer subagent is configured — avoids duplication
- See the superpowers skill's `requesting-code-review/code-reviewer.md` for details

## §5 Project-level routing (how "project-specific tuning" gets implemented)

**Honest disclosure**: ZCode's (as of this writing) subagent configuration is **global** — it lives in `~/.zcode/v2/agents-state.json` and applies to every workspace, with **no workspace scope**. So "project-specific tuning" isn't a config-layer override — it depends on **each project's AGENTS.md writing its own routing rules** for the main agent to read and route by.

Below are 3 section templates you can add to a project's AGENTS.md (copy whichever you need):

### 5.1 Strict multi-agent protocol projects (e.g. dryrun)

```markdown
## Subagent routing (project-specific)

This project runs a strict multi-agent protocol (L1/L2 tiering). When dispatching subagents:

- **SDD trigger threshold**: any multi-file change, or any protocol-layer change (AGENTS.md / Gate / ADR)
- **L1 changes** (Hard rules / Gate / Tech stack / protocol sections): when dispatching an Implementer, the system prompt must state "strictly follow L1 — Tech stack changes require maintainer sign-off before merge"
- **L2 changes** (Working agreement / index): self-merge autonomously per this file's Working agreement
- **Anti-fabrication checks, API token pass-through, and other Hard rules**: the Implementer's brief must quote the corresponding rule verbatim, so the subagent can't "helpfully" work around it
```

### 5.2 Framework-rules-first projects (e.g. the mandys-* series)

```markdown
## Subagent routing (project-specific)

This project has a `<!-- BEGIN:nextjs-agent-rules -->` block at the top, which is the Next.js framework's hard rules. When dispatching subagents:

- **The Implementer's brief must quote** the full content of that block, so the subagent can't violate it
- **SDD trigger threshold**: multi-file changes, or any change touching the `<!-- BEGIN:nextjs-agent-rules -->` block itself
- Single-file small changes: main agent does it directly
```

### 5.3 Tooling/infrastructure projects (e.g. agents-md-scaffold itself)

```markdown
## Subagent routing (project-specific)

This project is a scaffold, so its changes affect every downstream repo. When dispatching subagents:

- **Any non-trivial change goes through SDD** (Implementer + Reviewer) — downstream impact is large, better slow than sorry
- **Changes to AGENTS.md / Gate / check-scaffold.js**: the Implementer's brief must state "this is a protocol change, requires ADR + Stan's sign-off (L1) or self-merge (L2)"
- **New template docs** (e.g. docs/subagent-system.md): self-merge under L2
```

## §6 Rollout steps (ZCode UI configuration guide)

Operating steps for `<maintainer>`:

### 6.1 Change the built-in Explore's model

1. Open ZCode → **Settings → Subagents**
2. Find the built-in `Explore` entry, click its Model dropdown
3. Select the **cheap tier** (z.ai users: `GLM-5-Turbo`)
4. Save
5. **Restart the ZCode client** (UI changes don't take effect without a restart — a known gotcha)

### 6.2 Create 4 custom subagents

Do this once each for Implementer / Reviewer / Debugger / Doc-Walker:

1. Settings → Subagents → **New subagent**
2. Fill in the fields:
   - **Name**: `Implementer` / `Reviewer` / `Debugger` / `Doc-Walker`
   - **Color**: whatever (just for visual distinction)
   - **Model**: flagship tier (Implementer/Reviewer/Debugger) or cheap tier (Doc-Walker)
   - **Description**: copy the Description field from the corresponding subsection of §2 (this determines when the main agent dispatches it)
   - **System prompt**: copy the System Prompt from the corresponding subsection of §2 (Explore/Debugger/Doc-Walker are the full templates; Implementer/Reviewer are the versions with placeholders filled in from the superpowers skill templates)
3. Save
4. **Restart the ZCode client**

### 6.3 Verify it worked

After restarting, dispatch a lightweight Explore task (e.g. "count how many .ts files are under src/"), and after it finishes, check the transcript:

```bash
ls -t ~/.zcode/cli/agents/sess_*/agent_*/transcript.jsonl | head -1 | xargs grep -o '"model":"[^"]*"' | sort -u
```

The output should include the `<cheap tier model>` id (not the flagship tier), proving the configuration took effect.

### 6.4 Known UI limitations

- **Tools can't be picked individually**: the available-tools dropdown only offers "default all permissions." There's no way to restrict Reviewer to read-only + running tests, or to keep Doc-Walker from editing code. **Workaround**: rely on the system prompt's HARD CONSTRAINTS as a soft constraint (every prompt opens with uppercase English DO NOT rules)
- **No workspace scope**: subagent configuration is global. Project-level differences can only be expressed through the project's AGENTS.md routing rules (see §5)
- **Requires a restart**: UI configuration changes don't take effect immediately — the client must be restarted

## §7 Honest disclosure (unverified boundaries)

This template is inferred from a single user's (Stan's) design; everything below is **not yet validated at scale**:

1. **The division of labor across the 5 subagents** is a design inference, not a data-backed conclusion. Stan has so far only run simple tasks through Explore (Turbo) + Implementer/Reviewer (GLM-5.2); Debugger and Doc-Walker haven't been used in practice yet
2. **Whether the cheap tier is good enough** depends on task complexity and model capability. Turbo is fine for mechanical search; exploration requiring cross-file reasoning may need to fall back to the flagship tier — there's currently no objective threshold for this judgment
3. **The tool allowlist relies on system-prompt constraints**, which are weaker than real tool restrictions — if a subagent doesn't comply, it could edit files it shouldn't. No such behavior has been observed so far, but it hasn't been validated at scale
4. **The ZCode UI field length limit is unknown** — if the system prompt field has a character cap, the templates in §2 may need to be compressed
5. **Implementer/Reviewer quote the superpowers skill**, which requires the user to have that plugin installed. The fallback without it is to inline the template into the UI

## §8 Appendix: Stan's actual current configuration (a reference value, not a mandate)

As of 2026-07-18, Stan's actual configuration on the z.ai Coding Plan:

| Subagent | Model | Config location |
|---|---|---|
| Explore (built-in, model override) | `GLM-5-Turbo` | `~/.zcode/v2/agents-state.json` → `builtInModelOverrides.Explore` |
| general-purpose (built-in, model override) | `GLM-5.2` (inherits default) | same as above |
| Implementer | not yet created | UI: Settings → Subagents |
| Reviewer | not yet created | same as above |
| Debugger | not yet created | same as above |
| Doc-Walker | not yet created | same as above |

**Confirmed working**: after configuring Explore → Turbo and restarting, the transcript confirms `"model":"builtin:zai-coding-plan/GLM-5-Turbo"` took effect.
**Not yet validated**: the 4 custom subagents haven't been created in the UI yet — this template's design is done; the next step is to set them up per §6 and feed real-world feedback back into this section.
