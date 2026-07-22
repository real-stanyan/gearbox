# ADR-0024: gearbox-update --refresh-drift——漂移拷贝重拷 + 全量引用映射

- Date: 2026-07-20
- Status: accepted
- 关联: ADR-0017(gearbox-update)、ADR-0021(hash 戳记契约)、ADR-0023(版本号)

## Context

issue #51(维护者会话指示)。两个缺口:

1. **漂移只报不修**:上游修订已拷贝的 ADR 后,`gearbox-version` 报 ⚠️ 漂移(ADR-0021),但 `gearbox-update` 对已存在的 slug 匹配一律 skip——闭环断在"人工 diff 或重拷"。
2. **增量回流的引用映射 bug**:`transformAdrContent` 的 renumberMap 只含**本次新拷**的编号映射,不含历史已重编号的配对。首次全量回流(一批拷完)时碰不到;增量回流时新拷 ADR 内文引用旧条目会保留上游编号,在下游指向错误文件。实锤:Blackbox `docs/gearbox-backfill-2026-07-19` 分支,新拷的 0023(install)内文 `ADR-0016` 在 Blackbox 实际是 0017。

维护者曾问"能否镜像同步(下游多的删、少的补)"——**否决**:下游 docs/adr/ 是「上游拷贝 + 下游自有决策」混合体,删"多的"= 销毁下游自有 ADR;且回流是提醒不是强制(ADR-0013),下游有权拒绝,镜像会把已拒绝的强行塞回。同步语义维持单向增量,本 ADR 只补漂移闭环。

## Decision

1. **`--refresh-drift` flag(opt-in)**:对 slug 匹配且带 `sha256:` 戳记的拷贝,比对记录 hash vs 上游当前 hash;漂移 → 用上游最新内容重跑变换覆盖(保留下游编号,溯源行随变换重新生成、hash 戳记自动换新),每个重拷单独 commit,走同一条回流分支。
   - **不碰**:下游自有 ADR(无上游 slug/溯源配对)、legacy 无戳记拷贝(漂移不可检测,ADR-0021 边界)、溯源引用型同步(非拷贝)。
   - **已知取舍**:覆盖会丢掉下游对拷贝文件的本地修改。兜底 = 分支 + PR review(diff 可见)+ 下游 L1 流程;因此是 flag 不是默认行为。
   - 不带 flag 时检测到漂移 → skip 原因里显式报漂移并提示 flag,不再静默。
2. **引用映射修复(无条件生效)**:变换用的映射表 = **全部已存在的 slug/溯源配对**(上游号 → 下游号)∪ 本次新拷分配。新拷与重拷共用。

## Consequences

- 漂移闭环:version 报 ⚠️ → update --refresh-drift 重拷 → 戳记更新 → version 转 ✅
- 增量回流的交叉引用从此正确;Blackbox 现存回流分支建议废弃重跑(修复后的工具会产出正确引用)
- 重拷覆盖本地修改的风险显性化(flag + review),不引入"下游修改保护"这类复杂 diff 合并——YAGNI,出现真实需求再议
- 分级:纯工具行为(ADR-0017「个人工具,不是协议改动」先例),不动 AGENTS.md;三件套照走(issue #51 + 本 ADR + PR),CI 绿自主 merge;Version bump: minor(新增机制)
