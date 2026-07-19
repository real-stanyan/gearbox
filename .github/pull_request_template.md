<!--
本模板是 Gearbox 的协议层契约载体 (ADR-0013)。
新建 PR 时 GitHub 会自动套用本模板。请按需填写, 不要删 Affects downstream 字段。
-->

## What / Why / Changes

<!-- 简述: 做了什么 / 为什么 / 改动文件清单。CI 绿后请自行 merge (L2) 或等维护者同意 (L1)。 -->

## Affects downstream

<!-- 必填 (ADR-0013)。二选一:

  - `no`  —— 本 PR 不影响下游项目 (如纯 Gearbox 内部文档、CI 配置、ADR 模板改动)
  - `yes` —— 本 PR 影响 downstream (协议级改动: Hard rules / Gate / Tech stack / Working agreement /
             索引 / 任何引用 L1/L2 分级或协议机制的新增内容, 见 ADR-0012 判据)

若 `yes`: 必须给 DOWNSTREAM.md 清单里的每个项目各开一个回流 issue, 引用本 PR + 标 L1/L2,
然后把链接附在下面。**无下游 issue 链接 = 本 PR 不能 merge (ADR-0013 硬规则)。**

若 `no`: 简要说明为什么不影响 (如 "纯 ADR 模板格式调整, 不改协议内容")。
-->

- Affects downstream: <!-- no | yes -->
- 下游回流 issue 链接(yes 时必填, **按 `DOWNSTREAM.md`「已接入项目」清单逐项列出**, 一项一行):
  - <repo>: <回流 issue 链接>

## Version bump

<!-- 必填 (ADR-0023)。四选一:

  - `major` —— 跨工具/跨 repo 契约变更 (hash 戳记格式 / install 锚点结构 / 文件布局 / 改名), 下游需人工干预
  - `minor` —— 新增机制 (新 ADR / 新工具 / 新协议条款)
  - `patch` —— 已有文件修订 (措辞 / status 行 / typo)
  - `none`  —— 不动协议与工具 (需一句理由, 如 "纯 README typo")

merge 后作者 agent 以 merge 时刻最新 tag 为基准打 annotated tag 并 push:
  git tag -a v0.x.y -m "一句话摘要" && git push origin v0.x.y
-->

- Version bump: <!-- major | minor | patch | none -->

## Gate

```
<!-- 粘贴 node scripts/check-gearbox.js 输出 -->
```
