<!--
This template is the protocol-layer contract carrier for Gearbox (ADR-0013).
GitHub applies it automatically to new PRs. Fill in as needed; do not delete the
Affects downstream field.
-->

## What / Why / Changes

<!-- Briefly: what was done / why / list of changed files. Once CI is green, merge it yourself (L2) or wait for maintainer agreement (L1). -->

## Affects downstream

<!-- Informational declaration (ADR-0013 → ADR-0026 pull model). Pick one:

  - `no`  —— this PR doesn't affect downstream projects (e.g. Gearbox-internal docs, CI config, ADR template tweaks)
  - `yes` —— this PR affects downstream (protocol-level changes: Hard rules / Gate / Tech stack /
             Working agreement / the index / any new content that references L1/L2 tiering or a
             protocol mechanism — see the ADR-0012 criterion)

Backfill is pull-driven: downstream repos self-check with `gearbox-version` when starting a shift,
and run `gearbox-update` if behind (ADR-0026). This field **no longer blocks merge** — marking `yes`
does not require opening an issue against every downstream repo. It only helps assess the blast
radius + helps the maintainer decide whether to **optionally** open a notification issue against
known downstream projects.

If `no`: briefly explain why it doesn't affect downstream (e.g. "pure ADR template formatting tweak, doesn't change protocol content").
-->

- Affects downstream: <!-- no | yes + one sentence on the blast radius -->

## Version bump

<!-- Required (ADR-0023). Pick one of four:

  - `major` —— a cross-tool/cross-repo contract change (hash-stamp format / install anchor structure /
               file layout / rename); downstream needs manual intervention
  - `minor` —— a new mechanism (new ADR / new tool / new protocol clause)
  - `patch` —— a revision to an existing file (wording / status line / typo)
  - `none`  —— doesn't touch the protocol or tooling (needs one sentence of justification, e.g.
               "pure README typo")

In the same PR, the author sets package.json's version to the target for this change
(= latest tag + bump segment, ADR-0028/0029).
After merge, the author agent tags relative to the latest tag as of merge time and pushes it:
  git tag -a v0.x.y -m "one-line summary" && git push origin v0.x.y
The maintainer then runs npm publish to release the npx package (ADR-0029; needs npm credentials,
agents don't run this on the maintainer's behalf).
`none` triggers no tag/publish and doesn't touch package.json's version.
-->

- Version bump: <!-- major | minor | patch | none -->

## Gate

```
<!-- paste the output of node scripts/check-gearbox.js -->
```
