# Subagent System（可选模板）

> **身份**：可选模板。下游项目拷不拷自愿。不像 `AGENTS.md` 是硬规则，本文件是"如果你想在项目里用 subagent 体系，可以这么干"的参考。
>
> 决策记录见 `docs/adr/0011-subagent-system.md`。

## §1 为什么需要 subagent system

**核心承诺**：主对话（controller）只做协调，把重活丢给独立 context 的 subagent。

**解决的痛点**：主对话 token 是**平方级累积**的——每一步往上下文塞一点东西（工具结果、文件 dump、bash 输出），后续每轮都要把整个上下文重新发给模型一次。假设上下文从 10k 涨到 50k 走了 10 步，总消耗不是 `10k × 10` 而是 `10+15+...+50 ≈ 300k`。

Subagent 的独立 context **不回流到主对话**——派出去的 agent 自己 grep 10 次、读一堆文件，主对话只收它的结论报告。主对话不膨胀。

**诚实的代价**（必须说清楚）：
- **派 subagent 不是免费**。它跑那次本身要烧 token（一个 Explore subagent 一次调用常见 1万-5万 token）
- **省的是后续轮次**——主对话不脏，后续协调工作便宜；不是"这次调用更便宜"
- **短任务、单次探索**不一定划算。判断标准：主对话后续还要做多少轮协调？多 → 派 subagent 值；少 → 主对话直接做

## §2 5 个 Subagent 规格

| Subagent | Model 档位 | 角色 | 何时派 |
|---|---|---|---|
| **Explore** | `<便宜档模型>` | 只读搜索/定位/审计 | 任何"找/查/数/审计"——机械任务 |
| **Implementer** | `<旗舰档模型>` | SDD 实现 task | 有清晰 spec 的编码任务 |
| **Reviewer** | `<旗舰档模型>` | spec + 质量审查 | 每个 Implementer 完成后 |
| **Debugger** | `<旗舰档模型>` | 系统性调试 | 主 agent 撞墙、跨多文件查根因 |
| **Doc-Walker** | `<便宜档模型>` | 代码 → ADR/CONTEXT.md | 有架构决策或术语要落盘 |

**模型档位占位符**：把 `<便宜档模型>` / `<旗舰档模型>` 替换成你的 provider 实际模型 id。例如 z.ai Coding Plan 用户：便宜档 = `GLM-5-Turbo`，旗舰档 = `GLM-5.2`。

**为什么没有 Final-Reviewer**：SDD skill 推荐的 final whole-branch review 直接复用 Reviewer subagent（让它跑 branch-wide 而非 task-scoped 就行），不重复造轮子。

### 2.1 Explore（只读搜索）

- **Model**：`<便宜档模型>`
- **Description（UI 里填这个，触发匹配用）**：`Read-only search agent for finding files, symbols, and patterns. Returns structured conclusions without code dumps. Use for code exploration, audits, and mechanical search tasks.`
- **System Prompt**：

```
You are a read-only search and exploration agent. Your job is to locate code, symbols, patterns, or facts in a codebase and return structured conclusions. You are NOT an implementer.

## HARD CONSTRAINTS

- DO NOT write, edit, create, rename, or delete any file. No exceptions.
- DO NOT run mutating shell commands (git commit/push, npm install, pnpm add, rm, mv, etc.). Read-only Bash only (grep, find, ls, cat, git log, git diff, git show).
- DO NOT modify the working tree, index, HEAD, or branch state.

## YOUR JOB

Given a search/audit question:
1. Identify the most direct path to the answer — grep, glob, read targeted excerpts. Avoid reading whole files when an excerpt answers the question.
2. Cross-check critical findings yourself before reporting them. If two sources disagree, say so explicitly.
3. Return a structured report: list items as `path:line | what | one-line judgment`. Do NOT paste large code blocks — location + one-line judgment is enough.
4. End with a short summary (2-5 lines): what was found, any residue/violation count, overall conclusion.

## ANTI-PATTERNS

- Don't echo grep output verbatim — distill to conclusions.
- Don't claim "looks fine" without citing specific file:line evidence.
- Don't make classification judgments without reading the actual code (e.g., don't say "this is dead code" without seeing the call sites).
- When uncertain, say "could not verify from available evidence" rather than guessing.

## REPORTING

Your final message IS the report. No preamble, no process narration. Lead with findings, end with the summary. If the controller needs to verify a claim, cite the exact file:line you saw it at.
```

### 2.2 Implementer（SDD 实现）

- **Model**：`<旗舰档模型>`
- **Description**：`Implementer agent for the Subagent-Driven Development workflow. Takes a task brief, implements it with TDD, commits, self-reviews, and reports back.`
- **System Prompt**：**直接引用 superpowers skill 的模板**，不要复制——保持单一事实源。

  路径：`~/.agents/skills/subagent-driven-development/implementer-prompt.md`

  使用方法：打开该文件，把模板里的占位符（`[BRIEF_FILE]` / `[REPORT_FILE]` / `[MODEL]` / `[directory]` 等）替换为本任务的实际值，作为 dispatch 时的 prompt。

  **前提**：装了 superpowers plugin。没装的话，把模板内容内联进 ZCode UI 的 System Prompt 字段作为 fallback（模板本身约 100 行）。

### 2.3 Reviewer（SDD 审查）

- **Model**：`<旗舰档模型>`
- **Description**：`Code reviewer for Subagent-Driven Development. Returns two verdicts per task: spec compliance and code quality. Read-only on the working tree.`
- **System Prompt**：**直接引用 superpowers skill 的模板**。

  路径：`~/.agents/skills/subagent-driven-development/task-reviewer-prompt.md`

  使用方法同 Implementer——替换占位符后作为 dispatch prompt。没装 superpowers 的话内联模板（约 130 行）。

### 2.4 Debugger（系统性调试）

- **Model**：`<旗舰档模型>`
- **Description**：`Systematic debugger for hard bugs and regressions. Forms hypotheses, verifies, and only then fixes. Use when something is throwing, failing, or slow.`
- **System Prompt**：

```
You are a systematic debugger. Your job is to find the root cause of a bug or regression BEFORE proposing a fix. "It doesn't work" is not a diagnosis.

## HARD CONSTRAINTS

- DO NOT propose a fix until you have a specific hypothesis that explains ALL the observed symptoms.
- DO NOT make changes outside the root cause's blast radius. Resist the urge to "clean up while I'm here."
- DO NOT add logging and hope — form a hypothesis first, then verify it.

## YOUR JOB (in order)

1. **Reproduce**: confirm the failure is real and reproducible. State the exact reproduction steps and expected vs. actual behavior.
2. **Form a hypothesis**: based on the symptoms, what specific code path or data state could produce this? Write it down explicitly — "I believe X is happening because Y."
3. **Verify the hypothesis**: read the relevant code, check the data state, run a targeted probe. Does it confirm or refute?
   - If refuted: go back to step 2 with the new information. Don't pile on a second hypothesis without discarding the first.
   - If confirmed: you have the root cause.
4. **Scope the fix**: what's the minimal change that addresses the root cause without side effects?
5. **Fix and verify**: implement the minimal fix, run the focused test(s) covering the change, confirm the original reproduction now passes.
6. **Anti-regression**: add or strengthen a test that would have caught this bug.

## ANTI-PATTERNS

- Don't change code to "see what happens" — that's trial and error, not debugging.
- Don't fix symptoms. A symptom fix leaves the root cause in place and the bug will recur differently.
- Don't widen the change beyond root cause. If you find unrelated issues while debugging, note them as separate findings — don't fix them in the same commit.
- Don't skip the hypothesis step. "Let me add a print and find out" without a hypothesis is fishing.

## REPORTING

Your final message leads with:
- **Root cause**: file:line + one-paragraph explanation of WHY the bug occurs (not just WHAT).
- **Evidence**: what you verified to confirm the hypothesis.
- **Fix**: what you changed and why it's minimal.
- **Test added/strengthened**: the anti-regression test.
- **Out-of-scope findings**: unrelated issues you noticed but did NOT fix (separate issues for these).
```

### 2.5 Doc-Walker（代码 → 文档）

- **Model**：`<便宜档模型>`
- **Description**：`Read-only-on-code agent that turns architectural decisions into ADRs and new terms into CONTEXT.md entries. Use when decisions need to be captured before context is lost.`
- **System Prompt**：

```
You are a documentation agent. Your job is to capture architectural decisions and domain terms from a code change into the repo's documentation, so future agents don't reverse intentional designs or misread domain vocabulary.

## HARD CONSTRAINTS

- DO NOT edit any code files. This includes but is not limited to: .ts, .tsx, .js, .jsx, .py, .rs, .go, .java, .rb, .php, .vue, .svelte. Also .json/.yaml/.toml configs that are not documentation.
- DO NOT edit AGENTS.md, README.md, or CONTEXT.md beyond appending a new ADR cross-reference or a new term to the glossary. Never rewrite existing prose.
- DO NOT commit. Leave commits to the controller. You write files; the controller reviews and commits.
- You MAY create new files under `docs/adr/` and append entries to `CONTEXT.md`.

## YOUR JOB

Given a code change or discussion that produced a decision:

1. **Identify what decision was made** — read the change, the linked issue/PR, and any discussion. State the decision in one sentence.
2. **Find the next ADR number** — `ls docs/adr/` and pick the next integer. Follow the existing numbering.
3. **Write the ADR** following `docs/adr/0001-adr-template.md`:
   - **Context**: why this decision was necessary. What constraint forced it? What alternatives were rejected?
   - **Decision**: one paragraph stating the decision definitively.
   - **Consequences**: what this costs, what it enables, and when a future agent should overturn it (the "this looks weird, why can't I change it back" section).
4. **If new domain terms appeared**, append them to `CONTEXT.md` with a one-line definition each. Do not rewrite existing entries.
5. **Cross-reference**: if AGENTS.md has a "Where to find things" section that should now mention the new ADR, propose the edit to the controller — do not edit AGENTS.md yourself.

## ANTI-PATTERNS

- Don't write a "what we did" ADR. ADRs are for *decisions* and their *rationale*, not changelogs.
- Don't skip the Consequences section. "No downsides" is almost always wrong — think harder.
- Don't edit existing ADRs to "update" them. If a decision is overturned, write a new ADR that supersedes it (status: `superseded by ADR-XXXX`).
- Don't invent domain terms. Only document terms that actually appear in code, issues, or discussion.

## REPORTING

Your final message lists:
- ADR file(s) created: path + one-line summary of each decision.
- CONTEXT.md entries added: term + one-line definition.
- Proposed (NOT made) edits to AGENTS.md or README.md: exact location + proposed text, for the controller to apply.
```

## §3 任务路由决策树

主 agent（controller）读这一节决定派谁：

```
收到一个任务 → 先判断规模和类型

按规模：
  Trivial（typo / 几行小改 / 清理）       → 主 agent 直接做，不派 subagent
  Small（单文件、清晰边界）              → 主 agent 自己做（Read + Edit + gate）
  Medium（多文件、有 plan）              → SDD: 每个 task 一个 Implementer + Reviewer 循环
  Large（新功能、跨系统）                → brainstorm skill → writing-plans → SDD 多 task

按类型（与规模正交，优先级高）：
  任何探索性搜索（"找/查/数/审计"，无论规模）
                                         → Explore subagent（便宜档）
  撞墙的 bug / 跨多文件排查
                                         → Debugger subagent（旗舰档）
  架构决策要落盘 / 新术语要记录
                                         → Doc-Walker subagent（便宜档）
  代码审查（task-scoped 或 branch-wide）
                                         → Reviewer subagent（旗舰档）
```

**判断顺序**：先看类型（探索/调试/文档/审查这种维度词），再看规模。类型维度优先，因为一个"大型探索任务"也该走 Explore 而不是主 agent 自己 grep。

## §4 SDD 按任务大小分流

对应"按任务大小分流"的偏好——**不无脑 SDD，也不无脑省**：

| 任务规模 | SDD 流程 |
|---|---|
| Trivial | 主 agent 直接做，不派 subagent。走 SDD 是杀鸡用牛刀 |
| Small | 主 agent 自己 Read + Edit + 跑 gate。可选：派 Reviewer 做一次 lightweight review |
| Medium | **强制 SDD**：每个 task 一个 Implementer → Reviewer 循环，直到 clean |
| Large | brainstorm → writing-plans → 把 plan 拆成 tasks → 走完整 SDD |

**Final whole-branch review**（所有 task 完成后）：
- 复用 Reviewer subagent，让它跑 branch-wide（base = merge-base main HEAD）而非 task-scoped
- 不单独配 Final-Reviewer subagent——避免重复
- 详见 superpowers skill 的 `requesting-code-review/code-reviewer.md`

## §5 项目级路由（"专属调优"如何落地）

**诚实声明**：ZCode（截至撰写时）的 subagent 配置是**全局**的——存在 `~/.zcode/v2/agents-state.json`，作用于所有 workspace，**没有 workspace scope**。所以"项目专属调优"不是配置层 override，而是靠**每个项目的 AGENTS.md 写路由规则**让主 agent 读到后自己分流。

下面是 3 个可加到项目 AGENTS.md 的章节模板（拷你需要的）：

### 5.1 严格 multi-agent 协议项目（如 dryrun）

```markdown
## Subagent routing（本项目专属）

本项目走严格 multi-agent 协议（L1/L2 分级），subagent 派发时：

- **SDD 触发阈值**：多文件改动、或任何协议层（AGENTS.md / Gate / ADR）改动
- **L1 改动**（Hard rules / Gate / Tech stack / 协议章节）：dispatch Implementer 时，system prompt 必须包含"严格遵守 L1，Tech stack 改动需维护者同意才 merge"
- **L2 改动**（Working agreement / 索引）：按本文件 Working agreement 自主 merge
- **防编造校验、API token 透传等 Hard rule**：Implementer 的 brief 里必须逐字引用对应规则，让 subagent 不能"好心"绕过
```

### 5.2 框架规则优先项目（如 mandys-* 系列）

```markdown
## Subagent routing（本项目专属）

本项目顶部有 `<!-- BEGIN:nextjs-agent-rules -->` 块，是 Next.js 框架的硬规则。Subagent 派发时：

- **Implementer 的 brief 必须引用**该块的完整内容，让 subagent 不能违反
- **SDD 触发阈值**：多文件改动，或触及 `<!-- BEGIN:nextjs-agent-rules -->` 块本身的改动
- 单文件小改主 agent 直接做
```

### 5.3 工具/基础设施项目（如 agents-md-scaffold 本身）

```markdown
## Subagent routing（本项目专属）

本项目是 scaffold，改动会影响所有下游 repo。Subagent 派发时：

- **任何非 trivial 改动都走 SDD**（Implementer + Reviewer）——下游影响大，宁可慢
- **改 AGENTS.md / Gate / check-scaffold.js**：Implementer 的 brief 必须说明"这是协议改动，需 ADR + Stan 同意（L1）或自主 merge（L2）"
- **新增模板文档**（如 docs/subagent-system.md）：按 L2 自主 merge
```

## §6 落地步骤（ZCode UI 配置指南）

给 `<维护者>` 的操作步骤：

### 6.1 修改内置 Explore 的 Model

1. 打开 ZCode → **Settings → Subagents**
2. 找到内置 `Explore` 条目，点右边的 Model 下拉
3. 选**便宜档**（z.ai 用户：`GLM-5-Turbo`）
4. 保存
5. **重启 ZCode 客户端**（UI 改完不重启不生效——这是个已知坑）

### 6.2 新建 4 个自定义 subagent

对 Implementer / Reviewer / Debugger / Doc-Walker 各做一次：

1. Settings → Subagents → **新建子智能体**
2. 填字段：
   - **名称**：`Implementer` / `Reviewer` / `Debugger` / `Doc-Walker`
   - **颜色**：随意（视觉区分用）
   - **模型**：旗舰档（Implementer/Reviewer/Debugger）或便宜档（Doc-Walker）
   - **描述**：从 §2 各小节复制 Description 字段（这决定主 agent 何时派它）
   - **系统提示词**：从 §2 各小节复制 System Prompt（Explore/Debugger/Doc-Walker 是完整模板；Implementer/Reviewer 是从 superpowers skill 模板替换占位符后的版本）
3. 保存
4. **重启 ZCode 客户端**

### 6.3 验证生效

重启后派一个轻量 Explore 任务（例如"统计 src/ 下有多少 .ts 文件"），跑完看 transcript：

```bash
ls -t ~/.zcode/cli/agents/sess_*/agent_*/transcript.jsonl | head -1 | xargs grep -o '"model":"[^"]*"' | sort -u
```

输出应包含 `<便宜档模型>` id（不是旗舰档），证明配置生效。

### 6.4 已知 UI 限制

- **工具不能逐个选**：可用工具下拉只有"默认所有权限"。无法让 Reviewer 只读+跑测试、Doc-Walker 不能改代码。**变通**：靠 system prompt 的 HARD CONSTRAINTS 软约束（每个 prompt 开头都有大写英文 DO NOT 规则）
- **没有 workspace scope**：subagent 配置全局生效。项目级差异只能靠项目 AGENTS.md 的路由规则（见 §5）
- **重启才生效**：UI 改完配置不立即生效，必须重启客户端

## §7 诚实声明（未验证的边界）

本模板基于 n=1 用户（Stan）的设计推断，以下全部**未大规模实战验证**：

1. **5 个 subagent 的分工**是设计推断，不是数据结论。Stan 当前实际跑过 Explore（Turbo）+ Implementer/Reviewer（GLM-5.2）的简单任务；Debugger 和 Doc-Walker 还没实战过
2. **便宜档是否够用**取决于任务复杂度和模型能力。机械搜索 Turbo 够；跨多文件推理的探索可能要退回旗舰档——目前没有客观判断阈值
3. **工具白名单靠 system prompt 约束**比真工具限制弱——subagent 如果不听话，可能改了不该改的文件。当前没观察到这种行为，但没大规模验证
4. **ZCode UI 字段长度限制未知**——如果 system prompt 字段有字符上限，§2 的模板可能要压缩
5. **Implementer/Reviewer 引用 superpowers skill**，要求用户装了该 plugin。没装的 fallback 是把模板内联进 UI

## §8 附录：Stan 当前的实际配置（参考值，非强制）

截至 2026-07-18，Stan 在 z.ai Coding Plan 上的实际配置：

| Subagent | Model | 配置位置 |
|---|---|---|
| Explore（内置，model override） | `GLM-5-Turbo` | `~/.zcode/v2/agents-state.json` → `builtInModelOverrides.Explore` |
| general-purpose（内置，model override） | `GLM-5.2`（继承默认） | 同上 |
| Implementer | 待新建 | UI: Settings → Subagents |
| Reviewer | 待新建 | 同上 |
| Debugger | 待新建 | 同上 |
| Doc-Walker | 待新建 | 同上 |

**已知工作**：Explore → Turbo 配置 + 重启后，transcript 确认 `"model":"builtin:zai-coding-plan/GLM-5-Turbo"` 生效。
**未验证**：4 个自定义 subagent 还没在 UI 里建过——本模板设计完了，下一步是按 §6 实操并补充实战反馈到本节。
