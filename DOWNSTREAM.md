# Downstream projects

在用本 Gearbox 协议的项目清单。**Gearbox 的协议改动 PR,merge 前必须 declare `Affects downstream`**(ADR-0013);`yes` 时,每个列入本清单的项目都必须各开一个回流 issue。

## 判定标准(必须同时满足才入清单)

1. 根目录有 `AGENTS.md`,内容含 `### Issue & PR 的角色`(证明是 Gearbox 协议,不是同名文件)
2. 根目录有 `CLAUDE.md` = `@AGENTS.md`(空壳契约)
3. 有 `docs/adr/` 目录

## 已接入项目

| repo | 接入时间 | 当前同步到 | 回流备注 |
|---|---|---|---|
| [`real-stanyan/dryrun`](https://github.com/real-stanyan/dryrun) | 2026-07-18 | ADR-0013(自有, subagent routing) | 已回流 Gearbox 0012(= dryrun 0012)+ 0011 §5.1(= dryrun 0013);0013(B-3)不适用(dryrun 无下游);见 [dryrun#38](https://github.com/real-stanyan/dryrun/issues/38) + [dryrun#40](https://github.com/real-stanyan/dryrun/pull/40) |
| [`real-stanyan/mandys_bubble_tea_admin_app`](https://github.com/real-stanyan/mandys_bubble_tea_admin_app) | 2026-07-18 | ADR-0011(自有, native-swiftui) | 缺 Gearbox 0011+0012;回流提醒已开 → [mandys_app#1](https://github.com/real-stanyan/mandys_bubble_tea_admin_app/issues/1) |
| [`real-stanyan/Blackbox`](https://github.com/real-stanyan/Blackbox) | 2026-07-19 | Gearbox 0001–0013 全量 + ADR-0014(自有, tsc gate) | 接入即全量同步,无欠账 |

## 维护

- **新增项目接入时**:PR 引入协议 + 手动在本文件加一行
- **回流 issue merge 后**:更新对应行的"当前同步到"列
- **项目废弃**:保留行但备注"已归档,不再回流"

## 不入清单的项目(已核实)

- `mise` / `sparklab` / `atlas-dashboard`——它们的 AGENTS.md 是 Next.js `nextjs-agent-rules`,与 Gearbox 无关
- 其他 10 个 repo——三项全缺(AGENTS.md / CLAUDE.md / docs/adr/),未接入
