# AGENTS.md scaffold

多 agent（Claude Code + Z Code 等）协作项目的开局骨架：`AGENTS.md` 作单一事实源 + ADR + CI 硬门禁。给凡是想让多个 AI coding agent 在同一个 repo 里轮流干活而不打架的人用。

> This file is the single source of truth for ALL coding agents (Claude Code, Z Code, etc.).
> Rules live here and only here. Do not duplicate them elsewhere.

## Tech stack

- Node.js（仅用于跑结构自检脚本，无运行时依赖）
- 纯 Markdown 文档（AGENTS.md / CONTEXT.md / ADR）

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
node scripts/check-scaffold.js
```

> 本 repo 是文档型 scaffold，门禁不跑 vitest/tsc/lint，而是跑一个**结构自检脚本**：验证必需文件存在、`CLAUDE.md` 仍是 `@AGENTS.md` 空壳、关键章节锚点没被改名、不出现 `HANDOFF`、本 Gate 一节确实跑这个脚本（防止"CI 和 AGENTS.md 各跑各的"的契约漂移）。

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
