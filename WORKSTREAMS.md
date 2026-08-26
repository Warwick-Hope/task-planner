# Workstreams — who is working on what, right now

More than one Claude Code session works this repository at a time. This file is the claim
board. It exists because on **26 Aug 2026** two sessions ran in `C:\Dev\task-planner` at once:
one read `PLAN.md` §"Where we are", spent forty minutes on a design, and went to write it back
— by which time the other had committed twice, opened PR #18 and rewritten that same section.
Neither was warned, because nothing was looking.

**The claim board is the second line of defence, not the first.** The first is a working tree
of your own — see [CONTRIBUTING.md](CONTRIBUTING.md) §"Two sessions at once". Git isolates a
*branch with its own working tree*; two sessions sharing one directory share one HEAD, one
index and one set of files, and no amount of claiming fixes that.

**Starting work:** run `npm run session`, read the table below, then add your row in your first
commit. If your task overlaps a row that is already there, say so and pick something else, or
narrow your claim to a different section.

**Claim sections, not whole files.** Two sessions can both edit `PLAN.md`; they cannot both
edit §"Where we are".

| Claimed | Branch | What it is doing | Sections it owns |
|---|---|---|---|
| 2026-08-26 | `docs/prod-migration-4-3` | Recording that 4.3's migration is now applied to prod | `PLAN.md` §"Where we are" item 11, §Open items 2 |

**Current position and what is next:** Current position and what is next: [PLAN.md](PLAN.md) §"Where we are, and
what's next".

> **Remove your row in the last commit before you mark the PR ready** — not after merging.
> Squash-merging deletes the branch, and `npm run check:docs` fails on a claim naming a branch
> that no longer exists. It also fails on a claim more than two days old. Both are the check
> working: a board that keeps dead rows is a board nobody believes, and a board nobody believes
> is worse than no board, because it is consulted and then ignored.

## Recently finished, for context

| Landed | What it was |
|---|---|
| 2026-08-26 | **PR #20** — the Claude connector written into the plan as 4.8–4.11, and Phase 5.6 narrowed to the unattended sweep |
| 2026-08-26 | **PR #18** — web push for task assignments. Phase 4.3 in part; scheduled reminders deliberately excluded |
| 2026-08-26 | The two-session collision that produced this file, `npm run session` and the worktree rules in `CONTRIBUTING.md` ([KB.md](KB.md) #39) |
| 2026-08-25 | **PRs #15, #16, #17** — the bottom tab bar, the install offer, the invitation link, and 4.2 signed off after a real handset session |
| 2026-08-25 | **PRs #8–#14** — Playwright suite, consolidation refactor, RLS `initplan` rewrite, mobile pass, document retrofit, PWA |
