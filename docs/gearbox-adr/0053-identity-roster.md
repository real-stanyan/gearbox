# ADR-0053: An identity roster, and an L1 rule that doesn't claim what it can't verify

- Date: 2026-09-30
- Issue: #149
- Status: accepted
- Related: ADR-0006 (weak-b agreement — amended), ADR-0034 (maintainer anchors a GitHub account — amended: the roster replaces `## Maintainer`, team handles dropped), ADR-0042 (multi-human repos use the PR-comment path — amended: the human count comes from the roster, and the path becomes the maintainer's own merge), ADR-0012 (the "Why so strict" note moved out of the fence), ADR-0051 (fence budget)

## Context

ADR-0034 anchored L1 approval to the maintainer's GitHub account, and ADR-0042 made a PR comment from that account the only valid approval in a multi-human repo. Both assume only the maintainer acts under that account. In practice agents act under the humans' accounts: the downstream audit (2026-09-28) found every agent working under a human login, no L1 PR approved through a PR comment, and an agent-written "approval record". In the Gearbox repo, the handoff Memory for #148 was posted by an agent under the maintainer's account, and #144 was merged by the maintainer's hand after an agent's merge was refused by its tool — two acts GitHub shows identically. An `agreed` comment from a shared account proves nothing.

ADR-0042 also switched on "more than one human collaborator", which nothing recorded; #132 names the same hole from the other side (the repo owner is an unmodeled actor). And no rule said an approval covers only the commits it saw.

## Decision

- **`## Roster` replaces `## Maintainer`** (an L1 project section). One line per GitHub account: `human: <person>` (only that person acts under it), `shared: <person>` (the person and their agents), or `agent, run by <person>` (only agents). `— maintainer` on a human or shared line marks the maintainer's accounts. `scripts/lib/roster.js` is the only parser; `gearbox-agents check` reports unreadable lines, duplicates and a roster with no maintainer line. The kinds are a record, not a gate.
- **Human count** = distinct people on `human`/`shared` lines; more than one = a multi-human repo. This replaces ADR-0042's self-assessment.
- **Every repo**: L1 agreement comes only from the maintainer — an `agreed` PR comment or an Approve review from a maintainer account, or agreement in the session — and covers the commits it saw; a later push needs a new one.
- **Multi-human repos**: only the maintainer's own merge approves an L1 PR, and agents never merge one. The comment path and in-session agreement stop counting there: under shared accounts neither shows who approved.
- **Every repo**: an agent never writes an approval — no `agreed` comment, no Approve review, no approval record — for anyone, under any account.
- **Team handles are dropped** (ADR-0034 allowed one): a line names one account; a team lists its members.
- **Fence budget**: the fence went from 19796 B to 19319 B. The "Why so strict" blockquote was deleted from the fence; its precedent lives in ADR-0012: agents use "optional + purely additive" as an L2 channel to widen the protocol (PR #21), and the mechanism-reference criterion closes it.

## Alternatives rejected

- **A separate agent account** (a machine user; agents work only under it, and the maintainer's human-only account makes approvals attributable). Declined by the maintainer: an extra account and its credentials on every agent machine, and in the Gearbox repo a required Approve click on every agent PR — a non-admin account can't bypass code-owner review, and a user-owned repo has no Maintain role to grant a narrower bypass. This is the upgrade path if attributable approvals become necessary.
- **The maintainer's second account as a human-only approval account.** Same effect without a new account, but agents have used it.
- **Keeping the comment path under shared accounts.** It proves nothing, and the audit found it unused.
- **An `approval` command** that checks a PR for a current approval. With merge-only approval in multi-human repos, it has nothing to check that the agent can act on.

## Consequences

- The L1 rule now states what it relies on: agents obeying it. GitHub shows a merge by the maintainer's account, not whose hand pressed it. The backstops are the agent tool's own permission prompts and the after-the-fact veto (ADR-0006/0007).
- In a multi-human repo an agent opens an L1 PR and stops; per the existing rules, an open PR at shift-end gets a progress comment on its Task issue.
- Single-human repos are unchanged except that an approval now expires with a later push.
- The Gearbox repo is multi-human (two people), so its L1 PRs are merged by the maintainer's hand. Its L2 flow and branch protection are unchanged.
- Tier = **L1** (the weak-b clause, the Maintainer → Roster section). Version: ships inside v2.0.0 (the `## Maintainer` → `## Roster` layout change is part of the v2 major). Affects downstream: yes — the v1 → v2 migration and install write `## Roster`.
