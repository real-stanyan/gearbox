# ADR-0031: ADR 双目录分家——协议 ADR 与项目 ADR 拆目录,消撞号删重编号

- Date: 2026-07-21
- Status: accepted
- 关联: ADR-0021(hash 戳记)、ADR-0022(gearbox-install)、ADR-0023(版本号)、ADR-0024(重编号回流)、ADR-0016/0017(version/update)

## Context

下游 `docs/adr/` 一个目录同装两类 ADR:协议 ADR(拷自上游,带 `- 溯源:` 戳记 ADR-0021)与项目自有 ADR。两类抢同一编号命名空间会撞号——例 Blackbox 自有 ADR-0014 占号,上游 0014–0020 回流被整体重编号为本地 0015–0021。`gearbox-update` 为此背了整套「撞号检测 → 重编号 → 改内文 `ADR-XXXX` 引用」逻辑(`buildExistingNumMap` / `assignDownstreamNums` / `replaceAdrRefs`),复杂且脆:编号漂移让「下游第 N 号 = 上游第几号」不再恒等。

## Decision

拆成两个平行目录,上游下游一致:

- `docs/gearbox-adr/` — 协议 ADR。工具独占管理(install 写 / update 回流 / version 读),手别改。
- `docs/adr/` — 项目自有 ADR。人写,从 0001 起,工具永不碰。

上游本 repo 的协议 ADR 全部住 `docs/gearbox-adr/`;上游无 `docs/adr/`(Gearbox 自身暂无非协议决策)。

因两类分属不同目录,永不撞号,下游 `gearbox-adr/` 编号与上游 **1:1 恒等**。`gearbox-update` 的重编号子系统整体删除——它本就只因撞号而存在。

不写迁移工具:现有 3 个下游(dryrun/mandys/Blackbox)是早期自测舰队,将来真回流时手动 `git mv` 即可。

## Consequences

- **跨工具契约变更(文件布局)= major**(ADR-0023)→ v1.3.0 后为 v2.0.0。碰 Gate 锚点 + 三工具 = L1(ADR-0006)。
- `gearbox-update` 大幅简化:删撞号/重编号/内文改写,回流即「缺则按上游原号拷入 gearbox-adr/」。
- 下游项目 ADR 从 0001 独立编号,语义清晰:`ls docs/adr/` 只见自家决策,`ls docs/gearbox-adr/` 只见协议。
- 存量下游需一次性手动 `git mv`(本次不做);未迁移的老下游跑新 update 会把协议 ADR 拷进 `gearbox-adr/`,`docs/adr/` 里的旧协议 ADR 残留需手动清。
- **考虑过但未采纳**:子目录(`docs/adr/gearbox/`,路径多一层易混)、文件名前缀(`gearbox-0001-*`,仍混在一个 ls)、迁移工具(3 个下游手动足够)、上游保持 `docs/adr/`(工具要分源/目标两常量,语义不正)。
