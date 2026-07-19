# ADR-0022: gearbox-install——开局安装从 README 手工步骤变成工具

- Date: 2026-07-19
- Status: accepted
- 关联: ADR-0016/0017(工具家族第三件)、ADR-0021(hash 戳记随装即打)

## Context

issue #47(维护者会话指示)。新项目接入 Gearbox 此前靠 README 的手动流程:`cp` 五个路径 + 四步手工调整(填占位符、换 ci.yml 命令、删/改 PR 模板、删 dogfood 注)。已知失效模式:

- 步骤靠人记,漏一步就出**带上游残留的畸形骨架**(忘换 ci.yml 命令 → CI 开局红;忘删 B-3 节 → 下游背上不存在的下游义务)
- 手拷的 ADR 无溯源无戳记 → 全量 legacy,ADR-0021 的漂移检测对新项目失效
- Blackbox 接入时这些调整全是人工做的(接收端 B-3 注、门禁替换),每次接入重复发明

## Decision

`scripts/gearbox-install [目标目录] [--name] [--maintainer] [--gate]`,node 零依赖:

1. **AGENTS.md 模板变换机器化**:标题/简介/Tech stack 占位、删 dogfood 注(保留 ADR-0018 标注定级注,改接收端措辞)、B-3 节改接收端版(Blackbox 先例)、Gate 命令填入或占位、维护者替换、Gearbox 专属措辞清理
2. **锚点契约**:所有变换锚定上游 AGENTS.md 的已知文本,锚点丢失/不唯一即报错退出——上游模板改了而工具没跟上时**响,不出残缺骨架**。维护义务与 `check-gearbox.js` 锚点断言同类
3. **ADR 全量拷贝 + hash 戳记**:每个上游 ADR 加溯源行 + sha256 戳记(ADR-0021 契约),新项目 day one 即可被 `gearbox-version` 检测漂移;自带溯源字段的(date-cli 时代 0004/0005/0006)不重复加,照 gearbox-update 同规则计 legacy
4. **ci.yml 生成**:`--gate` 给了就与 Gate 节字面一致(CI == Gate 契约);没给就放**故意失败**的占位命令——填 Gate 前 CI 不该绿,绿着的占位比红着的占位危险
5. **不拷**:`pull_request_template.md`(B-3 载体,Gearbox 专属)、`scripts/`、`README.md`;**不覆盖**已有 AGENTS.md 的目录(已接入项目走 gearbox-update);**不自动 commit**(装完人工 review)

## Consequences

- **接入成本从"照 README 做四步"降到一条命令**,失效模式从"漏步骤"变成"锚点断裂报错"——可见、可修
- **工具家族分工闭合**:install 开局 / version 读状态 / update 写回流,三件互不重叠,入口都在 `scripts/`
- **锚点维护义务**:改上游 AGENTS.md 模板文本时,若碰到 install 的锚点,同 PR 更新工具——CI 不测这条(工具无自动化测试,ADR-0017 同款取舍),靠装机沙盒验证 + 失败响亮
- **DOWNSTREAM.md 不自动加行**:入清单是维护者决定(判定三条件),工具只在收尾提示——与 B-3「提醒不强制」一致
- **分级**:新工具引用协议机制,按 ADR-0012 归 L1;issue #47 + 本 ADR + PR,维护者会话指示发起、merge 前确认同意
