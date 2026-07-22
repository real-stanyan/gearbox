# ADR-0015: 协议与 repo 整体改名 scaffold → Gearbox

- Date: 2026-07-19
- Status: accepted

## Context

这套多 agent 协作协议一直没有正式名字——"scaffold" 本是载体描述(开局拷走的骨架),在 DOWNSTREAM.md、下游 ADR、日常会话里被事实当作协议代称。维护者(Stan)2026-07-19 会话指示:正式命名 **Gearbox**,repo 同步改名。

## Decision

1. **协议名 = Gearbox**,repo 名 `agents-md-scaffold` → `gearbox`(GitHub rename,旧 URL 自动 301)
2. **活文档全量改称**:AGENTS.md / README / CONTEXT.md / DOWNSTREAM.md / PR 模板 / package.json
3. **Gate 脚本随名**:`scripts/check-scaffold.js` → `scripts/check-gearbox.js`,AGENTS.md Gate 节、ci.yml、脚本自断言三处同步(Gate 命令行变更 = L1,ADR-0010)
4. **历史 ADR(0001–0014)不改写**:append-only 记录,里面的 "scaffold" 是写作当时的事实。本 ADR 是唯一的改名记录
5. **README 保留前身名注**:方便旧引用溯源

## Consequences

- **下游引用暂时叫旧名**:dryrun / mandys_app / Blackbox 的 ADR 溯源字段与 AGENTS.md 写的是 "scaffold"。旧 URL 有跳转,不属故障;按 B-3 各开回流提醒 issue,下游按各自节奏改称呼(或不改,提醒非强制)
- **本地路径变更**:`~/Github/agents-md-scaffold` → `~/Github/gearbox`,引用旧路径的本地工具(全局 CLAUDE.md 开局指引、scaffold-version 脚本默认路径)需同步——随本次改名一并处理,但它们在 repo 外,不受本 repo 门禁保护
- **`scaffold-version` 脚本名成了遗留**:改名后脚本自身名字也过时,并入 #30(脚本居无定所)一起裁决
