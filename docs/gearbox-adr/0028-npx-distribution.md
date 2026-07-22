# ADR-0028: npx 零配置分发——工具打成 npm 包,陌生人一条命令上手

- Date: 2026-07-20
- Status: accepted
- 关联: ADR-0016(gearbox-version bash)、ADR-0017(gearbox-update)、ADR-0022(gearbox-install)、ADR-0023(版本号)、ADR-0026(pull 触发)、ADR-0027(远端寻址,本 ADR 是其 follow-on)

## Context

ADR-0027 解决上游**数据**寻址(去哪找 ADR/tag),但留了**脚本分发**缺口:`gearbox-install`/`version`/`update` 脚本本身只住上游 `scripts/`,陌生人要先 clone gearbox + 把脚本弄上 PATH 才能跑。ADR-0026 注入下游开工第 4 步还硬编码 `~/Github/gearbox/scripts/`(维护者布局),对陌生人是错路径。

维护者选定分发渠道 = **npm / npx**(会话决策):陌生人 `npx gearbox-agents <cmd>` 零配置上手,有 node 即可,无需 clone / symlink / 配 PATH。

## Decision

把工具家族打成 npm 包,`npx` 分发。

### 1. 包结构:gearbox repo 自身 = 包,`bin/gearbox.js` dispatcher

- `package.json` 加 `bin: { gearbox: "bin/gearbox.js" }`;`files` 白名单打包**上游快照**——`AGENTS.md` / `CONTEXT.md` / `docs/adr/`(install 拷贝要读)+ `scripts/` + `bin/`。
- `bin/gearbox.js`(node dispatcher):路由 `install|version|update`,参数原样透传,退出码透传。

### 2. npx 路径复用本地逻辑:dispatcher 设 `GEARBOX_DIR=包根`

npm 包自带上游快照(打包时的 AGENTS.md + docs/adr),dispatcher 把 `GEARBOX_DIR` 指向包根 → 三工具的**现有本地路径逻辑零改动**即可用。**npx 路径根本不碰远端**——ADR-0027 的远端寻址是「git-clone 下游、无本地上游」的兜底,不是 npx 路径。两条分发方式(npx 包快照 / git-clone + 远端寻址)各有其上游解析,互不干扰。

### 3. 包非 git repo → 版本号走 env override

npm 剥掉 `.git`,包里 `git tag` 取不到。dispatcher 读 `package.json` 的 `version`,以 `GEARBOX_UPSTREAM_VERSION=v<version>` 传给工具。三工具版本解析优先级统一为:**env override(npx)> 远端 ls-remote(ADR-0027)> 本地 git tag**。install 写 `.gearbox-version` 戳记、`.gearbox-upstream`(npx 无 git origin → 回退读 `package.json` 的 `repository.url`)同理认 env。

### 4. version 保持 bash,dispatcher shell-out(不改写为 node)

`gearbox-version` 仍是 bash(ADR-0016 决策不动),dispatcher 对 `version` 用 `bash` 执行、对 `install`/`update` 用 `node`。**代价**:npx 跑 version 需环境有 bash(mac/linux 天然;Windows 需 Git Bash / WSL)。对一个多 agent coding 协议工具,bash 可用是合理前提;install/update(node)在 Windows 照常。真要纯 node 跨平台再另拆——不为此重写已验证的 148 行 bash。

### 5. 版本耦合:npm version === 协议 git tag

npm 包版本与协议 git tag(ADR-0023)**同一个号**。发布流程:release PR 里把 `package.json` version 改成本次目标版本;merge 后作者 agent 打同名 annotated tag(ADR-0023 原流程)+ **维护者跑 `npm publish`**。step-4 注入 / install 提示改用 `npx gearbox-agents <cmd>`。

### 6. publish 是维护者动作(工具/agent 不代跑)

`npm publish` 发布到外部 registry、需维护者 npm 凭据 → **只能维护者手动跑**(或维护者自行配 `NPM_TOKEN` + CI Action,本 ADR 不预设 Action,默认手动)。agent 只把包备好 + 本地验证。

## Consequences

- **陌生人零配置闭环**:`npx gearbox-agents install`(铺骨架,上游=包快照)→ 开工 `npx gearbox-agents version` 自查 → 落后 `npx ... update` 回流。无 clone、无 symlink、无 PATH 配置。ADR-0027 留的脚本分发缺口至此闭合。
- **两条分发并存**:① npx(陌生人,包快照作上游)② git-clone + 本地/远端寻址(维护者舰队 + 想追 git 的人)。维护者本地跑 `gearbox-version` 行为零变(GEARBOX_DIR 命中本地 git repo,不设 env override)。
- **版本耦合的维护成本(诚实记录)**:`package.json` version 必须与 git tag 手动保持一致(release PR 改 package.json + merge 后打 tag)。漏改则 npx 报的上游版本与 tag 不符。用一个号(不是两套)把认知负担压到最小,代价是每次 release 多改一行 + 记得 publish。
- **bash 依赖(诚实记录)**:npx version 在无 bash 的纯 Windows 环境不可用(install/update 可用)。可接受的降级,已文档化。
- **包名**:`gearbox-agents`(unscoped)。原拟 `gearbox` 被占(npm 上是个 DI 容器),`@real-stanyan/gearbox` scoped 亦可但维护者选 unscoped 短名。名字散在 4 处(package.json / dispatcher 帮助 / install step-4 注入 / README),改名要一起动。
- **分级 / 版本**:纯工具/分发能力,不动 AGENTS.md 协议正文(ADR-0017「个人工具非协议改动」先例)→ **L2**,三件套照走。新增 npx 分发机制、向后兼容(git-clone 路径不变)→ **minor** → v1.1.0 之后为 **v1.2.0**。
- **考虑过但未采纳**:curl|bash 引导脚本(否决——curl|bash 信任面 + 需自托管 URL,维护者选了 npm 标准渠道);把 version 改写成 node 做纯 node 包(否决——推翻 ADR-0016 且重写已验证 bash,shell-out 够用);npm 版本与协议版本解耦成两套号(否决——双号认知负担 > 手动同步一行的成本)。
