import test from "node:test";
import assert from "node:assert/strict";
import { parseRoster, rosterLine, findAccount, ROSTER_NOTE } from "../scripts/lib/roster.js";

const md = (...lines) => ["# demo", "", "## Roster", "", ...lines, "", "## Next", "", "- `ignored` — human: nobody", ""].join("\n");

test("the three forms parse, with the maintainer mark on human and shared lines", () => {
  const r = parseRoster(md(
    "- `real-stanyan` — human: stanyan — maintainer",
    "- `RicksZhang` — human: stanyan",
    "- `DamianBuilds-ai` — shared: Damian",
    "- `stanyan-agent` — agent, run by stanyan",
  ));
  assert.equal(r.found, true);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.entries.map(({ login, kind, person, maintainer }) => [login, kind, person, maintainer]), [
    ["real-stanyan", "human", "stanyan", true],
    ["RicksZhang", "human", "stanyan", false],
    ["DamianBuilds-ai", "shared", "Damian", false],
    ["stanyan-agent", "agent", "stanyan", false],
  ]);
});

test("people are distinct persons on human and shared lines; more than one is multi-human", () => {
  const one = parseRoster(md("- `a` — human: Ann — maintainer", "- `a2` — shared: Ann", "- `bot` — agent, run by Bob"));
  assert.deepEqual(one.people, ["Ann"]);
  assert.equal(one.multiHuman, false);
  const two = parseRoster(md("- `a` — human: Ann — maintainer", "- `b` — shared: Bob"));
  assert.deepEqual(two.people, ["Ann", "Bob"]);
  assert.equal(two.multiHuman, true);
});

test("an ASCII ' - ' separator parses like the em dash", () => {
  const r = parseRoster(md("- `a` - shared: Ann - maintainer", "* `bot` - agent, run by Ann"));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.entries.map((e) => [e.login, e.kind, e.person, e.maintainer]), [
    ["a", "shared", "Ann", true],
    ["bot", "agent", "Ann", false],
  ]);
});

test("prose, notes, blank lines and fenced blocks in the section are ignored", () => {
  const r = parseRoster(md(ROSTER_NOTE, "", "Some prose.", "```", "- not an entry", "```", "- `a` — shared: Ann — maintainer"));
  assert.deepEqual(r.errors, []);
  assert.equal(r.entries.length, 1);
});

test("a list item that matches no form is an error naming the line; nothing is guessed", () => {
  for (const bad of [
    "- real-stanyan — human: stanyan",          // no backticks
    "- `a` — owner: Ann",                        // unknown kind
    "- `a` — human:",                            // no person
    "- `bot` — agent, run by Ann — maintainer", // an agent can't be a maintainer
    "- `a b` — human: Ann",                      // space in login
  ]) {
    const r = parseRoster(md(bad));
    assert.equal(r.errors.length, 1, bad);
    assert.match(r.errors[0], /"## Roster": can't read/, bad);
    assert.ok(r.errors[0].includes(bad.trim()), bad);
    assert.equal(r.entries.length, 0, bad);
  }
});

test("a login listed twice, in any case, is an error", () => {
  const r = parseRoster(md("- `Octo` — human: Ann — maintainer", "- `octo` — agent, run by Ann"));
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /`octo` is listed twice/);
});

test("a <placeholder> login is flagged", () => {
  const r = parseRoster(md("- `<maintainer>` — shared: <maintainer> — maintainer"));
  assert.deepEqual(r.errors, []);
  assert.equal(r.placeholder, true);
  assert.equal(r.entries[0].placeholder, true);
});

test("no section: found is false and nothing else is reported", () => {
  const r = parseRoster("# demo\n\n## Maintainer\n\nGitHub account: `octo`\n");
  assert.equal(r.found, false);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.entries, []);
});

test("rosterLine renders each form so parseRoster reads it back", () => {
  const lines = [
    rosterLine("a", "human", "Ann", { maintainer: true }),
    rosterLine("b", "shared", "Bob"),
    rosterLine("bot", "agent", "Ann"),
  ];
  assert.deepEqual(lines, [
    "- `a` — human: Ann — maintainer",
    "- `b` — shared: Bob",
    "- `bot` — agent, run by Ann",
  ]);
  const r = parseRoster(md(...lines));
  assert.deepEqual(r.errors, []);
  assert.equal(r.entries.length, 3);
});

test("findAccount matches logins case-insensitively", () => {
  const r = parseRoster(md("- `Real-Stanyan` — human: stanyan — maintainer"));
  assert.equal(findAccount(r, "real-stanyan").login, "Real-Stanyan");
  assert.equal(findAccount(r, "someone"), null);
});
