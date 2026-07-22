# ADR-0003: Issue / PR 三角色（Task / Memory / Protocol gap），不用 HANDOFF.md

- Date: 2026-07-17
- Status: accepted

## Context

本 repo 的协议核心是"会话之间唯一的共享记忆是 repo 本身"。issue #2 那轮交接验证了机制成立，但也暴露了：**协议从来没正式定义 issue 该怎么用**。

实际撞上的三个问题：

1. issue #2 comment（Claude Code 留的验收报告）是好实践，但**没沉淀就会丢**——下个 agent 不会自动继承这种交接格式
2. Claude Code 撞上"merge 策略无约定"时，是凭 issue #2 的**临时授权**开 issue #3 的，不是凭协议规则。换上下文可能就 silent 判断了
3. "为什么不用 HANDOFF.md"只写在 README.md（给模板用户的），没写进 AGENTS.md（协议本身）

候选方案：

- **A. HANDOFF.md**：覆盖式写，一个文件。优点是单点；缺点是后写覆盖前写、旧上下文丢、无时间戳、无作者、无法关闭归档、无法被引用。
- **B. Issue comment**：append-only、带时间戳、带作者、可 `#N` 引用、可关闭归档、关联到具体 task。缺点是分散在多个 issue 里（但这恰好是优点——上下文跟任务绑定，不漂）。
- **C. 同时定义三类 issue 角色**（Task / Memory / Protocol gap）：在 B 的基础上形式化"什么时候开 issue、开哪种、什么时候关"。

## Decision

采用 C：在 AGENTS.md 显式定义 issue 的**三个不重叠角色**——Task / Memory / Protocol gap，并把"撞上协议缺口必须开 issue、不许 silent 判断"立为硬规则。Memory 角色用 issue comment 承载，**不建 HANDOFF.md**。

三角色边界：

| 角色 | 什么时候用 | 什么时候关 |
|---|---|---|
| Task | 要做一件可执行的事 | 任务做完且门禁绿 |
| Memory | 收工时留 comment（做到哪/卡在哪/下一步） | 下一棒接手即完成 |
| Protocol gap | 撞上 repo 回答不了的问题 | 缺口补进 AGENTS.md/ADR/CONTEXT.md |

Memory comment 的最小格式定为四项：做到哪 / 卡在哪 / 下一步 / 是否关 issue。少一项不算合格交接。

## Consequences

- **代价**：协议变厚了。每开一个 issue，agent 得判断它属于哪类。形式化本身有维护成本。
- **换来的**：
  - 好实践被固化，不靠口口相传——满足"repo 是唯一共享记忆"的基石
  - "撞缺口开 issue"从默契升级为硬规则，降低 silent 判断的风险
  - 三角色分类给后来的 agent 一个判断框架，而不是每次重新发明
- **风险**：n=1 经验立完整分类可能过早抽象。缓解——分类是**描述性**的（总结已发生的 issue #2/#3 行为），不是**规范性**的（没发明新流程）。
- **边界**：PR 不是独立角色——PR 是 Task 的实施载体，merge 时关 Task issue。PR review 中发现的新问题另开 issue，不在 PR 评论里堆。
- 如果未来某类 issue（比如 Protocol gap）频率极低或极高，届时另开 ADR 调整分类，不就地改本 ADR。
