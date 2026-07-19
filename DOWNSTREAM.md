# Downstream projects

在用本 scaffold 协议的项目清单。**scaffold 的协议改动 PR,merge 前必须 declare `Affects downstream`**(ADR-0013);`yes` 时,每个列入本清单的项目都必须各开一个回流 issue。

## 判定标准(必须同时满足才入清单)

1. 根目录有 `AGENTS.md`,内容含 `### Issue & PR 的角色`(证明是 scaffold 协议,不是同名文件)
2. 根目录有 `CLAUDE.md` = `@AGENTS.md`(空壳契约)
3. 有 `docs/adr/` 目录

## 已接入项目

| repo | 接入时间 | 当前同步到 | 回流备注 |
|---|---|---|---|
| [`real-stanyan/dryrun`](https://github.com/real-stanyan/dryrun) | 2026-07-18 | ADR-0011(自有, puppeteer) | 缺 scaffold 的 0011(subagent-system)+ 0012(L1/L2 边界判据) |
| [`real-stanyan/mandys_bubble_tea_admin_app`](https://github.com/real-stanyan/mandys_bubble_tea_admin_app) | 2026-07-18 | ADR-0011(同步自 scaffold) | 缺 scaffold 的 0012(L1/L2 边界判据) |

## 维护

- **新增项目接入时**:PR 引入协议 + 手动在本文件加一行
- **回流 issue merge 后**:更新对应行的"当前同步到"列
- **项目废弃**:保留行但备注"已归档,不再回流"

## 不入清单的项目(已核实)

- `mise` / `sparklab` / `atlas-dashboard`——它们的 AGENTS.md 是 Next.js `nextjs-agent-rules`,与 scaffold 无关
- 其他 10 个 repo——三项全缺(AGENTS.md / CLAUDE.md / docs/adr/),未接入
