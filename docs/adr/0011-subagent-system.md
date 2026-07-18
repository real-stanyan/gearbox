# ADR-0011: 在 scaffold 增加 Subagent System 模板（docs/subagent-system.md）

- Date: 2026-07-18
- Status: accepted

## Context

Scaffold 现有的 multi-agent 协议（ADR-0003 ~ 0010）解决的是**agent ↔ agent 之间**的轮班协作——交接、Memory、PR 处置、协议变更分级。但有一个层次没覆盖：**单个 agent 会话内部如何用 subagent**。

实际需求来自 ZCode（z.ai 出品的 Claude Code 类工具）——它支持 subagent：主 agent（controller）可以把任务派给独立 context 的子 agent，子 agent 的工具结果不回流到主对话。这解决了一个具体的痛点：**主对话 token 平方级累积**。每一步往上下文塞一点东西，后续每轮都按"当时总大小"重新计费一次；走 10 步从 10k 涨到 50k，总消耗 ≈ 300k。

但 ZCode 的 subagent 系统有几个**让下游项目各自摸索成本高**的特性：

1. **全局配置**——subagent 定义存在 `~/.zcode/v2/agents-state.json`，作用于所有 workspace，**没有 workspace scope**。项目级差异没法通过配置 override 实现
2. **配置入口分散**——UI（Settings → Subagents）+ 文件层（agents-state.json）+ 重启才生效，没文档容易踩坑
3. **SDD skill 提供了 implementer/reviewer 模板但没落地指南**——superpowers plugin 的 `subagent-driven-development` skill 有现成的 prompt 模板（约 100-130 行每个），但它讲的是"怎么派 subagent"，不讲"一个项目该有几个 subagent、怎么分工、怎么按任务路由"
4. **模型成本分层需要明确依据**——便宜档（机械任务）vs 旗舰档（判断任务）的分工没参考，每个维护者自己拍脑袋

候选方案：

- **A. 把 subagent system 写进 AGENTS.md 作为协议一部分** —— 协议膨胀；而且 subagent system 是可选实践，不是所有项目都用 ZCode，写进硬规则不合适
- **B. 在 scaffold 增加独立的 `docs/subagent-system.md` 作为可选模板** —— 下游拷不拷自愿；保持 AGENTS.md 的硬规则地位，subagent system 作为"如果你用，这样配"的参考
- **C. 不在 scaffold 定义，每个项目自己写** —— 不一致，摸索成本重复支付，违背 scaffold"开局骨架"的定位

## Decision

采用 **B**：在 scaffold 增加 `docs/subagent-system.md` 作为**可选模板**（不是 Hard rule），下游拷不拷自愿。同时新增本 ADR 记录决策。

模板定义 **5 个 subagent**：

| Subagent | Model 档位 | 角色 |
|---|---|---|
| Explore | 便宜档 | 只读搜索/定位/审计 |
| Implementer | 旗舰档 | SDD 实现 task |
| Reviewer | 旗舰档 | SDD task review |
| Debugger | 旗舰档 | 系统性调试 |
| Doc-Walker | 便宜档 | 代码 → ADR/CONTEXT.md |

配套的**任务路由决策树**（主 agent 按规模 + 类型判断派谁）+ **SDD 按任务大小分流**（Trivial/Small 不强制 SDD，Medium/Large 强制）+ **项目级路由**（靠项目 AGENTS.md 软规则，弥补 ZCode 无 workspace scope）+ **落地步骤**（ZCode UI 配置指南）。

**关键子决策**：

1. **为什么是 5 个**——对应"代码探索 / 新功能开发 / 轻量修复 / 复杂调试"4 个高频任务 + 1 个文档落地（Doc-Walker）。SDD skill 推荐的 final-reviewer 不单配，复用 Reviewer subagent（让它跑 branch-wide 而非 task-scoped）
2. **为什么 Implementer/Reviewer 引用 superpowers skill 模板而不内联复制**——保持单一事实源。superpowers 的模板是 skill 作者验证过的，复制到本 scaffold 后两边会漂移；引用让上游更新自动传播。Fallback：没装 superpowers 的用户把模板内联进 UI 字段
3. **为什么 Explore/Debugger/Doc-Walker 自己写**——没有现成模板可引用；自己写的 prompt 借鉴 superpowers 模板的风格（HARD CONSTRAINTS 大写英文、明确的 ANTI-PATTERNS、结构化 REPORTING）
4. **为什么不改 AGENTS.md**——subagent system 是可选实践，不是开局必需；写进 AGENTS.md 会让协议膨胀、混淆 Hard rule 和推荐实践
5. **为什么不改 README.md 的架构表**——同上，subagent-system.md 不是开局必需文件，下游维护者自己决定要不要拷

## Consequences

**代价**：

- 维护者要在 ZCode UI 手动配置 5 个 subagent（一次性工作，约 15 分钟）
- 下游项目多了一个"要不要用这套"的决策点
- 模板文档本身要维护——superpowers skill 模板更新时，本 scaffold 的引用可能指向过期内容（缓解：模板里写明引用路径，维护者拷时检查最新）
- 5 个 subagent 的分工是设计推断，未经大规模实战——如果实战发现某个 subagent 从没用上（如 Doc-Walker），或者某个角色缺失（如需要专门 Planner），要回来改本 ADR

**换来的**：

- 跨项目一致的 subagent 命名/分工/路由逻辑
- 模型成本分层有明确依据（便宜档 vs 旗舰档 vs 何时派谁）
- SDD skill 不再只是"怎么派"的 skill 文档，有"怎么在我的项目落地"的模板
- ZCode 的几个坑（全局配置、重启才生效、无工具白名单）有显式记录，下游不用重新踩
- 协议层（AGENTS.md）和实践层（subagent-system.md）分离，各司其职

**推翻条件**（未来 agent 看到本 ADR 想改时，先确认这些前提是否还成立）：

1. **ZCode 支持 workspace-scoped subagent**——§5 项目级路由那一节就要重写，从"靠 AGENTS.md 软规则"升级成"真配置层 override"
2. **ZCode 支持 UI 工具白名单**——§2 各 subagent 的 system prompt 里 HARD CONSTRAINTS 可以从"软约束"升级为"工具硬限制"，相应 prompt 可以简化
3. **5 个 subagent 分工被实战证伪**——如果某个角色长期闲置或某个常见任务无 subagent 可派，要回来调整清单
4. **superpowers skill 模板废弃或大幅变更**——Implementer/Reviewer 的引用策略要重新评估，可能需要内联一份冻结版本
5. **ZCode subagent 配置支持批量导入/导出**（如 JSON 文件）——§6 落地步骤可以简化成"导入 agents-state.json"，不用手动 UI 配置

**未验证边界的诚实清单**（模板 §7 也有，这里集中记录）：

- n=1 用户设计，5 subagent 分工未在大规模实战验证
- 便宜档 vs 旗舰档的判断阈值没有客观标准
- 工具白名单靠 system prompt 软约束，没大规模验证 subagent 是否真的"听话"
- ZCode UI 字段长度限制未知，超长 prompt 可能塞不下
- Stan 实际只跑过 Explore（Turbo）+ Implementer/Reviewer（GLM-5.2）简单任务，Debugger 和 Doc-Walker 零实战
