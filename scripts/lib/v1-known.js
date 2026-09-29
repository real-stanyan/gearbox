// Known v1 upstream text (ADR-0050 migration): which lines of a v1 AGENTS.md / CONTEXT.md came
// from Gearbox rather than from the project, and which glossary terms (CONTEXT.md table rows)
// are Gearbox's. Shipped as hashes (v1-known-lines.json), so the package carries a fingerprint
// of the old protocol text, not the text itself.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const KNOWN_PATH = join(dirname(fileURLToPath(import.meta.url)), "v1-known-lines.json");
export const SEPARATOR_ROW = /^\|?\s*:?-{3,}/;
const ZH_MAINTAINER = "<维护者>";

export function normalizeKnownLine(line, maintainer = null) {
  let l = line.trim();
  if (maintainer) l = l.split(maintainer).join("<maintainer>");
  return l;
}

export function knownLineHash(normalizedLine) {
  return createHash("sha256").update(normalizedLine).digest("hex").slice(0, 12);
}

export function termKey(cell) {
  return cell.replace(/[*`]/g, "").trim().toLowerCase();
}

export function tableTerms(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.startsWith("|") || SEPARATOR_ROW.test(l)) continue;
    if (SEPARATOR_ROW.test((lines[i + 1] || "").trim())) continue; // header row
    const cell = l.split("|")[1];
    if (cell !== undefined && termKey(cell)) out.push(termKey(cell));
  }
  return out;
}

// Lines are hashed from both files' texts; terms come from the CONTEXT.md texts only. The
// migration deletes glossary rows by term, so a first cell of an AGENTS.md table (its roles
// table has "Task") must not become a term, or a project's own "task" row would be deleted.
export function buildKnown(agentsTexts, contextTexts) {
  const lines = new Set();
  const terms = new Set();
  for (const text of [...agentsTexts, ...contextTexts]) {
    for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
      const n = normalizeKnownLine(raw);
      if (!n) continue;
      lines.add(knownLineHash(n));
      // Chinese-era templates (v1.0.0–v1.3.x) spell the placeholder <维护者>. The migration folds a
      // bound maintainer name to <maintainer> before lookup, whatever the era, so such a line is
      // also known in its <maintainer> form.
      if (n.includes(ZH_MAINTAINER)) lines.add(knownLineHash(n.split(ZH_MAINTAINER).join("<maintainer>")));
    }
  }
  for (const text of contextTexts) for (const t of tableTerms(text)) terms.add(t);
  return { lines, terms };
}

export function serializeKnown(known, sources) {
  return JSON.stringify({ format: 1, sources, lines: [...known.lines].sort(), terms: [...known.terms].sort() }) + "\n";
}

export function loadKnown(path = KNOWN_PATH) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  return { lines: new Set(data.lines), terms: new Set(data.terms), sources: data.sources };
}
