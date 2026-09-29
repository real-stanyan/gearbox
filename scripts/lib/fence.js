// Gearbox protocol fences (ADR-0050): the tool-managed blocks in AGENTS.md (`protocol`)
// and CONTEXT.md (`glossary`). Pure string functions, no fs — shared by install / update /
// version / check and the upstream self-check.
import { createHash } from "node:crypto";

export const FENCE_NOTES = {
  protocol:
    'managed by gearbox-agents, do not edit by hand; project additions go in "## Local protocol extensions"',
  glossary:
    'managed by gearbox-agents, do not edit by hand; project terms go in "## Project terms"',
};

const BEGIN_RE = /^<!-- gearbox:(protocol|glossary) (v\d+\.\d+\.\d+) sha256:([0-9a-f]{12});.*-->$/;
const END_RE = /^<!-- \/gearbox:(protocol|glossary) -->$/;
const MARKER_RE = /^<!-- \/?gearbox:/;

export class FenceError extends Error {}

function toLines(text) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

export function normalize(content) {
  const lines = toLines(content).map((l) => l.replace(/[ \t]+$/, ""));
  while (lines.length > 0 && lines[0] === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

export function hashContent(content) {
  return createHash("sha256").update(normalize(content)).digest("hex").slice(0, 12);
}

// null when `text` has no marker of this fence; FenceError on anything malformed — never a guess.
export function findFence(text, name) {
  const lines = toLines(text);
  let begin = -1;
  let end = -1;
  let version = null;
  let hash = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!MARKER_RE.test(line)) continue;
    const b = line.match(BEGIN_RE);
    const e = line.match(END_RE);
    if (!b && !e) throw new FenceError(`malformed gearbox marker on line ${i + 1}: ${line}`);
    const markerName = (b || e)[1];
    if (markerName !== name) {
      if (begin !== -1 && end === -1)
        throw new FenceError(`gearbox:${markerName} marker nested inside gearbox:${name} (line ${i + 1})`);
      continue;
    }
    if (b) {
      if (begin !== -1) throw new FenceError(`duplicate gearbox:${name} begin marker (line ${i + 1})`);
      begin = i;
      version = b[2];
      hash = b[3];
    } else {
      if (begin === -1)
        throw new FenceError(`gearbox:${name} end marker without a begin marker (line ${i + 1})`);
      if (end !== -1) throw new FenceError(`duplicate gearbox:${name} end marker (line ${i + 1})`);
      end = i;
    }
  }
  if (begin === -1) return null;
  if (end === -1) throw new FenceError(`gearbox:${name} begin marker (line ${begin + 1}) has no end marker`);
  const content = lines.slice(begin + 1, end).join("\n");
  return {
    name,
    version,
    hash,
    actualHash: hashContent(content),
    content,
    block: lines.slice(begin, end + 1).join("\n"),
    beginLine: begin,
    endLine: end,
  };
}

export function renderFence(name, version, content) {
  if (!FENCE_NOTES[name]) throw new FenceError(`unknown fence name: ${name}`);
  if (!/^v\d+\.\d+\.\d+$/.test(version)) throw new FenceError(`bad fence version: ${version}`);
  const body = normalize(content);
  return [
    `<!-- gearbox:${name} ${version} sha256:${hashContent(body)}; ${FENCE_NOTES[name]} -->`,
    body,
    `<!-- /gearbox:${name} -->`,
  ].join("\n");
}

export function replaceFence(text, name, block) {
  const fence = findFence(text, name);
  if (!fence) throw new FenceError(`no gearbox:${name} fence to replace`);
  const lines = toLines(text);
  return [...lines.slice(0, fence.beginLine), block, ...lines.slice(fence.endLine + 1)].join("\n");
}

export function fenceStatus(localText, upstreamText, name) {
  const upstream = findFence(upstreamText, name);
  if (!upstream) throw new FenceError(`upstream has no gearbox:${name} fence`);
  const local = findFence(localText, name);
  if (!local) return { state: "missing", local: null, upstream };
  if (local.actualHash !== local.hash) return { state: "hand-edited", local, upstream };
  if (local.hash !== upstream.hash || local.version !== upstream.version)
    return { state: "behind", local, upstream };
  return { state: "synced", local, upstream };
}
