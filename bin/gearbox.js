#!/usr/bin/env node
// gearbox — npx dispatcher (ADR-0028).
//
// 让陌生人零配置用工具家族:`npx gearbox-agents <install|version|update>`。
// npm 包自带上游快照(打包 AGENTS.md / CONTEXT.md / docs/adr/,见 package.json
// "files"),dispatcher 把 GEARBOX_DIR 指向包根 → 三工具复用现有本地路径逻辑,
// npx 路径根本不碰远端(ADR-0027 远端寻址是 git-clone 下游的兜底,非 npx 路径)。
//
// 包不是 git repo(npm 剥掉 .git),故上游版本号从 package.json 走 env override
// GEARBOX_UPSTREAM_VERSION 传给工具(工具优先用它,否则回退 git tag)。
//
// 子命令路由:install/update = node 脚本;version = bash 脚本(ADR-0016 未改写,
// 见 ADR-0028 决策)。参数原样透传。退出码透传。

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { argv, exit, env, stderr } from "node:process";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// 包版本(package.json)→ 传给工具作上游版本(包非 git repo,tag 取不到)
let pkgVersion = null;
try {
  pkgVersion = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version || null;
} catch {
  /* 理论不会——包一定带 package.json */
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
      "  install   在当前(或指定)目录铺 Gearbox 骨架\n" +
      "  version   查当前下游 repo 同步到上游哪个版本 / 哪些 ADR\n" +
      "  update    回流:拷上游缺失 ADR 到当前下游 repo\n" +
      "  prune     分支卫生:清已合并/stale 分支(默认 dry-run,ADR-0030)\n\n" +
      "例: npx gearbox-agents install --maintainer you --gate \"npm test\"\n",
  );
  exit(sub ? 0 : 1);
}

const route = ROUTES[sub];
if (!route) {
  stderr.write(`未知命令: ${sub}  (gearbox --help 看用法)\n`);
  exit(1);
}

try {
  execFileSync(route.cmd, [join(pkgRoot, route.file), ...rest], {
    stdio: "inherit",
    env: {
      ...env,
      // 上游 = 包自身快照(除非调用者显式覆盖 GEARBOX_DIR)
      GEARBOX_DIR: env.GEARBOX_DIR || pkgRoot,
      // 上游版本 = 包版本(工具优先用它,回退 git tag);带 v 前缀对齐 tag 语义
      GEARBOX_UPSTREAM_VERSION:
        env.GEARBOX_UPSTREAM_VERSION || (pkgVersion ? `v${pkgVersion}` : ""),
    },
  });
} catch (e) {
  exit(typeof e.status === "number" ? e.status : 1);
}
