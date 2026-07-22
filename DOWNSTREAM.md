# Downstream projects

> **本表是非规范性的可选仪表盘(ADR-0026)。** 回流靠 pull——下游开工跑 `gearbox-version` 自查、落后就 `gearbox-update`,不依赖上游推送;本表不再是 merge 门禁,也不是任何硬规则的遍历目标。它只是**维护者自用的私有舰队视图**,记录「我这些 repo 各同步到哪」。**拷走 Gearbox 自建上游时,整个「已接入项目」表可清空**——判定标准与「不入清单」两节是通用文档,保留即可。

在用本 Gearbox 协议的项目清单(维护者舰队)。协议改动 PR 仍在 PR body 声明 `Affects downstream`(信息性,ADR-0013 → ADR-0026);维护者可**可选地**对下列项目开告知 issue,但非强制——下游本就会靠开工自查撞到落后。

## 判定标准(必须同时满足才入清单)

1. 根目录有 `AGENTS.md`,内容含 `### Issue & PR 的角色`(证明是 Gearbox 协议,不是同名文件)
2. 根目录有 `CLAUDE.md` = `@AGENTS.md`(空壳契约)
3. 有 `docs/gearbox-adr/` 目录（协议 ADR 落点）

## 已接入项目

| repo | 接入时间 | 当前同步到 | 回流备注 |
|---|---|---|---|
| [`real-stanyan/dryrun`](https://github.com/real-stanyan/dryrun) | 2026-07-18 | ADR-0013(自有, subagent routing) | 已回流 Gearbox 0012(= dryrun 0012)+ 0011 §5.1(= dryrun 0013);0013(B-3)不适用(dryrun 无下游);见 [dryrun#38](https://github.com/real-stanyan/dryrun/issues/38) + [dryrun#40](https://github.com/real-stanyan/dryrun/pull/40) |
| [`real-stanyan/mandys_bubble_tea_admin_app`](https://github.com/real-stanyan/mandys_bubble_tea_admin_app) | 2026-07-18 | ADR-0011(自有, native-swiftui) | 缺 Gearbox 0011+0012;回流提醒已开 → [mandys_app#1](https://github.com/real-stanyan/mandys_bubble_tea_admin_app/issues/1) |
| [`real-stanyan/Blackbox`](https://github.com/real-stanyan/Blackbox) | 2026-07-19 | **Gearbox 0001–0020 全量**(0014–0020 重编号为本地 0015–0021)+ ADR-0014(自有, tsc gate) | 2026-07-19 [Blackbox#5](https://github.com/real-stanyan/Blackbox/pull/5) 回流(gearbox-update 首次实战);AGENTS.md 四项已回流(改名/0018/0019/0020);回流 issue #1–#4 已关 |

## 维护

- **新增项目接入时**:PR 引入协议 + 手动在本文件加一行
- **回流 issue merge 后**:更新对应行的"当前同步到"列
- **项目废弃**:保留行但备注"已归档,不再回流"
- **本地速查**:在下游 repo 根目录跑 `~/Github/gearbox/scripts/gearbox-version`(溯源优先判定 ADR-0016 + hash 漂移检测 ADR-0021)。速查非权威——权威是本文件;下游"已评估拒绝回流"脚本看不见;无戳记的 legacy 拷贝漂移不可检测
- **批量回流**:在下游 repo 根目录跑 `~/Github/gearbox/scripts/gearbox-update`(ADR-0017)——拷缺失 ADR + 重编号 + push 待 review 分支。护栏:不碰 AGENTS.md、不自动 PR、不自动 merge;终点仍是下游 L1 流程

## 不入清单的项目(已核实)

- `mise` / `sparklab` / `atlas-dashboard`——它们的 AGENTS.md 是 Next.js `nextjs-agent-rules`,与 Gearbox 无关
- 其他 10 个 repo——三项全缺(AGENTS.md / CLAUDE.md / docs/adr/),未接入
