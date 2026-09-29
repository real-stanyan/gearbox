// Known v1 upstream text (ADR-0050 migration): which lines of a v1 AGENTS.md / CONTEXT.md came
// from Gearbox rather than from the project. Shipped as hashes (v1-known-lines.json), so the
// package carries a fingerprint of the old protocol text, not the text itself.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const KNOWN_PATH = join(dirname(fileURLToPath(import.meta.url)), "v1-known-lines.json");
export const SEPARATOR_ROW = /^\|?\s*:?-{3,}/;

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

export function buildKnown(texts) {
  const lines = new Set();
  const terms = new Set();
  for (const text of texts) {
    for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
      const n = normalizeKnownLine(raw);
      if (n) lines.add(knownLineHash(n));
    }
    for (const t of tableTerms(text)) terms.add(t);
  }
  return { lines, terms };
}

export function serializeKnown(known, sources) {
  return JSON.stringify({ format: 1, sources, lines: [...known.lines].sort(), terms: [...known.terms].sort() }) + "\n";
}

export function loadKnown(path = KNOWN_PATH) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  return { lines: new Set(data.lines), terms: new Set(data.terms), sources: data.sources };
}
