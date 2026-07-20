# ADR-0027: 上游远端寻址——工具支持从 remote 拉取,pull 服务陌生 fork

- Date: 2026-07-20
- Status: accepted
- 关联: ADR-0016(gearbox-version)、ADR-0017(gearbox-update)、ADR-0022(gearbox-install)、ADR-0023(版本号/.gearbox-version 戳记)、ADR-0026(pull 触发,本 ADR 是其 follow-on)

## Context

ADR-0026 把回流改为 pull(下游开工自查 → gearbox-update 拉取),但三个工具都只会从**本地**找上游：

```
GEARBOX_DIR = env.GEARBOX_DIR || ~/Github/gearbox   # version/update/install 一致
```

对维护者自己的舰队够用——下游与上游同机,共享一份 `~/Github/gearbox`。但陌生人 fork 一旦发生就断：`alice/myapp` 用了协议,她机器上没有 `~/Github/gearbox`,`gearbox-version` 直接 `✗ 找不到 Gearbox ADR 目录`。pull 承诺「下游自己去上游找」,工具却不知道**去哪个远端找**。

这是 ADR-0026 明确拆出的 follow-on：pull 服务陌生 fork 的**必要条件**。本 ADR 决策 + 实现一并落地(公用版)。

## Decision

给工具家族加**远端上游寻址**,四个子决策：

### 1. 上游地址存哪 → 新文件 `.gearbox-upstream`(config,非 stamp)

新增根目录文件 `.gearbox-upstream`,一行 = 上游 repo 的 git URL(如 `https://github.com/real-stanyan/gearbox.git`)。

- **与 `.gearbox-version` 分工**:`.gearbox-version` 是 **stamp**(工具写、记「我在哪个版本」);`.gearbox-upstream` 是 **config**(记「我的上游在哪」,install 写、人可改)。语义不同,不塞进同一文件——避免改 `.gearbox-version` 格式(那是跨工具契约,会触发 major)。
- **install 自动写**:`gearbox-install` 从它运行时的 `GEARBOX_DIR` 取 `git remote get-url origin`,写进下游 `.gearbox-upstream`(取不到 origin 则跳过,警告)。维护者装机 → 指向 `real-stanyan/gearbox`;陌生人从自己 fork 装 → 指向其 fork。人可事后编辑追不同上游。
- **committed config**:`.gearbox-upstream` 随下游 repo 提交(它是配置,不是产物);缓存不进 repo(见 3)。

### 2. 怎么取远端 ADR/tag → 浅克隆缓存(git,非 gh api)

远端上游**浅克隆到本地缓存目录**(`~/.cache/gearbox/<sha12(url)>`,`git clone --depth 1` 首次、`git fetch` 后续),然后**复用现有全部本地读取逻辑**(把解析出的上游目录指向缓存即可)。tag 用 `git ls-remote --tags <url>` 单独取(浅克隆不保证带全历史 tag),ADR 文件内容用缓存工作树。

- 选 git 而非 `gh api`：① 最大复用——缓存落地后 version/update 的本地文件系统读写机制**零改动**;② 不依赖 gh CLI/GitHub,GitLab/自建 git 同样能用;③ tag 语义原生。
- 代价:缓存磁盘 + 首次 clone 耗时(`--depth 1` + 后续 fetch 缓解)。

### 3. 缓存位置 → `~/.cache/gearbox/`,永不进 repo

缓存在 `$XDG_CACHE_HOME/gearbox/`(缺省 `~/.cache/gearbox/`),每个上游 URL 一个 `sha12(url)` 子目录。缓存**在下游 repo 之外**,天然不进 git;无需 `.gitignore` 兜底(除非有人把缓存指进 repo,不支持这种用法)。

### 4. 寻址优先级 + 离线降级

**优先级(高→低)**:① `GEARBOX_DIR` env(逃生阀,永远最高)→ ② 本地默认 `~/Github/gearbox`(存在就用,维护者舰队走这条,快且总最新)→ ③ `.gearbox-upstream` 远端缓存(本地都没有时,陌生 fork 走这条)。

> 维护者舰队**行为完全不变**(本地 `~/Github/gearbox` 命中,根本不碰远端)。远端只在本地上游缺席时启用——纯增量,向后兼容:存量下游没有 `.gearbox-upstream` 也不影响(有本地上游)。

**离线降级**:
- `gearbox-version`(只读、建议性)：远端取不到(离线/无网)→ `⚠ 无法访问上游,跳过版本检查` + **exit 0**(不阻塞开工)。
- `gearbox-update`(主动拉取)：取不到 → **硬报错 exit 1**(拉不到就是拉不到,不能假装成功)。

## Consequences

- **陌生 fork 的 pull 闭环**:装机写 `.gearbox-upstream` → 开工 `gearbox-version` 缺本地上游则克隆缓存对比 → 落后 `gearbox-update` 从缓存拉取。ADR-0026 的公共承诺至此对陌生人也成立。
- **维护者舰队零回归**:本地优先,远端路径对现有舰队根本不触发。沙盒验证含本地回归 + 远端(对 real github)双路径。
- **跨语言重复成本(诚实记录)**:寻址+缓存逻辑在 **bash(version)** 和 **node(update)** 各写一份——工具家族本就跨语言(ADR-0016 Bash / 0017 Node),这里放大了重复。不为此引入共享库(会给零依赖工具加依赖);契约(`.gearbox-upstream` 格式 + 缓存路径约定)写死在本 ADR 作对齐锚。install 只**写** `.gearbox-upstream`,不做远端解析(它永远从本地上游运行),故不涉此重复。
- **新增网络失败模式**:工具从「纯本地文件系统、零网络」变成「可能触网」。通过「本地优先 + 离线降级」把爆炸半径限制在「本地上游缺席」这一条路径。
- **分级 / 版本**:纯工具能力,不动 AGENTS.md 协议正文(ADR-0017「个人工具非协议改动」先例)→ **L2**,三件套照走(issue + 本 ADR + PR),CI 绿自主 merge。新增 `.gearbox-upstream` 机制、向后兼容(无文件=本地回退)→ **minor**(新增机制,ADR-0023);未改 `.gearbox-version` 格式,故非 major → v1.0.0 之后为 v1.1.0。
- **考虑过但未采纳**:扩 `.gearbox-version` 为两行(config+stamp 混一文件)——否决,改 stamp 格式 = major 且混淆「工具写 vs 人写」边界。`gh api` 取数——否决,绑 GitHub + gh CLI,弃 git 原生 tag 语义与本地读取复用。多上游/上游链——YAGNI。
- **仍未闭合的缺口(诚实记录)**:本 ADR 解决上游**数据**寻址(去哪找 ADR/tag),不解决**脚本分发**——`gearbox-version`/`gearbox-update` 脚本本身仍住在上游 `scripts/`,不随 install 进下游。陌生 fork 要跑 pull,得先把脚本弄到自己 PATH 上(clone gearbox + symlink)。ADR-0026 注入下游开工第 4 步的命令目前硬编码 `~/Github/gearbox/scripts/`(维护者布局)。真·公共分发(npx / brew / 脚本随 install 落地)是下一个 follow-on,不在本 ADR。故本 ADR 使「陌生 fork 的 pull」从「不可能」变「可行但需手动配脚本」,非「零配置开箱即用」。
