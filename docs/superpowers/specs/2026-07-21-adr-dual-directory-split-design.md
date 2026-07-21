# 设计：ADR 双目录分家（协议 ADR ↔ 项目 ADR）

- 日期: 2026-07-21
- 状态: 待实施（brainstorming 已批准，进 writing-plans）
- 目标 ADR: 0031（协议 ADR，落 `docs/gearbox-adr/`）
- 版本: v1.3.0 → **v2.0.0**（major，跨工具契约变更）
- 分级: **L1**（碰 Gate 锚点 + install/update/version 三工具）

## 问题

当前下游 `docs/adr/` 一个目录、一套编号，同时装两类 ADR：

- **协议 ADR**（拷自上游 Gearbox，带 `- 溯源:` 戳记，ADR-0021）
- **项目自有 ADR**（下游自己写的架构决策）

两类抢同一编号命名空间，导致撞号。`gearbox-update` 为此背了整套「撞号检测 → 重编号 → 改内文 `ADR-XXXX` 引用」逻辑（约 100 行 + `renumberMap`）。例：Blackbox 自有 ADR-0014（tsc gate）占了 0014，上游 gearbox 0014–0020 回流时被整体重编号成本地 0015–0021。

编号漂移让「下游第 N 号 = 上游第几号」不再恒等，回流内文引用要跟着改，复杂且脆。

## 决策

**把两类 ADR 拆进两个平行目录**，上游下游一致：

```
docs/gearbox-adr/   ← 协议 ADR。工具独占管理（install 写 / update 回流 / version 读）。手别改
docs/adr/           ← 项目自有 ADR。人写，从 0001 起。工具永不碰
```

上游本 repo 的 30 个 ADR 全是协议 ADR → 整体 `git mv` 进 `docs/gearbox-adr/`；上游不再有 `docs/adr/`（Gearbox 自身暂无非协议决策；日后若有纯 repo 层面决策再新建）。

### 核心收益

- 两套编号各占各目录 → **永不撞号**
- 下游 `gearbox-adr/` 编号与上游 **1:1 恒等**（无漂移）
- `gearbox-update` 的**重编号子系统整个删除**（撞号检测 / `renumberMap` / `replaceAdrRefs` 内文改写）——它本就只因撞号而存在

### 不做的事（YAGNI）

- **不写迁移工具**。现有 3 个下游（dryrun / mandys / Blackbox）是早期自测舰队，非真安装，本次不动；将来真回流到它们时手动 `git mv` 即可，不固化成代码。
- 不给 `docs/adr/` 预置模板文件；项目 ADR 复用 `gearbox-adr/0001-adr-template.md` 的格式，AGENTS.md 里点明。

## 改动清单（8 个文件 + 1 新 ADR）

| # | 文件 | 改动 |
|---|---|---|
| 1 | 上游 `docs/adr/*.md`（30） | `git mv` → `docs/gearbox-adr/`；ADR 间 `ADR-XXXX` 文本引用**不变**（号不变），仅路径式引用要改（见 #6） |
| 2 | `scripts/check-gearbox.js` | required file `docs/adr/0001-adr-template.md` → `docs/gearbox-adr/0001-…`；目录断言 `docs/adr` → `docs/gearbox-adr` |
| 3 | `scripts/gearbox-install` | 源常量 `GEARBOX_ADR_DIR` + `GEARBOX_GITHUB_BASE` → `gearbox-adr`；写目标 `docs/adr` → `docs/gearbox-adr`；收尾提示改为「协议 ADR 已入 gearbox-adr/，首个**项目**决策写 `docs/adr/0001-*.md`」 |
| 4 | `scripts/gearbox-update` | 源/目标目录常量 → `gearbox-adr`；**删重编号子系统**；dedup 改为「`gearbox-adr/NNNN-slug.md` 是否已存在」（号即规范号）；0006 supersede 处理路径 → `gearbox-adr` |
| 5 | `scripts/gearbox-version` | `UPSTREAM_ADR_DIR` / `DOWNSTREAM_ADR_DIR` / 本地探测 / 报错文案 → `gearbox-adr` |
| 6 | `AGENTS.md` | 「Where to find things」列两目录；内文路径引用 `docs/adr/0003-…` `docs/adr/0005-…` → `gearbox-adr/`；While working「架构性决策写 docs/adr/」改为「**项目**架构决策写 `docs/adr/`；协议 ADR 由工具管在 `docs/gearbox-adr/`，手别改」 |
| 7 | `README.md` | 第 30/40 行路径 + 说明：项目 ADR → `docs/adr/`（从 0001）；协议 ADR → `docs/gearbox-adr/` |
| 8 | `DOWNSTREAM.md` | 判定标准第 3 条 `docs/adr/` → `docs/gearbox-adr/`（证明是 Gearbox 协议项目看这个目录） |
| 9 | **新** `docs/gearbox-adr/0031-adr-dual-directory-split.md` | 记录本决策与理由 |

## 治理（按 Gearbox 自己的规矩）

- **三件套**：Protocol gap issue + ADR-0031 + 分支 PR（CI 绿）
- **L1 明确同意**：维护者（stanyan，= 本人）在会话/PR comment 说「同意」后 agent 才 merge
- **版本**：PR body 声明 `Version bump: major`；同 PR 把 `package.json` version 改 `2.0.0`；merge 后作者打 annotated tag `v2.0.0` + push；维护者跑 `npm publish`（agent 不代跑，ADR-0028/0029）
- **CI 门禁全程绿**：`node scripts/check-gearbox.js`（#2 改完后仍须通过）

## 验证

1. `node scripts/check-gearbox.js` 绿（上游自检认 `docs/gearbox-adr/`）
2. 沙盒跑 `gearbox-install` 到空目录 → 协议 ADR 落 `docs/gearbox-adr/`，`docs/adr/` 不被工具创建，收尾提示正确
3. 沙盒跑 `gearbox-version` → 认 `docs/gearbox-adr/`，版本对比正常
4. 沙盒跑 `gearbox-update`（下游落后一版）→ 回流拷入 `gearbox-adr/`，号与上游一致，无重编号，不碰 `docs/adr/`
5. 项目自有 ADR 放 `docs/adr/0001-*.md` 时工具全程不动它

## 考虑过但未采纳

- **子目录**（`docs/adr/gearbox/`）：工具路径多一层、项目 ADR 与 gearbox 子目录同级易混。
- **文件名前缀**（`gearbox-0001-*.md` 同目录）：两类仍混在一个 `ls`，可读性最差，工具要靠前缀过滤。
- **迁移工具**：3 个下游是自测舰队，手动 `git mv` 足够，不值得固化。
- **上游保持 `docs/adr/`**（不对称）：工具要分源/目标两常量，语义也不正（上游那些就是协议 ADR）。
