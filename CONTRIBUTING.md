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

**Branch per piece of work**, named `<type>/<slug>` — `feat/`, `fix/`, `docs/`, `chore/`, lower
case, hyphenated. Phase work keeps the `feat/phase-N-description` convention. Claude names the
branch; never accept an auto-generated name.

**Never commit or push to `main` directly** — everything merges through a PR, documentation
included.

**Parallel sessions each get a worktree, outside the repository:**

```bash
git worktree add C:/Dev/.worktrees/task-planner/<slug> -b <type>/<slug> origin/main
```

Never nest a worktree inside the repo — [KB.md](KB.md) #30 explains what breaks. `.claude/worktrees`
is the harness's own; leave it gitignored and clean it up when sessions end.

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
   edit §"Where we are".

Do **not** add `merge=union` to `.gitattributes` for the documents. Union merge interleaves both
sides silently, and in a document where corrections supersede earlier claims, silent
interleaving produces exactly the failure these rules exist to prevent.

**Run `npm run check:docs` before reporting anything finished.**
