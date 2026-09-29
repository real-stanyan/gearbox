// Shared protocol assertions (ADR-0051). Downstream: `gearbox-agents check` (CI job
// gearbox-check). Upstream: scripts/check-gearbox.js runs them in upstream mode, which skips
// .gearbox-version and adds the protocol-fence budget.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { findFence, FenceError } from "./fence.js";
import { baseTitle, fenceRun, headings, sectionBody, sectionSizes, splitByLevel } from "./sections.js";

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

export function runProtocolChecks(root, { upstream = false } = {}) {
  const errors = [];
  const warnings = [];
  const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), "utf8") : null);
  const agents = read("AGENTS.md");
  const context = read("CONTEXT.md");
  if (agents === null) errors.push("AGENTS.md is missing");
  if (context === null) errors.push("CONTEXT.md is missing");

  const fenceOf = (text, file, name) => {
    if (text === null) return null;
    try {
      const f = findFence(text, name);
      if (!f) errors.push(`${file} has no gearbox:${name} fence — run \`npx gearbox-agents update\` (a v1 layout is migrated automatically, ADR-0050)`);
      return f;
    } catch (e) {
      if (!(e instanceof FenceError)) throw e;
      errors.push(`${file}: ${e.message}`);
      return null;
    }
  };
  const protocol = fenceOf(agents, "AGENTS.md", "protocol");
  const glossary = fenceOf(context, "CONTEXT.md", "glossary");

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

  const claude = read("CLAUDE.md");
  if (claude === null || claude.trim() !== "@AGENTS.md")
    errors.push("CLAUDE.md must be exactly '@AGENTS.md' (the empty-shell contract; rules live only in AGENTS.md)");
  if (existsSync(join(root, "HANDOFF.md"))) errors.push("HANDOFF.md must not exist (progress lives in issues/PRs)");
  if (inGit(root))
    for (const f of NEVER_IGNORED)
      if (isIgnored(root, f)) errors.push(`protocol file must not be gitignored: ${f} (ADR-0037 — it would never reach the next shift's clone)`);

  return { errors, warnings, protocol, glossary };
}
