# ADR-0025: gearbox-update 开跑防呆——报告豁免 / 自动切 main / --force-redo

- Date: 2026-07-20
- Status: accepted
- 关联: ADR-0017(gearbox-update)、ADR-0024(--refresh-drift)

## Context

issue #53。Blackbox 首次真实重跑连踩三坑(维护者实操复盘):

1. 上次运行残留的 `gearbox-update-report.md`(untracked)挡住 clean 检查
2. 在旧回流分支上重跑,新分支从 HEAD 分叉,**继承了旧工具的错误拷贝**——工具只警告"不在 main/master"不拦截,警告被忽略,产物不可信且事后难察觉(引用错不是 hash 漂移,--refresh-drift 救不了)
3. 今日分支已存在时只报错,清理要人工三条命令

三者共性:预检把责任推给人,而人在"重跑一下"心态下必然跳过仔细阅读。

## Decision

分级自动化——按风险定谁自动、谁要 flag:

1. **报告文件豁免(无条件自动)**:clean 检查忽略 `gearbox-update-report.md`;它是本工具自己的产物、文档明说 PR 后即弃、每次运行覆盖。风险零。
2. **自动切 main(默认自动,`--allow-branch` 逃生)**:开跑时不在 main/master → `git checkout main`(无 main 则 master,都无则报错)。clean 检查在前,切换必然安全;工具本来就会移动 HEAD(建新分支),把起点也管起来同性质。真要基于别的分支(罕见)加 `--allow-branch`。
3. **`--force-redo`(显式 flag,不做默认)**:今日分支已存在 → 默认仍报错(**分支上可能有手工 L1 修改**——流程就是在回流分支上手改 AGENTS.md 再开 PR,自动删 = 可能销毁人工工作);带 flag 才 `git branch -D` 重建,push 从 `-u` 变 `--force-with-lease` 覆盖远端。**不自动删远端分支**——force-with-lease 温和等效,且保留远端 reflog 兜底。

## Consequences

- 三坑消失/降为一条命令;误用旧基分支这类"静默产出坏结果"的失效模式被硬拦截取代
- `--allow-branch` 使用者自担基分支正确性(工具不再兜底)
- `--force-with-lease` 在他人往回流分支推了提交时会拒绝——这是特性不是缺陷(回流分支理论上单人产物,有别人提交说明出事了)
- 分级:纯工具行为(ADR-0017 先例),不动 AGENTS.md;issue #53 + 本 ADR + PR,CI 绿自主 merge;Version bump: minor
