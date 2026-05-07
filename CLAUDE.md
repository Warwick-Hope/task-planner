# Clarity — Project Intelligence Document

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
- **Repo:** https://github.com/Warwick-Hope/task-planner (personal GitHub account)

---

## Accounts

- **GitHub:** https://github.com/Warwick-Hope/task-planner (personal account — Warwick-Hope)
- **Supabase:** Personal account — both projects transferred from Plant Plan org, project IDs unchanged
  - **Dev:** fxczpsznrcxykfsiyvty
  - **Prod:** ialovkohwdlkpgsrqrjo
- MCP points at dev only — never touch prod directly
- Never run destructive operations on prod

---

## Environment variables

Required in `.env.local` — never commit this file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://fxczpsznrcxykfsiyvty.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_key
ANTHROPIC_API_KEY=your_anthropic_key
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
```
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

**tasks**
```
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

**shopping_list**
```
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

- **One branch per phase** — named `feat/phase-N-description` (e.g. `feat/phase-0-schema`, `feat/phase-1-personal`)
- **Claude names the branch** at the start of each new phase — never use auto-generated worktree names
- **Commit after each completed phase step** — use the commit format above; don't batch multiple steps into one commit
- **Migration files always committed** — every Supabase migration in `supabase/migrations/` is committed immediately after it runs successfully on dev
- **Merge to `main` when phase is complete** — after smoke test passes, not mid-phase
- **No force push, no direct commits to `main`** — all work goes through a named branch

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

---

### Phase 2 — Household workspace foundation

Goal: a second user can join a household, share tasks, assign work to each other and to child profiles.

- [ ] 2.1 Household creation — create household workspace, set name, become owner
- [ ] 2.2 Invitation flow — invite by email, token link, accept/decline, join as adult member
- [ ] 2.3 Child profiles — add non-auth household members (name + avatar colour), manageable by adult members
- [ ] 2.4 Household categories — create shared categories visible to all members (owner_id null, is_shared true)
- [ ] 2.5 Shared task visibility — tasks in shared categories appear in all household members' views
- [ ] 2.6 Task assignment — assign to household member; adult-to-adult requires acceptance, adult-to-child does not
- [ ] 2.7 Assignment notifications — in-app notification on assignment, accept/decline flow for adult assignments
- [ ] 2.8 Household dashboard — shared view: today's household tasks, assigned-to-me, upcoming
- [ ] 2.9 Workspace switcher — navigate between personal and household workspaces in one UI
- [ ] 2.10 Horizon model in household — same horizon fields available on household tasks, same UI component

---

### Phase 3 — Household features: cleaning and shopping

Goal: room cleaning schedules and meal/shopping features. The household workspace becomes genuinely useful day-to-day.

- [ ] 3.1 Rooms — add/edit/delete rooms for the household
- [ ] 3.2 Cleaning tasks — tasks linked to rooms via source_id, assignable, recurring, appear in main task list
- [ ] 3.3 Cleaning schedule view — tasks by room, upcoming schedule, mark complete, roll-over visibility
- [ ] 3.4 Shopping list — manual item entry, shop tags (Tesco/Asda etc.), mark purchased, clear purchased
- [ ] 3.5 Meal planning — assign meal names to days of the week, weekly view
- [ ] 3.6 Ingredients — add ingredients to a meal, mark each as Have/Need
- [ ] 3.7 Meal → shopping list — push Need ingredients to shopping list with quantities
- [ ] 3.8 Shopping list deduplication — merge matching ingredient entries from multiple meals
- [ ] 3.9 Shopping task — auto-create "Go shopping" task linked to shopping list

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
- [ ] **Next: Phase 2.1 — Household creation**

---

## How to continue in a new session

1. Read this file in full
2. Check the phase checklists — find the first unchecked item
3. Continue from there
4. Ask before changing anything marked as locked
5. Update Current State as items are completed
6. One step at a time — confirm before moving to the next item
