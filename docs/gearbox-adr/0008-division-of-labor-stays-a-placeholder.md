# ADR-0008: Division of labor stays a placeholder — division of labor is a project property, not a template property

- Date: 2026-07-17
- Status: accepted

## Context

Point 3 of issue #3: the Division of labor section of AGENTS.md is still an `<e.g.: ...>` placeholder — "which agent owns which kind of task, and what to do at the edges, has no actionable agreement." The acceptance criteria offered two paths: fill it in for real, or explicitly remove it with a stated reason.

The four rounds of the date-cli Path A experiment provide a data point: this section was also deliberately left blank in date-cli ("fill it in once the experiment produces some experience"), and after four rounds, **no division-of-labor experience was produced** — because under the shift model, agents work in relay, not in parallel; each shift does a complete task, and task type was never routed by agent specialty. What the experiment validated was the handoff mechanism, not a division-of-labor mechanism.

## Decision

**Third path: the placeholder is the correct answer — make "it's a placeholder" explicit instead of ambiguous.**

- This section stays a placeholder, but the placeholder text becomes actionable guidance: fill it in per-project when copied; when it's not filled in, or an edge case is hit, the **default rule = Task issue claim-and-own** (whoever claims a task does it start to finish, already established in While working); solo-agent projects may delete the whole section (this section is not a gate anchor, so deleting it doesn't break `check-scaffold.js`).
- No rule is invented from n=0 division-of-labor experience. date-cli's candidate split (mechanical bulk edits → Z Code; design / hard bugs → Claude Code) is kept as an example, labeled as an unvalidated candidate.

### Why not fill it in

Division of labor depends on which agents a project has on hand, their respective strengths, and the composition of its tasks — all project properties. Hardcoding any specific split in the template would leave whoever copies it either blindly following it or deleting it — neither is as good as a placeholder with guidance attached.

### Why not delete it

"Routing tasks by agent specialty" is a real need in multi-agent collaboration (issue #3 was opened because this was actually hit) — removing the section would mean pretending the problem doesn't exist. Keeping the placeholder plus the default claim-and-own rule gives even unfilled projects an actionable fallback.

## Consequences

- Projects that copy the scaffold get three clear options: fill it in / use the default claim-and-own rule / delete the section. There's no more ambiguity about "was this placeholder forgotten or intentional."
- **The default claim-and-own rule becomes the formal fallback when there's no division-of-labor agreement** — upgraded from "an implicit corollary of While working" to an explicit rule.
- If a project using this scaffold produces a reusable division-of-labor pattern in the future, it can be backfilled as a new ADR + example, without changing the structure of this decision.
