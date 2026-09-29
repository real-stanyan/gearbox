import test from "node:test";
import assert from "node:assert/strict";
import { migrateV1 } from "../scripts/lib/migrate-v1.js";
import { buildKnown, normalizeKnownLine, knownLineHash } from "../scripts/lib/v1-known.js";
import { renderFence, findFence } from "../scripts/lib/fence.js";
import { headings, sectionBody, splitByLevel } from "../scripts/lib/sections.js";
import { gateCommand } from "../scripts/lib/protocol-check.js";

const TEMPLATE = [
  "# example-project", "",
  "<One sentence: what this project is, what counts as done, what the scope boundaries are.>", "",
  "> This file is the single source of truth for ALL AI coding agents, whatever the tool (Claude Code, Z Code, Cursor, etc.).",
  "> Rules live here and only here. Do not duplicate them elsewhere.", "",
  "## Tech stack", "", "<Project tech stack, one per line.>", "",
  "## Hard rules", "", "<Project rules that must not be violated, one per line.>", "",
  "> Any clause in the protocol body marked **Hard rule** counts as part of this section.", "",
  "## Working agreement (multi-agent)", "",
  "### On starting a shift (the three start-of-shift steps)", "", "1. Sync, then read.", "2. Check GitHub Issues.", "",
  "### While working", "", "- Commit in small steps.", "- One agent sees a task through.", "",
  "### PR disposition (merge rules)", "", "- **Who merges**: L1 waits for `<maintainer>` agreement, L2 is autonomous.", "",
  "### Gate (the hard gate — must be all-green before shift-end)", "", "```bash", "<gate command, e.g.: npx tsc --noEmit && npx vitest run>", "```", "",
  "> Fill in the gate to match your actual project.", "",
  "### Division of labor (optional, fill in as needed)", "", "1. **Fill it in**", "2. **Leave it blank**", "",
  "## Where to find things", "", "- `CONTEXT.md` — domain glossary", "",
].join("\n");
const CONTEXT_TEMPLATE = [
  "# Domain context — example-project", "", "Domain glossary.", "",
  "## Terms", "", "| Term | Definition | Notes |", "|---|---|---|", "| handoff | a baton | — |", "| gate | the command | — |", "",
  "## Key invariants", "", "- No HANDOFF file.", "",
].join("\n");
const known = buildKnown([TEMPLATE], [CONTEXT_TEMPLATE]);
const protocolBlock = renderFence("protocol", "v2.0.0", "## Working agreement (multi-agent)\n\n- the new protocol");
const glossaryBlock = renderFence("glossary", "v2.0.0", "## Protocol terms\n\n| Term | Definition | Notes |\n|---|---|---|\n| handoff | x | y |");
const migrate = (agentsMd, contextMd = CONTEXT_TEMPLATE) => migrateV1({ agentsMd, contextMd, known, protocolBlock, glossaryBlock });
// The `##` sections of a migrated AGENTS.md (the one inside the test protocol fence included).
const SKELETON_H2 = ["Tech stack", "Hard rules", "Gate", "Maintainer", "Working agreement (multi-agent)", "Local protocol extensions", "Division of labor", "Where to find things"];
const h2Titles = (text) => headings(text).filter((h) => h.level === 2).map((h) => h.title);

const nearTemplate = TEMPLATE
  .replace("# example-project", "# shop-app")
  .replace("<One sentence: what this project is, what counts as done, what the scope boundaries are.>", "A coffee-shop ordering app.")
  .replace("<Project tech stack, one per line.>", "Expo / TypeScript")
  .replace("<Project rules that must not be violated, one per line.>", "- Money is always integer cents.")
  .replace("`<maintainer>`", "`real-owner`")
  .replace("<gate command, e.g.: npx tsc --noEmit && npx vitest run>", "npx tsc --noEmit")
  .replace("1. **Fill it in**\n2. **Leave it blank**", "Single agent at a time; no routing.");

test("near-template: project content kept, protocol replaced, nothing carried", () => {
  const { agentsMd, report } = migrate(nearTemplate);
  assert.ok(agentsMd.startsWith("# shop-app\n\nA coffee-shop ordering app."));
  assert.equal(findFence(agentsMd, "protocol").block, protocolBlock);
  assert.match(sectionBody(agentsMd, 2, "Gate"), /```bash\nnpx tsc --noEmit\n```/);
  assert.match(agentsMd, /GitHub account: `real-owner`/);
  assert.match(sectionBody(agentsMd, 2, "Hard rules"), /integer cents/);
  assert.doesNotMatch(sectionBody(agentsMd, 2, "Hard rules"), /counts as part of this section/);
  assert.match(sectionBody(agentsMd, 2, "Division of labor"), /Single agent at a time/);
  assert.deepEqual([report.carried, report.moved, report.flagged], [[], [], []]);
  assert.equal(report.maintainer, "real-owner");
  assert.equal(report.divisionOfLabor, "kept");
});

test("local additions: carried lines, moved subsections, gate notes, index moved out", () => {
  const withLocal = nearTemplate
    .replace("- One agent sees a task through.", "- One agent sees a task through.\n- Search closed issues before claiming a task.")
    .replace("### PR disposition (merge rules)", "### Worktree discipline (project ADR-0149)\n\n- One worktree per lane.\n\n### PR disposition (merge rules)")
    .replace("> Fill in the gate to match your actual project.", "> Fill in the gate to match your actual project.\n\n`npm test` also type-checks mobile/.")
    .replace("- `CONTEXT.md` — domain glossary", `- \`CONTEXT.md\` — domain glossary\n${"- `src/x.ts` — a long index line\n".repeat(1200)}`);
  const { agentsMd, indexMd, report } = migrate(withLocal);
  const ext = sectionBody(agentsMd, 2, "Local protocol extensions");
  assert.match(ext, /### From v1: While working\n\n- Extends: While working\n- Upstream: undecided\n\n- Search closed issues before claiming a task\./);
  assert.match(ext, /### Worktree discipline \(project ADR-0149\)\n\n- Extends: Working agreement \(multi-agent\)\n- Upstream: undecided\n\n- One worktree per lane\./);
  assert.match(sectionBody(agentsMd, 2, "Gate"), /also type-checks mobile/);
  assert.ok(indexMd.includes("a long index line"));
  assert.match(sectionBody(agentsMd, 2, "Where to find things"), /docs\/INDEX\.md/);
  assert.ok(Buffer.byteLength(agentsMd) <= 32768);
  assert.deepEqual(report.moved, ["Worktree discipline (project ADR-0149)"]);
  assert.deepEqual(report.carried, [{ section: "While working", lines: 1 }]);
  assert.equal(report.gateNotes, 1);
  assert.ok(report.indexMoved.bytes > 32768);
});

test("translated subsection (>50% unknown) is flagged, not carried", () => {
  // Deliberately Chinese: a hand-translated v1 subsection, the shape a Chinese-era downstream has.
  const translated = nearTemplate.replace("- Commit in small steps.\n- One agent sees a task through.", "- 小步提交。\n- 一个任务一个 agent 做完。\n- 本项目：先查撞车。");
  const { agentsMd, report } = migrate(translated);
  assert.deepEqual(report.flagged, [{ section: "While working", unknown: 3, total: 3 }]);
  assert.doesNotMatch(agentsMd, /小步提交/);
});

test("invariant: every unknown protocol-region line lands in the output or its section is flagged", () => {
  const withLocal = nearTemplate
    .replace("2. Check GitHub Issues.", "2. Check GitHub Issues.\n3. Say hi on the team channel.")
    .replace("- One agent sees a task through.", "- One agent sees a task through.\n- Lane names are kebab-case.");
  const { agentsMd, report } = migrate(withLocal);
  const flagged = new Set(report.flagged.map((f) => f.section));
  const wa = splitByLevel(withLocal, 2).find((c) => c.title === "Working agreement (multi-agent)");
  for (const sub of splitByLevel(wa.lines.join("\n"), 3).slice(1))
    for (const line of sub.lines) {
      const n = normalizeKnownLine(line, "real-owner");
      if (!n || n.startsWith("```") || known.lines.has(knownLineHash(n))) continue;
      assert.ok(agentsMd.includes(line) || flagged.has(sub.title), `lost: ${line}`);
    }
});

test("CONTEXT.md: protocol rows replaced by the fence, project rows kept, edits reported", () => {
  const ctx = CONTEXT_TEMPLATE.replace("| handoff | a baton | — |", "| handoff | a baton, passed at merge | — |\n| star | loyalty point | — |");
  const { contextMd, report } = migrate(nearTemplate, ctx);
  assert.equal(findFence(contextMd, "glossary").block, glossaryBlock);
  assert.match(contextMd, /## Project terms\n\n\| Term \| Definition \| Notes \|\n\|---\|---\|---\|\n\| star \| loyalty point \| — \|/);
  assert.doesNotMatch(contextMd, /\| gate \| the command/);
  assert.doesNotMatch(contextMd, /## Key invariants/);
  assert.deepEqual(report.context, { removedTerms: 2, editedTerms: ["handoff"], keptRows: 1 });
});

test("no Working agreement at all: skeleton with placeholders, gate reported missing", () => {
  const { agentsMd, report } = migrate("# hand-written\n\nSome notes.\n");
  assert.ok(findFence(agentsMd, "protocol"));
  assert.equal(report.gateMoved, false);
  assert.match(agentsMd, /<gate command/);
});

// --- Maintainer folding, Chinese-era installs, ~~~ fences ---

test("a short maintainer login inside another word doesn't make a template line unknown", () => {
  // The maintainer fold is a substring replace: login "ed" turns "merged" into "merg<maintainer>"
  // (and "marked", in the Hard-rules note, into "mark<maintainer>").
  const tpl = TEMPLATE.replace("- One agent sees a task through.", "- One agent sees a task through.\n- A task is done once its PR is merged.");
  const k = buildKnown([tpl], [CONTEXT_TEMPLATE]);
  const { agentsMd, report } = migrateV1({ agentsMd: tpl.replace("`<maintainer>`", "`ed`"), contextMd: CONTEXT_TEMPLATE, known: k, protocolBlock, glossaryBlock });
  assert.equal(report.maintainer, "ed");
  assert.deepEqual([report.carried, report.moved, report.flagged], [[], [], []]);
  assert.doesNotMatch(sectionBody(agentsMd, 2, "Hard rules"), /counts as part of this section/);
});

test("the backticked login is folded on its own when a word on the same line also contains it", () => {
  const who = "- **Who merges**: L1 waits for `<maintainer>` agreement, L2 is autonomous.";
  const tpl = TEMPLATE.replace(who, `${who}\n- It's enough for the \`<maintainer>\` to say "agreed" in a PR comment.`);
  const k = buildKnown([tpl], [CONTEXT_TEMPLATE]);
  const { report } = migrateV1({ agentsMd: tpl.replaceAll("`<maintainer>`", "`ed`"), contextMd: CONTEXT_TEMPLATE, known: k, protocolBlock, glossaryBlock });
  assert.equal(report.maintainer, "ed");
  assert.deepEqual([report.carried, report.flagged], [[], []]);
});

test("a Chinese-era install's maintainer is detected, and its maintainer lines count as known", () => {
  // Deliberately Chinese: the v1.0.0–v1.3.x template text, from Gearbox's own public history.
  const merge = "- **谁 merge**：PR 作者 agent 在 CI 绿后自行 merge。协议改动按分级走（见「协议自身的变更」）：L1 等 `<维护者>` 同意，L2 自主。";
  const zh = [
    "# example-project", "",
    "## Working agreement (multi-agent)", "",
    "### While working", "", "- 小步提交。", "",
    "### PR 处置（merge 规则）", "", merge, "",
    "## Where to find things", "",
  ].join("\n");
  const k = buildKnown([zh], []);
  const { report } = migrateV1({ agentsMd: zh.replace("`<维护者>`", "`real-owner`"), contextMd: "", known: k, protocolBlock, glossaryBlock });
  assert.equal(report.maintainer, "real-owner");
  assert.deepEqual([report.carried, report.moved, report.flagged], [[], [], []]);
});

test("each Chinese-era maintainer form is recognized on its own", () => {
  for (const line of [
    "- **谁 merge**：…L1 等 `real-owner` 同意，L2 自主。",
    "| **L1 严格层** | Hard rules | issue + ADR + PR,**且必须 `real-owner` 在会话或 PR comment 中明确同意后 agent 才能 merge** |",
    "- 质量兜底 = CI 门禁 + `real-owner` 事后否决权（revert + 重开 issue）。",
  ]) {
    const { report } = migrate(`# x\n\n## Working agreement (multi-agent)\n\n### PR 处置\n\n${line}\n`);
    assert.equal(report.maintainer, "real-owner", line);
  }
});

test("a v1 gate command in a ~~~ block moves to ## Gate", () => {
  const tilde = nearTemplate.replace("```bash\nnpx tsc --noEmit\n```", "~~~bash\nnpx tsc --noEmit\n~~~");
  const { agentsMd, report } = migrate(tilde);
  assert.equal(report.gateMoved, true);
  assert.equal(report.gateNotes, 0);
  assert.deepEqual(gateCommand(agentsMd), ["npx tsc --noEmit"]);
});

test("a code block added to a protocol subsection is carried whole, so its # comment stays code", () => {
  const withBlock = nearTemplate.replace(
    "- One agent sees a task through.",
    "- One agent sees a task through.\n- Lint before pushing:\n\n  ~~~bash\n  # the whole workspace\n  npm run lint\n  ~~~",
  );
  const { agentsMd, report } = migrate(withBlock);
  // 7 non-blank lines, 3 of them unknown content; the ~~~ delimiters are structural
  assert.deepEqual(report.carried, [{ section: "While working", lines: 3 }]);
  assert.match(
    sectionBody(agentsMd, 2, "Local protocol extensions"),
    /- Lint before pushing:\n  ~~~bash\n  # the whole workspace\n  npm run lint\n  ~~~/,
  );
  assert.ok(!headings(agentsMd).some((h) => h.title === "the whole workspace"), "a carried code line became a heading");
});

test("a code block left open in v1 is closed where it is carried, so it can't swallow the sections after it", () => {
  // An unclosed fence runs to the end of the file, so everything after it is part of this block.
  const open = nearTemplate.replace("- One agent sees a task through.", "- One agent sees a task through.\n- Example:\n\n  ~~~\n  some code");
  const { agentsMd } = migrate(open);
  assert.deepEqual(h2Titles(agentsMd), SKELETON_H2);
  const ext = sectionBody(agentsMd, 2, "Local protocol extensions");
  assert.match(ext, /  ~~~\n  some code\n[\s\S]*npx tsc --noEmit[\s\S]*\n  ~~~\n?$/);
});

// --- No-silent-loss invariant (spec §4) ---

test("a local line that merely starts with dashes is content, not a table separator", () => {
  const withNote = nearTemplate.replace("- One agent sees a task through.", "- One agent sees a task through.\n--- mobile team: run the simulator smoke test too ---");
  const { agentsMd, report } = migrate(withNote);
  assert.deepEqual(report.carried, [{ section: "While working", lines: 1 }]);
  assert.match(sectionBody(agentsMd, 2, "Local protocol extensions"), /--- mobile team: run the simulator smoke test too ---/);
});

test("a second Working agreement section adds to the first instead of replacing it", () => {
  const twice = nearTemplate.replace(
    "## Where to find things",
    "## Working agreement (project additions)\n\n### Deploys\n\n- Deploy on Tuesdays only.\n\n### Gate (mobile)\n\n```bash\nnpm run mobile:test\n```\n\n### Division of labor\n\n- Mobile work goes to the mobile lane.\n\n## Where to find things",
  );
  const { agentsMd, report } = migrate(twice);
  assert.equal(report.gateMoved, true);
  assert.deepEqual(gateCommand(agentsMd), ["npx tsc --noEmit"]);
  assert.match(sectionBody(agentsMd, 2, "Division of labor"), /Single agent at a time; no routing\.\n\n- Mobile work goes to the mobile lane\./);
  assert.deepEqual(report.moved, ["Deploys", "Gate (mobile)"]);
  const ext = sectionBody(agentsMd, 2, "Local protocol extensions");
  assert.match(ext, /### Deploys\n\n- Extends: Working agreement \(multi-agent\)\n- Upstream: undecided\n\n- Deploy on Tuesdays only\./);
  assert.match(ext, /### Gate \(mobile\)\n[\s\S]*npm run mobile:test/);
});

test("a repeated project section is merged in order, not overwritten", () => {
  const twice = nearTemplate.replace("## Working agreement (multi-agent)", "## Hard rules\n\n- Never log card numbers.\n\n## Working agreement (multi-agent)");
  const { agentsMd } = migrate(twice);
  assert.match(sectionBody(agentsMd, 2, "Hard rules"), /integer cents\.\n\n- Never log card numbers\./);
});

test("an unfilled v1 gate placeholder is not reported as a moved gate", () => {
  const { agentsMd, report } = migrate(TEMPLATE);
  assert.equal(report.gateMoved, false);
  assert.equal(report.gateNotes, 0);
  assert.match(sectionBody(agentsMd, 2, "Gate"), /<gate command/);
});

test("invariant, fuzzed: lines added anywhere in the protocol region land in Gate / extensions / Division of labor, or their subsection is flagged", () => {
  const shapes = [
    (id) => `- local rule ${id}`,
    (id) => `#### Local heading ${id}`,
    (id) => `--- local note ${id} ---`,
    (id) => `| local cell ${id} | x |`,
    (id) => `> local quote ${id}`,
    (id) => `### Local section ${id}`,
  ];
  let seed = 20260929;
  const rand = (n) => {
    seed = (seed * 48271) % 2147483647;
    return seed % n;
  };
  const base = nearTemplate.split("\n");
  const from = base.indexOf("## Working agreement (multi-agent)") + 1;
  let flaggedRounds = 0;
  for (let round = 0; round < 250; round++) {
    const doc = [...base];
    let to = base.indexOf("## Where to find things");
    const added = [];
    for (let j = 0, n = 1 + rand(5); j < n; j++) {
      const line = shapes[rand(shapes.length)](`${round}.${j}`);
      doc.splice(from + rand(to - from + 1), 0, line);
      to++;
      added.push(line);
    }
    const text = doc.join("\n");
    const { agentsMd, report } = migrate(text);
    assert.deepEqual(h2Titles(agentsMd), SKELETON_H2, text);
    if (report.flagged.length) flaggedRounds++;
    const homes = ["Gate", "Local protocol extensions", "Division of labor"].map((t) => sectionBody(agentsMd, 2, t).split("\n"));
    const subs = splitByLevel(splitByLevel(text, 2).find((c) => c.title === "Working agreement (multi-agent)").lines.join("\n"), 3);
    for (const line of added) {
      if (homes.some((h) => h.includes(line))) continue;
      const sub = subs.find((s) => s.lines.includes(line));
      assert.ok(sub?.title && report.flagged.some((f) => sub.title.startsWith(f.section)), `lost: ${line}\n---\n${text}`);
    }
  }
  assert.ok(flaggedRounds > 0, "the fuzz never exercised the flagged path");
});
