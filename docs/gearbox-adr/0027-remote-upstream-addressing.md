# ADR-0027: Upstream remote addressing — tools support pulling from a remote, pull serves stranger forks

- Date: 2026-07-20
- Status: accepted
- Related: ADR-0016 (gearbox-version), ADR-0017 (gearbox-update), ADR-0022 (gearbox-install), ADR-0023 (version scheme / `.gearbox-version` stamp), ADR-0026 (pull trigger, this ADR is its follow-on)

## Context

ADR-0026 changed backfill to pull (downstream self-checks at start of shift → gearbox-update pulls), but all three tools only look for upstream **locally**:

```
GEARBOX_DIR = env.GEARBOX_DIR || ~/Github/gearbox   # consistent across version/update/install
```

That's fine for the maintainer's own fleet — downstream and upstream share a machine, sharing one copy of `~/Github/gearbox`. But it breaks the moment a stranger forks: `alice/myapp` adopts the protocol, her machine has no `~/Github/gearbox`, and `gearbox-version` just says `✗ Gearbox ADR directory not found`. Pull promises "downstream goes and finds it at upstream itself," but the tool doesn't know **which remote to look at**.

This is the follow-on ADR-0026 explicitly split off: the **necessary condition** for pull to serve stranger forks. This ADR decides and implements it together (the shared version).

## Decision

Add **remote upstream addressing** to the tool family, four sub-decisions:

### 1. Where the upstream address lives → a new file `.gearbox-upstream` (config, not a stamp)

Add a new root-level file `.gearbox-upstream`, one line = the upstream repo's git URL (e.g. `https://github.com/real-stanyan/gearbox.git`).

- **Division of labor with `.gearbox-version`**: `.gearbox-version` is a **stamp** (the tool writes it, records "which version I'm at"); `.gearbox-upstream` is **config** (records "where my upstream is," install writes it, humans can edit it). Different semantics, so don't stuff them into the same file — that would avoid changing `.gearbox-version`'s format (that's a cross-tool contract; changing it would trigger a major bump).
- **install writes it automatically**: `gearbox-install` reads `git remote get-url origin` from the `GEARBOX_DIR` it's running from, and writes it into the downstream's `.gearbox-upstream` (if origin can't be found, it skips this with a warning). When the maintainer sets up a machine → points at `real-stanyan/gearbox`; when a stranger installs from their own fork → points at their fork. Humans can edit it afterward to chase a different upstream.
- **committed config**: `.gearbox-upstream` is committed with the downstream repo (it's configuration, not a build artifact); the cache is not committed (see 3).

### 2. How to fetch remote ADRs/tags → shallow-clone cache (git, not the gh API)

The remote upstream is **shallow-cloned into a local cache directory** (`~/.cache/gearbox/<sha12(url)>`, `git clone --depth 1` the first time, `git fetch` afterward), and then **all the existing local read logic is reused** (just point the resolved upstream directory at the cache). Tags are fetched separately with `git ls-remote --tags <url>` (a shallow clone doesn't guarantee the full tag history); ADR file contents come from the cached working tree.

- Chose git over `gh api`: ① maximum reuse — once the cache is in place, version/update's local filesystem read/write logic needs **zero changes**; ② doesn't depend on the gh CLI/GitHub, works the same on GitLab/self-hosted git; ③ native tag semantics.
- Cost: cache disk usage + first-clone latency (mitigated by `--depth 1` + subsequent fetches).

### 3. Cache location → `~/.cache/gearbox/`, never committed to the repo

The cache lives at `$XDG_CACHE_HOME/gearbox/` (defaulting to `~/.cache/gearbox/`), one `sha12(url)` subdirectory per upstream URL. The cache is **outside the downstream repo**, so it's naturally excluded from git; no `.gitignore` backstop needed (unless someone deliberately points the cache into the repo, which is not a supported usage).

### 4. Addressing priority + offline degradation

**Priority (high → low)**: ① `GEARBOX_DIR` env (escape hatch, always highest) → ② local default `~/Github/gearbox` (used if present — the maintainer's fleet takes this path, fast and always current) → ③ `.gearbox-upstream` remote cache (when neither local option exists — stranger forks take this path).

> The maintainer's fleet has **completely unchanged behavior** (local `~/Github/gearbox` hits, remote is never touched at all). Remote only activates when local upstream is absent — purely additive, backward compatible: existing downstreams without `.gearbox-upstream` are unaffected (they have a local upstream).

**Offline degradation**:
- `gearbox-version` (read-only, advisory): remote unreachable (offline/no network) → `⚠ Cannot reach upstream, skipping version check` + **exit 0** (doesn't block starting a shift).
- `gearbox-update` (active pull): unreachable → **hard error, exit 1** (if you can't pull it, you can't pull it — no pretending it succeeded).

## Consequences

- **The pull loop closes for stranger forks**: install writes `.gearbox-upstream` → at start of shift `gearbox-version` clones-and-caches to compare when no local upstream exists → if behind, `gearbox-update` pulls from the cache. ADR-0026's public promise now holds for strangers too.
- **Zero regression for the maintainer's fleet**: local-first, the remote path never triggers at all for the existing fleet. Sandbox verification covers both local regression and the remote path (against real GitHub).
- **Cross-language duplication cost (honest record)**: the addressing + caching logic is written once each in **bash (version)** and **node (update)** — the tool family was already cross-language (ADR-0016 Bash / 0017 Node), and this amplifies the duplication. No shared library is introduced for this (that would add a dependency to zero-dependency tools); the contract (`.gearbox-upstream` format + cache path convention) is nailed down in this ADR as the alignment anchor. install only **writes** `.gearbox-upstream` and does no remote resolution itself (it always runs from a local upstream), so it doesn't share in this duplication.
- **A new network-failure mode**: the tools go from "pure local filesystem, zero network" to "may touch the network." "Local-first + offline degradation" confines the blast radius to the single path of "local upstream absent."
- **Tier / version**: pure tool capability, doesn't touch the AGENTS.md protocol body (ADR-0017's "personal tool, not a protocol change" precedent) → **L2**, three-piece set as usual (issue + this ADR + PR), self-merge once CI is green. Adds the `.gearbox-upstream` mechanism, backward compatible (no file = local fallback) → **minor** (new mechanism, ADR-0023); doesn't change `.gearbox-version`'s format, so not major → after v1.0.0 this becomes v1.1.0.
- **Considered but not adopted**: expanding `.gearbox-version` to two lines (mixing config+stamp in one file) — rejected, changing the stamp format = major and blurs the "tool-written vs. human-written" boundary. Fetching data via `gh api` — rejected, ties to GitHub + the gh CLI, giving up native git tag semantics and reuse of local-read logic. Multiple upstreams / upstream chains — YAGNI.
- **A gap that's still not closed (honest record)**: this ADR solves upstream **data** addressing (where to find ADRs/tags), not **script distribution** — the `gearbox-version`/`gearbox-update` scripts themselves still live in upstream's `scripts/`, and install doesn't carry them into downstream. For a stranger's fork to run pull, they first have to get the scripts onto their own PATH (clone gearbox + symlink). The command ADR-0026 injects as the downstream's 4th start-of-shift step currently hardcodes `~/Github/gearbox/scripts/` (the maintainer's layout). True public distribution (npx / brew / scripts landing via install) is the next follow-on, not covered by this ADR. So this ADR moves "pull for stranger forks" from "impossible" to "feasible but requires manually configuring the scripts," not "zero-config, works out of the box."
