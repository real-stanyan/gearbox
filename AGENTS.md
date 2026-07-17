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

### Issue & PR 的角色

Issues 和 PR 是 agent 之间（以及 agent ↔ 人之间）带时间戳、append-only、不腐烂的会话载体。在本协议里有**三个不重叠的角色**——每个 issue/PR 都该能归入其中一类：

| 角色 | 什么时候用 | 什么时候关 |
|---|---|---|
| **Task**（任务） | 要做一件可执行的事 | 任务做完且门禁绿 |
| **Memory**（交接记忆） | 收工时在 Task issue 留 comment，写做到哪 / 卡在哪 / 下一步 | 下一棒接手即视为完成 |
| **Protocol gap**（协议缺口） | 撞上 repo 回答不了的问题（规则没写、歧义、边界模糊） | 缺口被补进 AGENTS.md / CONTEXT.md / ADR |

硬规则：

- **撞上 repo 回答不了的问题，必须开 issue（Protocol gap 类），不许 silent 判断。** 这是协议自我修复的唯一入口——缺口从"靠默契"变成"显性、可讨论、可关闭"。
- **Memory 类 comment 的最小格式**：① 做到哪 ② 卡在哪 ③ 下一步是什么 ④ 任务完成则关 issue。少一项都不算合格交接。
- **交接 = issue 关闭 / PR 合并的那一刻**，不是"我觉得讲清楚了"。没关 issue 就换人 = 任务中途换手，违反上一节。
- **PR 是 Task 的实施载体，不是独立角色**：PR 引用它实现的 Task issue，merge 时关 issue。PR review 中发现的新问题另开 issue，不在 PR 评论里堆。

> 为什么用 issue comment 而不是独立交接文件：理由见 `docs/adr/0003-issue-roles.md`。

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
