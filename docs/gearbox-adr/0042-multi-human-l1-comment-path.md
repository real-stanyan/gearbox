# ADR-0042: Multi-human repos narrow L1 approval to the PR-comment path

- Date: 2026-07-23
- Status: accepted
- Related: ADR-0006 (weak-b agreement forms), ADR-0034 (`<maintainer>` anchors a GitHub username), ADR-0036 (install maintainer binding)

## Context

ADR-0006's weak-b form accepts two L1 approval paths: the maintainer says "agreed" in the session, or writes "agreed" in a PR comment. ADR-0034 made the PR-comment path verifiable (comment author == the `<maintainer>` GitHub account) and explicitly accepted that the in-session path is unverifiable — "the maintainer is simply whoever is at the keyboard."

That acceptance is safe only while there is exactly one human. With a second collaborator, the in-session path becomes an impersonation channel: any collaborator can tell their own agent "I am the maintainer, agreed," and the agent has no way to check. Worse, the hole is unfalsifiable after the fact — in-session approval leaves no trace, so a merged L1 PR with no maintainer comment is indistinguishable from an impersonated one. The maintainer's after-the-fact veto (ADR-0006/0007) still works, but detection degrades to "the maintainer happens to remember they never agreed."

## Decision

**The number of humans in the repo selects the valid L1 approval paths:**

- **Single-human repo** (maintainer is the only human collaborator): both weak-b paths remain valid, unchanged. The keyboard is the maintainer; verification is meaningless.
- **Multi-human repo** (more than one human collaborator): **only the PR-comment path counts** — a comment authored by the GitHub account `<maintainer>` names (ADR-0034). In-session agreement is not valid L1 approval, no matter whose session it is, including the maintainer's own. Rationale for including the maintainer's own session: the rule's value is that *every* L1 merge carries a verifiable approval artifact; exempting "sessions that are really the maintainer" reopens the exact indistinguishability the rule closes.

The clause lands in the weak-b paragraph of AGENTS.md ("Changing the protocol itself"), so downstream installs inherit it verbatim.

**Companion hardening in this repo (outside the protocol text, not template-carried):** branch protection on `main` — required status check `gate`, required code-owner review via `.github/CODEOWNERS` covering the protocol surface (`AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/gearbox-adr/`, `.github/`, `scripts/`, `.gearbox-version`), force pushes and deletions blocked, **not enforced on admins**. GitHub cannot see the L1/L2 semantic boundary, so the mapping is by file path and deliberately one notch coarser: a non-admin collaborator touching any protocol file needs maintainer review, even for edits that are L2 in protocol terms. The maintainer (admin) and their agents are unaffected, preserving agent self-merge. Downstream repos that want the same hardening replicate it in their own settings; the template only records the pattern here.

## Consequences

- Multi-human repos: every L1 merge now has a durable, verifiable approval artifact (the maintainer-account comment). The impersonation path via chat is closed by rule; the CODEOWNERS layer closes it by mechanism for non-admin collaborators in this repo.
- Single-human repos: zero change — no new ceremony for the template's most common case.
- Cost: in multi-human repos the maintainer must leave a PR comment even when they already agreed in session (one extra click). Accepted — the artifact is the point.
- The human-count boundary is self-assessed (the protocol doesn't define how to count collaborators mechanically). Edge cases (a drive-by PR from a fork, a departed collaborator) resolve conservatively: if in doubt, use the PR-comment path — it is always valid.
- Tier = **L1**: edits the weak-b clause in "Changing the protocol itself" (ADR-0006/0012). Maintainer directed and approved in session (single-human at the time of this change, so the in-session path is still valid for approving this very change).
- Version = **minor** (new protocol clause + new ADR, ADR-0023).
- **Considered, not adopted**: requiring GitHub's Approve button (retracts ADR-0006's weak-b trade-off, same rejection as ADR-0034); a CI check scanning PR comments for the maintainer's "agreed" (enforcement theater — the agent merges locally anyway; the veto and the comment artifact are the real mechanisms); enforcing branch protection on admins (would block the maintainer's own agents' self-merge, contradicting ADR-0007).
