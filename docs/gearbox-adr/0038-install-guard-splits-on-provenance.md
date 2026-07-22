# ADR-0038: install's existing-AGENTS.md guard splits on provenance

- Date: 2026-07-22
- Status: accepted
- Related: ADR-0022 (gearbox-install), ADR-0026 (pull-triggered backfill — the "onboarded → update" path), ADR-0031 (dual ADR directories — one of the fingerprint companions)

## Context

`gearbox-install` refuses to run when the target already has an `AGENTS.md`, with a message assuming the file was Gearbox-made ("onboarded projects use gearbox-update"). But `AGENTS.md` is an industry convention — Claude Code, Cursor, Codex, Zed all auto-read it — so the existing file may be **hand-written**, never touched by Gearbox. For those projects the old message was wrong twice: they aren't onboarded (`gearbox-update` dead-ends too — no `docs/gearbox-adr/`), and their file is a hand-authored asset with no template to rebuild it from. Net effect: hand-written-AGENTS.md projects had no adoption path at all.

## Decision

The guard stays a hard refusal in both cases — it only splits the **advice** by provenance:

- **Fingerprint found** (Gearbox-made): unchanged message — use `gearbox-update` to backfill.
- **No fingerprint** (hand-written): new message — this file is the project's own asset and the tool will never touch it; adoption path is `mv AGENTS.md AGENTS.md.bak` → re-run install → merge the project's rules from the `.bak` into the generated Hard rules / Tech stack sections.

Fingerprint = any of: the `## Working agreement (multi-agent)` anchor in the file (present in every Gearbox-generated AGENTS.md; upstream `check-gearbox.js` guards the anchor against renames), a `.gearbox-version` stamp, or a `docs/gearbox-adr/` directory. All three are tool-written; a hand-authored file matching any of them by accident is implausible.

Direction principle the message encodes: **the user's `AGENTS.md` stays the single entry point, and Gearbox content merges into it** — never a parallel rule file. The root `AGENTS.md` filename is the one hard, zero-cost loading guarantee agent tools provide; anything Gearbox ships must end up inside it.

## Considered, not adopted

- **Overwrite prompt (ask, then rm + reinstall on yes)** — turns the destructive path into the low-friction default. The majority hitting this guard want an upgrade and ran the wrong tool; a y/n prompt lures them into deleting project memory, and a pty-driven agent may auto-answer `y`. The interactive-prompt precedent (ADR-0036) is not symmetric: its worst case is a leftover placeholder, this one's worst case is data loss. Destructive intent must stay outside the tool (manual `mv`/`rm`) or, if real demand appears, behind an explicit auditable `--force` flag — never behind an interactive question.
- **Renaming the generated file to `GEARBOX-AGENTS.md` + a "please also read the user's AGENTS.md" note** — no tool auto-reads that filename, so the protocol file degrades from guaranteed-loaded to hoped-for; the user's `AGENTS.md` must still be edited to point at it (the dependency survives, inverted); two rule files with undefined conflict semantics kill the single-source-of-truth premise; and a rename is a major bump (ADR-0023) with every tooling anchor retargeted.
- **Auto-merge into a hand-written AGENTS.md** — writing generated sections into someone's hand-authored file is high-risk, low-payoff; the back-up-and-merge instruction keeps the human in charge of the merge. YAGNI until real demand.

## Consequences

- Hand-written-AGENTS.md projects now get a correct, actionable adoption path instead of a misleading pointer at a tool that also fails.
- Gearbox-made targets see the same refusal as before (message header tightened to say "a Gearbox AGENTS.md").
- The fingerprint reuses the section anchor already load-bearing for `check-gearbox.js`, so a template rename that broke the fingerprint would already be red upstream.
- Tier: **L2** — tool guard branching + messages; no protocol-mechanism reference; AGENTS.md untouched. Version bump: **minor** (new ADR + new tool behavior); collapses into the pending v1.4.0 tag (max-not-sum, ADR-0023 via #69), `package.json` already at 1.4.0.
