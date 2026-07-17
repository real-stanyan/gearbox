# ADR-0002: 用结构自检脚本当门禁（而非 markdownlint / 留占位）

- Date: 2026-07-17
- Status: accepted

## Context

本 repo 是 dogfood——它**自己**得满足 scaffold 里 `AGENTS.md` 规定的"收工前门禁全绿"和"CI 跑同一套命令"契约。但 repo 里全是 `.md`，没有 app 代码可测。三个候选：

1. **留占位**（`npx vitest run` 等示例命令）——CI 永远红，直接违反 scaffold 自己定的规矩，否决。
2. **markdownlint**——只校验格式，测不到结构契约（CLAUDE.md 是不是还 `@AGENTS.md`、关键章节锚点有没有被改名、有没有偷偷冒出 HANDOFF.md），覆盖面不够。
3. **结构自检脚本**——零依赖（只用 `node:fs`），断言 scaffold 的结构契约成立。

## Decision

用 `scripts/check-scaffold.js` 当门禁。它断言：

- 必需文件齐（AGENTS.md / CLAUDE.md / CONTEXT.md / README.md / ci.yml / ADR 模板）
- `CLAUDE.md` 恰好是 `@AGENTS.md`（空壳契约——规则只写一份的物理保证）
- `AGENTS.md` 含全部 load-bearing 章节锚点（防 rename 悄悄破坏协议）
- `AGENTS.md` 不含 `HANDOFF`（与 README 的"不建 HANDOFF.md"保持一致，两源不能打架）
- `AGENTS.md` 的 Gate 一节确实跑这个脚本（防"CI 和 AGENTS.md 各跑各的"的契约漂移）

CI 跑 `node scripts/check-scaffold.js`，本地同命令。

## Consequences

- **代价**：每加一条新的结构契约，都得同步改这个脚本。脚本本身成了需要维护的代码。
- **换来的**：门禁是真绿的、契约是真被强制的、dogfood 是真成立的。后来的人想"好心"把 CLAUDE.md 填实、或把 Gate 一节改成别的命令，CI 会当场红给他看。
- **边界**：只验结构，不验内容质量。占位符 `<项目名>` 之类对**本** repo 无意义（但作为模板该留），脚本故意不管——它管的是"模板结构完整"，不是"本 repo 填没填实"。
- 如果未来本 repo 长出真实代码（比如 scaffold 变成可 `npx create` 的工具），届时应叠一个 ADR-000X 补真实测试，而不是改掉本脚本。
