# ADR-0034: `<maintainer>` anchors to a GitHub username

- Date: 2026-07-22
- Status: accepted
- Related: ADR-0006 (protocol change tiers / weak-b agreement), ADR-0012 (L1/L2 boundary criterion)

## Context

The template told adopters to "replace `<maintainer>` with your (or your team's) name." A display name anchors nothing an agent can verify:

- **In-session approval**: the maintainer is simply whoever is at the keyboard. No verification is possible in any scheme — the name string plays no role here. This stays as-is (accepted).
- **Async approval (the PR-comment path of the weak-b form, ADR-0006)**: "agreed" written in a PR comment carries exactly one verifiable identity — the GitHub account that authored the comment. A display name and the account may not even match (this repo's own dogfood pair: "stanyan" vs `real-stanyan`), leaving an agent to guess the mapping. In a multi-contributor or public-fork repo, "whose 'agreed' counts as L1 approval" was formally undefined.

## Decision

`<maintainer>` is defined as a **GitHub username** (a team = a GitHub team handle):

1. The copy-note in AGENTS.md now instructs adopters to fill in a GitHub username and states why.
2. The weak-b clause now states explicitly: for the PR-comment path, only a comment authored by the GitHub account `<maintainer>` names counts as L1 approval — anyone else's "agreed" does not.
3. `gearbox-install` usage text and README install examples say `--maintainer <your-github-username>`; the install `mustReplace` FROM string is synced with the reworded copy-note (string coupling, same class as ADR-0031's).

Deliberately **not** added: any technical enforcement (branch protection, CODEOWNERS, comment-author CI checks). The weak-b form stays a procedural contract backed by the after-the-fact veto (ADR-0006/0007) — this ADR only makes the identity it names verifiable, not machine-enforced.

## Consequences

- Async L1 approval now has an objective identity check an agent can perform: compare the comment author against `<maintainer>`.
- In-session approval is unchanged and remains unverifiable by design.
- Existing downstreams that filled in a display name keep working (nothing breaks mechanically); aligning means editing one word in AGENTS.md.
- Tier = **L1**: edits the "Changing the protocol itself" section (ADR-0006/0012).
- Version = **patch** (revision to existing files, no new mechanism); collapses into the pending untagged v1.4.0 (ADR-0023 catch-up), `package.json` untouched.
- **Considered but not adopted**: requiring GitHub's Approve button (retracts ADR-0006's weak-b trade-off — rejected); adding a CI check that scans PR comments for the maintainer's "agreed" (enforcement theater — the agent merges locally anyway and the veto remains the real backstop).
