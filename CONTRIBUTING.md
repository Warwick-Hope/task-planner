# Contributing — how to work in this repo

Two facts drive every rule below. Nothing here makes sense without them.

1. **A push to `main` is a production deploy.** Vercel publishes
   <https://task-planner-nine-sigma.vercel.app> on every push to `main`, in about two minutes,
   with no staging step.
2. **GitHub cannot enforce any of this.** The repo is private on a free personal plan, so
   server-side branch protection is unavailable and the `verify` check cannot be *required*.
   Every rule below is convention plus a local hook. A red `verify` merged to `main` goes
   straight to production.

## One-time setup, per clone

```bash
npm install
npm run setup:hooks
```

`setup:hooks` does three things that are not automatic and each bite differently:

- `core.hooksPath .githooks` — installs the `pre-push` hook. Without it, nothing stops a direct
  push to `main` and nothing catches a wrong GitHub account.
- `core.longpaths true` — Windows path length.
- `credential.https://github.com.username Warwick-Hope` — pins the GitHub account for this repo.
  **Read [KB.md](KB.md) #27 before touching anything to do with a `403` on push.**

Also copy `.env.local` in — it is untracked, and both the dev server and the Supabase CLI need
it. [KB.md](KB.md) §Environment lists what belongs in it.

Git identity is repo-local: `user.email = warwickhope93@gmail.com`,
`user.name = Warwick-Hope`. The **global** git config is the Plant Plan identity — never change
global to fix this repo.

## Starting a piece of work

**Run `npm run session` first.** It prints which working tree you are in, every other working
tree and whether it has uncommitted work, how far behind `origin/main` you are, the open PRs,
and the claim board. A `SessionStart` hook in `.claude/settings.json` runs it automatically, so
in practice you read it rather than run it — but run it by hand after a long gap, because the
answer changes while you think.

**Branch per piece of work**, named `<type>/<slug>` — `feat/`, `fix/`, `docs/`, `chore/`, lower
case, hyphenated. Phase work keeps the `feat/phase-N-description` convention. Claude names the
branch; never accept an auto-generated name.

**Never commit or push to `main` directly** — everything merges through a PR, documentation
included.

## Two sessions at once

**Git handles concurrent work. It does not handle two sessions in one directory.** Its unit of
isolation is a branch *with its own working tree* — one HEAD, one index, one set of files on
disk. Two Claude sessions in `C:\Dev\task-planner` are not two contributors; they are two hands
on one keyboard, and GitHub never sees the conflict because it never gets that far. This is not
theory: it happened on 26 Aug 2026 and cost a session's work ([KB.md](KB.md) #39).

**So: one session, one working tree. No exceptions, including "this will only take a minute".**

```bash
git fetch origin
git worktree add C:/Dev/.worktrees/task-planner/<slug> -b <type>/<slug> origin/main
cp .env.local C:/Dev/.worktrees/task-planner/<slug>/.env.local
```

**A new worktree has no `node_modules`**, so `npm run lint`, `build` and `dev` all fail with
`'next' is not recognized` until you deal with it. Either `npm install` in the worktree, or —
faster, and no second copy on disk — junction it to the main checkout's. A junction needs no
administrator rights on Windows:

```powershell
New-Item -ItemType Junction `
  -Path   C:\Dev\.worktrees\task-planner\<slug>\node_modules `
  -Target C:\Dev\task-planner\node_modules
```

Worktrees the harness creates itself get this from `worktree.symlinkDirectories` in
`.claude/settings.json`; one made by hand with `git worktree add` does not.

- **Branch from `origin/main`, not from local `HEAD`** — the shared checkout is often sitting on
  somebody else's feature branch.
- **Copy `.env.local` in.** It is untracked, so a new worktree has none, and both the dev server
  and the Supabase CLI need it ([KB.md](KB.md) §Environment).
- **Never nest a worktree inside the repo** — [KB.md](KB.md) #30 explains what breaks.
  `.claude/worktrees` is the harness's own; leave it gitignored and clean it up when sessions
  end.
- **Remove it when the work lands:** `git worktree remove C:/Dev/.worktrees/task-planner/<slug>`,
  then `git branch -D <branch>` (`-d` refuses after a squash merge — [KB.md](KB.md) #29).

**Then claim your sections** in [WORKSTREAMS.md](WORKSTREAMS.md), in your first commit. A
worktree stops two sessions overwriting each other's *files*; it does not stop them both
rewriting `PLAN.md` §"Where we are" and meeting as a merge conflict. Claim sections, not files.

**Push the branch as soon as you have claimed.** The guard resolves a claim against
`git ls-remote origin`, not your local branches, so a claim on an unpushed branch fails
`check:docs` with "claims `<branch>`, which no longer exists" — which reads like the work has
landed when it has not even left the machine. Pushing early is right anyway: an unpushed branch
is invisible to every other session's `npm run session`.

**Remove your claim in the last commit before the PR is ready** — the branch dies on squash
merge, and the same check then fails for the real reason.

## While you work

- **Update from `main` by rebasing** (`git pull --rebase origin main`), never by merging.
- **Commit at logical checkpoints**, not every file save, and not in one batch at the end.
  Commit after each completed phase step.
- **Commit format:** `type: short description` — `feat`, `fix`, `chore`, `refactor`, `docs`.
- **Migration files are committed immediately** after they run successfully on dev, in the same
  commit as the `types/index.ts` change they imply.
- **Never commit `.env.local`.**
- End commit messages with:

  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```

Run the checks locally before pushing — finding out locally is faster than finding out in CI:

```bash
npm run lint
npm run build        # also type-checks: noEmit + strict
npm run test:e2e     # not run by CI — see KB.md #21
npm run check:docs   # the documentation guard
```

TypeScript is strict and **`any` is never acceptable**. ESLint and TypeScript errors fail the
build, so `npx tsc --noEmit` locally if in doubt.

## Coding conventions

- All DB calls server-side, via API routes or server components. Client components use Supabase
  for auth and nothing else.
- All API routes under `app/api/`. Shared types in `types/index.ts`. Shared logic in `lib/` —
  see [KB.md](KB.md) #24 before writing a helper that might already exist.
- Components in `components/` — small and single-purpose.
- No inline styles. Tailwind only.

## Opening and merging

```bash
git push -u origin <type>/<slug>
gh pr create --fill
gh pr merge --squash        # the remote branch auto-deletes
```

The `verify` check (lint + build) runs on every PR. It is **advisory in the mechanical sense
and mandatory in practice** — it cannot be required on a free plan, so **wait for it to go green
before merging yourself**.

The repo is squash-only and takes the **PR title as the squash-commit subject and the PR body as
its message** — write the title as an imperative commit subject.

### Cleaning up afterwards

```bash
git branch -D <type>/<slug>              # -d refuses: see KB.md #29
git worktree remove C:/Dev/.worktrees/task-planner/<slug>
```

`-D` rather than `-d` is not carelessness — a squash commit is not an ancestor of the branch it
came from, so `-d` reports a merged branch as unmerged.

### Emergency direct push

For broken production needing an instant revert only:

```bash
TP_ALLOW_MAIN_PUSH=1 git push origin main
```

Say why in the commit message. **No force push, ever.** Reaching for this twice means the branch
model is wrong — fix the model instead.

## Deploying a database migration

Migrations are applied to **dev** first, always, and pushed to **prod** when the change merges.

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<value from .env.local>"
$env:SUPABASE_DB_PASSWORD  = "<the matching database password>"

supabase db push --linked                          # dev — the CLI is linked to dev

supabase link --project-ref ialovkohwdlkpgsrqrjo   # prod
supabase db push --linked
supabase link --project-ref fxczpsznrcxykfsiyvty   # dev — always do this after
```

Three things will catch you out, all in [KB.md](KB.md): `db push` targets the linked project and
takes no project reference (#1); the direct host is IPv6-only, so an IPv4 network needs the
pooler URL (#2); and the CLI's stored login is the wrong account and will hang waiting for a
password you did not set (#5). Read those before your first migration, not after.

**Dry-run against prod first.** Then re-link to dev, and check that you did.

## Working on documents without colliding

The documents are the contended resource, not the code.

1. **Status lives in exactly one place** — [PLAN.md](PLAN.md) §"Where we are, and what's next",
   with its `**Updated:**` stamp moved to the day you change it. Never state status anywhere
   else.
2. **[KB.md](KB.md) is append-only**, numbered from its index, never renumbered. Git merges
   appends cleanly and conflicts on mid-file edits.
3. **Corrections are applied in place, not appended**, with the withdrawal note at the *top* of
   the entry or section. A dead figure left standing with its retraction 200 lines below is how
   the next session quotes it in good faith.
4. **A withdrawn figure goes in the retired-facts registry** in [CLAUDE.md](CLAUDE.md), so it
   cannot come back. `npm run check:docs` fails on any revival.
5. **The decisions log is append-only, with absolute dates** — `25 Aug 2026`, never "today".
6. **Claim the section, not the file.** Two sessions can both edit `PLAN.md`; they cannot both
   edit §"Where we are". The board is [WORKSTREAMS.md](WORKSTREAMS.md).
7. **Re-read a shared section immediately before you edit it** — not at the start of the
   session. Reading `PLAN.md` and writing it back forty minutes later is how the 26 Aug
   collision happened, and the gap is where the other session's work lands
   ([KB.md](KB.md) #39). `git fetch && git log origin/main..HEAD --oneline` is the cheap check.
8. **Take a `KB.md` number from `origin/main`, not from your branch.** Two branches both
   appending "#39" merge cleanly when the entries land in different sections, and you get two
   #39s. `npm run check:docs` catches it as `duplicate-kb-entry` — on the *second* PR. If that
   is yours, renumber yours; the merged one keeps the number, because other documents already
   cite it.

Do **not** add `merge=union` to `.gitattributes` for the documents. Union merge interleaves both
sides silently, and in a document where corrections supersede earlier claims, silent
interleaving produces exactly the failure these rules exist to prevent.

**Run `npm run check:docs` before reporting anything finished.**
