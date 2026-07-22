#!/usr/bin/env node
// gearbox — npx dispatcher (ADR-0028).
//
// Lets strangers use the tool family with zero config: `npx gearbox-agents <install|version|update>`.
// The npm package ships its own upstream snapshot (bundles AGENTS.md / CONTEXT.md /
// docs/gearbox-adr/, see package.json "files"); the dispatcher points GEARBOX_DIR at the
// package root → the three tools reuse the existing local-path logic, and the npx path never
// touches the remote at all (ADR-0027's remote addressing is a fallback for git-clone
// downstreams, not the npx path).
//
// The package is not a git repo (npm strips .git), so the upstream version number comes from
// package.json via an env override, GEARBOX_UPSTREAM_VERSION, passed to the tools (tools prefer
// it, falling back to the git tag otherwise).
//
// Subcommand routing: install/update = node scripts; version = bash script (ADR-0016 left
// unchanged, see ADR-0028 for the decision). Args are passed through as-is. Exit codes are
// passed through.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { argv, exit, env, stderr } from "node:process";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// Package version (package.json) → passed to the tools as the upstream version (the package
// isn't a git repo, so a tag can't be read)
let pkgVersion = null;
try {
  pkgVersion = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version || null;
} catch {
  /* shouldn't happen in practice — the package always ships package.json */
}

const ROUTES = {
  install: { cmd: "node", file: "scripts/gearbox-install" },
  version: { cmd: "bash", file: "scripts/gearbox-version" },
  update: { cmd: "node", file: "scripts/gearbox-update" },
  prune: { cmd: "node", file: "scripts/gearbox-prune" },
};

const [sub, ...rest] = argv.slice(2);

if (!sub || sub === "-h" || sub === "--help") {
  stderr.write(
    "gearbox <command> [args]\n\n" +
      "  install   lay down the Gearbox skeleton in the current (or a given) directory\n" +
      "  version   check which upstream version / which ADRs the current downstream repo is synced to\n" +
      "  update    backfill: copy ADRs missing from the current downstream repo, from upstream\n" +
      "  prune     branch hygiene: clean up merged/stale branches (dry-run by default, ADR-0030)\n\n" +
      "example: npx gearbox-agents install --maintainer you --gate \"npm test\"\n",
  );
  exit(sub ? 0 : 1);
}

const route = ROUTES[sub];
if (!route) {
  stderr.write(`Unknown command: ${sub}  (run gearbox --help for usage)\n`);
  exit(1);
}

try {
  execFileSync(route.cmd, [join(pkgRoot, route.file), ...rest], {
    stdio: "inherit",
    env: {
      ...env,
      // upstream = the package's own snapshot (unless the caller explicitly overrides GEARBOX_DIR)
      GEARBOX_DIR: env.GEARBOX_DIR || pkgRoot,
      // upstream version = the package version (tools prefer this, falling back to the git tag);
      // the "v" prefix keeps it aligned with tag semantics
      GEARBOX_UPSTREAM_VERSION:
        env.GEARBOX_UPSTREAM_VERSION || (pkgVersion ? `v${pkgVersion}` : ""),
    },
  });
} catch (e) {
  exit(typeof e.status === "number" ? e.status : 1);
}
