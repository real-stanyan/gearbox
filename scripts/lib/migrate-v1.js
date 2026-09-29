// v1 → v2 migration (ADR-0050): turns a v1-layout AGENTS.md / CONTEXT.md — protocol text merged
// by hand — into the fenced v2 layout. Pure: strings in, strings + report out, or a MigrationError
// (nothing produced) when a file can't be split into sections safely.
// Invariant: every line of the v1 protocol region that isn't known upstream text ends up in
// `## Gate`, in `## Local protocol extensions`, or named in the report (flagged subsections).
import { splitByLevel, baseTitle, fenceRun } from "./sections.js";
import {
  buildAgentsMd, buildContextMd, SOT_NOTE, PLACEHOLDERS, DEFAULT_DIVISION, INDEX_POINTERS, CONTEXT_INTRO, PROJECT_TERMS,
} from "./skeleton.js";
import { AGENTS_MAX_BYTES } from "./protocol-check.js";
import { normalizeKnownLine, knownLineHash, termKey, SEPARATOR_ROW } from "./v1-known.js";

// Thrown before any output when a v1 file can't be migrated safely; `update` catches it and stops
// with the message, having written nothing. `file` and `line` (1-based) name what to fix.
export class MigrationError extends Error {
  constructor(message, { file = null, line = null } = {}) {
    super(message);
    this.name = "MigrationError";
    this.file = file;
    this.line = line;
  }
}

// v1 `###` headings (baseTitle, lowercased) → canonical section. Exact match only.
const ALIASES = new Map([
  ["on starting a shift", "On starting a shift"],
  ["while working", "While working"],
  ["roles of issues & prs", "Roles of issues & PRs"],
  ["issue & pr 的角色", "Roles of issues & PRs"],
  ["pr disposition", "PR disposition"],
  ["pr 处置", "PR disposition"],
  ["changing the protocol itself", "Changing the protocol itself"],
  ["协议自身的变更", "Changing the protocol itself"],
  ["gate", "Gate"],
  ["on ending a shift", "On ending a shift"],
  ["parallel shifts", "Parallel shifts"],
  ["branch hygiene", "Branch hygiene"],
  ["分支卫生", "Branch hygiene"],
  ["division of labor", "Division of labor"],
]);

// Where a v1 install wrote the maintainer into the protocol text in place of `<maintainer>` — or of
// `<维护者>`, in the Chinese-era v1.0.0–v1.3.x templates. English forms first.
const MAINTAINER_PATTERNS = [
  /L1 waits for `([^`<>]+)` agreement/,
  /after the `([^`<>]+)` explicitly agrees/,
  /authored by the GitHub account `([^`<>]+)`/,
  /it's enough for the `([^`<>]+)` to say/,
  /L1 等 `([^`<>]+)` 同意/,
  /必须 `([^`<>]+)` 在会话/,
  /`([^`<>]+)` 事后否决权/,
];

function detectMaintainer(text) {
  for (const p of MAINTAINER_PATTERNS) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

// Is this line v1 upstream text? A v1 install replaced `<maintainer>` with the login, so the login
// is folded back before lookup. normalizeKnownLine folds by substring, which also rewrites the login
// inside other words (login "ed": "merged" → "merg<maintainer>"), so the line is also tried as
// written, and with only the backticked login folded — every v1 template backticks the placeholder.
function knownLineTest(known, maintainer) {
  const has = (normalized) => known.lines.has(knownLineHash(normalized));
  return (line) => {
    const raw = normalizeKnownLine(line);
    if (has(raw)) return true;
    if (!maintainer) return false;
    return has(normalizeKnownLine(line, maintainer)) || has(raw.split(`\`${maintainer}\``).join("`<maintainer>`"));
  };
}

// A line with no project content: blank, a code-fence delimiter (bare or with a language tag), a
// table separator row, a thematic break. It is never "unknown", and travels only inside a carried
// code block. Anything else is content — "--- note ---" included — so it can't vanish as structure.
function isStructural(line) {
  const t = line.trim();
  if (t === "") return true;
  const run = fenceRun(line);
  if (run) return /^[\w.+#-]*$/.test(t.slice(run.len).trim());
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(t) || /^([-*_])(\s*\1){2,}$/.test(t);
}

function trimBlank(lines) {
  const out = [...lines];
  while (out.length && out[0].trim() === "") out.shift();
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  return out;
}

// Fenced code blocks, read the way sections.js reads them (``` or ~~~, closed by the same character
// at least as long), so a block here is a block there. `end` is the closing line — or the last line,
// for a block left open.
function fencedBlocks(lines) {
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const open = fenceRun(lines[i]);
    if (!open) continue;
    let end = i + 1;
    while (end < lines.length) {
      const run = fenceRun(lines[end]);
      if (run && run.char === open.char && run.len >= open.len) break;
      end++;
    }
    blocks.push({ start: i, end: Math.min(end, lines.length - 1), open, closed: end < lines.length });
    i = end;
  }
  return blocks;
}

const FENCE_FIX = "close the code fence (or escape the backticks), then rerun gearbox-agents update";

// The migration splits a file into sections the way sections.js pairs code fences. Where that
// pairing can't be trusted — a fence never closed, an inline ```span``` read as an opener, a fence
// "closed" by a line with a language tag — the headings after it read as code, and whole sections
// (the index, later `##` sections) sink into one subsection, possibly a flagged one. Refuse instead.
function assertFencesPair(text, file) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  for (const b of fencedBlocks(lines)) {
    const opener = lines[b.start].trim();
    let why = null;
    if (b.open.char === "`" && opener.slice(b.open.len).includes("`"))
      why = `"${opener.length > 60 ? `${opener.slice(0, 57)}…` : opener}" starts with an inline code span, which reads as an opening code fence`;
    else if (!b.closed) why = "this code fence is never closed, so the rest of the file would read as code";
    else {
      const closer = lines[b.end].trim();
      if (closer.slice(fenceRun(lines[b.end]).len).trim())
        why = `this code fence is never closed — "${closer}" on line ${b.end + 1} closes it only by accident (a closing fence has no language tag)`;
    }
    if (why) throw new MigrationError(`${file} line ${b.start + 1}: ${why} — ${FENCE_FIX}`, { file, line: b.start + 1 });
  }
}

// What of a v1 protocol subsection must survive, in order: each unknown line, and each code block
// holding one — whole, so the code keeps its fence and a `# comment` in it can't become a heading.
// `unknown` counts the unknown lines: the > 50% rule and the report.
function carry(lines, isKnown) {
  const isUnknown = (l) => !isStructural(l) && !isKnown(l);
  const blocks = new Map(fencedBlocks(lines).map((b) => [b.start, b]));
  const out = [];
  let unknown = 0;
  for (let i = 0; i < lines.length; i++) {
    const b = blocks.get(i);
    if (!b) {
      if (isUnknown(lines[i])) {
        out.push(lines[i]);
        unknown++;
      }
      continue;
    }
    const block = lines.slice(b.start, b.end + 1);
    const n = block.filter(isUnknown).length;
    if (n) {
      out.push(...block);
      unknown += n;
    }
    i = b.end;
  }
  return { lines: out, unknown };
}

// The v1 `### Gate` command: the first closed code block that holds a command line — the template's
// `<gate command …>` placeholder isn't one. The subsection's other lines are left for gate notes.
function splitGateCommand(lines) {
  const isCommand = (l) => l.trim() !== "" && !/^<.*>$/.test(l.trim());
  const b = fencedBlocks(lines).find((x) => x.closed && lines.slice(x.start + 1, x.end).some(isCommand));
  if (!b) return { code: null, rest: lines };
  return { code: lines.slice(b.start + 1, b.end).join("\n"), rest: [...lines.slice(0, b.start), ...lines.slice(b.end + 1)] };
}

function extension(title, extendsSection, lines) {
  return [`### ${title}`, "", `- Extends: ${extendsSection}`, "- Upstream: undecided", "", ...trimBlank(lines)].join("\n");
}

// Is this section's heading v1 template text? Closing #s and indentation aside.
function isTemplateHeading(chunk, isKnown) {
  return isKnown(chunk.heading) || isKnown(`${"#".repeat(chunk.level)} ${chunk.title}`);
}

// A heading is recognized by its base title, so wording of its own in the trailing parenthetical
// ("### While working (plus: never force-push)") would vanish with the v1 heading. Unless the heading
// is template text, that wording comes along as a plain line wherever the section's content goes.
function headingNote(chunk, isKnown) {
  if (chunk.title === baseTitle(chunk.title) || isTemplateHeading(chunk, isKnown)) return null;
  return `v1 heading: ${chunk.title}`;
}

function withNote(note, lines) {
  return note ? [note, "", ...lines] : lines;
}

// One `## Working agreement` section. A v1 file can hold more than one (say, "(project additions)"),
// so results accumulate in `wa` — a later section never overwrites an earlier one.
function migrateWorkingAgreement(chunk, isKnown, wa, report) {
  const subs = splitByLevel(chunk.lines.join("\n"), 3);
  const leadNote = headingNote(chunk, isKnown);
  const lead = carry(subs[0].lines, isKnown);
  const leadCount = lead.unknown + (leadNote ? 1 : 0);
  if (leadCount) {
    wa.extensions.push(extension("From v1: Working agreement (multi-agent)", "Working agreement (multi-agent)", withNote(leadNote, lead.lines)));
    report.carried.push({ section: "Working agreement (multi-agent)", lines: leadCount });
  }
  for (const s of subs.slice(1)) {
    const canonical = ALIASES.get(baseTitle(s.title).toLowerCase());
    // There is one gate command: a second Gate subsection moves whole, like an unrecognized one.
    if (!canonical || (canonical === "Gate" && wa.gateSeen)) {
      wa.extensions.push(extension(s.title, "Working agreement (multi-agent)", s.lines));
      report.moved.push(s.title);
      continue;
    }
    const note = headingNote(s, isKnown);
    if (canonical === "Gate") {
      wa.gateSeen = true;
      const { code, rest } = splitGateCommand(s.lines);
      if (code !== null) {
        wa.gate = code;
        report.gateMoved = true;
      }
      const notes = carry(rest, isKnown);
      wa.gateNotes.push(...withNote(note, notes.lines));
      report.gateNotes += notes.unknown + (note ? 1 : 0);
      continue;
    }
    const kept = carry(s.lines, isKnown);
    if (canonical === "Division of labor") {
      if (kept.unknown || note) {
        wa.divisionOfLabor.push(withNote(note, trimBlank(s.lines)).join("\n"));
        report.divisionOfLabor = "kept";
      }
      continue;
    }
    if (kept.unknown === 0 && !note) continue;
    // The > 50% rule counts the body only (spec §4); a flagged subsection is named whole, heading too.
    const total = s.lines.filter((l) => l.trim() !== "").length;
    if (kept.unknown / total > 0.5) {
      report.flagged.push({ section: canonical, unknown: kept.unknown, total });
      continue;
    }
    wa.extensions.push(extension(`From v1: ${canonical}`, canonical, withNote(note, kept.lines)));
    report.carried.push({ section: canonical, lines: kept.unknown + (note ? 1 : 0) });
  }
}

function migrateContext(contextMd, known, isKnown, glossaryBlock, report) {
  const chunks = splitByLevel(contextMd || "", 2);
  const head = trimBlank(chunks[0].lines).join("\n") || `# Domain context\n\n${CONTEXT_INTRO}`;
  const kept = [];
  let renamed = false;
  for (const c of chunks.slice(1)) {
    // Protocol-term rows leave only a v1 template section (e.g. "## Terms"): the glossary fence
    // carries them now. A project's own table may use the same word for something else ("claim",
    // "gate") — that row stays, and is reported as a collision.
    const template = isTemplateHeading(c, isKnown);
    const body = [];
    let rows = 0;
    for (let i = 0; i < c.lines.length; i++) {
      const line = c.lines[i];
      const t = line.trim();
      if (t.startsWith("|")) {
        const isSep = SEPARATOR_ROW.test(t);
        const isHeader = !isSep && SEPARATOR_ROW.test((c.lines[i + 1] || "").trim());
        if (isSep || isHeader) {
          body.push(line);
          continue;
        }
        const key = termKey(t.split("|")[1] || "");
        if (known.terms.has(key)) {
          if (template) {
            report.context.removedTerms++;
            if (!isKnown(line)) report.context.editedTerms.push(key);
            continue;
          }
          report.context.collisions.push(key);
        }
        body.push(line);
        rows++;
        continue;
      }
      if (!isStructural(line) && isKnown(line)) continue;
      body.push(line);
    }
    const prose = body.filter((l) => !l.trim().startsWith("|") && !isStructural(l));
    if (rows === 0 && prose.length === 0) continue;
    const cleaned = rows === 0 ? body.filter((l) => !l.trim().startsWith("|")) : body;
    let heading = c.heading;
    if (rows > 0 && !renamed && template) {
      heading = "## Project terms";
      renamed = true;
    }
    report.context.keptRows += rows;
    kept.push([heading, "", ...trimBlank(cleaned)].join("\n"));
  }
  return buildContextMd({ head, glossaryBlock, projectTerms: kept.length ? kept.join("\n\n") : PROJECT_TERMS });
}

export function migrateV1({ agentsMd, contextMd, known, protocolBlock, glossaryBlock }) {
  assertFencesPair(agentsMd, "AGENTS.md");
  assertFencesPair(contextMd, "CONTEXT.md");
  const report = {
    maintainer: null, gateMoved: false, gateNotes: 0, divisionOfLabor: "default",
    carried: [], moved: [], flagged: [], extraSections: [], indexMoved: null, oversize: null,
    context: { removedTerms: 0, editedTerms: [], keptRows: 0, collisions: [] },
  };
  const maintainer = detectMaintainer(agentsMd);
  report.maintainer = maintainer;
  const isKnown = knownLineTest(known, maintainer);

  const chunks = splitByLevel(agentsMd, 2);
  // A repeated project section is merged in order, never overwritten.
  const techStackParts = [];
  const hardRulesParts = [];
  const whereToFindParts = [];
  const wa = { gate: null, gateSeen: false, gateNotes: [], divisionOfLabor: [], extensions: [] };
  const extraSections = [];
  for (const c of chunks.slice(1)) {
    const key = baseTitle(c.title).toLowerCase();
    const kept = (lines) => withNote(headingNote(c, isKnown), trimBlank(lines)).join("\n");
    if (key === "tech stack") techStackParts.push(kept(c.lines));
    else if (key === "hard rules") hardRulesParts.push(kept(c.lines.filter((l) => !(l.trim().startsWith(">") && isKnown(l)))));
    else if (key === "where to find things") whereToFindParts.push(kept(c.lines));
    else if (key === "working agreement") migrateWorkingAgreement(c, isKnown, wa, report);
    else {
      extraSections.push([c.heading, ...c.lines].join("\n"));
      report.extraSections.push(c.title);
    }
  }
  const merged = (parts) => parts.filter(Boolean).join("\n\n");
  const techStack = merged(techStackParts);
  const hardRules = merged(hardRulesParts);
  const whereToFind = merged(whereToFindParts);

  const keptPreamble = trimBlank(chunks[0].lines.filter((l) => !(l.trim().startsWith(">") && isKnown(l))));
  const head = [...keptPreamble, "", SOT_NOTE].join("\n");
  const build = (where) =>
    buildAgentsMd({
      head,
      techStack: techStack || PLACEHOLDERS.techStack,
      hardRules: hardRules || PLACEHOLDERS.hardRules,
      gate: wa.gate,
      gateNotes: wa.gateNotes.join("\n"),
      maintainer,
      protocolBlock,
      localExtensions: wa.extensions.length ? wa.extensions.join("\n\n") : PLACEHOLDERS.localExtensions,
      divisionOfLabor: wa.divisionOfLabor.length ? wa.divisionOfLabor.join("\n\n") : DEFAULT_DIVISION,
      extraSections,
      whereToFind: where,
    });

  let agents = build(whereToFind || PLACEHOLDERS.whereToFind);
  let indexMd = null;
  if (Buffer.byteLength(agents) > AGENTS_MAX_BYTES && whereToFind) {
    indexMd = `# Index\n\n> Moved out of AGENTS.md by the Gearbox v2 migration (ADR-0051): AGENTS.md is loaded into every agent session and capped at 32 KiB. Keep one line per entry here too.\n\n${whereToFind}\n`;
    report.indexMoved = { bytes: Buffer.byteLength(whereToFind) };
    agents = build(INDEX_POINTERS);
  }
  if (Buffer.byteLength(agents) > AGENTS_MAX_BYTES) report.oversize = Buffer.byteLength(agents);

  const context = migrateContext(contextMd, known, isKnown, glossaryBlock, report);
  return { agentsMd: agents, contextMd: context, indexMd, report };
}
