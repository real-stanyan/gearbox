# ADR-0005: 交接 Memory 留在 open 的交接 issue 里,不埋进关闭的 Task issue

- Date: 2026-07-17
- Status: accepted
- 溯源:本决策源自 date-cli 路 A 实验(原 date-cli ADR-0007),在真实多 agent 协作中验证后回流到 scaffold

## Context

ADR-0003 规定收工时 Memory comment 留在"对应 issue 的 comment"。路 A 第三轮撞上的问题:**"对应 issue"通常是刚关闭的 Task issue,下一棒开工三件事扫的是 open issues,看不到关闭的 Task 里的 Memory。**

具体表现:Memory 沉进 closed issue,下一棒进 repo 不知道该读哪个 issue,得靠人指路("去看 #1 的 comment")。**这破坏了"repo 是唯一共享记忆"——记忆在那里,但没有入口。**

候选方案:
- **A. 让下一棒自己翻 git log + closed issues 找 Memory** —— 能找到,但靠人记忆"哪个 issue 有 Memory",不可靠
- **B. 收工时开一个 open 的"交接 issue"**,Memory 留这里,下一棒关闭它 = 接手
- **C. 回到 HANDOFF.md** —— 已被 ADR-0003 否决(覆盖式写、无时间戳)

## Decision

采用 B:**收工时开一个 open 的交接 issue(Task 类,标题写明"第 N 轮交接:谁 → 下一棒")。**

- body 写现状 + 下一步建议
- Memory comment(五项格式,ADR-0004)留在这个 issue 里
- 下一棒进 repo,开工三件事第 2 步(查 open issues)天然扫到它
- 下一棒读完 + 关闭它 = 接手记录

配套改动:
- "On starting a shift"第 2 步细化:先找 open 交接 issue,**找不到 = 上一棒违规收工**,开 gap issue 记录,再从 git log + 其他 open issues 重建上下文
- "On ending a shift"加第 4 步:开下一棒的交接 issue

## Consequences

- **代价**:每棒收工多一个动作(开交接 issue)。Protocol gap 类的关闭动作也多一步(关掉自己的 issue 后,如果还要换棒,得开交接 issue)。
- **换来的**:交接链不再断。下一棒**不需要知道"这条规则"就能撞见入口**——交接 issue 是 open 的,开工三件事自然扫到。这是"自举"的关键。
- **"找不到 = 违规"**给了协议一个**可观测的失败信号**:如果某棒忘了开交接 issue,下一棒会立刻发现(开工找不到入口),而不是默默用旧上下文开工。
- 风险:如果某棒频繁违规(老忘开交接 issue),会产生"违规 → 开 gap → 又一个 open issue"的噪音。缓解——违规应该极少,因为它就是收工的标准动作之一。
