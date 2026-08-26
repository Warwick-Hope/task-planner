# CLAUDE.md

Guidance for Claude Code working in this repository. **This file is the facts card: the things
that prevent mistakes, one line each, with a pointer to where the detail lives.** It
deliberately does not restate `PLAN.md` or `KB.md` — two copies of a fact is how they drift
apart.

## What this is

**Clarity** — a unified personal planning and household coordination app. One login, one
planning system: a personal workspace for horizon-based task planning with AI brain-dump
capture, and a household workspace for shared tasks, cleaning, meals and shopping. The
distinction between the two is visibility and permissions, not separate modes. Next.js 14 on
Vercel, Supabase for data and auth, Anthropic for the brain dump. A personal project on
personal accounts, architected multi-tenant from day one.

**Current status lives in one place: [PLAN.md](PLAN.md) §"Where we are, and what's next".** Read
it before starting anything — do not infer status from this file, from the phase tables, or
from memory.

| Document | What it holds |
|---|---|
| [PLAN.md](PLAN.md) | **The plan.** Status, context, locked decisions, phases, risks, verification, decisions log |
| [KB.md](KB.md) | **Read before any non-trivial task.** 30 numbered gotchas — start at its index. Also holds the environment: project refs, env vars, accounts |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branch model, hooks, commit and PR flow, migration deploys, document rules |
| [WORKSTREAMS.md](WORKSTREAMS.md) | **The claim board.** Who is working on what, right now. Read it before editing a shared document |
| [SCHEMA.md](SCHEMA.md) | The database shape — enums, tables, columns. Not the authority; the migrations are |
| [SECURITY_HARDENING.md](SECURITY_HARDENING.md) | Evidence: the 14 Aug 2026 security review, every finding and what was done about it |
| [README.md](README.md) | Public-facing: what the app is, how to run it locally |

## 🔴 Numbers and facts that are dead — never quote these

| Retired | Status |
|---|---|
| `Auth → Policies` | Wrong location for leaked password protection — it is Authentication → Providers → Email, and it is Pro-plan only, so on the free tier there is nothing to toggle ([KB.md](KB.md) #12) |
| `db push --project-ref` | No such flag — `db push` targets the linked project ([KB.md](KB.md) #1) |
| `role_categories` | Replaced by `categories` in Phase 0 ([SCHEMA.md](SCHEMA.md)) |
| `task_roles` | Dropped 17 Aug 2026 — a pre-Phase-0 leftover with no code and no rows ([SECURITY_HARDENING.md](SECURITY_HARDENING.md)) |
| `Internal task planning web application for Plant Plan Ltd` | Wrong — this is a personal project on personal accounts, for personal and household use ([PLAN.md](PLAN.md) §Context) |
| `An unauthenticated API call gets an HTML login page` | Fixed 26 Aug 2026 — `/api` is exempt from the redirect and answers 401 JSON ([KB.md](KB.md) #37) |
| `4.11 OAuth is polish, deferred until the tools have proved themselves` | Withdrawn 26 Aug 2026 — a pasted token cannot reach claude.ai at all, so 4.11 is what puts the connector on a phone. It follows 4.10 immediately ([KB.md](KB.md) #46) |
| `There is no GET /api/tasks, and nothing lists workspaces` | Both exist as of Phase 4.10 — the connector's tools needed them and the app never had ([PLAN.md](PLAN.md) §"The tool surface") |
| `The brain dump has no quota` | Twenty captures per user per UTC day since Phase 4.10, shared between the textarea and the `capture` tool ([KB.md](KB.md) #48) |
| Phase `5.6 M365 integration` | Retired 26 Aug 2026 — Clarity does **not** integrate with Teams, Outlook, Plaud or Fathom. Claude already connects to all four, so the Claude connector reads them and calls Clarity's tools. 5.6 is now the unattended sweep only ([PLAN.md](PLAN.md) §"The Claude connector") |

Current figures come from [PLAN.md](PLAN.md) §"Where we are" — not from memory, and not from an
older section of any document. If two numbers disagree, say so rather than picking one.

## How to work here

- **Read before acting** — this file, then `PLAN.md` §"Where we are", then only the `KB.md`
  section your task touches, from its index.
- **Corrections are applied in place, not appended.** Fix the sentence that states the wrong
  thing; the withdrawal note goes at the *top* of its section.
- **`KB.md` is append-only** — new entries at the end of their section, numbered from the index,
  never renumbered. Everything cross-references the numbers.
- **The decisions log is append-only, with absolute dates** — `25 Aug 2026`, never "today".
- **When you learn something non-obvious, append a numbered `KB.md` entry** rather than only
  fixing the immediate issue.
- **Run `npm run check:docs` before reporting finished.**
- **One session, one working tree.** More than one session works this repo at a time. Take a
  worktree before editing anything, claim your sections in [WORKSTREAMS.md](WORKSTREAMS.md), and
  re-read a shared section immediately before writing it — not at session start
  ([KB.md](KB.md) #39, [CONTRIBUTING.md](CONTRIBUTING.md) §"Two sessions at once").
- **One step at a time** — confirm before moving to the next phase item.

Branching, commits, PRs and migration deploys are all in [CONTRIBUTING.md](CONTRIBUTING.md).

## The facts that prevent mistakes

- **There is no unit-test runner.** Do not assume Jest or Vitest. The only tests are the
  Playwright e2e suite in [e2e/](e2e/) ([PLAN.md](PLAN.md) §Verification).
- **`supabase db push` has no project-ref flag** — it pushes to the linked project, and the CLI
  is linked to dev. Re-link, push, re-link back ([KB.md](KB.md) #1).
- **The Supabase MCP cannot apply migrations, and points at dev only** ([KB.md](KB.md) #3).
- **Both Supabase projects pause after ~7 days idle** on the free tier. A paused project also
  produces a misleading network error ([KB.md](KB.md) #4, #2).
- **Two GitHub accounts on this machine, and `gh auth switch` is global.** A bare `403` on push
  means the pin, never the switch ([KB.md](KB.md) #27).
- **A push to `main` deploys to production in ~2 minutes**, and `verify` cannot be required
  ([KB.md](KB.md) #28).
- **Build horizon fields through [lib/horizon.ts](lib/horizon.ts)**, never by setting
  `horizon_*` columns directly ([KB.md](KB.md) #22).
- **The status cycle, colour inheritance, task-status toggling, drag sensors and the app shell
  are shared in `lib/` and `components/layout/`** — each was duplicated five or six times and
  had drifted. Add to them ([KB.md](KB.md) #24).
- **`group-hover` controls do not render at all on a touch screen** — show them below `md`
  ([KB.md](KB.md) #26).
- **The service worker caches no user data and registers in production only** — adding pages or
  API responses to it would be a bug, not an improvement ([KB.md](KB.md) #32).
- **A push subscription is a capability** — `push_subscriptions` is owner-only, and cross-member
  sends go through a security definer function that checks both sides ([KB.md](KB.md) #38).
- **An unauthenticated call to any API route gets a 401 JSON** — `/api` is exempt from the login
  redirect as of Phase 4.9, and each route answers for itself ([KB.md](KB.md) #37).
- **`/api/mcp` checks scope per tool, not at the door** — reaching it needs `tasks:read`, and a
  writing tool checks `tasks:write` itself, so a read-only token gets a connector that lists. The
  transport is hand-written JSON-RPC, deliberately, and a tool refusal is a *result* with
  `isError`, never a protocol error ([KB.md](KB.md) #47).
- **The capture quota is counted in [lib/brain-dump.ts](lib/brain-dump.ts)**, not in the route and
  not in the tool — one budget of twenty a day, whichever door the call came through. The e2e
  suite spends from it ([KB.md](KB.md) #48).
- **Task reads and writes go through [lib/tasks-server.ts](lib/tasks-server.ts)** — the routes and
  the connector's tools both call it, and `complete_task` is separate from an update because
  completing advances a recurrence ([KB.md](KB.md) #24, #49).
- **A route is session-only until it names a token scope** — `requireCaller(request)` refuses a
  bearer token; `requireCaller(request, { scope })` accepts one. `/api/tokens` is session-only on
  purpose ([KB.md](KB.md) #45).
- **A bearer token is exchanged for a real user session, never a service-role client** — the
  project's signing key is asymmetric, so we cannot mint one; `SUPABASE_SECRET_KEY` buys it from
  the Auth admin API and RLS stays untouched ([KB.md](KB.md) #44).
- **Icon alpha is per icon, not a setting** — the `purpose: "any"` PNGs need transparent corners,
  the maskable and iOS ones need full-bleed opaque ones. Regenerate with `npm run build:icons`
  and let `e2e/pwa.spec.ts` check it ([KB.md](KB.md) #40).
- **An accepted invitation cannot be revoked** — the row is the record that someone was invited,
  and deleting it would not remove their membership ([KB.md](KB.md) #41).
- **Never call `preventDefault()` on `beforeinstallprompt`** — it suppresses the browser's own
  install offer, which is the one people expect ([KB.md](KB.md) #35).
- **Below `md` the nav is a bottom tab bar** — the first four entries in `PersonalNav`/
  `HouseholdNav` are the tabs, the rest are in the More sheet, and `main` reserves `pb-24` for it
  ([KB.md](KB.md) #34).
- **`manifest.webmanifest`, `sw.js` and `offline.html` are exempt from the middleware matcher** —
  Chrome fetches them with no session, and a 307 to `/login` fails the install silently
  ([KB.md](KB.md) #31).
- **Middleware uses `getUser()`, and `/invite/[token]` is exempt from the login redirect**
  ([KB.md](KB.md) #6, #7).
- **Qualify both sides of every comparison in an RLS subquery** — an unqualified column binds to
  the inner table and silently makes the policy a tautology ([KB.md](KB.md) #8).
- **`auth.uid()` in a policy must be `(select auth.uid())`** ([KB.md](KB.md) #10).
- **The e2e accounts are fixed and shared, the suite is single-worker, and dev has email
  confirmation off while prod has it on** ([KB.md](KB.md) #14, #15).
- **`types/index.ts` is the single source for table shapes** — update it alongside any
  migration.

## Commands

```bash
npm run dev          # dev server on localhost:3000
npm run build        # production build — also type-checks, since noEmit + strict
npm run lint         # ESLint: next/core-web-vitals, next/typescript, prettier
npm run format       # prettier --write .
npm run test:e2e     # Playwright suite; starts the dev server itself
npm run test:e2e:ui  # the same, in Playwright's interactive UI
npm run check:docs   # the documentation guard — run before reporting finished
npm run session      # what else is running: other worktrees, open PRs, claims (KB.md #39)
npm run verify:pwa   # the PWA, against a production build (PLAN.md §Verification)
npm run build:icons  # regenerate the app icons from public/icon.svg
npm run setup:hooks  # one-time, per clone: hooks path, long paths, GitHub account pin
```

CI runs `lint` and `build` on every PR, as the `verify` job. Nothing else is automated.
Migration commands are in [CONTRIBUTING.md](CONTRIBUTING.md) §"Deploying a database migration".

## Layout

```
app/(auth)         sign in, sign up, onboarding
app/(dashboard)    personal workspace: tasks, calendar, plan, brain-dump, mission, roles
app/(household)    household workspace: tasks, cleaning, shopping, meals, rooms, categories
app/api/**         one folder per resource, REST-ish
components/        small, single-purpose; components/layout/AppShell.tsx is the shared chrome
lib/               all shared logic — see KB.md #24 before adding a helper
types/index.ts     every table shape, in one file
middleware.ts      session refresh and auth redirects on every request
supabase/migrations/   every schema change, in order, applied to dev first
e2e/               the Playwright suite — the only tests there are
```

## 🔴 Standing prohibitions

- **Do not change anything in [PLAN.md](PLAN.md) §"Decisions already taken (locked)" without
  asking** — those decisions shape the whole data model, and reopening one by accident is
  expensive.
- **Do not run a destructive operation on prod, ever**, and do not point the MCP at it.
- **Do not use `getSession()`** anywhere — `getUser()` only. `getSession()` trusts the cookie
  without validating it ([KB.md](KB.md) #6).
- **Do not call Supabase from a client component** for anything but auth. All other DB access is
  server-side.
- **Do not use `any`.** TypeScript is strict, and it stays strict.
- **Do not fix a push `403` with `gh auth switch`** — it moves the breakage to the other repo
  ([KB.md](KB.md) #27).
- **Do not edit anything from the shared checkout while another working tree is live.** Take
  your own. `npm run session` says whether one is ([KB.md](KB.md) #39).
- **Do not leave the Supabase CLI linked to prod.** Re-link to dev, then check you did
  ([KB.md](KB.md) #1).
- **Do not commit `.env.local`.**
- **Do not force push**, and do not push to `main` outside the documented emergency path
  ([CONTRIBUTING.md](CONTRIBUTING.md)).
- **Do not state status in this file** — it belongs in [PLAN.md](PLAN.md), and a second copy is
  guaranteed to drift. It already did once, which is why the documents were reorganised.
