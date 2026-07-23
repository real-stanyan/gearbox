# ADR-0048: Parallel shifts in multi-human repos — lanes, per-lane handoffs, repo-level terminals

- Date: 2026-07-23
- Status: accepted
- Related: ADR-0005 (handoff lives in an open issue), ADR-0007 (merge rules), ADR-0009 (terminal shift), ADR-0028 (version held to latest tag), ADR-0042 (multi-human L1 path), ADR-0044 (frontier claiming), ADR-0046 (shift-start sync), ADR-0047 (claim = assignment)

## Context

The protocol was written serial: "normally only one shift is present at a time" (ADR-0007 leans on this premise to make second-agent review optional), one open handoff issue as the single baton (ADR-0005), and a terminal declaration meaning "no next shift, ever" (ADR-0009). Multi-human repos run shifts in parallel as the norm, which breaks three things: "the open handoff issue" becomes ambiguous when several are open; a shift ending while another runs is not "terminal" in any meaningful sense; and two lanes shipping protocol PRs collide on ADR numbers and the `package.json` version.

Recent pieces already cover the collision-avoidance half: shift-start sync (ADR-0046) kills stale clones, frontier claiming (ADR-0044) narrows what's claimable, claim-as-assignment (ADR-0047) makes claims visible. What was missing is the *lifecycle* half — how batons, terminals, and protocol-change serialization work with more than one live shift.

## Decision

Four rules, gathered in a new AGENTS.md subsection ("Parallel shifts"). Serial single-human repos are untouched — with one live shift every rule below degenerates to the existing behavior.

1. **A lane = one shift + its claimed tasks.** Parallel shifts are allowed iff each works only on frontier tasks it has claimed (ADR-0044/0047). Disjoint claims = disjoint lanes; no additional lock exists or is needed. File-level overlap between lanes resolves in the PR merge like any concurrent development; task-level overlap is prevented at claim time.
2. **Handoff issues become per-lane.** Shift-end still opens one (ADR-0005 shape unchanged), but the body must list the Task issues the lane still owns. A starting shift reads **all** open handoff issues, takes over **at most one** lane — claim its listed tasks (ADR-0047), close its handoff — and leaves the other lanes' handoffs open: closing another live lane's handoff is stealing its baton. A handoff marked **"context only"** (lane finished, nothing transfers) is closed by its first reader after reading.
3. **Terminal declarations are repo-level, not lane-level.** A terminal declaration (ADR-0009) is valid only when no other lane is live — no other open handoff issue, no open task claimed by someone else. A lane ending while others run is just a lane end: close or hand off as usual, no terminal declaration.
4. **Protocol changes serialize at merge time.** Two lanes may each open a protocol PR, but ADR numbers and the version bump are claimed **at merge, not at branch time**: before merging, re-fetch; if a competing protocol PR landed first, renumber the ADR and recompute the version (latest tag + segment — already the rule, ADR-0028) inside your PR, then merge. This turns the collision from a silent double-assignment into a mechanical pre-merge rebase step.

**ADR-0007's premise updates, its conclusion survives.** "Only one shift at a time" was the stated reason review isn't mandatory; that reason is now serial-only. Review stays optional under parallelism because the quality backstop never actually depended on serialization: the CI gate + the maintainer's after-the-fact veto, plus branch protection where configured (ADR-0042). Making review mandatory only in multi-human repos was considered and rejected — it would gate every lane's merge on another human's availability, reintroducing the blocking that ADR-0007 rejected, while the protocol-surface risk it would mitigate is already covered by ADR-0042's comment-path rule and CODEOWNERS-style hardening.

## Consequences

- The serial baton generalizes to a small set of visible batons; the start-of-shift scan cost grows by the number of live lanes (in practice: units, not dozens).
- A lane can stall with its handoff open indefinitely. Accepted: the handoff is visible, timestamped, and lists exactly the tasks it holds — a maintainer can release a stalled lane by unassigning its tasks and closing its handoff (the ADR-0047 stale-claim rule already covers dangling assignments).
- Rule 4 adds one pre-merge check to protocol PRs in parallel repos. Serial repos never hit it.
- Tier = **L2**: all edits land in the collaboration-agreement sections (start/end of shift, PR disposition premise, new subsection) outside any hard-rule marking (ADR-0006/0018); the text references claiming/frontier/handoff mechanics, not the tiering mechanism (ADR-0012). The PR-disposition edit changes a premise sentence, not the rule — behavior unchanged, burden of proof per ADR-0010 met by this ADR.
- Version = **minor** (new protocol clauses + new ADR, ADR-0023).
- **Considered, not adopted**: one shared pinned handoff thread for all lanes (loses close-as-takeover semantics, decays into an unbounded thread, hides per-lane scope); lane locks beyond task claims (directory/file leases — speculative machinery, PR merge already arbitrates file overlap); mandatory review in multi-human repos (see above); a scheduling layer deciding who works next (the protocol coordinates through artifacts, not through a scheduler — claims are the schedule).
