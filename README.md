# Gearbox — 多 agent 协作项目骨架

> 前身名 `agents-md-scaffold`,2026-07-19 改名 **Gearbox**(ADR-0015)。旧 GitHub URL 自动跳转。

## 快速上手（零配置,ADR-0028）

有 node 即可,无需 clone / 配 PATH：

```bash
# 在新项目目录里铺 Gearbox 骨架(占位、门禁、ADR 溯源+hash 戳记全自动)
npx gearbox-agents install --maintainer <你的名字> --gate "npx tsc --noEmit"
# 三个参数都可省: 省了就留 <占位符>,ci.yml 放故意失败的占位命令

# 之后随时查同步 / 回流上游协议更新(pull 触发,ADR-0026)
npx gearbox-agents version    # 查当前 repo 同步到上游哪个版本 / 哪些 ADR
npx gearbox-agents update     # 拷上游缺失 ADR 到当前 repo,产出待 review 分支
```

> npx 路径:包自带上游快照,`version`/`update` 拿包快照作上游对比(ADR-0028)。
> `version` 需环境有 bash(mac/linux 天然;Windows 用 Git Bash / WSL);`install`/`update` 是 node,跨平台。

**维护者 / 贡献者**(改 Gearbox 本身)用本地 clone：

```bash
node ~/Github/gearbox/scripts/gearbox-install <repo> --maintainer <你的名字> --gate "npx tsc --noEmit"
```

装完：
1. 填 `AGENTS.md` 里剩余 `<占位符>`（`grep -n '<' AGENTS.md`）
2. 首个自有架构决策写进 `docs/adr/`（项目 ADR 独立编号，从 0001 起）；协议 ADR 在 `docs/gearbox-adr/`（工具管，格式见其 0001-adr-template.md）
3. 开工三件事第 4 步跑 `npx gearbox-agents version` 自查协议版本(pull 触发)

## 架构（为什么长这样）

| 文件 | 角色 |
|---|---|
| `AGENTS.md` | 单一事实源。所有 agent（Claude Code、Z Code 等）都读它。规则只写这一份 |
| `CLAUDE.md` | 空壳，`@AGENTS.md` 一行。兼容旧版 Claude Code + 未来 Claude 专属内容挂载点 |
| `CONTEXT.md` | 领域词汇表。防止不同 agent 对同一个业务词理解不同 |
| `docs/gearbox-adr/` | 协议 ADR（拷自 Gearbox，工具管）。`docs/adr/` 则放本项目自有决策 |
| `.github/workflows/ci.yml` | 硬门禁。红了 merge 不进——唯一不依赖 agent 自觉的约束 |

刻意**没有** `HANDOFF.md`：进度和交接走 GitHub Issues + PR（append-only、带时间戳、不腐烂）。

## 验证过的实践（date-cli 实验 + Gearbox 自食其力）

这套协议不是空想,在 [`real-stanyan/date-cli`](https://github.com/real-stanyan/date-cli)（private）里跑过 **4 轮多 agent 协作验证**（Z Code 开局 + Claude Code 接力 3 轮,完整 git log / issues / PR / ADR 可查）,之后又在**本 repo 自身**用同一套协议跑了第 5、6 轮（自食其力:用协议维护协议）。长出的机制全部落成 ADR:

| 机制 | ADR | 解决的问题 | 出处 |
|---|---|---|---|
| Memory 五项格式 | 0004 | 排程决策(选 a 不选 b 的理由)不再腐烂,且不污染 ADR | date-cli |
| 交接 Memory 留 open issue | 0005 | 下一棒开工自然扫到入口,不再靠人指路 | date-cli |
| 协议变更分级授权(L1/L2) | 0006 | Hard rules/Gate 不能 agent 自主改;Working agreement 可自治 | date-cli |
| PR 处置细则 | 0007 | merge 策略/merge 权限/互审与否不再靠临时授权 | date-cli 实践追认 |
| 分工占位符显式化 | 0008 | 分工是项目属性;无约定时兜底 = Task issue 认领制 | 第 5 轮 |
| 终局收工豁免 | 0009 | 「违规收工」和「工作到头」分得开;沉默的终局不算终局 | 第 5 轮 |
| 门禁断言分层 | 0010 | 收紧门禁 L2 零摩擦;放松/删除 L1 需人同意 | 第 5 轮 |
| Subagent 模板与路由 | 0011 | 主 agent 派活缺统一模板;下游可按需回流 | 第 6 轮 |
| L1/L2 边界判据(机制引用优先) | 0012 | agent 用「可选+纯新增」当 L2 通道扩张协议边界(PR #21 复盘) | 第 6 轮 |
| 下游回流提醒(B-3) | 0013 | Gearbox 是模板非依赖,下游漏接协议改进无感知 | 第 6 轮 |

**实验验证了什么成立、什么不成立:**

- ✅ **成立的**:交接零口述、协议自我修复循环(开缺口 → 补进 AGENTS.md)、代码协作三棒无一处靠猜
- ✅ **第 5 轮新增的**:协议能抓自身违规——上一棒没开交接 issue,下一棒按 On starting 撞空、开缺口 issue、长出 ADR-0009 边界条款,全程无人指路;L1 b-弱同意流程(维护者会话内说「同意」+ PR comment 留痕)首次实跑走通
- ✅ **第 6 轮新增的**:协议抓越权(PR #21 agent 用 L2 self-merge 引入引用 L1/L2 的模板,复盘长出 0012 判据堵路)+ 回流机制自举闭环(0013 引入 B-3 的 PR 自己按 B-3 补开下游 issue,证据链完整)
- 🔸 **部分成立的**:门禁拦事——纯函数区真拦,但 I/O 层和测试文件类型是持续暴露的盲区(打地鼠模式)
- ❌ **未根治的**:门禁"全绿" ≠ "正确"——这是回归性保证的本质,无法用一份协议根治

**诚实的边界——以下全部未验证,拷走后自担:**

- **规模**:n=1 用户、2 个 agent、玩具级代码库。真实项目的代码量与业务复杂度没碰过
- **并行**:整套协议建立在轮班制(一次一棒)上。多 agent 同时在场会打穿 ADR-0007 的前提(它自己写了推翻条件)
- **分工**:ADR-0008 承认 n=0,占位符即答案
- **L1 异步**:目前 b-弱同意都是维护者在场秒回;维护者离线时 L1 改动就挂着,这个瓶颈是明说接受的,但没尝过疼
- **仪式成本**:每棒 issue + 五项 Memory + 协议改动必 ADR。协议实验里是数据,高频小任务场景里是税

若某个 agent 不认 `AGENTS.md`，在 repo 里软链接：`ln -s AGENTS.md <该工具认的文件名>`。

设计讨论出处：mandys_bubble_tea 项目 2026-07-17 会话（多 agent 协作架构反思）。
