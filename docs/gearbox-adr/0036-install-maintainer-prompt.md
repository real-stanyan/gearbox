# ADR-0036: gearbox-install prompts to bind the maintainer interactively (TTY only)

- Date: 2026-07-22
- Status: accepted
- Related: ADR-0034 (maintainer anchors a GitHub username — the reason binding matters), ADR-0022 (gearbox-install), ADR-0027 (offline-tolerant network access pattern), ADR-0006 (L1 approval forms)

## Context

`npx gearbox-agents install` without `--maintainer` leaves the `<maintainer>` placeholder in the generated AGENTS.md, with only a soft "fill in later" reminder. That asymmetry has teeth:

- Async L1 approval (ADR-0034) is verified against the maintainer's GitHub account. An unfilled placeholder matches **no** account, so the PR-comment approval path is silently dead — safe-by-default (nobody can approve, rather than anybody), but invisible until an L1 change actually stalls.
- The Gate placeholder has a hard backstop: the generated ci.yml ships a deliberately-failing command, so CI stays red until it's filled. The maintainer placeholder had no equivalent forcing moment.

The npx flow is also the one case where a human is almost certainly sitting at a terminal — the cheapest possible moment to ask.

## Decision

When `--maintainer` is absent **and** stdin+stdout are both TTYs, gearbox-install asks once whether to bind a maintainer:

1. **Detected default**: `gh api user --jq .login` (4s timeout, silent null when gh is missing or logged out). The gh login is token-backed, so it is almost always the operator's real account.
2. **Prompt semantics**: with a detected default, Enter accepts it and `-` skips; with no default, Enter skips. Binding stays **optional** — the skip path produces exactly the pre-ADR end state (placeholder + reminder in Next steps).
3. **Typo check**: the public `api.github.com/users/<name>` endpoint, no auth. Only a 404 rejects (re-ask); rate limits pass; network failure accepts the name unverified with a warning — install never blocks on the network (same spirit as ADR-0027's offline-skip).
4. **Non-TTY is untouched**: CI, agent shells, and pipes never see a prompt; behavior there is byte-identical to before.

## Considered, not adopted

- **GitHub OAuth device-flow "hard binding"** — proving account ownership at install time has no consumer: the enforcement point is the PR-comment author check, which GitHub itself guarantees (only the account owner can comment as that account). Anyone can pass any `--maintainer` value today and that is fine — designating a maintainer is configuration, not authentication. OAuth would add an app registration, device-flow polling, and token handling (all hand-rolled under the zero-dependency constraint) for zero verification value. YAGNI.
- **A downstream gate assertion ("AGENTS.md must not contain `<maintainer>`")** — considered as the ci.yml-style hard backstop, but the template deliberately supports maintainer-less installs (solo experiments, undecided teams). A red CI would turn an optional field into a mandatory one, which is a protocol-boundary change this ADR doesn't want to make. The prompt closes most of the gap at zero coercion; revisit if placeholder-stall reports actually happen.
- **`git config user.name` as a detection source** — self-declared, unverifiable, and a display name rather than an account; exactly what ADR-0034 moved away from.

## Consequences

- Interactive installs now surface the maintainer decision at the moment it's cheapest to answer; the L1-dead-placeholder failure mode requires an explicit skip rather than a silent omission.
- The prompt lands before the write phase, so a Ctrl-C during the question leaves no partial scaffold.
- Agents driving install through a pipe see no behavior change; agents in a pty (rare) may see the prompt — the README's agent flow already tells them to pass `--maintainer` explicitly, which bypasses it.
- Tier: this ADR's text references the L1 approval mechanism, so the change is **L1** per ADR-0012 (mechanism reference takes priority). Version bump: **minor** (new mechanism).
