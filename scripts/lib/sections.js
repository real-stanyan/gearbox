// Markdown heading helpers for AGENTS.md / CONTEXT.md. A line inside a ``` or ~~~ block is never a
// heading (a `# comment` in a bash block is not an H1). Fences per CommonMark: track the opening
// fence's character and length; close only on a line with the same character and >= length.

function toLines(text) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

export function fenceRun(line) {
  const m = line.match(/^ {0,3}(`{3,}|~{3,})/);
  if (!m) return null;
  return { char: m[1][0], len: m[1].length };
}

export function headings(text) {
  const out = [];
  let fenceState = null; // { char, len }
  const lines = toLines(text);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = fenceRun(line);
    if (fence) {
      if (fenceState && fence.char === fenceState.char && fence.len >= fenceState.len) {
        fenceState = null;
      } else if (!fenceState) {
        fenceState = fence;
      }
      continue;
    }
    if (fenceState) continue;
    const m = line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/);
    if (m) out.push({ index: i, level: m[1].length, title: m[2] });
  }
  return out;
}

export function baseTitle(title) {
  return title.replace(/\s*[(（][^()（）]*[)）]\s*$/, "").trim();
}

function matches(h, level, title, prefix) {
  return h.level === level && (prefix ? h.title.startsWith(title) : h.title === title);
}

export function hasHeading(text, level, title, { prefix = false } = {}) {
  return headings(text).some((h) => matches(h, level, title, prefix));
}

export function sectionBody(text, level, title, { prefix = false } = {}) {
  const lines = toLines(text);
  const hs = headings(text);
  const i = hs.findIndex((h) => matches(h, level, title, prefix));
  if (i === -1) return null;
  const next = hs.slice(i + 1).find((h) => h.level <= level);
  return lines.slice(hs[i].index + 1, next ? next.index : lines.length).join("\n");
}

export function splitByLevel(text, level) {
  const lines = toLines(text);
  const chunks = [];
  let current = { title: null, level: 0, heading: null, start: 0 };
  for (const h of headings(text).filter((x) => x.level === level)) {
    chunks.push({ ...current, lines: lines.slice(current.start, h.index) });
    current = { title: h.title, level: h.level, heading: lines[h.index], start: h.index + 1 };
  }
  chunks.push({ ...current, lines: lines.slice(current.start) });
  return chunks.map(({ start, ...c }) => c);
}

export function sectionSizes(text) {
  return splitByLevel(text, 2)
    .map((c) => ({
      title: c.title ?? "(preamble)",
      bytes: Buffer.byteLength([...(c.heading ? [c.heading] : []), ...c.lines].join("\n") + "\n"),
    }))
    .sort((a, b) => b.bytes - a.bytes);
}
