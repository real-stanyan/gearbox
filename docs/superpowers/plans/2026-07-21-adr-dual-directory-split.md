# ADR 双目录分家 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把协议 ADR（`docs/gearbox-adr/`）与项目自有 ADR（`docs/adr/`）拆成两个平行目录，消除撞号并删除 `gearbox-update` 的重编号子系统。

**Architecture:** 上游 30 个协议 ADR 整体 `git mv` 进 `docs/gearbox-adr/`；三个工具（install 写 / version 读 / update 回流）的 ADR 目录常量从 `docs/adr` 改为 `docs/gearbox-adr`；`gearbox-update` 因不再撞号删掉重编号逻辑，回流号与上游 1:1 恒等；`docs/adr/` 留给下游项目自己从 0001 写。

**Tech Stack:** Node.js（install/update，无运行时依赖）+ Bash（version）+ 纯 Markdown 文档；门禁 = `node scripts/check-gearbox.js`（结构自检）+ 沙盒功能验证。

## Global Constraints

- **每个 commit 后 `node scripts/check-gearbox.js` 必须绿**（本 repo 唯一硬门禁）。
- **本变更 = L1 + major**（ADR-0023/0006）：需 Protocol gap issue + ADR-0031 + 分支 PR；merge 前须维护者（stanyan）明确「同意」。
- **ADR 之间的 `ADR-XXXX` 文本引用不变**（编号不变，只有目录变）；只改**路径式**引用（`docs/adr/NNNN-…` → `docs/gearbox-adr/NNNN-…`）。
- **版本**：`package.json` version 改 `2.0.0`；PR body 声明 `Version bump: major`。tag `v2.0.0` + `npm publish` 是 **merge 后维护者动作，不在本计划执行范围**（ADR-0028/0029，agent 不代跑）。
- **merge 方式 = merge commit**（ADR-0007）。
- 分支：`feat/adr-dual-directory-split`（spec 已提交于此）。
- 沙盒目录统一用 `/private/tmp/claude-501/-Users-stanyan-Github-gearbox/ea0d0d35-8e15-44d1-889b-1fdf03288630/scratchpad`（下称 `$SB`）。

---

### Task 1: 移动上游 ADR + 同步 Gate（原子，门禁不能断绿）

`git mv` 与 `check-gearbox.js` 改动必须同一个 commit——否则移完 ADR 后旧断言指向 `docs/adr/` 会红。

**Files:**
- Move: `docs/adr/*.md` (30 个) → `docs/gearbox-adr/`
- Modify: `scripts/check-gearbox.js:32`（required file 路径）
- Modify: `scripts/check-gearbox.js:52-53`（目录断言）

**Interfaces:**
- Produces: `docs/gearbox-adr/` 目录（含 30 个协议 ADR，编号 0001–0030 不变）；上游不再有 `docs/adr/`。

- [ ] **Step 1: 建目录并移动全部 ADR**

```bash
cd /Users/stanyan/Github/gearbox
mkdir -p docs/gearbox-adr
git mv docs/adr/*.md docs/gearbox-adr/
rmdir docs/adr    # 上游此后无 docs/adr/（Gearbox 自身暂无非协议决策）
```

- [ ] **Step 2: 先跑门禁确认现在是红的（证明断言确实锚在旧路径）**

Run: `node scripts/check-gearbox.js`
Expected: FAIL——报 `missing required file: docs/adr/0001-adr-template.md` 与 `docs/adr/ must be a directory`

- [ ] **Step 3: 改 check-gearbox.js 的 required file 路径（第 32 行）**

把：
```javascript
  "docs/adr/0001-adr-template.md",
```
改为：
```javascript
  "docs/gearbox-adr/0001-adr-template.md",
```

- [ ] **Step 4: 改 check-gearbox.js 的目录断言（第 52-53 行）**

把：
```javascript
// 3. docs/adr/ is a directory
check("docs/adr/ must be a directory", existsSync(join(root, "docs", "adr")) && statSync(join(root, "docs", "adr")).isDirectory());
```
改为：
```javascript
// 3. docs/gearbox-adr/ is a directory
check("docs/gearbox-adr/ must be a directory", existsSync(join(root, "docs", "gearbox-adr")) && statSync(join(root, "docs", "gearbox-adr")).isDirectory());
```

- [ ] **Step 5: 跑门禁确认恢复绿**

Run: `node scripts/check-gearbox.js`
Expected: PASS（末行 `✓ gearbox structure OK` 之类的全绿输出，退出码 0）

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(adr): 上游协议 ADR 迁入 docs/gearbox-adr/ + 同步 Gate 断言

双目录分家第一步:git mv 30 个协议 ADR,check-gearbox 断言随迁。
原子提交保门禁不断绿。ADR-0031 记录决策。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 写 ADR-0031（决策记录）

**Files:**
- Create: `docs/gearbox-adr/0031-adr-dual-directory-split.md`

**Interfaces:**
- Consumes: Task 1 的 `docs/gearbox-adr/` 目录。
- Produces: 协议 ADR-0031，供后续 commit message / PR 引用。

- [ ] **Step 1: 写 ADR-0031**

```markdown
# ADR-0031: ADR 双目录分家——协议 ADR 与项目 ADR 拆目录,消撞号删重编号

- Date: 2026-07-21
- Status: accepted
- 关联: ADR-0021(hash 戳记)、ADR-0022(gearbox-install)、ADR-0023(版本号)、ADR-0024(重编号回流)、ADR-0016/0017(version/update)

## Context

下游 `docs/adr/` 一个目录同装两类 ADR:协议 ADR(拷自上游,带 `- 溯源:` 戳记 ADR-0021)与项目自有 ADR。两类抢同一编号命名空间会撞号——例 Blackbox 自有 ADR-0014 占号,上游 0014–0020 回流被整体重编号为本地 0015–0021。`gearbox-update` 为此背了整套「撞号检测 → 重编号 → 改内文 `ADR-XXXX` 引用」逻辑(`buildExistingNumMap` / `assignDownstreamNums` / `replaceAdrRefs`),复杂且脆:编号漂移让「下游第 N 号 = 上游第几号」不再恒等。

## Decision

拆成两个平行目录,上游下游一致:

- `docs/gearbox-adr/` — 协议 ADR。工具独占管理(install 写 / update 回流 / version 读),手别改。
- `docs/adr/` — 项目自有 ADR。人写,从 0001 起,工具永不碰。

上游本 repo 的协议 ADR 全部住 `docs/gearbox-adr/`;上游无 `docs/adr/`(Gearbox 自身暂无非协议决策)。

因两类分属不同目录,永不撞号,下游 `gearbox-adr/` 编号与上游 **1:1 恒等**。`gearbox-update` 的重编号子系统整体删除——它本就只因撞号而存在。

不写迁移工具:现有 3 个下游(dryrun/mandys/Blackbox)是早期自测舰队,将来真回流时手动 `git mv` 即可。

## Consequences

- **跨工具契约变更(文件布局)= major**(ADR-0023)→ v1.3.0 后为 v2.0.0。碰 Gate 锚点 + 三工具 = L1(ADR-0006)。
- `gearbox-update` 大幅简化:删撞号/重编号/内文改写,回流即「缺则按上游原号拷入 gearbox-adr/」。
- 下游项目 ADR 从 0001 独立编号,语义清晰:`ls docs/adr/` 只见自家决策,`ls docs/gearbox-adr/` 只见协议。
- 存量下游需一次性手动 `git mv`(本次不做);未迁移的老下游跑新 update 会把协议 ADR 拷进 `gearbox-adr/`,`docs/adr/` 里的旧协议 ADR 残留需手动清。
- **考虑过但未采纳**:子目录(`docs/adr/gearbox/`,路径多一层易混)、文件名前缀(`gearbox-0001-*`,仍混在一个 ls)、迁移工具(3 个下游手动足够)、上游保持 `docs/adr/`(工具要分源/目标两常量,语义不正)。
```

- [ ] **Step 2: 跑门禁确认绿**

Run: `node scripts/check-gearbox.js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/gearbox-adr/0031-adr-dual-directory-split.md
git commit -m "docs(adr): ADR-0031 ADR 双目录分家

记录协议/项目 ADR 拆目录决策与理由。major/L1。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: gearbox-install → gearbox-adr

**Files:**
- Modify: `scripts/gearbox-install:43-45`（源常量 + github base）
- Modify: `scripts/gearbox-install:198-204`（Where to find things 文本）
- Modify: `scripts/gearbox-install:233,238,242-246,248,269`（拷贝段：注释/源目录/占位改写/写目标）
- Modify: `scripts/gearbox-install:389,406`（收尾提示）
- Test: 沙盒 install 到空目录

**Interfaces:**
- Consumes: 上游 `docs/gearbox-adr/`（Task 1）。
- Produces: 下游 `docs/gearbox-adr/`（协议 ADR 落这里）；install 不创建下游 `docs/adr/`。

- [ ] **Step 1: 改源常量 + github base（43-45 行）**

把：
```javascript
const GEARBOX_ADR_DIR = join(GEARBOX_DIR, "docs/adr");
const GEARBOX_GITHUB_BASE =
  "https://github.com/real-stanyan/gearbox/blob/master/docs/adr";
```
改为：
```javascript
const GEARBOX_ADR_DIR = join(GEARBOX_DIR, "docs/gearbox-adr");
const GEARBOX_GITHUB_BASE =
  "https://github.com/real-stanyan/gearbox/blob/master/docs/gearbox-adr";
```

- [ ] **Step 2: 改 Where to find things 模板（195-206 行区块）**

把 `mustReplace` 的第三参（新文本，203 行那段）：
```javascript
  `- \`CONTEXT.md\` — 领域词汇表
- \`docs/adr/\` — 架构决策记录（0001–${pad4(0)} 占位,由安装脚本改写）
- <其他模块文档目录，如 docs/modules/>`,
```
改为：
```javascript
  `- \`CONTEXT.md\` — 领域词汇表
- \`docs/gearbox-adr/\` — 协议 ADR（拷自 Gearbox,工具管,手别改）
- \`docs/adr/\` — 本项目自有架构决策（从 0001 起,人写）
- <其他模块文档目录，如 docs/modules/>`,
```

- [ ] **Step 3: 删掉占位改写块（242-246 行）**

不再需要「ADR 范围占位改写」（新模板没占位符了）。删除整段：
```javascript
// 补上 Where to find things 里的 ADR 范围(上面先占位,这里知道真实终号后改写)
agents = agents.replace(
  `（0001–${pad4(0)} 占位,由安装脚本改写）`,
  `（0001–${pad4(lastNum)} 随 Gearbox 引入,${pad4(lastNum + 1)} 起为本项目自有）`,
);
```

- [ ] **Step 4: 改拷贝段注释、源目录报错、写目标（233/238/248/269 行）**

- 233 行注释 `// ====== 2. docs/adr/ 全量拷贝 ...` → `// ====== 2. docs/gearbox-adr/ 全量拷贝 ...`
- 238 行 `die("上游 docs/adr/ 为空?");` → `die("上游 docs/gearbox-adr/ 为空?");`
- 248 行：
```javascript
mkdirSync(join(targetDir, "docs/adr"), { recursive: true });
```
改为：
```javascript
mkdirSync(join(targetDir, "docs/gearbox-adr"), { recursive: true });
```
- 269 行：
```javascript
  writeFileSync(join(targetDir, "docs/adr", f), content);
```
改为：
```javascript
  writeFileSync(join(targetDir, "docs/gearbox-adr", f), content);
```

- [ ] **Step 5: 改收尾提示（389/406 行）**

- 389 行 `docs/adr/` 标签 → `docs/gearbox-adr/`：
```javascript
console.log(`  ${C.green("✓")} docs/gearbox-adr/ ${C.dim(`(${adrFiles.length} 个上游协议 ADR, ${stamped} 个已加 hash 戳记 ADR-0021)`)}`);
```
- 406 行「首个自有决策」提示改为指向 `docs/adr/0001`（不再接在上游号后）：
```javascript
console.log(`  ${step++}. 首个自有决策写 ${C.cyan(`docs/adr/0001-*.md`)} ${C.dim("(项目 ADR 独立编号;协议 ADR 在 docs/gearbox-adr/,格式见 0001-adr-template.md)")}`);
```
（`lastNum` 此后可能不再被别处引用——若 Node 报未使用变量不会中断，可保留；若想清爽，确认无其他引用后删 240 行 `const lastNum = …`。先 grep：`grep -n lastNum scripts/gearbox-install`，仅剩定义行才删。）

- [ ] **Step 6: 沙盒验证 install**

```bash
SB=/private/tmp/claude-501/-Users-stanyan-Github-gearbox/ea0d0d35-8e15-44d1-889b-1fdf03288630/scratchpad
rm -rf "$SB/t3" && mkdir -p "$SB/t3"
GEARBOX_DIR=/Users/stanyan/Github/gearbox node scripts/gearbox-install "$SB/t3" --maintainer stanyan --gate "npx tsc --noEmit"
echo "--- gearbox-adr 应有 31 个协议 ADR ---"; ls "$SB/t3/docs/gearbox-adr" | wc -l
echo "--- docs/adr 不该被创建 ---"; ls "$SB/t3/docs/adr" 2>&1 || echo "OK: 无 docs/adr(符合预期)"
echo "--- Where to find things 应列两目录 ---"; grep -n "gearbox-adr\|本项目自有架构决策" "$SB/t3/AGENTS.md"
```
Expected: `gearbox-adr` 有 31 个文件（0001–0031）；`docs/adr` 不存在；AGENTS.md 列两目录。

- [ ] **Step 7: 本 repo 门禁绿 + Commit**

```bash
node scripts/check-gearbox.js   # Expected: PASS
git add scripts/gearbox-install
git commit -m "feat(install): 协议 ADR 拷入下游 docs/gearbox-adr/

源/目标目录 + github base + 收尾提示改指 gearbox-adr;项目 ADR 归 docs/adr/。ADR-0031。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: gearbox-version → gearbox-adr

**Files:**
- Modify: `scripts/gearbox-version:49`（本地上游探测）
- Modify: `scripts/gearbox-version:67,71`（报错文案 + `UPSTREAM_ADR_DIR`）
- Modify: `scripts/gearbox-version:78,80`（`DOWNSTREAM_ADR_DIR` + 报错文案）
- Test: 沙盒 version（复用 Task 3 的 `$SB/t3`）

**Interfaces:**
- Consumes: 上游 + 下游 `docs/gearbox-adr/`。
- Produces: 无（只读速查）。

- [ ] **Step 1: 改本地上游探测（49 行）**

```bash
if [[ -d "$DEFAULT_LOCAL/docs/adr" ]]; then
```
改为：
```bash
if [[ -d "$DEFAULT_LOCAL/docs/gearbox-adr" ]]; then
```

- [ ] **Step 2: 改「找不到上游」报错 + UPSTREAM_ADR_DIR（67/71 行）**

- 67 行：
```bash
  echo "  本地无 $DEFAULT_LOCAL/docs/adr, 且根目录无 .gearbox-upstream 配置"
```
改为：
```bash
  echo "  本地无 $DEFAULT_LOCAL/docs/gearbox-adr, 且根目录无 .gearbox-upstream 配置"
```
- 71 行：
```bash
UPSTREAM_ADR_DIR="$GEARBOX_DIR/docs/adr"
```
改为：
```bash
UPSTREAM_ADR_DIR="$GEARBOX_DIR/docs/gearbox-adr"
```

- [ ] **Step 3: 改 DOWNSTREAM_ADR_DIR + 下游报错（78/80 行）**

- 78 行：
```bash
DOWNSTREAM_ADR_DIR="docs/adr"
```
改为：
```bash
DOWNSTREAM_ADR_DIR="docs/gearbox-adr"
```
- 80 行：
```bash
  echo "${RED}✗ 当前目录没有 docs/adr/——请在下游 repo 根目录跑本命令${RESET}"
```
改为：
```bash
  echo "${RED}✗ 当前目录没有 docs/gearbox-adr/——请在下游 repo 根目录跑本命令${RESET}"
```

- [ ] **Step 4: 沙盒验证 version（下游与上游同版，应报「已最新」）**

```bash
SB=/private/tmp/claude-501/-Users-stanyan-Github-gearbox/ea0d0d35-8e15-44d1-889b-1fdf03288630/scratchpad
cd "$SB/t3" && git init -q && git add -A && git commit -q -m init
GEARBOX_DIR=/Users/stanyan/Github/gearbox bash /Users/stanyan/Github/gearbox/scripts/gearbox-version
cd /Users/stanyan/Github/gearbox
```
Expected: 认 `docs/gearbox-adr/`，逐条比对 31 个 ADR 无「缺失」，退出码 0。

- [ ] **Step 5: 本 repo 门禁绿 + Commit**

```bash
node scripts/check-gearbox.js   # Expected: PASS
git add scripts/gearbox-version
git commit -m "feat(version): ADR 目录改指 docs/gearbox-adr/

上游/下游探测 + 报错文案随双目录分家更新。ADR-0031。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: gearbox-update → gearbox-adr + 删重编号子系统

回流不再撞号（协议 ADR 独占 `docs/gearbox-adr/`），故删掉整套重编号逻辑，回流化简为「缺则按上游原号拷入」。

**Files:**
- Modify: `scripts/gearbox-update:50,52-53`（模块级目录常量 + github base）
- Modify: `scripts/gearbox-update:117,119,144,151`（`resolveUpstream` 内四处 `docs/adr`）
- Modify: `scripts/gearbox-update:233,243-244`（`validateContext` 下游目录 + 报错）
- Delete: `scripts/gearbox-update` 撞号分支（381-392 行 step 3）
- Delete: `scripts/gearbox-update` 函数 `buildExistingNumMap`（406-423）、`assignDownstreamNums`（425-459）、`replaceAdrRefs`（461-474）
- Modify: `transformAdrContent`（476+）去掉 `renumberMap` 参数与重编号，改为按上游原号
- Modify: 写盘/报告/supersede 路径 `docs/adr` → `docs/gearbox-adr`（约 677/754/769/790/1068 行及其调用点）
- Test: 沙盒 update（造一个落后一版的下游）

**Interfaces:**
- Consumes: 上游 `docs/gearbox-adr/`；下游 `docs/gearbox-adr/`（编号与上游恒等）。
- Produces: 回流后下游 `docs/gearbox-adr/NNNN-slug.md` = 上游同号；不触碰下游 `docs/adr/`。

- [ ] **Step 1: 改模块级常量（50/52-53 行）**

```javascript
let GEARBOX_ADR_DIR = join(GEARBOX_DIR, "docs/adr");
...
const GEARBOX_GITHUB_BASE =
  "https://github.com/real-stanyan/gearbox/blob/master/docs/adr";
```
三处 `docs/adr` → `docs/gearbox-adr`（50 行的 join、53 行的 URL 尾段）。

- [ ] **Step 2: 改 resolveUpstream 四处（117/119/144/151 行）**

`existsSync(join(localDir, "docs/adr"))`、`join(GEARBOX_DIR, "docs/adr")`、`join(cacheDir, "docs/adr")`、`join(localDir, "docs/adr")` 全部 `docs/adr` → `docs/gearbox-adr`。

- [ ] **Step 3: 改 validateContext 下游目录 + 报错（233/243-244 行）**

- 233 行 `const downAdrDir = join(downDir, "docs/adr");` → `join(downDir, "docs/gearbox-adr")`
- 243-244 行报错文案 `没有 docs/adr/` / `都有 docs/adr/` → `docs/gearbox-adr/`

- [ ] **Step 4: 删撞号分支（381-392 行 step 3）**

删除整个 `// 3. 撞号(...)` 到其 `continue;` 的块（`if (usedDownNums.has(gearboxNum)) { ... continue; }`）。删后把「4. 纯缺」注释改为「3. 缺(按上游原号拷)」，其 `type:"copy"` action 去掉 `collision:false` 字段（下面不再用）：
```javascript
    // 3. 缺: 按 gearbox 原号拷入 gearbox-adr/(不撞号,号恒等)
    actions.push({
      type: "copy",
      gearbox: gearboxAdr,
      reason: "下游缺,按 gearbox 原号拷",
    });
```

- [ ] **Step 5: 删三个重编号函数（406-474 行）**

删除 `buildExistingNumMap`、`assignDownstreamNums`、`replaceAdrRefs` 三个函数整体（连同 461 行 `// ===== 拷贝 + 重编号 + 替换 =====` 段注释改为 `// ===== 拷贝 =====`）。

- [ ] **Step 6: 化简 transformAdrContent（476 行起）**

去掉 `renumberMap` 参数与 `replaceAdrRefs` 调用；`newNum` 恒等于 `gearboxAdr.num`，标题/内文 `ADR-XXXX` 引用无需改写（号不变）。保留 (b) 溯源字段 + hash 戳记逻辑（ADR-0021）不动。新签名 `transformAdrContent(gearboxAdr)`，内部 `const content = gearboxAdr.content;` 起步，再走溯源追加。调用点（原传 `newNum`/`renumberMap` 处）同步改为只传 `gearboxAdr`，写盘路径用 `pad4(gearboxAdr.num)`。

- [ ] **Step 7: 改写盘/报告/supersede 路径（约 677/754/769/790/1068 行）**

`grep -n "docs/adr" scripts/gearbox-update` 逐条把剩余 `docs/adr/` 字符串改为 `docs/gearbox-adr/`（含 0006 supersede 报告行、`dstPath` 模板、commit 提示的 `git add docs/adr/`）。改完再 `grep -n "docs/adr\b" scripts/gearbox-update` 应只剩 `docs/gearbox-adr`（无裸 `docs/adr`）。同时确认 `assignDownstreamNums`/`renumberMap`/`replaceAdrRefs` 已无任何引用：`grep -nE "renumberMap|assignDownstreamNums|buildExistingNumMap|replaceAdrRefs" scripts/gearbox-update` 应为空。

- [ ] **Step 8: 沙盒验证 update（下游落后一版 → 回流补齐）**

```bash
SB=/private/tmp/claude-501/-Users-stanyan-Github-gearbox/ea0d0d35-8e15-44d1-889b-1fdf03288630/scratchpad
rm -rf "$SB/t5" && cp -R "$SB/t3" "$SB/t5"
rm "$SB/t5/docs/gearbox-adr/0030-gearbox-prune.md"   # 造「缺 0030」的落后下游
cd "$SB/t5" && git init -q && git add -A && git commit -q -m init
GEARBOX_DIR=/Users/stanyan/Github/gearbox node /Users/stanyan/Github/gearbox/scripts/gearbox-update
echo "--- 0030 应被按原号补回 gearbox-adr/ ---"; ls docs/gearbox-adr/0030-*.md
echo "--- docs/adr 应仍不存在(未被误创建) ---"; ls docs/adr 2>&1 || echo "OK: 无 docs/adr"
cd /Users/stanyan/Github/gearbox
```
Expected: `docs/gearbox-adr/0030-gearbox-prune.md` 被回流补回（原号，无重编号）；无 `docs/adr/`。

- [ ] **Step 9: 本 repo 门禁绿 + Commit**

```bash
node scripts/check-gearbox.js   # Expected: PASS
git add scripts/gearbox-update
git commit -m "feat(update): 回流改指 docs/gearbox-adr/ + 删重编号子系统

双目录不撞号,删 buildExistingNumMap/assignDownstreamNums/replaceAdrRefs,
回流化简为按上游原号拷入。号与上游 1:1 恒等。ADR-0031。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 文档同步（AGENTS.md + README.md + DOWNSTREAM.md）

**Files:**
- Modify: `AGENTS.md:34`（While working 决策去向）
- Modify: `AGENTS.md:54`（内文路径引用 0003/0005）
- Modify: `AGENTS.md:147`（Where to find things）
- Modify: `README.md:30,40`
- Modify: `DOWNSTREAM.md:11`（判定标准第 3 条）

**Interfaces:**
- Consumes: 无。
- Produces: 文档与新布局一致。注意 AGENTS.md 的 anchor 名不变（门禁锚点），只改锚下内容。

- [ ] **Step 1: AGENTS.md While working（34 行）**

```markdown
- 架构性决策写 `docs/adr/`（一个决策一个文件）
```
改为：
```markdown
- **项目自有**架构决策写 `docs/adr/`（一个决策一个文件，从 0001 起）；协议 ADR 在 `docs/gearbox-adr/`，由 gearbox 工具管，手别改
```

- [ ] **Step 2: AGENTS.md 内文路径引用（54 行）**

把 `docs/adr/0003-issue-roles.md` 与 `docs/adr/0005-handoff-lives-in-an-open-issue.md` 两处路径改为 `docs/gearbox-adr/0003-issue-roles.md`、`docs/gearbox-adr/0005-handoff-lives-in-an-open-issue.md`。

- [ ] **Step 3: AGENTS.md Where to find things（147 行）**

```markdown
- `docs/adr/` — 架构决策记录
```
改为：
```markdown
- `docs/gearbox-adr/` — 协议 ADR（拷自 Gearbox，工具管，手别改）
- `docs/adr/` — 本项目自有架构决策（从 0001 起）
```
（本 repo 自身没有 `docs/adr/`，但 AGENTS.md 是发给下游的模板正文，两条都列以指导下游；本 repo 门禁不因此行报错——它只查 anchor 字符串存在。）

- [ ] **Step 4: README.md（30/40 行）**

- 30 行：
```markdown
2. 首个自有架构决策写进 `docs/adr/`（编号接在拷入的上游 ADR 之后；0001 是模板）
```
改为：
```markdown
2. 首个自有架构决策写进 `docs/adr/`（项目 ADR 独立编号，从 0001 起）；协议 ADR 在 `docs/gearbox-adr/`（工具管，格式见其 0001-adr-template.md）
```
- 40 行表格 `docs/adr/` 那格：
```markdown
| `docs/adr/` | 决策记录。防止后来的 agent 把有意为之的设计"好心"改回去 |
```
改为：
```markdown
| `docs/gearbox-adr/` | 协议 ADR（拷自 Gearbox，工具管）。`docs/adr/` 则放本项目自有决策 |
```

- [ ] **Step 5: DOWNSTREAM.md 判定标准第 3 条（11 行）**

```markdown
3. 有 `docs/adr/` 目录
```
改为：
```markdown
3. 有 `docs/gearbox-adr/` 目录（协议 ADR 落点）
```

- [ ] **Step 6: 门禁绿（anchor 未改名 + DOWNSTREAM.md 段仍在）+ Commit**

Run: `node scripts/check-gearbox.js`
Expected: PASS

```bash
git add AGENTS.md README.md DOWNSTREAM.md
git commit -m "docs: 文档同步双目录分家(gearbox-adr/ 协议 + adr/ 项目)

AGENTS.md While working/路径引用/Where to find + README + DOWNSTREAM 判定标准。ADR-0031。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: 版本 bump + 三件套收口

**Files:**
- Modify: `package.json`（version → 2.0.0）
- 外部: GitHub Protocol gap issue + PR

**Interfaces:**
- Consumes: Task 1–6 全部 commit。
- Produces: 可 merge 的 PR（待维护者「同意」）。

- [ ] **Step 1: 改 package.json version**

`"version": "1.3.0"` → `"version": "2.0.0"`（当前最新 tag 为 v1.3.0，major 段位跳 2.0.0）。先确认基准：`git describe --tags --abbrev=0` 应为 `v1.3.0`。

- [ ] **Step 2: 全量回归——门禁 + 三工具沙盒冒烟**

```bash
node scripts/check-gearbox.js                                   # PASS
grep -rn "\"docs/adr\"\|docs/adr/" scripts/ | grep -v gearbox-adr   # 应为空(无残留裸 docs/adr)
```
Expected: 门禁绿；`scripts/` 里无裸 `docs/adr` 残留（Task 3–5 已全改）。Task 3/4/5 的沙盒验证若已过即可。

- [ ] **Step 3: Commit version bump**

```bash
git add package.json
git commit -m "chore(release): bump version 2.0.0 (ADR 双目录分家, major)

跨工具契约变更(文件布局: docs/adr → docs/gearbox-adr)= major(ADR-0023)。
tag + npm publish 为 merge 后维护者动作(ADR-0028/0029)。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: 开 Protocol gap issue + push 分支**

```bash
git push -u origin feat/adr-dual-directory-split
gh issue create --title "ADR 双目录分家: 协议 ADR ↔ 项目 ADR 拆目录" \
  --body "撞号根源在单目录共享编号命名空间。拆 docs/gearbox-adr/(协议) + docs/adr/(项目),删 gearbox-update 重编号子系统。决策见 ADR-0031。L1 + major(v2.0.0)。"
```

- [ ] **Step 5: 开 PR（body 含分级 + 版本声明）**

```bash
gh pr create --title "feat: ADR 双目录分家 (ADR-0031, v2.0.0)" --body "$(cat <<'EOF'
## What
协议 ADR 迁入 docs/gearbox-adr/,项目自有 ADR 留 docs/adr/。删 gearbox-update 重编号子系统(不再撞号)。

## 分级 / 版本
- 层级: **L1**(碰 Gate 锚点 + install/version/update 三工具) — 需维护者明确「同意」后方可 merge
- Version bump: **major** — 跨工具契约(文件布局)变更,下游回流需人工干预(手动 git mv 存量协议 ADR)
- Affects downstream: **yes** — 布局变;存量 3 下游(自测舰队)本次不迁,将来手动处理

## 三件套
- Issue: (上一步创建的编号)
- ADR: docs/gearbox-adr/0031-adr-dual-directory-split.md
- PR: 本 PR(CI 绿 + 维护者同意后 merge commit)

## Merge 后(维护者动作,agent 不代跑)
- `git tag -a v2.0.0` + push(ADR-0023/0028)
- `npm publish`(ADR-0028/0029)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: 等维护者「同意」再 merge**

L1 硬规则（ADR-0006）：`<维护者>`=stanyan 在会话或 PR comment 明确「同意」后，作者 agent 方可 CI 绿时 `gh pr merge --merge`（merge commit，ADR-0007）。**不得自行 merge。**

---

## Self-Review

**1. Spec coverage:**
- 双目录布局 → Task 1（上游）+ Task 3（下游 install）✓
- check-gearbox 断言 → Task 1 ✓
- install/version/update 目录常量 → Task 3/4/5 ✓
- 删重编号子系统 → Task 5 ✓
- 无迁移工具（YAGNI）→ 未建任何迁移 task ✓
- AGENTS/README/DOWNSTREAM 文档 → Task 6 ✓
- ADR-0031 → Task 2 ✓
- 版本 major/v2.0.0 + package.json → Task 7 ✓
- L1 三件套 + 维护者同意 → Task 7 ✓
- tag/publish 为 merge 后维护者动作，明确排除执行 → Global Constraints + Task 7 Step 6 ✓

**2. Placeholder scan:** 无 TBD/TODO；每个代码步给出确切前后文本或确切编辑指令 + grep 校验。Task 5 的大段删除按函数名 + 行号 + 删后 grep 断言锚定（无裸 `docs/adr` / 无重编号符号残留）。

**3. Type/名称一致性:** `GEARBOX_ADR_DIR` / `DOWNSTREAM_ADR_DIR` / `UPSTREAM_ADR_DIR` / `transformAdrContent` / `buildExistingNumMap` / `assignDownstreamNums` / `replaceAdrRefs` 跨 task 用名一致；沙盒目录 `$SB/t3`→`$SB/t5` 复用链清晰。
