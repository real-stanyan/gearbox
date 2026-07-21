# ADR-0014: PR 模板引用 DOWNSTREAM.md 清单,不硬编码下游项目名

- Date: 2026-07-19
- Status: accepted

## Context

ADR-0013 落地时,`.github/pull_request_template.md` 把当时的两个下游项目名(dryrun / mandys_bubble_tea_admin_app)直接写死在「下游回流 issue 链接」小节里。

这造成同一份信息活在两处:`DOWNSTREAM.md` 是清单的权威源(ADR-0013 明文:"必须给 DOWNSTREAM.md 清单里的每个项目各开一个回流 issue"),PR 模板是它的复印件。下游清单变化时(新项目接入 / 项目归档),DOWNSTREAM.md 会改(ADR-0013 的维护规则要求),但 PR 模板必然被忘掉——模板不在任何维护清单里。漂移后果:PR 作者按模板里的旧名单开回流 issue,漏掉新下游,B-3 机制在盲区失效——正是 B-3 要解决的"漏接"以另一种形式回归。

## Decision

PR 模板不再列具体项目名,改为指令:**"按 `DOWNSTREAM.md`「已接入项目」清单逐项列出,一项一行"**,附占位行 `<repo>: <回流 issue 链接>`。

单一事实源原则(CONTEXT.md 第一条术语)应用于协议自身:清单只活在 DOWNSTREAM.md。

## Consequences

- **填 PR 时多一跳**:作者要打开 DOWNSTREAM.md 看清单,不能照模板抄。可接受——B-3 流程本来就要求逐项开 issue,清单必读
- **门禁不受影响**:check-gearbox.js 断言的是模板保留 `Affects downstream` 字段与 DOWNSTREAM.md 保留「已接入项目」节,不断言具体项目名
- **下游拷走模板时噪音更小**:模板不再带 Gearbox 自己的项目名(README 开局指引仍要求下游删/改写该模板)
