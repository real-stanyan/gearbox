# Gearbox

多 agent（Claude Code + Z Code 等）协作项目的开局骨架：`AGENTS.md` 作单一事实源 + ADR + CI 硬门禁。给凡是想让多个 AI coding agent 在同一个 repo 里轮流干活而不打架的人用。

> This file is the single source of truth for ALL coding agents (Claude Code, Z Code, etc.).
> Rules live here and only here. Do not duplicate them elsewhere.

## Tech stack

- Node.js（结构自检脚本 + `scripts/gearbox-update` 下游回流 / `scripts/gearbox-install` 开局安装，无运行时依赖，ADR-0017/0022）
- Bash（`scripts/gearbox-version` 下游同步速查，零依赖、只读，ADR-0016）
- 纯 Markdown 文档（AGENTS.md / CONTEXT.md / ADR）

## Hard rules

<不可违反的项目规则，每条一行。例：钱一律用 cents + BigInt；禁止向客户端暴露 SECRET_*。>

> **Gearbox 自身(dogfood)的硬规则不在本节复述**——以门禁断言为准(`scripts/check-gearbox.js` 是可执行的事实源)。协议正文中标注 **Hard rule / 硬规则** 的条款(如「Issue & PR 的角色」一节「必须开 issue,不许 silent 判断」硬规则,ADR-0003)**视同本节内容,受 L1 保护**:判据锚定标注本身,不锚定条款物理住在哪个章节(ADR-0018)。
> 拷走本 Gearbox 时:删掉本注,把占位符换成你项目的硬规则。

## Working agreement (multi-agent)

### On starting a shift（开工三件事）

1. `git log --oneline -10` — 看最近发生了什么
2. 查 GitHub Issues — **先找 open 的交接 issue**（上一棒的 Memory 在里面；读完关闭它 = 接手，见 ADR-0005。找不到 → 查最近关闭的 issue 有无「无下一棒」终局声明：有 = 合规终局收工（ADR-0009），正常开工；无 = 上一棒违规收工，开 Protocol gap issue 记录——两种情况都从 git log + open issues 重建上下文），然后看其他 open 任务和备注
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
| **Memory**（交接记忆） | 收工时在**交接 issue**（见 On ending a shift）留 comment，五项格式 | 下一棒读完并关闭交接 issue = 接手完成 |
| **Protocol gap**（协议缺口） | 撞上 repo 回答不了的问题（规则没写、歧义、边界模糊） | 缺口被补进 AGENTS.md / CONTEXT.md / ADR |

硬规则：

- **撞上 repo 回答不了的问题，必须开 issue（Protocol gap 类），不许 silent 判断。** 这是协议自我修复的唯一入口——缺口从"靠默契"变成"显性、可讨论、可关闭"。
- **Memory 类 comment 的最小格式**（ADR-0004）：① 做到哪 ② 卡在哪 ③ 下一步是什么 ④ 任务完成则关 issue ⑤ **判断依据 / 权衡**——本棒做了非既定决策时必填（选了什么、为什么、什么前提失效时该推翻）；没做决策就写「无」，不许省略。少一项都不算合格交接。
- **交接 = issue 关闭 / PR 合并的那一刻**，不是"我觉得讲清楚了"。没关 issue 就换人 = 任务中途换手，违反上一节。
- **PR 是 Task 的实施载体，不是独立角色**：PR 引用它实现的 Task issue，merge 时关 issue。PR review 中发现的新问题另开 issue，不在 PR 评论里堆。

> 为什么用 issue comment 而不是独立交接文件：理由见 `docs/adr/0003-issue-roles.md`。为什么 Memory 留在 open 交接 issue 而不是关闭的 Task issue：见 `docs/adr/0005-handoff-lives-in-an-open-issue.md`。

### PR 处置（merge 规则）

四条规则（ADR-0007）：

- **merge 方式一律 merge commit**，不 squash、不 rebase：小步 commit 的 why 是协议资产（repo 是会话之间唯一的共享记忆），squash 等于删记忆；风格定死一种，历史才可预测。
- **谁 merge**：PR 作者 agent 在 CI 绿后自行 merge。协议改动按分级走（见「协议自身的变更」）：L1 等 `<维护者>` 同意，L2 自主。
- **review 不强制第二 agent**：轮班制下常态只有一棒在场，强制互审会阻塞在交接边界上。质量兜底 = CI 门禁 + `<维护者>` 事后否决权（revert + 重开 issue）。
- **不接手别人的 open PR**——那是任务中途换手（见 While working）。例外：交接 issue 明确移交，或 `<维护者>` 指示。

收工时 PR 还挂着 = 任务没做完：按 On ending a shift 第 3 条把进度写进 Task issue comment，PR 留 open。

### 协议自身的变更（改本文件的规则）

agent 可以修改 AGENTS.md,但**按改动内容分级**(ADR-0006):

| 层级 | 内容 | 流程 |
|---|---|---|
| **L1 严格层** | Hard rules / Gate 命令 / Tech stack / 本节自身 | issue + ADR + PR,**且必须 `<维护者>` 在会话或 PR comment 中明确同意后 agent 才能 merge** |
| **L2 自治层** | Working agreement(除 Gate)/ 索引(Where to find things) | issue + ADR + PR,agent 可自主 merge |

> **拷走本 Gearbox 时:把 `<维护者>` 换成你(或你的团队)的名字。** 见 ADR-0006。

「Gate 命令」的边界(ADR-0010):命令行本身与**放松/删除/改写门禁脚本现有断言** = L1;**新增收紧断言** = L2,随所属 PR 走。纯重构(行为不变)算 L2,举证责任在改的 agent。

**测试型门禁**(vitest / tsc / lint,ADR-0020):配置层直接套上行(收紧 L2 / 放松 L1 / 命令行 L1);测试内容层按**动机**定级——测试跟随产品代码变更同 PR 增删改 = L2 常规开发;**为绿而删**(删 / `.skip` / 弱化测试而 diff 无对应产品变更)= L1,沉默的 skip = 违规。删/skip 测试必须在 commit message 或 PR body 写明动机。

通用规则(两层都适用):

- **三件套缺一不可**:对应 issue(通常是 Protocol gap 类)+ ADR(记录决策与理由)+ 分支 PR(CI 绿才能 merge,merge 时关 issue)。
- **没有 issue + ADR 的协议改动是违规的**,应当 revert,无论属于哪一层。
- **协议变更比代码改动更重**:代码只在架构性决策时才要 ADR,协议变更一律要。
- **人保留事后否决权**:revert 对应 PR + 重开 issue,即撤销该变更——即便当时没拦住。

**L1/L2 边界判据**(ADR-0012,**机制引用优先**):新增内容只要**引用了 L1/L2 分级 / Hard rules / Working agreement 的机制**(无论是否"可选"、是否动现有文件),按 **L1** 处理。客观判据——文本中出现 `L1` / `L2` / `Hard rule` / `Working agreement` / `分级授权` 等机制关键词,或语义上依赖这些机制运转(如 subagent 路由依赖 L1/L2 决定派谁)。

| 场景 | 归类 | 依据 |
|---|---|---|
| 新增模板/子系统,**引用** 协议机制 | **L1** | ADR-0012 |
| 新增纯说明文档(如"如何贡献"),**不引用** 任何协议机制 | L2 | ADR-0012 |
| 改现有协议文件(Hard rules / Gate / Tech stack / Working agreement 内容) | **L1** | ADR-0006 |
| 改索引(Where to find things) | L2 | ADR-0005 |
| CONTEXT.md 词条**定义**既有机制(仅改 CONTEXT.md + 注明出处 ADR + 不新增义务/不改流程边界,三要件缺一不可) | L2 | ADR-0019 |

**定义豁免**(ADR-0019):判据抓的是**立法**(新增/修改机制语义),不是**描述**(把已立的法写进词汇表)。三要件任一不满足或拿不准 → 按 L1,不许自行豁免;借定义之名改语义 = 违规,revert + 重开 issue。

> 为什么严:agent 容易用"可选+纯新增"当 L2 通道扩张协议边界(参见 PR #21 复盘——subagent-system 引用 L1/L2 却 L2 self-merge)。本判据把这条路堵掉。

L1 的"明确同意"是 b-弱形态:`<维护者>` 在会话里说"同意"或在 PR comment 里写"同意"即可,agent 自己操作 merge 按钮。**不强制 GitHub 的 approve 按钮**——代价是 `<维护者>` 成为 L1 瓶颈,这个代价接受。

**下游回流**(ADR-0013,pull 触发见 ADR-0026):回流以 **pull 为主**——下游开工时跑 `gearbox-version` 自查协议版本,落后就 `gearbox-update`(触发不依赖上游认识下游,适配公共 fork)。上游侧:每个协议改动 PR 仍在 PR body 声明 `Affects downstream`(`yes`/`no` + 一句理由),但**降为信息性——帮判断影响面,不再逐下游开 issue、不再阻塞 merge**(「无链接=不能 merge」已随 ADR-0026 退役)。维护者若维护私有舰队,可**可选地**对 `DOWNSTREAM.md` 已登记项目开告知 issue,非强制。

**协议版本号**(ADR-0023):semver 变体,基线 `v0.0.0`。段位判据——**major** = 跨工具/跨 repo 契约变更(hash 戳记格式、install 锚点结构、文件布局、改名),下游回流需人工干预;**minor** = 新增机制(新 ADR / 新工具 / 新协议条款);**patch** = 已有文件修订(措辞、status 行、typo)。流程——PR body 必须声明 `Version bump: major|minor|patch|none`(`none` 需一句理由,通过 PR 模板);merge 后**作者 agent** 以 merge 时刻最新 tag 为基准打 annotated tag 并 push。不建 CHANGELOG——tag message + ADR 即变更记录。下游本地版本记在 `.gearbox-version` 戳记文件,工具写工具读(install 装机写 / update 回流更新 / version 读取对比),人不维护。

### Gate（门禁 — 收工前必须全绿）

```bash
node scripts/check-gearbox.js
```

> 本 repo 是文档型模板(Gearbox 本体)，门禁不跑 vitest/tsc/lint，而是跑一个**结构自检脚本**：验证必需文件存在、`CLAUDE.md` 仍是 `@AGENTS.md` 空壳、关键章节锚点没被改名、不出现 `HANDOFF`、本 Gate 一节确实跑这个脚本（防止"CI 和 AGENTS.md 各跑各的"的契约漂移）。

CI（`.github/workflows/ci.yml`）跑同一套命令，红了不许 merge。

### On ending a shift（收工规矩）

1. 门禁全绿
2. commit + push
3. 做完的 Task issue 照常关闭；做到一半的,进度写到该 issue 的 comment
4. **开下一棒的交接 issue**（Task 类,保持 open,ADR-0005）:body 写现状与下一步建议,本轮 Memory comment（五项格式,ADR-0004）留在这里。**这是下一棒唯一保证撞见的入口**——Memory 不再埋进随手关闭的 Task issue。**唯一例外——终局收工**（ADR-0009）:归档 / 确认无下一棒时可不开,但必须在最后关闭的 issue 里 comment 显式声明「无下一棒」+ 理由,沉默的终局不算终局

### Division of labor（可选，按需填）

分工是项目属性，模板不预设（ADR-0008）。拷走时三选一：

1. **填实**：哪类任务归哪个 agent。<未验证的候选示例：机械性批量修改、补测试 → Z Code；架构设计、难 bug → Claude Code>
2. **不填**：默认规则 = **Task issue 认领制**——谁认领谁从头做到尾（见 While working），任务不按 agent 特长路由。
3. **单 agent 项目**：整节删除（本节不是门禁锚点，删除不破 `check-gearbox.js`）。

## Where to find things

- `CONTEXT.md` — 领域词汇表
- `docs/adr/` — 架构决策记录
- `scripts/` — 门禁自检（check-gearbox.js）+ 下游工具家族（gearbox-install 开局 / gearbox-version 读 / gearbox-update 写，ADR-0016/0017/0022）
- <其他模块文档目录，如 docs/modules/>
