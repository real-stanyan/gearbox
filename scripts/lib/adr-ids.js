// ADR IDs (ADR-0052): ADR files grouped by their numeric ID, and the list of the duplicate groups a
// repo already had when it adopted issue-numbered ADRs — docs/adr/older-duplicates.md. The v1 → v2
// migration (gearbox-update) and install write that list on arrival, and nothing writes it later; the
// protocol check reads it: a listed group warns, any other duplicate is an error.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const OLDER_DUPLICATES_PATH = "docs/adr/older-duplicates.md";

const OLDER_DUPLICATES_INTRO =
  "These ADR numbers were already used by more than one file when this repo adopted issue-numbered ADRs (ADR-0052). References to them are ambiguous, and they stay as they are — renumbering would break those references. The protocol check warns about these groups once; any other duplicate ADR number is an error. Don't add new groups here: name a new ADR after its issue instead.";

// ADR files in `dir` grouped by their numeric ID: "0074-x.md" and "74-y.md" are both ADR-74. Only
// groups of two or more come back, ordered by ID, file names sorted. A file without a leading number
// (README, notes, the older-duplicates list) isn't an ADR, and a `dir` that isn't a directory holds none.
export function duplicateAdrIds(root, dir) {
  const abs = join(root, dir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
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

// The list's `- ADR-<id>: <file>, <file>` lines, as ID → the file names they record; any other line
// is prose. Empty when there is no list.
export function readOlderDuplicates(root) {
  const path = join(root, OLDER_DUPLICATES_PATH);
  const groups = new Map();
  if (!existsSync(path) || !statSync(path).isFile()) return groups;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^- ADR-(\d+): (.+)$/);
    if (!m) continue;
    const id = Number(m[1]);
    if (!groups.has(id)) groups.set(id, new Set());
    for (const name of m[2].split(",")) if (name.trim()) groups.get(id).add(name.trim());
  }
  return groups;
}

// The list as the arrival writes it: the intro, then one line per group of duplicateAdrIds.
export function renderOlderDuplicates(groups) {
  return `${[OLDER_DUPLICATES_INTRO, "", ...groups.map(({ id, files }) => `- ADR-${id}: ${files.join(", ")}`)].join("\n")}\n`;
}
