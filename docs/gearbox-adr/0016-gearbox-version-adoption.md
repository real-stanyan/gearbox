# ADR-0016: gearbox-version 入库——B-3.5 本地速查工具转正

- Date: 2026-07-19
- Status: accepted

## Context

`scaffold-version`(bash,查下游落后上游几个 ADR)在 dryrun#40 实战中被引用,但居无定所:不在版本控制、没走流程(ADR-0013 说 B-3.5 = 手动 + 本地脚本,"届时另开 ADR"),且纯文件名编号对比有已知误报——下游自有 ADR 占同号(dryrun 0011 = puppeteer ≠ 上游 0011 = subagent-system)会被报成"已同步"。缺口挂在 issue #30,维护者拍板选 b(入库 + 修误报),顺应 ADR-0015 改名 gearbox-version。

## Decision

1. **入库**:`scripts/gearbox-version`,纳入版本控制。部署方式 symlink 到 PATH(`ln -sf ~/Github/gearbox/scripts/gearbox-version ~/.local/bin/`),旧 `~/.local/bin/scaffold-version` 删除
2. **判定算法从文件名对比改为溯源优先**。上游 ADR-NNNN 视为已同步当且仅当:
   - a) 下游存在**同 slug** 的 ADR 文件(开局拷贝,编号可不同),或
   - b) 下游任一 ADR 引用上游该编号(文字 `scaffold|Gearbox ADR-NNNN`,或上游 repo URL 的 `adr/NNNN-` 链接)
3. **定位 = 本地速查,非权威**:权威状态仍是 `DOWNSTREAM.md`「当前同步到」列。脚本零依赖、只读,不进门禁,不构成下游义务
4. **Tech stack 补一行 Bash**(工具脚本),`Where to find things` 补 `scripts/` 索引

## Consequences

- **消掉旧误报**:同号不同 slug 不再算同步(实测 dryrun:0011 经 0013-dryrun-subagent-routing 的溯源字段正确识别为已回流)
- **残余盲区(接受)**:下游「已评估并拒绝回流」(关 issue 声明不采纳,如 dryrun 对 0013 判不适用)脚本看不见,仍报"未同步"。脚本输出里明示此边界;要消除得读 GitHub issue 状态,引入网络依赖,不值
- **溯源字段成为软契约**:下游回流 ADR 时写 `溯源:` 行(引用上游编号或 URL)才能被识别。B-3 回流 issue 模板已建议此格式,不强制
- **B-3.5 只启用"查"半边**:脚本不代开回流 issue,不改任何文件。全自动化(B-4)的拒选理由见 ADR-0013,不变
