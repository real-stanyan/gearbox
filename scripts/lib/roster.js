// The identity roster (ADR-0053): AGENTS.md's project section "## Roster", one list item per GitHub
// account. Pure — no I/O. The protocol check, install and the v1 → v2 migration all go through this
// module, so they can never disagree about who is who.
import { fenceRun, sectionBody } from "./sections.js";

export const ROSTER_NOTE =
  "> One line per GitHub account: `human: Name` (only that person), `shared: Name` (the person and their agents) or `agent, run by Name`; `— maintainer` marks the accounts whose actions approve L1 (ADR-0053).";

const FORMS =
  "expected `- `login` — human: <person>`, `- `login` — shared: <person>` (either may end `— maintainer`) or `- `login` — agent, run by <person>` (ADR-0053)";
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/;
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+`([^`\s]+)`\s+(?:—|-)\s+(.+?)\s*$/;
const HUMANISH = /^(human|shared):\s*(.+?)(?:\s+(?:—|-)\s+maintainer)?$/;
const MAINTAINER_TAIL = /\s+(?:—|-)\s+maintainer$/;
const AGENT = /^agent,\s*run by\s+(.+)$/;
const isPlaceholder = (login) => /^<.+>$/.test(login);

export function rosterLine(login, kind, person, { maintainer = false } = {}) {
  if (kind === "agent") return `- \`${login}\` — agent, run by ${person}`;
  return `- \`${login}\` — ${kind}: ${person}${maintainer ? " — maintainer" : ""}`;
}

// A person that still holds a dash separator or ends in "maintainer" is a mistyped tail folded into
// the name ("Ann – maintainer", "Ann — Maintainer"): unreadable, never a second person.
const mistyped = (person) => /(^|\s)[—–-](\s|$)/.test(person) || /maintainer$/i.test(person);

function parseItem(line) {
  const m = line.match(ITEM);
  if (!m) return null;
  const [, login, rest] = m;
  const h = rest.match(HUMANISH);
  if (h) return mistyped(h[2]) ? null : { login, kind: h[1], person: h[2].trim(), maintainer: MAINTAINER_TAIL.test(rest) };
  const a = rest.match(AGENT);
  if (a && !MAINTAINER_TAIL.test(rest)) return mistyped(a[1]) ? null : { login, kind: "agent", person: a[1].trim(), maintainer: false };
  return null;
}

export function parseRoster(agentsText) {
  const body = sectionBody(agentsText, 2, "Roster");
  const out = { found: body !== null, entries: [], people: [], multiHuman: false, errors: [], placeholder: false };
  if (body === null) return out;
  const seen = new Set();
  let open = null; // the enclosing ``` / ~~~ block, if any
  for (const line of body.split("\n")) {
    const run = fenceRun(line);
    if (run) {
      if (!open) open = run;
      else if (run.char === open.char && run.len >= open.len) open = null;
      continue;
    }
    if (open || !LIST_ITEM.test(line)) continue;
    const entry = parseItem(line);
    if (!entry) {
      out.errors.push(`"## Roster": can't read \`${line.trim()}\` — ${FORMS}`);
      continue;
    }
    const key = entry.login.toLowerCase();
    if (seen.has(key)) {
      out.errors.push(`"## Roster": \`${entry.login}\` is listed twice — one line per GitHub account (ADR-0053)`);
      continue;
    }
    seen.add(key);
    entry.placeholder = isPlaceholder(entry.login);
    if (entry.placeholder) out.placeholder = true;
    out.entries.push(entry);
  }
  out.people = [...new Set(out.entries.filter((e) => e.kind !== "agent").map((e) => e.person))];
  out.multiHuman = out.people.length > 1;
  return out;
}

export function findAccount(roster, login) {
  const key = String(login).toLowerCase();
  return roster.entries.find((e) => e.login.toLowerCase() === key) ?? null;
}
