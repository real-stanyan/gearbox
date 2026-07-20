<!--
本模板是 Gearbox 的协议层契约载体 (ADR-0013)。
新建 PR 时 GitHub 会自动套用本模板。请按需填写, 不要删 Affects downstream 字段。
-->

## What / Why / Changes

<!-- 简述: 做了什么 / 为什么 / 改动文件清单。CI 绿后请自行 merge (L2) 或等维护者同意 (L1)。 -->

## Affects downstream

<!-- 信息性声明 (ADR-0013 → ADR-0026 pull 模型)。二选一:

  - `no`  —— 本 PR 不影响下游项目 (如纯 Gearbox 内部文档、CI 配置、ADR 模板改动)
  - `yes` —— 本 PR 影响 downstream (协议级改动: Hard rules / Gate / Tech stack / Working agreement /
             索引 / 任何引用 L1/L2 分级或协议机制的新增内容, 见 ADR-0012 判据)

回流靠 pull: 下游开工跑 `gearbox-version` 自查、落后就 `gearbox-update` (ADR-0026)。
本字段**不再阻塞 merge**——填 `yes` 无需逐下游开 issue。仅在判断影响面 + 帮维护者决定是否
可选地对私有舰队 (`DOWNSTREAM.md` 已登记项目) 开告知 issue。

若 `no`: 简要说明为什么不影响 (如 "纯 ADR 模板格式调整, 不改协议内容")。
-->

- Affects downstream: <!-- no | yes + 一句影响面说明 -->

## Version bump

<!-- 必填 (ADR-0023)。四选一:

  - `major` —— 跨工具/跨 repo 契约变更 (hash 戳记格式 / install 锚点结构 / 文件布局 / 改名), 下游需人工干预
  - `minor` —— 新增机制 (新 ADR / 新工具 / 新协议条款)
  - `patch` —— 已有文件修订 (措辞 / status 行 / typo)
  - `none`  —— 不动协议与工具 (需一句理由, 如 "纯 README typo")

同一 PR 里作者把 package.json 的 version 改成本次目标版本(= 最新 tag + 段位, ADR-0028/0029)。
merge 后作者 agent 以 merge 时刻最新 tag 为基准打 annotated tag 并 push:
  git tag -a v0.x.y -m "一句话摘要" && git push origin v0.x.y
然后维护者跑 npm publish 发布 npx 包(ADR-0029; 需 npm 凭据, agent 不代跑)。
none 段位不触发 tag/publish, 也不动 package.json version。
-->

- Version bump: <!-- major | minor | patch | none -->

## Gate

```
<!-- 粘贴 node scripts/check-gearbox.js 输出 -->
```
