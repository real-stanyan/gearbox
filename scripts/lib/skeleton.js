// v2 AGENTS.md / CONTEXT.md assembly (ADR-0050). install builds a fresh skeleton with
// placeholders; the v1 → v2 migration fills the same skeleton with the project's own
// content. Fence blocks are passed in verbatim — nothing here edits protocol text.

export const SOT_NOTE = [
  "> This file is the single source of truth for ALL AI coding agents, whatever the tool (Claude Code, Z Code, Cursor, Codex, etc.). Rules live here and only here.",
  "> The block between the `gearbox:protocol` markers is the Gearbox protocol, managed by `gearbox-agents` — don't edit it. Project rules go in the sections outside it.",
].join("\n");

export const LOCAL_EXTENSIONS_NOTE =
  "> Project additions to the fenced protocol. Each `###` entry names the fenced section it extends (`- Extends:`) and where it stands upstream (`- Upstream:` an upstream issue link, `project-specific`, or `undecided`). An entry is tiered as if it were written into the section it extends (ADR-0006/0012).";

export const GATE_NOTE =
  "> The Gate contract (what must be green, and when) is in the protocol below. This section holds only this project's command; `.github/workflows/ci.yml` runs it byte-for-byte.";

export const DEFAULT_DIVISION =
  "No fixed division of labor (ADR-0008 option 2): Task-issue claim-based ownership — whoever claims a task sees it through start to finish.";

// The index line for docs/adr/ (ADR-0052): the directory is the ADRs' index, so they aren't listed one
// by one. The v1 → v2 migration puts it in place of the v1 template's "starting at 0001" line.
export const DOCS_ADR_LINE =
  "- `docs/adr/` — this project's own architectural decisions, one file per decision named `<issue>-<slug>.md` after the issue that settles it (ADR-0052; not listed here one by one)";

export const INDEX_POINTERS = [
  "- `CONTEXT.md` — domain glossary (protocol terms, fenced + this project's terms)",
  "- `docs/gearbox-adr/` — protocol ADRs (managed by tooling — don't hand-edit)",
  DOCS_ADR_LINE,
  "- `docs/INDEX.md` — the full map of where things live (kept out of this file so it stays within 32 KiB)",
].join("\n");

export const PLACEHOLDERS = {
  intro: "<One sentence: what this project is, what counts as done, what the scope boundaries are.>",
  techStack: "<Project tech stack, one per line. Example: Next.js 15 / TypeScript / Postgres>",
  hardRules:
    "<Project rules that must not be violated, one per line. Example: money is always cents + BigInt; never expose SECRET_* to the client.>",
  gate: "<gate command, e.g.: npx tsc --noEmit && npx vitest run>",
  maintainer: "<maintainer>",
  localExtensions: "(none yet)",
  divisionOfLabor: [
    "<Pick one (ADR-0008), then delete this line and the other two options:>",
    "",
    "1. **Fill it in**: which kind of task goes to which agent (split by capability, not tied to a specific tool).",
    "2. **Leave it blank**: the default rule = **Task-issue claim-based ownership** — whoever claims a task sees it through start to finish; tasks aren't routed by agent specialty.",
    '3. **Single-agent project**: write "Single-agent project — no division of labor."',
  ].join("\n"),
  whereToFind: [
    "- `CONTEXT.md` — domain glossary (protocol terms, fenced + this project's terms)",
    "- `docs/gearbox-adr/` — protocol ADRs (managed by tooling — don't hand-edit)",
    DOCS_ADR_LINE,
    "- <one line per entry: `path` — what's there. Longer maps go in `docs/INDEX.md`>",
  ].join("\n"),
};

export const CONTEXT_INTRO =
  "Domain glossary. All agents' understanding of domain terms is grounded here; code naming stays consistent with the terms defined here.";

export const PROJECT_TERMS = "## Project terms\n\n| Term | Definition | Notes |\n|---|---|---|";

export function buildAgentsMd({
  title = "Project",
  intro = PLACEHOLDERS.intro,
  head = null,
  techStack = PLACEHOLDERS.techStack,
  hardRules = PLACEHOLDERS.hardRules,
  gate = null,
  gateNotes = "",
  maintainer = null,
  protocolBlock,
  localExtensions = PLACEHOLDERS.localExtensions,
  divisionOfLabor = PLACEHOLDERS.divisionOfLabor,
  extraSections = [],
  whereToFind = PLACEHOLDERS.whereToFind,
}) {
  if (!protocolBlock) throw new Error("buildAgentsMd needs the protocol fence block");
  const top = (head ?? `# ${title}\n\n${intro}\n\n${SOT_NOTE}`).trim();
  const gateBody = [
    "```bash",
    (gate || PLACEHOLDERS.gate).trim(),
    "```",
    "",
    GATE_NOTE,
    ...(gateNotes.trim() ? ["", gateNotes.trim()] : []),
  ].join("\n");
  return (
    [
      top,
      `## Tech stack\n\n${techStack.trim()}`,
      `## Hard rules\n\n${hardRules.trim()}`,
      `## Gate\n\n${gateBody}`,
      `## Maintainer\n\nGitHub account: \`${maintainer || PLACEHOLDERS.maintainer}\``,
      protocolBlock.trim(),
      `## Local protocol extensions\n\n${LOCAL_EXTENSIONS_NOTE}\n\n${localExtensions.trim()}`,
      `## Division of labor\n\n${divisionOfLabor.trim()}`,
      ...extraSections.map((s) => s.trim()).filter(Boolean),
      `## Where to find things\n\n${whereToFind.trim()}`,
    ].join("\n\n") + "\n"
  );
}

export function buildContextMd({ title = "Project", head = null, glossaryBlock, projectTerms = PROJECT_TERMS }) {
  if (!glossaryBlock) throw new Error("buildContextMd needs the glossary fence block");
  const top = (head ?? `# Domain context — ${title}\n\n${CONTEXT_INTRO}`).trim();
  return [top, glossaryBlock.trim(), projectTerms.trim()].join("\n\n") + "\n";
}
