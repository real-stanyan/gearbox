# ADR-0029: The release ritual incorporates npm publish + package.json version sync

- Date: 2026-07-20
- Status: accepted
- Related: ADR-0023 (protocol version scheme / tag flow, this ADR extends its process section), ADR-0028 (npx distribution)

## Context

ADR-0028 turned the tools into an npm package (`gearbox-agents`); `npm publish` is the step that makes npx distribution actually work, but it's scattered in ADR-0028's text and not part of the protocol body's release flow. Consequences:

1. It's easy to forget to publish after tagging → the npm version falls behind the git tag, and `npx gearbox-agents@latest` serves an old protocol.
2. `package.json`'s `version` must share the same number as the git tag (ADR-0028's decision), but when exactly to sync it isn't written into the flow → easy to forget, letting the two numbers drift apart.

ADR-0023's release flow only goes as far as "tag and push," and doesn't cover the npm-package layer. This ADR fills that in.

## Decision

Extend ADR-0023's release flow (AGENTS.md's "protocol version scheme" section) with two more steps:

1. **package.json version sync (within the PR)**: in the same PR that declares `Version bump`, the author changes `package.json`'s `version` to the target version for this release (= latest tag at merge time + segment). The npm package version and the git tag stay identical (ADR-0028).
2. **npm publish (after tagging, maintainer)**: after merge + tagging/push, **the maintainer runs `npm publish`** to publish the npx package. `npm publish` publishes to an external registry and needs npm credentials → **maintainer-only, manual**, the agent doesn't run it on their behalf (ADR-0028's 6th decision).

Full flow order: PR declares `Version bump` + changes `package.json` version → CI green → merge → author agent tags an annotated tag + pushes → maintainer runs `npm publish`.

- The `none` segment (no protocol or tool changes) doesn't trigger publish, and `package.json` version isn't touched either.
- The failure mode of forgetting to change `package.json` / forgetting to publish is the same as ADR-0023's forgetting to tag: the author of the next release fixes it up (a patch correcting the version number / a make-up publish). No automated gate is introduced to enforce this — keep it lightweight, humans backstop it.

## Consequences

- The release ritual becomes a single unified flow: one process runs from the Version bump declaration all the way to going live on npm, with no more hidden drift like "tagged but npm never updated."
- **Tier = L1**: changing AGENTS.md's "protocol version scheme" section (within the "Changing the protocol itself" section, protocol body) = L1 (ADR-0006). Three-piece set + merge only after the maintainer "agrees."
- **Version = patch**: a revision of existing files (AGENTS.md's version section + PR template), adding one flow step, no new cross-tool/cross-repo contract, and not a new mechanism (the publish mechanism already exists in ADR-0028) → patch → v1.2.2.
- **Knock-on effect on the install anchor**: gearbox-install transforms the "protocol version scheme" section into the downstream receiving-end version (downstream doesn't publish gearbox); the anchor updates along with the body change — pure tool follow-along, same PR.
- **No impact on downstream**: downstream is a consumer of gearbox, not a publisher of the gearbox protocol package; `AGENTS_MD_IMPACT[29] = null`.
- **Considered but not adopted**: CI auto-running `npm publish` (needs an `NPM_TOKEN` secret + the risk of automatic publishing) — rejected, publish stays a manual, deliberate maintainer action; if automation is truly wanted, the maintainer configures their own Action, not part of the protocol default.
