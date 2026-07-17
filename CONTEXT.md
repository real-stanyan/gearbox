# Domain context — AGENTS.md scaffold

领域词汇表。所有 agent 对业务词的理解以此为准；代码命名与这里的术语保持一致。

## Terms

| 术语 | 定义 | 备注 |
|---|---|---|
| 单一事实源 | 规则只写一份（`AGENTS.md`），其他 agent 配置（如 `CLAUDE.md`）只 `@` 引用它，不复制 | 防止规则在多处漂移 |
| 空壳契约 | `CLAUDE.md` 内容恰好是 `@AGENTS.md` 一行——物理保证 Claude Code 和 Z Code 读同一份规则 | 自检脚本断言这一条 |
| 交接（handoff） | 一个 agent 把任务交给另一个 agent，**只发生在 issue 关闭 / PR 合并那一刻**，不在任务中途 | 不是"讲清楚了"就交接，是 issue 关了才交接 |
| 协议缺口（protocol gap） | repo 的持久产物（AGENTS.md / ADR / CONTEXT.md）回答不了的问题 | 撞上必须开 issue，不许 silent 判断 |
| Issue 三角色 | Issue/PR 在本协议中的三种用法，不重叠：**Task**（任务）/ **Memory**（交接记忆）/ **Protocol gap**（协议缺口） | 每个 issue 都该能归入其中一类，见 AGENTS.md |
| 门禁（gate） | 收工前必须全绿的命令。本 repo 是 `node scripts/check-scaffold.js` | CI 跑同一套，红了不许 merge |
| Dogfood | 本 repo 用自己规定的协议开发自己 | 是验证手段，不是目的 |

## Key invariants

- `AGENTS.md` 永远是唯一规则源；`CLAUDE.md` 永远只是 `@AGENTS.md` 空壳
- 不建 `HANDOFF.md`——交接走 issue comment（append-only、带时间戳）
- 门禁命令在 AGENTS.md 和 ci.yml 里必须字面一致（CI == Gate 契约）
- 一个任务一个 agent 做完，交接只在任务边界发生
