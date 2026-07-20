# ADR-0030: gearbox-prune——分支清理工具化

- Date: 2026-07-20
- Status: accepted
- 关联: ADR-0016/0017/0022(工具家族第四件)、ADR-0007(merge 规则)、ADR-0028(npx 分发,dispatcher 加 prune 路由)

## Context

gearbox 工具家族已有三件:install(开局)/ version(读状态)/ update(写回流),覆盖协议生命周期的"接入"和"演进"。但**收工/开工两个时刻的分支卫生**还靠人记:

- GitHub 仓库默认 `delete_branch_on_merge=false`,PR merge 后 head 分支不自动删
- `git fetch --prune` 清 stale tracking refs 没人记得跑——远程早删的分支,本地 tracking ref 一直躺着
- 多棒轮班时,每棒 agent 接手前都该有干净起点,现状是堆积分支每过几棒要人工梳理一次(2026-07-19 dryrun 实例:9 本地 + 18 远程,其中 12 个 stale)

候选方案:

- **A. 只在 AGENTS.md 写软规则,靠 agent 跑原生 git 命令**——可行但每棒要背一堆命令,stale refs 细节容易漏
- **B. 做 `scripts/gearbox-prune` 工具 + AGENTS.md 软规则双轨**——一条命令覆盖本地/远程/stale/设置核对,与工具家族同风格,认知负担最低
- **C. 不做工具,只建议开 `delete_branch_on_merge`**——治本不治标,stale refs 和已有堆积清不掉

## Decision

采用 **B**:新增 `scripts/gearbox-prune`,node 零依赖(`node:child_process` + `node:fs` + `node:readline`),与 install/update/version 同风格。行为四档:

1. **默认(dry-run)**:列出将被清理的本地已合并分支 + stale tracking refs + 远程已合并分支 + `delete_branch_on_merge` 当前值,**不实际删**
2. **`--apply-local`**:执行本地分支 `git branch -d` + `git fetch --prune`(纯本地副作用)
3. **`--apply-remote`**:执行远程 `git push origin --delete`(outward-facing,打印清单 + 交互确认;`--yes` 跳过确认,供非 TTY/CI)
4. **`--check-settings`**:只读 `delete_branch_on_merge`,`false` 时输出建议开启命令(不自动改——仓库设置是 owner 决定)

护栏(硬约束,写进脚本顶部注释):

- 永禁 `git branch -D`(强删)——强删丢未合并工作,违反「保护工作中的任务分支」
- 白名单保护:当前分支 / 默认分支(main/master)/ `gearbox-backfill-*` 前缀(进行中回流分支)
- 非 git 仓库、无 origin remote → 响亮报错退出,不静默降级
- `gh` 没装/没认证 → 仅设置核对档降级为提示,分支清理照常(分支操作纯 git,不依赖 gh)

**与 feature prompt 的一处偏离**:prompt 建议用 GitHub API `branches/:branch` 的 `merged` 字段判定远程分支已合并——该端点实际**没有** `merged` 字段(只有 name/commit/protected)。改用 `git merge-base --is-ancestor origin/<branch> origin/<default>` 判定(fetch 后本地判,零 API 调用、零分页问题)。副作用是 `gh` 依赖缩小到只剩 `--check-settings` 档——比原设计更薄。

AGENTS.md 加 Working agreement 软规则小节「分支卫生(可选)」(不放 Hard rules,见下)。npx dispatcher(`bin/gearbox.js`,ADR-0028)加 `prune` 路由,陌生人 `npx gearbox-agents prune` 可用。

## Consequences

- **认知负担**:收工卫生从「记得清分支」变成一条命令,与「commit + push + 开交接 issue」并列
- **工具家族闭合**:install / update / version / prune 四件,覆盖接入 / 演进 / 读状态 / 卫生
- **分级 = L1**:软规则引用「收工前/开工」协议时刻,按 ADR-0012 机制引用判据归 L1;不放 Hard rules——Hard rules 是产品契约(破坏即失效),分支清理是卫生习惯(漏了只是 repo 变脏)
- **版本 = minor**:新工具 + 新 ADR(ADR-0023 段位规则)→ v1.3.0
- **Gate 不加断言**:check-gearbox.js 断协议不断工具,install/update/version 也不在 requiredFiles——保持职责单一
- **下游拷走可选**:工具纯 git/gh 操作,不依赖 gearbox 协议文件,任何 repo 能用;新装下游 AGENTS.md 自带软规则小节(install 原样透传),存量下游按 AGENTS_MD_IMPACT 提示自行决定纳入
- **不替代 GitHub 设置**:`delete_branch_on_merge=true` 仍是推荐根治方案,工具只在 `--check-settings` 提示
- **不在范围**:自动改仓库设置 / 清已关闭未合并 PR 分支(可能是 abandon 的工作,要人判断)/ 分支命名规范 / reflog 清理 / worktree 清理
