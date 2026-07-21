# ADR-0029: release 仪式纳入 npm publish + package.json 版本同步

- Date: 2026-07-20
- Status: accepted
- 关联: ADR-0023(协议版本号/tag 流程,本 ADR 扩充其流程段)、ADR-0028(npx 分发)

## Context

ADR-0028 把工具做成 npm 包(`gearbox-agents`),`npm publish` 是让 npx 分发生效的一步,但它散在 ADR-0028 的文字里、不在协议正文的 release 流程中。后果:

1. 打完 tag 容易忘 publish → npm 上的版本落后于 git tag,`npx gearbox-agents@latest` 拿到旧协议。
2. `package.json` 的 `version` 要与 git tag 同号(ADR-0028 决策),但同步时机没写进流程 → 容易漏改、两号漂移。

ADR-0023 的 release 流程只到「打 tag 并 push」,没覆盖 npm 包这层。本 ADR 把它补齐。

## Decision

扩充 ADR-0023 的 release 流程(AGENTS.md「协议版本号」段),纳入两步:

1. **package.json 版本同步(PR 内)**:声明 `Version bump` 的同一 PR 里,作者把 `package.json` 的 `version` 改成本次目标版本(= merge 时刻最新 tag + 段位)。npm 包版本与 git tag 恒等号(ADR-0028)。
2. **npm publish(tag 后,维护者)**:merge + 打 tag/push 之后,**维护者跑 `npm publish`** 发布 npx 包。`npm publish` 发外部 registry、需 npm 凭据 → **只维护者手动**,agent 不代跑(ADR-0028 第 6 决策)。

流程全序:PR 声明 `Version bump` + 改 `package.json` version → CI 绿 → merge → 作者 agent 打 annotated tag + push → 维护者 `npm publish`。

- `none` 段位(不动协议与工具)不触发 publish,`package.json` version 也不动。
- 漏改 `package.json` / 漏 publish 的失效模式同 ADR-0023 的漏 tag:下一次 release 的作者补上(patch 修正版本号 / 补发 publish)。不引入自动化门禁强制——保持轻,人兜底。

## Consequences

- release 仪式单一化:一条流程从 Version bump 声明走到 npm 上线,不再有「打了 tag 但 npm 没更新」的隐性漂移。
- **分级 = L1**:改 AGENTS.md「协议版本号」段(在「协议自身的变更」节内,协议正文)= L1(ADR-0006)。三件套 + 维护者「同意」后 merge。
- **版本 = patch**:已有文件(AGENTS.md 版本号段 + PR 模板)修订,补一步流程,不新增跨工具/跨 repo 契约,也非新机制(publish 机制已在 ADR-0028)→ patch → v1.2.2。
- **install 锚点连带**:gearbox-install 把「协议版本号」段变换成下游接收端版(下游不发布 gearbox),锚点随正文改动更新——纯工具跟随,同 PR。
- **下游无影响**:下游是 gearbox 的使用者,不发布 gearbox 协议包;`AGENTS_MD_IMPACT[29] = null`。
- **考虑过但未采纳**:CI 自动 `npm publish`(需 `NPM_TOKEN` secret + 自动发布风险)——否决,publish 保持维护者手动、有意识的动作;真要自动化,维护者自配 Action,不进协议默认。
