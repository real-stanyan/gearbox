# ADR-0013: 下游回流提醒机制——B-3 模板强制(scaffold 协议 PR 必填 Affects downstream)

- Date: 2026-07-19
- Status: accepted

## Context

scaffold 是**模板**(非依赖)——`cp` 一次后下游独立演进,跟 scaffold 断联。这设计本身是对的(每个项目该有自己的演进节奏),但**缺回流提醒机制**,导致下游漏接 scaffold 改进。

**实测证据**(issue #24):
- `dryrun` + `mandys_bubble_tea_admin_app` 都接入到 scaffold ADR-0010(2026-07-18)
- scaffold 后续加了 ADR-0011(subagent-system)+ ADR-0012(L1/L2 边界判据)——**两个下游都没拿到**
- 特别是 ADR-0012 是安全相关的协议改进(防 agent L2 self-merge 扩张协议),下游漏了 = 同样的越权风险会发生在它们身上

## Decision

**B-3 模板强制**:scaffold 的每个协议改动 PR,merge 前必须 declare `Affects downstream`(通过 `.github/pull_request_template.md` 强制出现该字段):

- **`no`** —— 本 PR 不影响下游(纯 scaffold 内部文档 / CI / ADR 模板格式等),正常 merge
- **`yes`** —— 本 PR 影响 downstream(任何协议级改动:Hard rules / Gate / Tech stack / Working agreement / 索引 / 任何引用 L1/L2 分级或协议机制的新增内容,按 ADR-0012 判据)。**必须给 `DOWNSTREAM.md` 清单里的每个项目各开一个回流 issue**:
  - issue 内容:引用 scaffold PR + 标 L1/L2(由 scaffold PR 作者按 ADR-0012 判据标)
  - issue 留 open,等下游 agent 开工三件事读到 → 下游决定回流(走自己的 L1)或拒绝(关 issue 注明理由)
  - **PR body 必须附上这些 issue 链接**。**无链接 = 本 PR 不能 merge**(Hard rule)

下游如何收到提醒:**不改下游 AGENTS.md**——回流 issue 开在下游项目里,下游 agent 开工三件事第 2 步("查 GitHub Issues")天然撞到。这是协议自举:下游已有的"先找 open issue"规则自动接住回流提醒。

### 不选其他方案的理由

| 方案 | 为什么不选 |
|---|---|
| **A 自动同步**(submodule / @import / symlink) | 摧毁 L1/L2 门控(下游维护者失去同意权)+ ADR 编号撞车(scaffold 0011 ≠ dryrun 0011)+ 协议 bug 自动传染 + CONTEXT.md 互相覆盖(scaffold 是协作术语,下游是项目领域术语) |
| **B-1 纯手动靠记忆** | 不可靠,正是要解决的问题。issue #24 的实测漏接就是 B-1 的失败 |
| **B-2 agent 半自动跨 repo 开 issue** | scaffold 的 Hard rules 没允许 agent 跨 repo write;且 agent 跨 repo 操作会让 scaffold 的判断混入下游协议,边界模糊 |
| **B-4 GitHub Actions 全自动** | (1) 跨 private repo write 必须用 PAT 或 GitHub App,token 管理 + 过期续期 + 安全风险(权限蔓延)(2) scaffold 加 Action 把它从"纯文档 repo"变成"有代码 repo"——本身是 L1 Tech stack 改动,引入新复杂度(3) Action 失效模式不可见——跑挂了不一定有人发现(4) B-4 不能省掉规则定义(什么是"协议改动"还是要 Hard rule 定),只是把执行自动化 |

## Consequences

- **协议改动 PR 多一步**:作者(agent/人)必须填 `Affects downstream` 字段;`yes` 时必须去每个下游项目开 issue 并附链接。这是真实负担,接受
- **DOWNSTREAM.md 要手动维护**:新项目接入时手动加一行,忘了就漏(但这是低频动作——接入一次)。本 ADR 不提供自动发现下游的机制(GitHub 没有反向追踪)
- **PR 模板不能强制 merge**:技术上 GitHub 不会因缺字段阻止 merge。Hard rule 的执行靠 review + agent 自觉。**失效模式可见**——PR body 没附下游 issue 链接,review 时一眼看出。这是接受的边界:用可见性换简单性
- **回流是建议,不是强制**:下游收到回流 issue 后,是否真的回流由下游维护者决定。本 ADR 只提供"提醒到位",不提供"强制回流"——因为下游可能有自己的 CONTEXT / Hard rules,盲拷会出问题
- **下游规模临界点**:本机制适合 ≤5 个下游 + 协议改动每周 1-2 次的场景(当前实测)。若下游增长到 10+ 或协议改动频率升高,应该升级到 B-3.5(手动 + 本地脚本)或 B-4(Action),届时另开 ADR

## 自举注记

引入 B-3 的本 PR 自己就是协议改动(`yes`),按规则该给下游开回流 issue。**但 B-3 流程还没生效(本 PR 就是引入它)**——所以本 PR 在引入前可自主走 L1 流程(需 Stan 同意),merge 后第一次实战是给 dryrun + mandys_app 各开 0011+0012 的回流 issue。这是协议自我应用的典型自举时刻。

## 演进信号

未来如果观察到:
- agent/人经常忘填 `Affects downstream` → 考虑 B-3.5(本地脚本辅助 review checklist)
- 下游经常收到不相关的回流 issue → 收紧"什么是协议改动"的判据
- 下游经常忽略回流 issue 不处理 → 考虑回流 issue 是否要带更高优先级标记

届时另开 ADR,不在本 ADR 范围调整。
