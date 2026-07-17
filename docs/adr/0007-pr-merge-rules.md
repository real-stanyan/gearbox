# ADR-0007: PR 处置细则——merge commit 一律、作者自 merge、review 不强制

- Date: 2026-07-17
- Status: accepted

## Context

issue #3（scaffold 最早的 protocol gap 之一，ADR-0003 的 Context 里就引用过它）：agent 在 review/merge PR #1 时，三个问题 repo 回答不了——

1. merge 策略：merge commit / squash / rebase？
2. PR 作者之外的 agent 能不能 merge？要不要等人批？
3. Division of labor 还是占位符（→ 拆给 ADR-0008）

当时靠 issue #2 的临时授权顶过去了。ADR-0003 形式化了 issue 角色，但 merge 细则本身一直没落地。之后 date-cli 路 A 四轮实验里，实践自发收敛出一套做法（全部 merge commit、作者 agent CI 绿后自 merge、无互审），本 ADR 把它写成规则。

## Decision

**AGENTS.md 新增「### PR 处置」一节，四条规则：**

1. **merge 方式一律 merge commit**，不 squash、不 rebase。
2. **PR 作者 agent 在 CI 绿后自行 merge**；协议改动按 ADR-0006 分级（L1 等维护者同意，L2 自主）。
3. **不强制第二 agent review**。质量兜底 = CI 门禁 + 维护者事后否决权（revert + 重开 issue）。
4. **不接手别人的 open PR**——那是任务中途换手。例外：交接 issue 明确移交，或维护者指示。

### 为什么 merge commit

- **小步 commit 的 why 是协议资产**。本协议的基石是「repo 是会话之间唯一的共享记忆」，While working 又要求 commit message 写清 why——squash 会把这些分步理由压成一条，等于删记忆。
- **风格统一比风格本身重要**。issue #3 的原始担忧就是「下个 agent 可能选 squash，历史风格分叉」。定死一种，历史才可预测。
- **先例**：date-cli 全部 7 个 PR 和本 repo 全部 3 个 PR 都是 merge commit，规则只是追认现状。

### 为什么 review 不强制

轮班制（一个任务从头到尾一个 agent）下，常态时刻只有一棒在场——强制互审等于每个 PR 都要阻塞等下一棒上线，交接边界被打穿。CI 是不靠自觉的约束，维护者否决权是结构性刹车，二者已覆盖「错误 merge」的恢复路径。

### 为什么不接手别人的 open PR

While working 已有「一个任务从头到尾一个 agent 做完；交接只发生在任务边界」。open PR = 任务未到边界。这条只是把既有规则在 PR 场景显式化，堵住「PR 挂着、另一个 agent 好心帮忙 merge」的缝。

## Consequences

- **代价**：main 历史带 merge 泡（bubble），`git log --oneline` 略吵。用 `--first-parent` 可看纯主线。
- **错误 PR merge 后的恢复**：revert merge commit（`git revert -m 1`）比 revert squash 略绕，可接受。
- **单 agent / 单人项目**拷走 scaffold 后若嫌重，可自行改本节（Working agreement 属 L2）。
- **风险**：作者自 merge + 无互审 = 单棒犯错直接进 main。缓解：CI 硬门禁挡结构性错误；协议改动另有 L1/L2 分级；维护者随时可 revert。
- 若未来多 agent 同时在场成为常态（非轮班制），互审的死锁前提失效，届时另开 ADR 重估。
