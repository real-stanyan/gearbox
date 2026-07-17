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

若某个 agent 不认 `AGENTS.md`，在 repo 里软链接：`ln -s AGENTS.md <该工具认的文件名>`。

设计讨论出处：mandys_bubble_tea 项目 2026-07-17 会话（多 agent 协作架构反思）。
