# ADR-0006: Tiered authority for protocol changes — L1 (Hard rules/Gate/Tech stack) needs human agreement, L2 is autonomous

- Date: 2026-07-17
- Status: partially superseded by ADR-0012 (the L1/L2 tiering itself still holds; but "how to classify new protocol-level content" is completed by ADR-0012's criterion — mechanism reference takes priority)
- Provenance: this decision originated in the date-cli Path A experiment (originally date-cli ADR-0009, decided by Stan), and backfilled into the scaffold after being validated in real multi-agent collaboration

## Context

Midway through Path A, the protocol hit a deadlock: **it claimed "hit a gap, open an issue, close it once the gap is folded into AGENTS.md" — but never said who has the authority to edit AGENTS.md.** As a result, all 4 open Protocol gap issues got stuck and couldn't be closed — not for lack of work, but for lack of a key.

date-cli first broke the deadlock with the original ADR-0004: "an agent may edit AGENTS.md via issue+ADR+PR, and a human retains after-the-fact revert veto power." But by the fourth round, the experiment exposed a problem: **this authorization was too broad for Hard rules and Gate commands** —

| Content type | Nature | Risk of full autonomy |
|---|---|---|
| Hard rules (e.g. UTC ms / pure functions / immutability) | Foundational consistency premise = physical law | An agent changing this autonomously = the foundation fails; by the time an after-the-fact revert happens, a lot of code has already been rewritten against the new rule |
| Gate commands (tests / typecheck / lint) | The one constraint that doesn't rely on discipline | An agent changing this autonomously = it gets to define "what counts as done" itself, turning the gate into a rubber stamp |
| Tech stack | The foundation of technology choices | Same risk as Hard rules |
| Working agreement (excluding Gate) | Process coordination | Low risk, cheap to experiment with |
| Index (Where to find things) | Documentation upkeep | Extremely low risk |

The after-the-fact revert brake is adequate for frequent small changes, but not for structural ones.

## Decision

**Tiered authority for protocol changes:**

| Tier | Content | Process |
|---|---|---|
| **L1 strict tier** | Hard rules / Gate commands / Tech stack / the "Changing the protocol itself" section itself | issue + ADR + PR, **and the agent may only merge after `<maintainer>` (after copying the scaffold, replace this placeholder with your project's maintainer name) explicitly agrees, in-session or in a PR comment** |
| **L2 autonomous tier** | Working agreement (excluding Gate) / index (Where to find things) | issue + ADR + PR, agent may self-merge |

**Weak-b form**: "explicit agreement" means the maintainer says "agreed" in a session, or writes "agreed" in a PR comment — that's enough, and the agent clicks the merge button itself. **GitHub's approve button is not required.** The cost is that the maintainer becomes the L1 bottleneck — that cost is accepted, in exchange for L2 continuing to validate agent autonomy.

> Projects that copy this scaffold: **replace `<maintainer>` in this ADR and in AGENTS.md's "Changing the protocol itself" section with your own name (or team name)**. If it's a solo project, you are the maintainer; if it's a team, designate who the L1 gatekeeper is.

### Why not other options

- **Not sticking with full autonomy (original date-cli ADR-0004)**: Hard rules / Gate risk is too high, see table above.
- **Not choosing strong-b (mandatory GitHub approve button)**: too much operational burden on the maintainer; weak-b's paper trail (PR + ADR + comment) is already enough.
- **Not choosing "everything needs agreement"**: Working agreement / index changes aren't worth reviewing every time — it would wear the maintainer out and undercut the value of agent autonomy.
- **Not going back to "agents can't change the protocol"**: that's the original deadlock; the protocol can't self-repair that way.

## Consequences

- **The maintainer becomes the bottleneck for L1 changes** — any Hard rules / Gate / Tech stack change must wait on their agreement. When an agent hits a gap of this kind, it can open the issue, write the ADR, and open the PR, but cannot merge — **it must state in the Memory comment that it's "blocked waiting on maintainer agreement."**
- **L2 changes remain self-sufficient** — Working agreement / index changes can be completed autonomously by an agent, without disturbing the maintainer.
- **Self-referential boundary**: L1 includes the "Changing the protocol itself" section itself. Changing the tiering rule → requires maintainer agreement. Tightening something to L2 → requires agreement; loosening something to L1 → requires agreement. **This self-reference is an accepted cost, to prevent an agent from expanding its own authority.**
- **Risk**: if the maintainer only sees weak-b's "agreed in a session" much later, the agent stays blocked in the meantime. Mitigation — L1 changes should be rare in practice (physical laws don't change often).
- **Evolution**: if L1 practice proves the risk is manageable, it can be loosened via a further ADR; and vice versa. This ADR itself can be superseded by a new one.
