# <项目名>

<一句话说清这个项目是什么、给谁用。>

> This file is the single source of truth for ALL coding agents (Claude Code, Z Code, etc.).
> Rules live here and only here. Do not duplicate them elsewhere.

## Tech stack

- <框架 / 语言 / 关键库>
- <数据库 / 部署平台>

## Hard rules

<不可违反的项目规则，每条一行。例：钱一律用 cents + BigInt；禁止向客户端暴露 SECRET_*。>

## Working agreement (multi-agent)

### On starting a shift（开工三件事）

1. `git log --oneline -10` — 看最近发生了什么
2. 查 GitHub Issues — 找自己认领的任务和别人留的备注
3. 跑一遍门禁命令（见下）确认基线是绿的 — 红的先修或开 issue，不带病开工

### While working

- 小步 commit，message 写清 **why**，不只是 what
- 一个任务从头到尾一个 agent 做完；交接只发生在任务边界（issue 关闭 / PR 合并），不在任务中间
- 非 trivial 改动走分支 + PR；typo 级小改可直接进 main
- 架构性决策写 `docs/adr/`（一个决策一个文件）
- 业务术语的定义查 `CONTEXT.md`；新术语出现时补进去

### Gate（门禁 — 收工前必须全绿）

```bash
<测试命令，如 npx vitest run>
<类型检查，如 npx tsc --noEmit>
<lint，如 npx next lint>
```

CI（`.github/workflows/ci.yml`）跑同一套命令，红了不许 merge。

### On ending a shift（收工规矩）

1. 门禁全绿
2. commit + push
3. 进度写到对应 issue 的 comment（做到哪、卡在哪、下一步是什么）；任务完成则关 issue

### Division of labor（可选，按需填）

- <例：机械性批量修改、补测试 → Z Code；架构设计、难 bug → Claude Code>

## Where to find things

- `CONTEXT.md` — 领域词汇表
- `docs/adr/` — 架构决策记录
- <其他模块文档目录，如 docs/modules/>
