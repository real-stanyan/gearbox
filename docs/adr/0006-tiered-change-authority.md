# ADR-0006: 协议变更分级授权——L1(Hard rules/Gate/Tech stack)需人同意,L2 自治

- Date: 2026-07-17
- Status: accepted
- 溯源:本决策源自 date-cli 路 A 实验(原 date-cli ADR-0009,经 Stan 拍板),在真实多 agent 协作中验证后回流到 scaffold

## Context

路 A 中段,协议遇到死结:**协议自称"撞缺口开 issue,缺口补进 AGENTS.md 就关",但没说"谁有权改 AGENTS.md"。** 结果 4 个 protocol gap issue 全部卡住关不掉——不是没人干活,是"没有钥匙"。

date-cli 先用 ADR-0004(原)解了死结:"agent 可改 AGENTS.md,走 issue+ADR+PR,人保留事后 revert 否决权"。但实验到第四轮暴露:**这条授权对 Hard rules 和 Gate 命令过宽**——

| 内容类型 | 性质 | 全自主的风险 |
|---|---|---|
| Hard rules(例:UTC ms / 纯函数 / 不可变) | 底层一致性前提 = 物理定律 | agent 自主改 = 地基失效;事后 revert 时代码已按新规则改一大片 |
| Gate 命令(测试/类型/lint) | 唯一不靠自觉的约束 | agent 自主改 = 自己定义"什么算完成",门禁变橡皮图章 |
| Tech stack | 技术选型根基 | 同 Hard rules |
| Working agreement(除 Gate) | 流程协调 | 风险低,试错成本低 |
| 索引(Where to find things) | 文档维护 | 风险极低 |

事后 revert 的刹车对频繁小改够用,对结构性变更不够。

## Decision

**协议变更分级授权:**

| 层级 | 内容 | 流程 |
|---|---|---|
| **L1 严格层** | Hard rules / Gate 命令 / Tech stack / "协议自身的变更"这一节自身 | issue + ADR + PR,**且必须<维护者>(scaffold 拷走后换成项目维护者名字)在会话或 PR comment 中明确同意后,agent 才能 merge** |
| **L2 自治层** | Working agreement(除 Gate)/ 索引(Where to find things) | issue + ADR + PR,agent 可自主 merge |

**b-弱形态**:"明确同意" = 维护者在会话里说"同意"或在 PR comment 里写"同意"即可,agent 自己操作 merge 按钮。**不强制 GitHub 的 approve 按钮**——代价是维护者成为 L1 瓶颈,这个代价接受,换取 L2 继续验证 agent 自治。

> 拷走本 scaffold 的项目:**把本 ADR 和 AGENTS.md「协议自身的变更」一节里的 `<维护者>` 换成你的名字(或团队名)**。如果你是单人项目,你就是维护者;如果团队,明确谁是 L1 守门人。

### 为什么不选其他方案

- **不沿用全部自主(原 date-cli ADR-0004)**:Hard rules / Gate 风险过高,见上表
- **不选 b-强(GitHub approve 按钮强制)**:维护者上手操作负担重;b-弱的留痕(PR + ADR + comment)已足够
- **不选"全部要同意"**:Working agreement / 索引不值得每条都过目,会让维护者疲于 review,且削弱 agent 自持价值
- **不回到"agent 不能改协议"**:那是原始死结,协议无法自我修复

## Consequences

- **维护者成为 L1 改动的瓶颈**——任何 Hard rules / Gate / Tech stack 变更必须等他同意。agent 撞上这类协议缺口时,能开 issue + 写 ADR + 开 PR,但不能 merge,**得在 Memory 里明确"卡在等维护者同意"**。
- **L2 改动继续自持**——Working agreement / 索引 agent 可自主完成,不打扰维护者。
- **自指边界**:L1 包含「协议自身的变更」这一节自身。修改分级规则 → 必须维护者同意。收紧到 L2 → 必须同意;放宽到 L1 → 必须同意。**这条自指是接受的代价,防 agent 自己给自己扩权。**
- **风险**:b-弱的"会话里说同意"如果维护者隔很久才看到,agent 会一直阻塞。缓解——L1 改动实践中应该极少(物理定律不会经常变)。
- **演进**:如果未来 L1 实践中证明风险可控,可再走 ADR 放宽;反之亦然。本 ADR 自身可被新 ADR 取代。
