// Shared protocol assertions (ADR-0051). Downstream: `gearbox-agents check` (CI job
// gearbox-check). Upstream: scripts/check-gearbox.js runs them in upstream mode, which skips
// .gearbox-version and adds the protocol-fence budget.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { findFence, FenceError, oneFenceAdvice } from "./fence.js";
import { baseTitle, fenceRun, headings, sectionBody, sectionSizes, splitByLevel } from "./sections.js";
import { planWorkflowFixes, CHECK_PATH } from "./workflows.js";

export const AGENTS_MAX_BYTES = 32768;
export const PROTOCOL_FENCE_MAX_BYTES = 20480;
export const PROJECT_HEADINGS = ["Tech stack", "Hard rules", "Gate", "Maintainer", "Local protocol extensions", "Where to find things"];
export const FENCE_HEADINGS = [
  [2, "Working agreement (multi-agent)"],
  [3, "On starting a shift"],
  [3, "While working"],
  [3, "Roles of issues & PRs"],
  [3, "PR disposition"],
  [3, "Changing the protocol itself"],
  [3, "Gate contract"],
  [3, "On ending a shift"],
];
export const NEVER_IGNORED = ["AGENTS.md", "CLAUDE.md", "CONTEXT.md", "docs/gearbox-adr", ".gearbox-version", ".github/workflows/ci.yml"];

// Non-empty lines of the FIRST fenced block under "## Gate", "# comments" stripped. The block is
// read like CommonMark: ``` or ~~~, closed by the same character at least as long as the opener.
// null when the section has no closed fenced block (an unterminated one would swallow the rest
// of the file as "commands").
export function gateCommand(agentsText) {
  const body = sectionBody(agentsText, 2, "Gate");
  if (body === null) return null;
  let open = null;
  const block = [];
  for (const line of body.split("\n")) {
    const run = fenceRun(line);
    if (open === null) {
      if (run) open = run;
    } else if (run && run.char === open.char && run.len >= open.len) {
      return block.map((l) => l.replace(/(^|\s)#.*$/, "").trim()).filter(Boolean);
    } else {
      block.push(line);
    }
  }
  return null;
}

export function maintainerAccount(agentsText) {
  const body = sectionBody(agentsText, 2, "Maintainer");
  const m = body && body.match(/GitHub account:\s*`([^`]+)`/);
  return m ? m[1] : null;
}

function withoutFence(text, fence) {
  if (!fence) return text;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return [...lines.slice(0, fence.beginLine), ...lines.slice(fence.endLine + 1)].join("\n");
}

function inGit(root) {
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isIgnored(root, path) {
  try {
    execSync(`git check-ignore -q "${path}"`, { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ADR files in `dir` grouped by their numeric ID (ADR-0052): "0074-x.md" and "74-y.md" are both
// ADR-74. Only groups of two or more come back, ordered by ID, file names sorted. A file without
// a leading number (README, notes) isn't an ADR.
export function duplicateAdrIds(root, dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const byId = new Map();
  for (const name of readdirSync(abs)) {
    const m = name.match(/^(\d+)-.+\.md$/);
    if (!m) continue;
    const id = Number(m[1]);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(name);
  }
  return [...byId]
    .filter(([, files]) => files.length > 1)
    .sort(([a], [b]) => a - b)
    .map(([id, files]) => ({ id, files: files.sort() }));
}

export function runProtocolChecks(root, { upstream = false } = {}) {
  const errors = [];
  const warnings = [];
  const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), "utf8") : null);
  const agents = read("AGENTS.md");
  const context = read("CONTEXT.md");
  if (agents === null) errors.push("AGENTS.md is missing");
  if (context === null) errors.push("CONTEXT.md is missing");

  const noFence = []; // files that were read and hold no marker of their fence
  const fenceOf = (text, file, name) => {
    if (text === null) return null;
    try {
      const f = findFence(text, name);
      if (!f) noFence.push({ file, name });
      return f;
    } catch (e) {
      if (!(e instanceof FenceError)) throw e;
      errors.push(`${file}: ${e.message}`);
      return null;
    }
  };
  const protocol = fenceOf(agents, "AGENTS.md", "protocol");
  const glossary = fenceOf(context, "CONTEXT.md", "glossary");
  // One fence gone while the other is there: the advice update and version give too. Otherwise a
  // missing fence is a v1 layout, which update migrates.
  if (noFence.length === 1 && (protocol || glossary)) {
    const { what, fix } = oneFenceAdvice(noFence[0].file);
    errors.push(`${what} — ${fix}`);
  } else
    for (const { file, name } of noFence)
      errors.push(`${file} has no gearbox:${name} fence — run \`npx gearbox-agents update\` (a v1 layout is migrated automatically, ADR-0050)`);

  for (const [file, f, home] of [["AGENTS.md", protocol, "## Local protocol extensions"], ["CONTEXT.md", glossary, "## Project terms"]]) {
    if (!f || f.actualHash === f.hash) continue;
    // Downstream the fence is upstream's text (re-apply it); in the Gearbox repo it is our own text (re-stamp it).
    const fix = upstream
      ? "set package.json's version to this change's target, then run `node scripts/dev/rehash-fences.js`"
      : `move project text to "${home}", then re-apply upstream's fence with \`npx gearbox-agents update --force\``;
    errors.push(`${file}: the gearbox:${f.name} fence was edited by hand (marker sha256:${f.hash}, content sha256:${f.actualHash}) — ${fix} (ADR-0050)`);
  }
  if (protocol && glossary && protocol.version !== glossary.version)
    errors.push(`fence versions differ: protocol ${protocol.version}, glossary ${glossary.version} — both markers always carry the protocol version (ADR-0050)`);
  if (!upstream && protocol) {
    const stamp = (read(".gearbox-version") || "").split("\n")[0].trim();
    if (stamp !== protocol.version)
      errors.push(`.gearbox-version is "${stamp || "(missing)"}" but the protocol fence is ${protocol.version} — they must match (ADR-0050)`);
  }

  if (agents !== null) {
    // LF content, as CI checks it out: a core.autocrlf checkout adds a byte per line on disk.
    const bytes = Buffer.byteLength(agents.replace(/\r\n/g, "\n"));
    if (bytes > AGENTS_MAX_BYTES) {
      const top = sectionSizes(agents).slice(0, 4).map((s) => `${s.title} ${s.bytes} B`).join(", ");
      errors.push(`AGENTS.md is ${bytes} bytes, over the ${AGENTS_MAX_BYTES}-byte budget (ADR-0051; Codex reads only the first 32 KiB by default). Largest sections: ${top}. Move long maps to docs/INDEX.md and keep "Where to find things" to one line per entry`);
    }
    const outside = withoutFence(agents, protocol);
    const outsideHeadings = headings(outside);
    for (const t of PROJECT_HEADINGS)
      if (!outsideHeadings.some((h) => h.level === 2 && h.title === t))
        errors.push(`AGENTS.md is missing the project section "## ${t}" (outside the protocol fence)`);
    if (protocol) {
      const inside = headings(protocol.content);
      for (const [level, t] of FENCE_HEADINGS)
        if (!inside.some((h) => h.level === level && (level === 2 ? h.title === t : baseTitle(h.title) === t)))
          errors.push(`the protocol fence is missing "${"#".repeat(level)} ${t}"`);
      const fenceBytes = Buffer.byteLength(protocol.content);
      if (upstream && fenceBytes > PROTOCOL_FENCE_MAX_BYTES)
        errors.push(`the protocol fence is ${fenceBytes} bytes, over the ${PROTOCOL_FENCE_MAX_BYTES}-byte upstream budget (ADR-0051) — move rationale into ADRs`);
    }

    const gate = gateCommand(agents);
    const ci = read(".github/workflows/ci.yml");
    if (!gate || gate.length === 0) errors.push('AGENTS.md "## Gate" has no fenced command block');
    else if (gate.some((l) => /^<.*>$/.test(l)))
      errors.push('AGENTS.md "## Gate" still holds the placeholder command — fill it in, and the same command in .github/workflows/ci.yml');
    else if (ci === null) errors.push(".github/workflows/ci.yml is missing (CI == Gate contract)");
    else for (const l of gate) if (!ci.includes(l)) errors.push(`.github/workflows/ci.yml doesn't run the Gate command line \`${l}\` (CI == Gate contract)`);

    const m = maintainerAccount(agents);
    if (!m || m === "<maintainer>")
      warnings.push('"## Maintainer" names no GitHub account yet — L1 approval has nothing to verify against (ADR-0034)');

    const ext = sectionBody(outside, 2, "Local protocol extensions");
    if (ext !== null) {
      // splitByLevel skips headings inside code blocks; the chunk before the first "###" has no title
      for (const { title, lines } of splitByLevel(ext, 3).filter((c) => c.title !== null)) {
        const up = lines.join("\n").match(/^- Upstream:[ \t]*(.*)$/m);
        const value = up ? up[1].trim() : "";
        if (!value) warnings.push(`local extension "${title}" has no "- Upstream:" line`);
        else if (/^undecided/i.test(value))
          warnings.push(`local extension "${title}" is "Upstream: undecided" — decide: an upstream issue link, or project-specific`);
      }
    }
  }

  // Downstream, the tool-owned gearbox-check.yml as update would write it (ADR-0051). A warning, not
  // an error: the sync Action can't write workflow files, so only a local update run fixes it.
  if (!upstream) {
    const fix = planWorkflowFixes(root).find((w) => w.path === CHECK_PATH);
    if (fix)
      warnings.push(
        `${CHECK_PATH} ${fix.why === "added" ? "is missing" : "differs from the template"} — run \`npx gearbox-agents@2 update\` locally to ${fix.why === "added" ? "write" : "rewrite"} it (the sync Action can't write workflow files, ADR-0051)`,
      );
  }

  const claude = read("CLAUDE.md");
  if (claude === null || claude.trim() !== "@AGENTS.md")
    errors.push("CLAUDE.md must be exactly '@AGENTS.md' (the empty-shell contract; rules live only in AGENTS.md)");
  if (existsSync(join(root, "HANDOFF.md"))) errors.push("HANDOFF.md must not exist (progress lives in issues/PRs)");
  if (inGit(root))
    for (const f of NEVER_IGNORED)
      if (isIgnored(root, f)) errors.push(`protocol file must not be gitignored: ${f} (ADR-0037 — it would never reach the next shift's clone)`);

  // Project ADRs are named after their issue (ADR-0052). A duplicate involving an issue ID (no
  // leading zero) is new and fails. Duplicates among older zero-padded sequential IDs can only be
  // fixed by renumbering, which breaks cited references — they warn, once for all of them.
  const older = [];
  for (const { id, files } of duplicateAdrIds(root, "docs/adr")) {
    if (files.every((f) => f.startsWith("0"))) older.push(`ADR-${id} (${files.join(", ")})`);
    else
      errors.push(
        `docs/adr: ADR-${id} is used by ${files.length} files: ${files.join(", ")} — name a new ADR after the issue that settles it (a fresh issue if that number is taken); never renumber an ADR that is already cited (ADR-0052)`,
      );
  }
  if (older.length)
    warnings.push(
      `docs/adr: older ADR numbers used by more than one file: ${older.join("; ")} — references to them are ambiguous; new ADRs are named after their issue, so this can't recur (ADR-0052)`,
    );
  for (const { id, files } of duplicateAdrIds(root, "docs/gearbox-adr"))
    errors.push(
      `docs/gearbox-adr: ADR-${id} is used by ${files.length} files: ${files.join(", ")} — ${
        upstream
          ? "protocol ADR numbers are claimed at merge: renumber yours (Upstream release process)"
          : "these copies are managed by gearbox-agents: delete the stray file and rerun `npx gearbox-agents update`"
      }`,
    );

  return { errors, warnings, protocol, glossary };
}
