# Clarity — Project Intelligence Document

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build (also type-checks, since noEmit + strict)
npm run lint     # next lint (ESLint: next/core-web-vitals, next/typescript, prettier)
npm run format   # prettier --write .
```

No test suite exists in this repo — don't assume Jest/Vitest are configured.

Supabase CLI migrations (dev):

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<value from .env.local>"   # personal account; CLI's stored login is Plant Plan
$env:SUPABASE_DB_PASSWORD  = "<dev database password>"   # else the CLI prompts and hangs in non-interactive shells
supabase db push --linked                                # CLI is linked to dev (fxczpsznrcxykfsiyvty)
```

`db push` has no `--project-ref` flag — it pushes to the linked project. To push to prod, `supabase link --project-ref ialovkohwdlkpgsrqrjo`, push, then re-link back to dev — never leave the CLI pointed at prod. The Supabase MCP cannot apply migrations (no permission), so this is always a CLI step run by Warwick.

## Code architecture

- **Route groups mirror the personal/household split**: `app/(auth)`, `app/(dashboard)` (personal workspace pages: tasks, calendar, plan, brain-dump, mission, roles), `app/(household)` (household workspace pages). API routes live under `app/api/**`, one folder per resource, matching REST-ish conventions (`app/api/tasks/[id]`).
- **Auth/session refresh happens in [middleware.ts](middleware.ts)** — calls `supabase.auth.getUser()` (never `getSession()`, per Supabase SSR guidance) on every request, redirects unauthenticated users to `/login` and authenticated users away from `/login`/`/signup`.
- **Two Supabase client helpers, not interchangeable**: [lib/supabase.ts](lib/supabase.ts) is the browser client (auth only, per the locked architecture rule below); [lib/supabase-server.ts](lib/supabase-server.ts) creates a cookie-aware server client for use in Server Components and API routes. All non-auth DB access must go through the server client.
- **[lib/workspace-server.ts](lib/workspace-server.ts)** resolves a user's personal workspace id — the entry point for scoping any query to "this user's personal data" versus a household workspace id passed explicitly.
- **[lib/horizon.ts](lib/horizon.ts)** is the single source of truth for the 7-level horizon model shared by personal and household tasks: `buildHorizonFields()` derives all coarser fields (year/half/quarter/month/week) from whichever precision the user actually set, `getHorizonReviewStatus()` flags tasks approaching/overdue for re-planning, `horizonSortKey()`/`formatHorizon()` back the list and calendar views. Any new UI that touches horizons should build fields through this module rather than setting horizon_* columns directly, so cascading stays consistent.
- **[lib/recurrence.ts](lib/recurrence.ts)** wraps `rrule` for recurring task patterns and next-occurrence generation on completion.
- **Types**: [types/index.ts](types/index.ts) is the single shared TypeScript source for all DB table shapes — update it alongside any migration.
- **Migrations**: [supabase/migrations/](supabase/migrations/) — every schema change is a committed migration file, applied to dev first (see Commands above), never hand-edited on the dashboard.

See "Architecture decisions (locked — ask before changing)" and the full database schema below for the product-level model (workspaces, categories, task assignment/visibility rules, etc.) before writing code that touches multi-tenancy or RLS.

## What this is

A unified personal planning and household coordination app. One login, one planning system. Personal workspace for individual task planning (horizon-based, AI brain dump, role categories). Household workspace for shared family tasks, cleaning schedules, meal planning, and shopping. The distinction between personal and household is visibility and permissions — not separate modes or apps.

Core differentiator: AI-powered brain dump capture (personal), and seamless task flow between personal and household contexts via shared categories.

Built for personal and household use first. Architected for multi-tenant from day one with a view to wider market later.

---

## Tech stack

- **Frontend/API:** Next.js 14, App Router, TypeScript strict, Tailwind CSS
- **Database/Auth:** Supabase (Postgres, RLS, Supabase Auth)
- **AI:** Anthropic API, Claude Sonnet (server-side only — never expose key client-side)
- **Hosting:** Vercel
- **Key libraries:** `rrule` (recurring tasks), `date-fns` (date logic), `@dnd-kit/core` (drag and drop), `shadcn/ui` (components)
- **Repo:** <https://github.com/Warwick-Hope/task-planner>

---

## Accounts

- **GitHub:** <https://github.com/Warwick-Hope/task-planner> (personal account — Warwick-Hope, two GitHub accounts on this machine: active = Warwick-Hope, secondary = WarwickHope)
- **Supabase:** Personal account — both projects transferred from Plant Plan org, project IDs unchanged
  - **Dev:** fxczpsznrcxykfsiyvty
  - **Prod:** ialovkohwdlkpgsrqrjo
- MCP points at dev only — never touch prod directly
- Never run destructive operations on prod

---

## Environment variables

Never commit `.env.local`. The same variable names are used in both environments — the values differ.

### `.env.local` (local dev — points at DEV Supabase project `fxczpsznrcxykfsiyvty`)

```env
# Dev Supabase
NEXT_PUBLIC_SUPABASE_URL=https://fxczpsznrcxykfsiyvty.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev anon key>

# AI — same key for dev and prod
ANTHROPIC_API_KEY=<anthropic key>

# Local URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase CLI only — NOT used by the app
# Personal account token, works for both projects via --project-ref
# NOTE: The CLI stored login is Plant Plan account. Always pass --token explicitly:
#   supabase db push --project-ref <id> --token <SUPABASE_ACCESS_TOKEN value>
# This avoids disrupting the Plant Plan CLI login.
SUPABASE_ACCESS_TOKEN=<token from supabase.com → Account → Access Tokens>
```

### Vercel environment variables (prod — points at PROD Supabase project `ialovkohwdlkpgsrqrjo`)

Set these in Vercel → Project → Settings → Environment Variables (Production only):

```env
NEXT_PUBLIC_SUPABASE_URL=https://ialovkohwdlkpgsrqrjo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod anon key from Supabase dashboard → Settings → API>
ANTHROPIC_API_KEY=<same anthropic key>
NEXT_PUBLIC_APP_URL=https://<your-vercel-url>.vercel.app
```

---

## Architecture decisions (locked — ask before changing)

- **Workspace model** — every user gets a personal workspace on signup (auto-created). Household workspaces are created explicitly and joined via invitation. All data belongs to a workspace, not directly to a user.
- **workspace_id on all tables** — replaces the old user_id pattern. RLS checks workspace membership, not raw user identity.
- **Visibility via categories** — tasks are visible to household members if their category has `is_shared = true`. Personal categories are private. This is how a task tagged "Family" in a personal brain dump surfaces in the household view — the Family category is marked shared.
- **Horizon model applies everywhere** — both personal and household tasks use the same 7-level horizon fields (year, half, quarter, month, week, day, time_slot). All null = unplanned. Household tasks tend to use day/week end of the scale; longer-term family plans use quarter/year. Same model, same logic, same UI.
- **Calendar is a view not a data model** — the calendar renders tasks that have due_date set. No separate events table for MVP. Dragging on calendar sets due_date on the task.
- **Categories replace role_categories** — same concept, extended. Personal categories (owner_id set) are private to that user. Household categories (owner_id null) are shared across all household members. Categories can be marked is_shared to expose tasks to household members.
- **Assignment flow** — assigning a task to another adult member requires their acceptance (pending → accepted/declined). Assigning to a child profile (non-auth) requires no approval. Either adult owner/member can assign to children.
- **Child/restricted profiles** — non-auth household members (children) stored as household_profiles. Name and avatar only. Cannot log in. Tasks can be assigned to them.
- **Membership tiers** — owner and adult members see all shared household content. Restricted members have limited visibility (for older children with their own login, future use).
- **Minimum horizon** — every task should eventually have at least a quarter-level horizon; fully unplanned tasks (all horizon fields null) are a transient state, not a permanent one. The review prompt system (1.9) surfaces these. Future hardening may enforce a default of "this quarter" on save.
- **Subtasks** — one level deep via parent_task_id. No recursive nesting.
- **Mission/Values** — personal workspace only. Reference layer, not per-task metadata.
- **AI parsing** — Anthropic API called server-side via Next.js API route only.
- **All DB calls server-side** — via API routes or server components. Never call Supabase directly from client components except for auth.
- **Entertaining templates** — out of scope until Phase 5.
- **Recipe steps/method** — out of scope until Phase 5. MVP meal planning = meal name + ingredients list only.
- **Offline-first** — deferred. Revisit for Android phase.
- **Push notifications** — deferred until Phase 4.

---

## Database schema

### Enums

```sql
task_status:      not_started | wip | done | cancelled
workspace_type:   personal | household
member_role:      owner | adult | restricted
task_source:      manual | brain_dump | cleaning | meal | shopping
assignment_status: none | pending | accepted | declined
```

### Tables

**workspaces**
`id, type (workspace_type), name, created_by, created_at`

**workspace_members**
`id, workspace_id, user_id (nullable — null = child profile), role (member_role), display_name, joined_at`

**household_profiles** — non-auth members (children)
`id, workspace_id, name, avatar_colour, created_by, created_at`

**profiles**
`id (ref auth.users), display_name, created_at, updated_at`

**categories** — replaces role_categories

```text
id
workspace_id
owner_id          — null = household-level category; set = personal category for that user
name
colour
is_shared         — true = tasks in this category visible to all household members
sort_order
parent_id         — self-ref, two levels max
created_at
```

#### tasks

```text
id
workspace_id
created_by
assigned_to_user_id      — nullable FK to auth.users
assigned_to_profile_id   — nullable FK to household_profiles
assignment_status        — assignment_status enum, default none
title
notes
status                   — task_status enum, default not_started
priority                 — nullable int 1-3
due_date                 — nullable date
due_time                 — nullable time
horizon_year             — nullable int
horizon_half             — nullable int (1-2)
horizon_quarter          — nullable int (1-4)
horizon_month            — nullable int (1-12)
horizon_week             — nullable date (week start)
horizon_day              — nullable date
horizon_time_slot        — nullable text
is_recurring             — boolean default false
recurrence_rule          — nullable text (rrule string)
recurrence_end_date      — nullable date
parent_task_id           — nullable self-ref
source                   — task_source enum default manual
source_id                — nullable uuid (FK to room, meal etc.)
category_id              — nullable FK to categories
created_at
updated_at
```

**non_negotiables** — 3 per user per day
`id, user_id, workspace_id, task_id, date, sort_order, created_at`

**missions**
`id, user_id, content, is_active, created_at`

**values**
`id, user_id, name, description, sort_order, created_at`

**rooms** — household workspace only
`id, workspace_id, name, sort_order, created_at`

**meals** — household workspace only, MVP = name + notes only
`id, workspace_id, name, notes, created_at`

**meal_plan** — assigns meals to days
`id, workspace_id, meal_id, planned_date, servings, created_at`

**ingredients**
`id, meal_id, name, quantity, unit, created_at`

#### shopping_list

```text
id
workspace_id
name
quantity          — nullable
unit              — nullable
shop_tag          — nullable text (e.g. Tesco, Asda)
source            — manual | meal
source_id         — nullable uuid (FK to meal)
is_purchased      — boolean default false
added_by          — FK to auth.users
created_at
```

**household_invitations**
`id, workspace_id, email, role (member_role), token, expires_at, accepted_at, created_by, created_at`

---

## Coding conventions

- TypeScript strict — no `any` types, ever
- All DB calls server-side via API routes or server components
- All API routes in `/app/api/`
- Shared types in `/types/index.ts`
- Supabase client helpers in `/lib/supabase.ts` (browser) and `/lib/supabase-server.ts` (server)
- Components in `/components` — small, single-purpose
- No inline styles — Tailwind only
- Commit format: `type: short description` (feat/fix/chore/refactor/docs)
- Commit at logical checkpoints — not every file save
- Never commit `.env.local`
- One step at a time — confirm before moving to next phase item

---

## Git workflow

A push to `main` is a production deploy — Vercel publishes `task-planner-nine-sigma.vercel.app` on every push, with no staging step. The repo is private on a free personal plan, so server-side branch protection is unavailable; a local pre-push hook is the substitute.

### One-time setup, per clone

```bash
npm run setup:hooks   # core.hooksPath → .githooks (pre-push refuses main); core.longpaths true
```

### The flow

- **Branch per piece of work** — `<type>/<slug>`: `feat/` `fix/` `docs/` `chore/`, lower case, hyphenated. Phase work keeps the `feat/phase-N-description` convention. Claude names the branch — never auto-generated worktree names.
- **Never commit or push to `main` directly** — everything merges through a PR, docs included.
- **Parallel Claude chats each get a worktree OUTSIDE the repo**: `git worktree add C:/Dev/.worktrees/task-planner/<slug> -b <type>/<slug> origin/main`. Never nest a worktree inside the repository (`.claude/worktrees` is the harness's own — leave it gitignored, clean it up when sessions end). Copy `.env.local` into a new worktree — it's untracked and dev + CLI need it.
- **Update from `main` by rebasing** (`git pull --rebase origin main`), never by merging.
- **Commit after each completed phase step** — `type: short description` format; don't batch steps.
- **Migration files always committed** immediately after they run successfully on dev.

### Opening and merging a PR

```bash
git push -u origin <type>/<slug>
gh pr create --fill
gh pr merge --squash        # remote branch auto-deletes
```

- The `verify` check (lint + build) runs on every PR. It cannot be *required* on a free plan, so **wait for it to go green before merging** — a red verify merged to `main` goes straight to production.
- The repo is squash-only and takes the **PR title as the squash-commit subject, PR body as its message** — write the title as an imperative commit subject.
- After the squash merge: `git branch -D <type>/<slug>` locally (`-d` refuses — squash commits aren't ancestors of `main`), then `git worktree remove` + delete the folder if one was used.
- **No force push.** Emergency direct push to `main` (broken prod needing an instant revert): `TP_ALLOW_MAIN_PUSH=1 git push origin main` — say why in the commit message. Reaching for it twice means the branch model is wrong; fix it instead.
- **Git identity** — repo-local config: `user.email = warwickhope93@gmail.com`, `user.name = Warwick-Hope`; credential helper is repo-local `gh` with active account Warwick-Hope. Global git config is Plant Plan — never change global.

---

## Deployment workflow

**Flow:** branch → test locally → PR → verify green → squash merge → Vercel auto-deploys `main` (~2 min)

- `main` branch = production. Only merge when tested and happy.
- Vercel project: `task-planner-nine-sigma.vercel.app` (team: warwick-hope-pvt-projects)
- ESLint and TypeScript errors will fail the build — run `npx tsc --noEmit` locally before pushing if in doubt

### New database migrations
Always test on dev first, then push to prod when merging to main:

```
# 1. Link to prod
supabase link --project-ref ialovkohwdlkpgsrqrjo

# 2. Push migrations (SUPABASE_ACCESS_TOKEN is the personal account token in .env.local)
supabase db push --linked

# 3. Re-link back to dev — always do this after
supabase link --project-ref fxczpsznrcxykfsiyvty
```

Set `$env:SUPABASE_ACCESS_TOKEN = "<value from .env.local>"` before running these commands (the stored CLI login is Plant Plan — the env var overrides it for that session).

---

## Phased build plan

### Phase 0 — Schema migration (do this before anything else)

Goal: rebuild dev database on the new combined schema. Wipe dev, do not touch prod.

- [x] 0.1 Drop existing dev tables and recreate enums: `task_status`, `workspace_type`, `member_role`, `task_source`, `assignment_status`
- [x] 0.2 Create `workspaces` and `workspace_members` tables with RLS
- [x] 0.3 Create `household_profiles` table with RLS
- [x] 0.4 Create `profiles` table (unchanged structure, updated RLS)
- [x] 0.5 Create `categories` table (replaces `role_categories`) with RLS
- [x] 0.6 Create `tasks` table with all new fields and RLS
- [x] 0.7 Create `non_negotiables` table with RLS
- [x] 0.8 Create `missions` and `values` tables with RLS
- [x] 0.9 Create `rooms`, `meals`, `meal_plan`, `ingredients` tables with RLS
- [x] 0.10 Create `shopping_list` table with RLS
- [x] 0.11 Create `household_invitations` table with RLS
- [x] 0.12 Update `/types/index.ts` — full TypeScript types for all tables
- [x] 0.13 Update all existing app code to use new schema (workspace_id, categories instead of role_categories, etc.)
- [x] 0.14 Smoke test: auth, onboarding, role/category CRUD, task entry, task list all working on new schema

---

### Phase 1 — Personal workspace complete

Goal: everything the original task planner was building, on the new schema. Personal workspace fully functional for one user.

Completed from previous build:

- [x] 1.1 Auth — email/password sign up and sign in, protected routes, session handling
- [x] 1.2 RLS — all tables have policies (will be rewritten in Phase 0)
- [x] 1.3 Onboarding — 3-step wizard: display name, categories, mission
- [x] 1.4 Category management — CRUD, two-level hierarchy, colour picker (was role_categories)
- [x] 1.5 Manual task entry — title, notes, horizon fields, category tags, status
- [x] 1.6 Task list view — filter by status/category/unplanned, horizon sort, status toggle, delete

Still to build:

- [x] 1.7 AI brain dump — text input, submits to `/api/brain-dump`, Sonnet parses to structured tasks, user reviews and confirms before saving
- [x] 1.8 Horizon logic — cascade clear on horizon change, derive upward fields from most precise set field
- [x] 1.9 Review prompts — surface tasks needing horizon resolution as dates approach
- [x] 1.10 Non-negotiables — set 3 per day per user, visible on dashboard, completion tracking, resets daily
- [x] 1.11 Calendar view — tasks with due_date on calendar, drag to move/assign due_date
- [x] 1.12 Recurring tasks — rrule-based recurrence, UI to set pattern, auto-generate next occurrence on completion
- [x] 1.13 Mission and values UI — read/write personal mission statement and values list
- [x] 1.14 Dashboard — daily home screen: today's tasks, non-negotiables, upcoming, quick links
- [ ] 1.15 AI planning assistant — conversational assistant with read access to personal workspace (tasks, horizons, categories, mission/values); surfaces insights, proposes changes (move task, set horizon, flag stale items), user approves before any write; build after dashboard so there's meaningful context to reason over
- [ ] 1.16 Brain dump AI steering — prime the Sonnet prompt with user's categories, horizon preferences, and workspace context per request so suggestions are smarter and more personalised; also richer per-task editing in the review step before confirm
- [ ] 1.17 Calendar time slots — tasks can have a time + duration; day view shows 15-min interval slots; drag to extend duration; tasks with only a date appear as all-day
- [ ] 1.18 UI density pass — action buttons on task rows (Edit, pin ◎, delete) are small; review touch target sizes and visual weight throughout; consider larger hit areas and clearer hover states
- [x] 1.19 Horizon Planner — new `/plan` page; the central planning screen. Replaces/extends the current calendar sidebar concept. Views: Year → Quarter → Month → Week; each view shows subdivisions as droppable buckets; sidebar shows tasks "unplanned at this level" (i.e. assigned to the current period but not yet broken down to the next precision); unplanned pool (no `horizon_year`) pinned at the bottom of the sidebar at every level; drag from sidebar onto a bucket to advance that task's horizon; click a bucket to drill into it (e.g. click Q2 → navigates to Quarter view for Q2); breadcrumb navigation back up; Week view links to Calendar for time-slot scheduling. H1/H2 views dropped for now (add as settings toggle later). Build before Phase 2.

---

### Phase 2 — Household workspace foundation

Goal: a second user can join a household, share tasks, assign work to each other and to child profiles.

- [x] 2.1 Household creation — create household workspace, set name, become owner
- [x] 2.2 Invitation flow — invite by email, token link, accept/decline, join as adult member
- [x] 2.3 Child profiles — add non-auth household members (name + avatar colour), manageable by adult members
- [x] 2.4 Household categories — create shared categories visible to all members (owner_id null, is_shared true)
- [x] 2.5 Shared task visibility — tasks in shared categories appear in all household members' views
- [x] 2.6 Task assignment — assign to household member; adult-to-adult requires acceptance, adult-to-child does not
- [x] 2.7 Assignment notifications — in-app notification on assignment, accept/decline flow for adult assignments
- [x] 2.8 Household dashboard — shared view: today's household tasks, assigned-to-me, upcoming
- [x] 2.9 Workspace switcher — navigate between personal and household workspaces in one UI
- [x] 2.10 Horizon model in household — same horizon fields available on household tasks, same UI component

---

### Phase 3 — Household features: cleaning and shopping

Goal: room cleaning schedules and meal/shopping features. The household workspace becomes genuinely useful day-to-day.

- [x] 3.1 Rooms — add/edit/delete rooms for the household
- [x] 3.2 Cleaning tasks — tasks linked to rooms via source_id, assignable, recurring, appear in main task list
- [x] 3.3 Cleaning schedule view — tasks by room, upcoming schedule, mark complete, roll-over visibility
- [x] 3.4 Shopping list — manual item entry, shop tags (Tesco/Asda etc.), mark purchased, clear purchased
- [x] 3.5 Meal planning — assign meal names to days of the week, weekly view
- [x] 3.6 Ingredients — add ingredients to a meal, mark each as Have/Need
- [x] 3.7 Meal → shopping list — push Need ingredients to shopping list with quantities
- [x] 3.8 Shopping list deduplication — merge matching ingredient entries from multiple meals
- [x] 3.9 Shopping task — auto-create "Go shopping" task linked to shopping list

---

### Phase 4 — Polish, mobile, notifications

Goal: usable on a phone, installable, notifies you of things. Ready for other households to use.

- [ ] 4.1 Mobile-optimised layouts — designed for phone viewport throughout
- [ ] 4.2 Progressive Web App — manifest, service worker, installable on Android home screen
- [ ] 4.3 Web push notifications — task reminders, assignment notifications
- [ ] 4.4 Microsoft OAuth — sign in with Microsoft, replaces email/password
- [ ] 4.5 Voice input — Whisper API transcription piped into brain dump
- [ ] 4.6 Billing — Stripe, free tier (personal workspace only) vs paid tier (household features)
- [ ] 4.7 Onboarding improvements — guided household setup flow for new users

---

### Phase 5 — Android native + extended features

Goal: true Android app. Extended recipe system. Entertaining templates. Market-ready.

- [ ] 5.1 Capacitor wrapper — package web app as Android APK, test on device
- [ ] 5.2 FCM push notifications — Firebase Cloud Messaging replacing web push for Android
- [ ] 5.3 Recipe system — ingredients list with quantities and units, serving size scaling, push scaled quantities to shopping list
- [ ] 5.4 Entertaining event templates — user-created templates that generate task sets relative to an event date
- [ ] 5.5 AI meal suggestions — Sonnet-powered suggestions based on household preferences and history
- [ ] 5.6 M365 integration — flagged emails → tasks, Teams messages → tasks
- [ ] 5.7 Extended family access — invite members outside household with restricted view
- [ ] 5.8 Multiple household support — for users managing more than one property

---

## Current state

- [x] Project moved to personal accounts (GitHub: Warwick-Hope, Supabase: personal org) — project IDs unchanged
- [x] Next.js 14 scaffold — TypeScript, Tailwind, Supabase client, ESLint, Prettier
- [x] Phase 0 complete — new combined schema live on dev, smoke test passed
- [x] Phase 1 complete — personal workspace fully functional (1.1–1.14 + feedback polish)
- [x] Phase 1.19 complete — Horizon Planner live at `/plan`
- [x] ESLint clean — all lint errors resolved; `.markdownlint.json` added to suppress line-length rule on docs
- [x] Phase 2 complete — household workspace foundation (2.1–2.10)
- [x] Phase 3 complete — cleaning (rooms, tasks, schedule view), shopping list, meal planning, ingredients, meal→shopping push with deduplication, auto shopping task
- [x] Household nav — section nav added to household layout (Dashboard, Tasks, Cleaning, Shopping, Meals, Rooms, Categories) with active-state highlighting; matches personal layout pattern
- [x] Personal nav — active-state highlighting added
- [x] First deploy complete — live on Vercel, prod migrations pushed, prod auth URLs configured
- [x] Git process — pre-push main guard, PR-only flow with squash merges, CI verify (lint + build) on PRs
- [x] Security hardening — tiers 1 and 2 of [SECURITY_HARDENING.md](SECURITY_HARDENING.md) code-complete, migrations applied to dev, smoke tested (PR #4). Invitation lookup moved behind a `get_invitation_by_token` RPC; `requireMember`/`parseJson` helpers applied across every household route; `household_profiles` RLS tautology fixed (membership of any workspace granted access to every household's child profiles); first indexes in the schema; brain-dump input capped; recurring-task insert errors surfaced; assignee membership validated
- [x] Three fixes found while smoke testing, same branch: `/invite/[token]` never rendered for logged-out visitors (middleware redirected every unauthenticated request to `/login`); `GET /api/tasks/[id]` didn't exist, so the cleaning form 405'd; brain dump truncated its own JSON at 2,048 output tokens
- [x] Brain dump horizon derivation moved server-side into [lib/horizon.ts](lib/horizon.ts) — the model returns a precision plus one date, the app does the calendar arithmetic. Model dropped to `claude-haiku-4-5` (extraction only now)
- [x] Security hardening shipped to prod (17 Aug 2026) — PR #4 squash-merged, the three `20260815*` migrations applied to prod, CLI re-linked to dev, invite page verified live
- [x] Supabase Advisors run on dev — 0 errors. Cleanup in `20260817000001_advisor_cleanup.sql`: dropped the leftover `task_roles` table, pinned `set_updated_at`'s search_path, revoked anon EXECUTE on the three session-only RPCs. Rationale and the deliberately-ignored warnings are in [SECURITY_HARDENING.md](SECURITY_HARDENING.md)
- [ ] **Next: Playwright smoke suite** (login, task CRUD, invite accept, brain dump), then the pre-4.1 consolidation refactor — both listed at the end of [SECURITY_HARDENING.md](SECURITY_HARDENING.md). Two small manual items still open there: enable leaked password protection in Auth → Policies (dev + prod), and identify `public.rls_auto_enable()`

### Deployment checklist (first deploy)
- [x] Create Vercel project at vercel.com/warwick-hope-pvt-projects → import from GitHub (Warwick-Hope/task-planner)
- [x] Set Vercel env vars (Production): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (prod), ANTHROPIC_API_KEY, NEXT_PUBLIC_APP_URL
- [x] Push migrations to prod: link CLI → push → re-link to dev
- [x] Set Supabase prod Auth → URL Configuration: Site URL → https://task-planner-nine-sigma.vercel.app, Redirect URLs → https://task-planner-nine-sigma.vercel.app/** (wildcard needed — signup redirects to /api/auth/callback and the allow-list is exact-match)

Note: prod Supabase is on the free tier and pauses after ~7 days without traffic — a paused project takes the live app down until manually restored from the dashboard. Fine once in daily use; upgrade or add a keep-alive if it recurs.

**Live URL:** https://task-planner-nine-sigma.vercel.app

### Future deploys
Vercel auto-deploys on every push to `main`. No manual steps needed.
For new migrations: link to prod, push, re-link to dev (see env vars section for token pattern).

---

## How to continue in a new session

1. Read this file in full
2. Check the phase checklists — find the first unchecked item
3. Continue from there
4. Ask before changing anything marked as locked
5. Update Current State as items are completed
6. One step at a time — confirm before moving to the next item
