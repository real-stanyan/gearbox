# Domain context — Gearbox

领域词汇表。所有 agent 对业务词的理解以此为准；代码命名与这里的术语保持一致。

## Terms

| 术语 | 定义 | 备注 |
|---|---|---|
| 单一事实源 | 规则只写一份（`AGENTS.md`），其他 agent 配置（如 `CLAUDE.md`）只 `@` 引用它，不复制 | 防止规则在多处漂移 |
| 空壳契约 | `CLAUDE.md` 内容恰好是 `@AGENTS.md` 一行——物理保证 Claude Code 和 Z Code 读同一份规则 | 自检脚本断言这一条 |
| 交接（handoff） | 一个 agent 把任务交给另一个 agent，**只发生在 issue 关闭 / PR 合并那一刻**，不在任务中途 | 不是"讲清楚了"就交接，是 issue 关了才交接 |
| 协议缺口（protocol gap） | repo 的持久产物（AGENTS.md / ADR / CONTEXT.md）回答不了的问题 | 撞上必须开 issue，不许 silent 判断 |
| Issue 三角色 | Issue/PR 在本协议中的三种用法，不重叠：**Task**（任务）/ **Memory**（交接记忆）/ **Protocol gap**（协议缺口） | 每个 issue 都该能归入其中一类，见 AGENTS.md |
| 门禁（gate） | 收工前必须全绿的命令。本 repo 是 `node scripts/check-gearbox.js` | CI 跑同一套，红了不许 merge |
| Dogfood | 本 repo 用自己规定的协议开发自己 | 是验证手段，不是目的 |
| L1/L2 分级 | 协议变更的两级授权：**L1 严格层**（Hard rules / Gate / Tech stack / 「协议自身的变更」节自身）需维护者明确同意才能 merge；**L2 自治层**（Working agreement 其余部分 / 索引）agent 可自主 merge | ADR-0006；边界判据见 ADR-0012 |
| 机制引用（判据） | 新增内容只要引用 L1/L2 / Hard rules / Working agreement 等协议机制（关键词或语义依赖），一律按 L1 处理 | ADR-0012「机制引用优先」；防「可选+纯新增」当 L2 通道扩权 |
| Memory 五项格式 | 交接 comment 的最小合格格式：① 做到哪 ② 卡在哪 ③ 下一步 ④ 完成则关 issue ⑤ 判断依据/权衡（无决策写「无」） | ADR-0004；少一项不算合格交接 |
| 终局收工 | 归档 / 确认无下一棒时的收工形态：可不开交接 issue，但必须在最后关闭的 issue 里显式声明「无下一棒」+ 理由 | ADR-0009；沉默的终局不算终局 |
| 下游（downstream） | 拷走本 Gearbox 协议后独立演进的项目；权威清单在 `DOWNSTREAM.md`「已接入项目」 | 入清单三条件见 DOWNSTREAM.md |
| 回流（backfill） | Gearbox 协议改进通过在下游 repo 开提醒 issue 传达给下游；是提醒不是强制，下游可拒（关 issue 注明理由） | ADR-0013（B-3 模板强制） |
| 协议版本号 | semver 变体 tag：**major** = 跨工具/跨 repo 契约变更；**minor** = 新增机制；**patch** = 已有文件修订。每个协议 PR 声明 `Version bump`，merge 后作者打 tag；下游本地版本记在 `.gearbox-version` 戳记（工具写工具读） | ADR-0023；基线 v0.0.0 |

## Key invariants

- `AGENTS.md` 永远是唯一规则源；`CLAUDE.md` 永远只是 `@AGENTS.md` 空壳
- 不建 `HANDOFF.md`——交接走 issue comment（append-only、带时间戳）
- 门禁命令在 AGENTS.md 和 ci.yml 里必须字面一致（CI == Gate 契约）
- 一个任务一个 agent 做完，交接只在任务边界发生
