# ADR-0002: Use a structural self-check script as the gate (instead of markdownlint / a placeholder)

- Date: 2026-07-17
- Status: accepted

## Context

This repo dogfoods itself — it must satisfy the same "gate all-green before ending a shift" and "CI runs the same commands" contract that the scaffold's `AGENTS.md` imposes on downstream projects. But the repo is all `.md` files, with no app code to test. Three candidates:

1. **Leave a placeholder** (example commands like `npx vitest run`) — CI would stay red forever, directly violating the rule the scaffold itself sets. Rejected.
2. **markdownlint** — only checks formatting, can't test the structural contract (whether `CLAUDE.md` is still `@AGENTS.md`, whether load-bearing section anchors got renamed, whether a `HANDOFF.md` quietly appeared). Coverage insufficient.
3. **Structural self-check script** — zero dependencies (uses only `node:fs`), asserts the scaffold's structural contract holds.

## Decision

Use `scripts/check-scaffold.js` as the gate. It asserts:

- Required files are all present (AGENTS.md / CLAUDE.md / CONTEXT.md / README.md / ci.yml / ADR template)
- `CLAUDE.md` is exactly `@AGENTS.md` (the empty-shell contract — the physical guarantee that rules live in exactly one place)
- `AGENTS.md` contains every load-bearing section anchor (guards against a rename silently breaking the protocol)
- `AGENTS.md` does not contain `HANDOFF` (kept consistent with README's "do not create HANDOFF.md" — the two sources must not conflict)
- The Gate section of `AGENTS.md` actually runs this script (guards against "CI and AGENTS.md each running something different" contract drift)

CI runs `node scripts/check-scaffold.js`; locally the same command applies.

## Consequences

- **Cost**: every new structural contract added means this script has to be updated in step. The script itself becomes code that needs maintaining.
- **Payoff**: the gate is genuinely green, the contract is genuinely enforced, dogfooding genuinely holds. If a later person "helpfully" fills in `CLAUDE.md` for real, or swaps the Gate section for a different command, CI turns red on the spot.
- **Boundary**: this only verifies structure, not content quality. Placeholders like `<project name>` are meaningless for **this** repo (but should stay, since this is a template) — the script deliberately ignores that. It governs "the template's structure is intact," not "this repo has filled everything in."
- If this repo ever grows real application code (e.g. the scaffold becomes an `npx create`-able tool), a future ADR-000X should layer on real tests rather than modifying this script.
