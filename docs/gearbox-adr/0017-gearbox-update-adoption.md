# ADR-0017: gearbox-update 入库——写侧回流工具转正,护栏写成契约

- Date: 2026-07-19
- Status: accepted

## Context

`scaffold-update`(node,Z Code 2026-07-19 产出)是写侧下游同步工具:扫描下游缺失的上游 ADR → 撞号自动重编号 → 单遍全文替换交叉引用 → supersede 状态联动 → 每个 ADR 一个 commit → push 到下游新分支 → 出报告。与只读的 gearbox-version(ADR-0016)互补。

问题(issue #39):居无定所、"个人工具"自我定级无判据、与 ADR-0013 拒选方案 A(自动同步)存在张力。维护者拍板选 a:入库转正。

## Decision

1. **入库**:`scripts/gearbox-update`,改名并纳入版本控制。部署 symlink 到 PATH,旧 `~/.local/bin/scaffold-update` 删除
2. **护栏从注释升级为契约**——以下三条是本 ADR 的核心,削弱任何一条 = L1 协议变更,必须走 issue + ADR + 维护者同意:
   - **不碰下游 AGENTS.md**(L1 文件只报告,不写)
   - **不自动开 PR**(留给人/主 agent review 后手动)
   - **不自动 merge**(L1 需维护者同意,b-弱形态不变)
3. **与 ADR-0013 方案 A 的边界**:A 被拒是因为"自动同步摧毁 L1/L2 门控"。gearbox-update 人手逐 repo 触发、只产出**待 review 的分支**、终点仍是下游自己的 L1 流程——门控保留,自动化的只是机械劳动(拷贝/重编号/引用替换)。这条边界成立的前提是三条护栏;护栏破则回到 A,应重读 ADR-0013 的拒选理由
4. **入库时顺手修的四处**:溯源识别 regex 兼容 scaffold/Gearbox 两代写法;PR base 分支从写死 `main` 改为检测(main/master);`AGENTS_MD_IMPACT` 表补 0014~0017 并立维护契约(上游每新增 ADR 必须补一行,null = 不动 AGENTS.md);全部改称 gearbox(分支名 `docs/gearbox-backfill-*`、报告 `gearbox-update-report.md`、env `GEARBOX_DIR`)

## Consequences

- **回流机械劳动归零**,判断劳动保留:AGENTS.md 手改清单、diff review、门禁、L1 同意都还在人/主 agent 手里
- **已知硬编码(接受)**:supersede 联动只认 "上游 0012 → 下游 0006" 这一对;未来上游出现新的 supersede 关系要改脚本。`AGENTS_MD_IMPACT` 同理。两处都有注释标明维护义务
- **不进门禁**:工具坏了影响的是回流效率,不是协议正确性;权威仍是 DOWNSTREAM.md + 下游 L1 流程
- **实测**(mandys_app 沙盒,本地 bare remote):6 个 ADR 回流、撞号链式重编号(0011→0012 连带 0012→0013...0016→0017)、交叉引用单遍替换、0006 supersede 指向重编号后的目标,全部正确
