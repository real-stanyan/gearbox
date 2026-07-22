# ADR-0028: npx zero-config distribution — the tools become an npm package, strangers get started with one command

- Date: 2026-07-20
- Status: accepted
- Related: ADR-0016 (gearbox-version, bash), ADR-0017 (gearbox-update), ADR-0022 (gearbox-install), ADR-0023 (version scheme), ADR-0026 (pull trigger), ADR-0027 (remote addressing, this ADR is its follow-on)

## Context

ADR-0027 solved upstream **data** addressing (where to find ADRs/tags), but left a **script distribution** gap: the `gearbox-install`/`version`/`update` scripts themselves still live only in upstream's `scripts/`; a stranger has to clone gearbox and put the scripts on their PATH before they can run them. The command ADR-0026 injects as the downstream's 4th start-of-shift step also hardcodes `~/Github/gearbox/scripts/` (the maintainer's layout) — the wrong path for a stranger.

The maintainer picked the distribution channel = **npm / npx** (a session decision): a stranger runs `npx gearbox-agents <cmd>` to get started with zero config, needing only node — no clone / symlink / PATH setup.

## Decision

Package the tool family as an npm package, distributed via `npx`.

### 1. Package structure: the gearbox repo itself = the package, `bin/gearbox.js` is the dispatcher

- Add `bin: { gearbox: "bin/gearbox.js" }` to `package.json`; the `files` allowlist packages an **upstream snapshot** — `AGENTS.md` / `CONTEXT.md` / `docs/adr/` (install's copy source) + `scripts/` + `bin/`.
- `bin/gearbox.js` (the node dispatcher): routes `install|version|update`, passes arguments through as-is, passes the exit code through.

### 2. The npx path reuses local logic: the dispatcher sets `GEARBOX_DIR=<package root>`

The npm package carries its own upstream snapshot (the AGENTS.md + docs/adr at packaging time); the dispatcher points `GEARBOX_DIR` at the package root → the three tools' **existing local-path logic works with zero changes**. **The npx path never touches the remote at all** — ADR-0027's remote addressing is the fallback for "downstream cloned via git, no local upstream," not the npx path. The two distribution paths (npx package snapshot / git-clone + remote addressing) each resolve their own upstream, without interfering with each other.

### 3. The package isn't a git repo → version resolution goes through an env override

npm strips `.git`, so `git tag` can't be read inside the package. The dispatcher reads `package.json`'s `version` and passes it to the tools as `GEARBOX_UPSTREAM_VERSION=v<version>`. Version-resolution priority is unified across all three tools as: **env override (npx) > remote ls-remote (ADR-0027) > local git tag**. install's writing of the `.gearbox-version` stamp and `.gearbox-upstream` (npx has no git origin → falls back to reading `package.json`'s `repository.url`) honors the env the same way.

### 4. version stays bash, the dispatcher shells out (not rewritten in node)

`gearbox-version` stays bash (ADR-0016's decision unchanged); the dispatcher executes it via `bash` for `version` and via `node` for `install`/`update`. **Cost**: running version via npx requires bash in the environment (native on mac/linux; Windows needs Git Bash / WSL). For a multi-agent coding-protocol tool, bash availability is a reasonable assumption; install/update (node) work as usual on Windows. If pure-node cross-platform support is truly needed, split that off separately — not worth rewriting 148 already-verified lines of bash for this.

### 5. Version coupling: npm version === protocol git tag

The npm package version and the protocol git tag (ADR-0023) **share the same number**. Release flow: in the release PR, change `package.json`'s version to the target version for this release; after merge, the author agent tags the same annotated tag (ADR-0023's original flow) + **the maintainer runs `npm publish`**. The step-4 injection / install hints switch to `npx gearbox-agents <cmd>`.

### 6. publish is a maintainer action (tools/agents don't run it on their behalf)

`npm publish` publishes to an external registry and needs the maintainer's npm credentials → **only the maintainer can run it manually** (or the maintainer sets up their own `NPM_TOKEN` + a CI Action; this ADR doesn't presuppose an Action, manual is the default). The agent only prepares the package + does local verification.

## Consequences

- **Zero-config closed loop for strangers**: `npx gearbox-agents install` (scaffolds, upstream = package snapshot) → at start of shift `npx gearbox-agents version` self-checks → if behind, `npx ... update` backfills. No clone, no symlink, no PATH setup. The script-distribution gap ADR-0027 left is now closed.
- **Two distribution paths coexist**: ① npx (strangers, package snapshot as upstream) ② git-clone + local/remote addressing (the maintainer's fleet + anyone who wants to track git). The maintainer's local `gearbox-version` runs behaves identically (GEARBOX_DIR hits the local git repo, env override is never set).
- **Maintenance cost of version coupling (honest record)**: `package.json`'s version must be kept manually in sync with the git tag (change package.json in the release PR + tag after merge). If you forget, the upstream version npx reports won't match the tag. Using one number (not two) minimizes cognitive load, at the cost of one extra line per release + remembering to publish.
- **bash dependency (honest record)**: npx version doesn't work on a pure Windows environment without bash (install/update do work). An acceptable, documented degradation.
- **Package name**: `gearbox-agents` (unscoped). The original choice `gearbox` was taken (an npm DI container); `@real-stanyan/gearbox` scoped was also viable, but the maintainer chose an unscoped short name. The name appears in 4 places (package.json / dispatcher help / install's step-4 injection / README) — a rename would need to touch all of them together.
- **Tier / version**: pure tool/distribution capability, doesn't touch the AGENTS.md protocol body (ADR-0017's "personal tool, not a protocol change" precedent) → **L2**, three-piece set as usual. Adds the npx distribution mechanism, backward compatible (the git-clone path is unchanged) → **minor** → after v1.1.0 this becomes **v1.2.0**.
- **Considered but not adopted**: a curl|bash bootstrap script (rejected — curl|bash's trust surface + needing a self-hosted URL; the maintainer chose the standard npm channel); rewriting version in node to make it a pure-node package (rejected — would overturn ADR-0016 and rewrite already-verified bash; shelling out is good enough); decoupling npm version from protocol version into two separate numbers (rejected — the cognitive load of two numbers outweighs the cost of manually syncing one line).
