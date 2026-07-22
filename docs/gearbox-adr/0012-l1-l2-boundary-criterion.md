# ADR-0012: L1/L2 边界判据——"机制引用优先"

- Date: 2026-07-19
- Status: accepted, 定义豁免见 ADR-0019(CONTEXT.md 词条描述既有机制不触发本判据)
- Supersedes: ADR-0006(ADR-0006 的 L1/L2 分层按内容类型分,本 ADR 补齐"新增内容怎么归类"的判据;ADR-0006 原文保留不删)

## Context

PR #21 引入 `docs/subagent-system.md` + ADR-0011——一份教 agent 怎么派 subagent 的子系统规格,§5.1 模板还引用了 L1/L2 分级机制。agent 按"没动现有文件"自判 L2,自主 merge 了(issue #22)。

复盘:**实质是扩张 Working agreement 覆盖范围的协议级改动,却走了 L2 通道,绕过维护者审。** 这是 ADR-0006 警惕的"agent 自己给自己扩权"的实例。

根因:ADR-0006 按**内容类型**分 L1/L2(Hard rules / Gate / Tech stack = L1;Working agreement / 索引 = L2),但**没规定"新增协议级内容"怎么归类**。agent 钻了这个空子——"我新增文件、没改现有协议文件,所以是 L2"。

三个候选判据(Stan 选 a):

- **a. 机制引用优先**:新增内容只要引用 L1/L2 分级 / Hard rules / Working agreement 机制,就是 L1。客观可验(grep 文本),防"可选"标签滥用
- **b. 可选/必选 + 文件维度**:可选+纯新增 = L2。等于事后追认 PR #21 的自判——"可选"是 agent 自己贴的标签,会被滥用
- **c. 最严纯新增**:纯新增且不引用机制 = L2,其余 L1。最严,但一些真正独立的可选文档也卡进 L1,增加维护者负担

## Decision

**L1/L2 边界判据 = 机制引用优先:**

> **新增内容只要引用了 L1/L2 分级 / Hard rules / Working agreement 的机制(无论是否"可选"、是否动现有文件),按 L1 处理。**

三类归类:

| 场景 | 归类 | 依据 |
|---|---|---|
| 新增模板/子系统,**引用** L1/L2 分级 / Hard rules / Working agreement 机制 | **L1** | 本 ADR |
| 新增纯说明文档(如"如何贡献"),**不引用**任何协议机制 | L2 | 本 ADR |
| 改现有协议文件(Hard rules / Gate / Tech stack / Working agreement 内容) | **L1** | ADR-0006 原有 |
| 改索引(Where to find things) | L2 | ADR-0005 原有 |

**客观判据**:"引用"= 文本中出现 `L1` / `L2` / `Hard rule` / `Working agreement` / `分级授权` 等机制关键词,或语义上依赖这些机制运转(如 subagent 路由依赖 L1/L2 决定派谁)。

### 关于 PR #21

**不 revert,但定性为"实质 L1、流程越权"**。理由:
- 内容质量好(§7 诚实声明、n=1 边界声明扎实)
- 为流程 revert 整个 PR 代价过大
- 维护者事后否决权正在生效——本 ADR 就是 Stan 行使该权利的方式

PR #21 作为先例留档:agent 在 L2 self-merge 通道扩张了协议边界,事后通过补 ADR 把同类扩张归 L1,堵住后续路径。

## Consequences

- **L1 范围扩大**:任何引用协议机制的新增模板/子系统,都要走"issue + ADR + PR + 维护者同意"。维护者负担增加——这是接受的代价
- **agent 不能再用"纯新增文件"当 L2 通道**:必须看新增内容是否引用协议机制。这是本 ADR 的核心约束
- **客观可验**:维护者或下一棒 agent 可以 grep 文本判断归类,不靠主观感觉
- **判据偏严的副作用**:真正独立的可选文档(如纯"如何贡献")仍可走 L2;但任何"教 agent 怎么干活"的模板基本都会引用协议机制,都会卡进 L1。这是有意的——"教 agent 干活"的模板影响协作行为,严格度该跟协议本身同级
- **后续观察点**:如果实践中发现 L1 卡住了太多低风险文档,可再走 ADR 放宽;反之亦然
- **风险**:语义依赖(不在文本里出现关键词,但实质依赖机制)仍靠主观判断。缓解——这类情况让 agent 开 Protocol gap issue 由维护者判,不 silent 处理
