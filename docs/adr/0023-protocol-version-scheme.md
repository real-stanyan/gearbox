# ADR-0023: 协议版本号——semver 变体 tag + 下游戳记

- Date: 2026-07-19
- Status: accepted
- 关联: ADR-0013(B-3 回流)、ADR-0016/0017/0021/0022(工具家族与 hash 戳记)

## Context

issue #49(维护者会话指示)。同步粒度此前只有「每条 ADR + hash 戳记」——能精确回答"差哪几条",但没有粗粒度人话摘要:下游想知道"我落后多少、回流有多重"得逐条看 20+ 行列表;对外也没有"你拷走的是哪个版本"的标识。

候选方案(会话内讨论):

- **a. semver 变体,段位映射影响重量级**(选定)
- b. 按 L1/L2 分段位——语义错位:L1/L2 是**授权**分级不是**影响**分级(Gate 命令改 flag 是 L1 但对下游影响为零),拿授权当影响,信号是错的
- c. 单调递增 v1/v2——零判断成本但丢掉重量级信号,退化成计数器,与 ADR 编号重复

## Decision

### 语义(semver 变体)

- **major**:跨工具/跨 repo 契约变更——hash 戳记格式(ADR-0021)、install 锚点结构(ADR-0022)、文件布局、改名。下游回流需人工干预
- **minor**:新增机制——新 ADR、新工具、新协议条款。下游要读新内容
- **patch**:已有文件修订——措辞、status 行、typo。下游重拷即可
- 基线:**master 809693d 打 `v0.0.0`**,历史不补 tag

段位价值 = 下游瞄一眼 `v0.4.2 → v0.5.0` 就知道回流的重量级(patch = 重拷,minor = 读新 ADR,major = 人工干预)——正好与 gearbox-version 已有的三类检测(缺失 / 漂移 / 契约)对齐。

### tag 流程

- PR 模板加必填字段 `Version bump: major|minor|patch|none`,`none` 需一句理由——与 `Affects downstream`(ADR-0013)同款声明模式
- merge 后**作者 agent** 以 merge 时刻最新 tag 为基准打 annotated tag(`git tag -a v0.x.y -m "一句话摘要"`)并 push。基准取 merge 时刻,天然串行,无并发冲突
- **不建 CHANGELOG**——tag message + ADR 就是变更记录,不重复造

### 下游戳记

- 下游根目录 `.gearbox-version`,一行版本号(如 `v0.1.0`)
- **工具写工具读,人不维护**:`gearbox-install` 装机写入当前上游版本;`gearbox-update` 回流成功后更新;`gearbox-version` 读取,与上游最新 tag(`git describe --tags --abbrev=0`)对比,输出一行摘要「上游 vX / 本地 vY (落后 段位)」
- 无戳记文件(存量下游如 Blackbox)不报错,提示「下次回流自动写入」——不要求手工补
- 现有逐条 ADR + hash 比对**原样保留**:版本行是摘要,明细仍是事实源;戳记谎报会被明细自然拆穿

## Consequences

- 下游一眼可知落后程度与回流重量级;对外发布有版本标识
- 每个协议 PR 多一次段位判断 + 一次打 tag——判据客观(动契约=major / 新增=minor / 修订=patch),成本低
- 门禁不加断言:tag 在 merge 后打,CI 检不到;兜底 = PR 模板必填字段 + 维护者事后否决权
- 忘打 tag 的失效模式:下一个 PR 的作者按「merge 时刻最新 tag」为基准,会连带补上落差(bump 取两 PR 中较重段位),版本号仍单调;发现漏打按协议开 Protocol gap issue
- **分级**:动 PR merge 流程(Working agreement)+ PR 模板 + 协议文件,按 ADR-0006/0012 归 **L1**;issue #49 + 本 ADR + PR,维护者会话指示发起、merge 前确认同意
