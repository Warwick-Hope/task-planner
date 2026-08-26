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
| 26 Aug 2026 | `docs/4-10-live` | Recording 4.10 live on prod — the migration is applied, and what "up to date" hid | `PLAN.md` §"Where we are" item 15, §Phases 4.10, §Open items 13; `KB.md` §Supabase and migrations |

Current position and what is next: [PLAN.md](PLAN.md) §"Where we are, and what's next".

> **Remove your row in the last commit before you mark the PR ready** — not after merging.
> Squash-merging deletes the branch, and `npm run check:docs` fails on a claim naming a branch
> that no longer exists. It also fails on a claim more than two days old. Both are the check
> working: a board that keeps dead rows is a board nobody believes, and a board nobody believes
> is worse than no board, because it is consulted and then ignored.

## Why there is no history table here

There was one — "Recently finished, for context", a row per merged PR. It came out on
**26 Aug 2026** after conflicting on three consecutive pull requests. Every session appended to
the top of the same table, so any two open PRs collided on the same four lines by construction,
and merging one guaranteed the other needed a rebase. #21 and #22 each hit it twice.

It was also the third copy of something already written down: [PLAN.md](PLAN.md) §"Where we are"
carries the narrative, and `git log --oneline` carries the rest. The claim table above has never
conflicted, because a claim is added and removed by one session at a time — which is the
difference worth remembering if a history table is ever proposed again.
