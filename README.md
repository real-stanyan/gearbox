# AGENTS.md scaffold — 多 agent 协作项目骨架

新项目开局把本目录内容拷进 repo 根：

```bash
cp -r ~/Github/agents-md-scaffold/{AGENTS.md,CLAUDE.md,CONTEXT.md,docs,.github} <repo>/
# 本 README.md 不拷
```

然后：
1. 填 `AGENTS.md` 里所有 `<占位符>`
2. 按项目实际调整 `.github/workflows/ci.yml` 的命令
3. 首个架构决策写进 `docs/adr/`（可参考 0001 模板）

## 架构（为什么长这样）

| 文件 | 角色 |
|---|---|
| `AGENTS.md` | 单一事实源。所有 agent（Claude Code、Z Code 等）都读它。规则只写这一份 |
| `CLAUDE.md` | 空壳，`@AGENTS.md` 一行。兼容旧版 Claude Code + 未来 Claude 专属内容挂载点 |
| `CONTEXT.md` | 领域词汇表。防止不同 agent 对同一个业务词理解不同 |
| `docs/adr/` | 决策记录。防止后来的 agent 把有意为之的设计"好心"改回去 |
| `.github/workflows/ci.yml` | 硬门禁。红了 merge 不进——唯一不依赖 agent 自觉的约束 |

刻意**没有** `HANDOFF.md`：进度和交接走 GitHub Issues + PR（append-only、带时间戳、不腐烂）。

## 验证过的实践（date-cli 实验出处）

这套协议不是空想,在 [`real-stanyan/date-cli`](https://github.com/real-stanyan/date-cli)（private）里跑过 **4 轮多 agent 协作验证**（Z Code 开局 + Claude Code 接力 3 轮,完整 git log / issues / PR / ADR 可查）。实验中长出了以下机制,都已回流到本 scaffold:

| 机制 | ADR | 解决的问题 |
|---|---|---|
| Memory 五项格式 | 0004 | 排程决策(选 a 不选 b 的理由)不再腐烂,且不污染 ADR |
| 交接 Memory 留 open issue | 0005 | 下一棒开工自然扫到入口,不再靠人指路 |
| 协议变更分级授权(L1/L2) | 0006 | Hard rules/Gate 不能 agent 自主改;Working agreement 可自治 |

**实验还验证了什么成立、什么不成立:**

- ✅ **成立的**:交接零口述、协议自我修复循环(开缺口 → 补进 AGENTS.md)、代码协作三棒无一处靠猜
- 🔸 **部分成立的**:门禁拦事——纯函数区真拦,但 I/O 层和测试文件类型是持续暴露的盲区(打地鼠模式)
- ❌ **未根治的**:门禁"全绿" ≠ "正确"——这是回归性保证的本质,无法用一份协议根治

**诚实的边界**:n=1 项目 + 2 个 agent 的单次验证,不是普适证明。拷走后请按你的场景再验证。

若某个 agent 不认 `AGENTS.md`，在 repo 里软链接：`ln -s AGENTS.md <该工具认的文件名>`。

若某个 agent 不认 `AGENTS.md`，在 repo 里软链接：`ln -s AGENTS.md <该工具认的文件名>`。

设计讨论出处：mandys_bubble_tea 项目 2026-07-17 会话（多 agent 协作架构反思）。
