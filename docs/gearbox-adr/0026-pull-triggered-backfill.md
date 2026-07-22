# ADR-0026: 回流从 push 触发改 pull 触发——B-3 降级、DOWNSTREAM.md 变可选仪表盘

- Date: 2026-07-20
- Status: accepted
- 关联: ADR-0013(B-3 下游回流提醒,本 ADR 降级之)、ADR-0014(PR 模板引用下游清单)、ADR-0016(gearbox-version)、ADR-0017(gearbox-update)、ADR-0018(Hard rule 标注定级)、ADR-0023(版本号)

## Context

Gearbox 定位是 GitHub 公共模板——任何人可拷走自建上游。但现有回流机制（B-3 / ADR-0013）是 **push**：

> 每个协议改动 PR，merge 前必须给 `DOWNSTREAM.md` 清单里的每个项目各开一个回流 issue，**无链接 = 不能 merge**。

push 成立的前提是上游**知道每个下游是谁、且有权在其 repo 开 issue**。这只在「维护者自己控制的一堆 repo」成立。对公共模板：

1. 陌生人 fork gearbox 自用 → 上游根本不知道他存在 → 无法为他开 issue。
2. 即便知道，也无权在陌生人 repo 开 issue。
3. 于是 `DOWNSTREAM.md` 的「已接入项目」硬编码清单，本质是**私有舰队管理数据**，混进了公共模板。

核心观察：**更新机制早已是 pull**——`gearbox-update` 就是「下游主动去上游找缺失 ADR 拷回来」，`gearbox-version` 就是「下游主动对比上游算落后」。push（B-3 开 issue）**不是更新机制，只是触发器**——让下游 agent 想起来跑 update。触发器可以换成下游开工自查，无需上游预先认识下游。

## Decision

回流触发从 **push（上游开 issue）** 改为 **pull（下游开工自查）**。四处联动：

1. **触发器迁移（下游开工三件事新增一步）**
   下游开工三件事加第 4 步：`跑 gearbox-version，落后就 gearbox-update`（只读、零副作用、几秒）。下游看到 ⚠️/✗ 自行拉取。
   → `gearbox-install` 从此为新下游 scaffold 这一步（新增锚点变换）；存量下游经 `gearbox-update` 回流本 ADR 时，报告用 `AGENTS_MD_IMPACT[26]` 提示手动加这一步。
   → **Gearbox 本体（上游）自身开工三件事不加此步**——它是上游，无上游可查。此步是接收端语义，仅经 install 注入下游。

2. **B-3 降级（ADR-0013，L1 核心改动）**
   删除「无链接 = 不能 merge」硬门禁。PR 模板的 `Affects downstream` 声明**保留为信息性**（帮人判断影响面），不再强制逐下游开 issue、不再阻塞 merge。B-3 由 Hard rule 降为「可选的维护者告知」。
   → 连带：ADR-0018 的「Hard rule 标注定级」示例原用 B-3「无链接=不能 merge」，B-3 降级后该示例失效，改用「Issue & PR 的角色」一节的「必须开 issue，不许 silent 判断」硬规则举例（install 接收端版本早已用它，正好统一）。

3. **DOWNSTREAM.md 降级为可选仪表盘**
   「已接入项目」表不再是 B-3 的遍历目标 / merge 门禁。保留「入清单判定标准」+「不入清单的已核实项目」作通用文档；「已接入项目」表标注为**非规范性、维护者自用的舰队视图**，公共模板拷走时可整表清空而不破坏任何机制。表本身保留（维护者的私有舰队仪表盘），`check-gearbox.js` 对 `## 已接入项目` 章节的断言保留——现在守的是「仪表盘章节别被误删」，不再是「B-3 遍历目标」。

4. **工具上游寻址（本 ADR 只声明方向，实现拆 follow-on）**
   `gearbox-version` / `gearbox-update` 现读本地 `~/Github/gearbox`。陌生下游无此本地副本，pull 对其仍不可用。**远端寻址（git remote / gh / 固定上游 URL）是 pull 真正服务陌生人的必要条件，但范围独立、体量大，拆为后续 ADR（follow-on）**。本 ADR 对**当前共享本地上游的舰队**（dryrun/mandys/Blackbox 都指向同一份 `~/Github/gearbox`）立即生效；公共陌生 fork 的 pull 待 follow-on。

## Consequences

- **公共模板与私有舰队解耦**：模板不再内嵌下游清单作门禁；舰队数据变成维护者可选的本地便利，删了不破协议。解决了「公共项目不该硬编码下游清单」。
- **触发保证的性质变化（诚实记录）**：push 是「上游保证 issue 存在」，pull 是「下游保证开工自查」。看似 pull 更弱，但——① push 也只保证 issue 存在，不保证下游行动，下游照样得开工三件事 + 动手；② 对陌生人 push 从来是虚构的保证；③ pull 对「上游忘了开 issue」这一失效模式更健壮。净评估：现实威胁模型下 pull 至少不弱于 push。
- **AGENTS.md 正文级改动仍需人工**：`gearbox-update` 护栏本就不碰下游 AGENTS.md，那部分靠报告的人工评估提示——push/pull 都不替你改，换 pull 零损失。本 ADR 改了下游开工三件事，属 AGENTS.md 正文级 → `AGENTS_MD_IMPACT` 新增 26 条目（并补回历史漏登的 25 = null）。
- **存量下游一次性迁移（最后一次 push）**：dryrun/mandys/Blackbox 各需在自己 AGENTS.md 加开工第 4 步。本 PR 自身 `Affects downstream: yes`，按**本 PR 仍生效的 B-3** 给三者各开一个迁移 issue——这是 B-3 退役前的最后一次 push，恰好用来分发 pull 迁移。迁移后它们靠自查，不再依赖上游开 issue。
- **分级 / 版本**：删除 B-3「无链接=不能 merge」这条 Hard rule 断言 = **L1**（放松/删除现有门禁语义，ADR-0010）。改下游 AGENTS.md 开工三件事契约、下游需人工加步 = **major**（ADR-0023）→ v0.3.0 之后为 **v1.0.0**，也恰当标记「Gearbox 首次破坏性变更 / 走向公共」。
- **三件套**：Protocol gap issue + 本 ADR + 分支 PR，CI 绿 + **维护者「同意」后**方可 merge（L1）。
- **考虑过但未采纳**：保留 push 服务私有舰队 + pull 服务公共（双轨）。否决——双轨要同时维护 DOWNSTREAM.md 清单和自查步，复杂度翻倍；push 半条命的价值（上游保证）在有 pull 后边际收益低。宁可 pull 单轨 + DOWNSTREAM.md 纯可选仪表盘。
