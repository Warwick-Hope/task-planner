# Task Planner — Project Intelligence Document

## What this is

A personal planning web app built for one user initially, architected for multi-tenant from day one with a view to marketing later. The core differentiator is AI-powered brain dump capture — speak or type a brain dump, AI parses it into structured tasks automatically. No other mainstream task manager does this well.

## Tech stack

- **Frontend/API:** Next.js 14, App Router, TypeScript, Tailwind CSS
- **Database/Auth:** Supabase (Postgres, RLS, Supabase Auth)
- **AI:** Anthropic API, Claude Sonnet (latest) for task parsing
- **Hosting:** Vercel
- **Repo:** <https://github.com/WarwickHope/task-planner>

## Supabase projects

- **Dev:** fxczpsznrcxykfsiyvty
- **Prod:** ialovkohwdlkpgsrqrjo
- MCP in Cursor points at dev only. Never run destructive operations on prod.

## Environment variables

Required in .env.local (never commit this file):

```env
NEXT_PUBLIC_SUPABASE_URL=https://fxczpsznrcxykfsiyvty.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_key
ANTHROPIC_API_KEY=your_anthropic_key
```

## Architecture decisions (locked)

- **Multi-tenant from day one** — every table has user_id, RLS enabled on all tables
- **Auth** — Supabase Auth, Microsoft OAuth added in Phase 2. Email/password for Phase 1.
- **Horizon model** — tasks have 7 nullable horizon fields (year, half, quarter, month, week, day, time_slot). All null = unplanned. Fields cascade — moving to a coarser horizon clears more precise fields. System flags tasks needing resolution as horizons approach.
- **Role categories** — self-referencing tree, two levels max for now. Colour set at top level, inherited by children. sort_order controls display sequence.
- **Subtasks** — one level deep via parent_task_id on tasks table. No recursive nesting for now.
- **Mission/Values** — separate tables, not part of profile. Reference layer for planning sessions only, not per-task metadata.
- **AI parsing** — Anthropic API called server-side via Next.js API route. Never expose API key client-side.

## Database schema (created in dev)

All tables have RLS enabled. Policies to be added per phase.

### Enums

- task_status: not_started | wip | done | cancelled

### Tables

- **profiles** — id (ref auth.users), display_name, created_at, updated_at
- **missions** — id, user_id, content, is_active, created_at
- **values** — id, user_id, name, description, sort_order, created_at
- **role_categories** — id, user_id, name, parent_id (self-ref), colour, sort_order, created_at
- **tasks** — id, user_id, title, notes, parent_task_id (self-ref), status, horizon_year, horizon_half, horizon_quarter, horizon_month, horizon_week, horizon_day, horizon_time_slot, created_at, updated_at
- **task_roles** — task_id, role_category_id (composite PK)

## Coding conventions

- TypeScript strict mode — no any types
- All database calls server-side via API routes or server components — never call Supabase directly from client components except for auth
- All API routes in /app/api/
- Shared types in /types/index.ts
- Supabase client helpers in /lib/supabase.ts (browser) and /lib/supabase-server.ts (server)
- Components in /components — keep them small and single-purpose
- No inline styles — Tailwind only
- Commit format: type: short description (feat/fix/chore/refactor/docs)
- Commit at logical checkpoints — not every file, not every hour
- Never commit .env.local

## Phased build plan

### Phase 1 — Core (current phase)

Goal: working app for personal use end to end

- [x] 1.1 Auth — email/password sign up and sign in, protected routes, session handling
- [x] 1.2 RLS policies — add policies to all tables so users only see their own data
- [x] 1.3 Onboarding — first run flow: set display name, create initial role categories, optionally add mission
- [ ] 1.4 Role category management — CRUD UI for managing the two-level hierarchy
- [ ] 1.5 Manual task entry — form to create a task with title, notes, horizon fields, role tags
- [ ] 1.6 Task list view — filterable, sortable by horizon, role, status. Unplanned view (all horizon fields null).
- [ ] 1.7 AI brain dump — chat window with model selector, submits to API route, Sonnet parses into one or more structured tasks, user reviews and confirms before saving
- [ ] 1.8 Basic horizon logic — cascade clear on horizon change, derive upward fields from most precise set field
- [ ] 1.9 Review prompts — system surfaces tasks needing horizon resolution based on current date proximity
- [ ] 1.10 Mission/values UI — simple area to add and view mission statement and personal values

### Phase 2 — Email + Calendar

- [ ] 2.1 Microsoft OAuth — Sign in with Microsoft, replace email/password
- [ ] 2.2 M365 flagged email → task — Graph API integration, flagged emails become tasks
- [ ] 2.3 Calendar view — tasks on a calendar, drag and drop to assign horizon_day and horizon_time_slot
- [ ] 2.4 Configurable horizon parameters — user-adjustable rules for review prompt timing
- [ ] 2.5 Teams message → task capture

### Phase 3 — Marketable

- [ ] 3.1 Multi-tenant OAuth (public Microsoft app registration)
- [ ] 3.2 Voice/transcription — Whisper API → Sonnet parsing
- [ ] 3.3 Mobile optimisation
- [ ] 3.4 Billing integration (Stripe)
- [ ] 3.5 Microsoft publisher verification

## Current state

- [x] Repo created: <https://github.com/WarwickHope/task-planner>
- [x] Next.js 14 scaffold complete — TypeScript, Tailwind, Supabase client, ESLint, Prettier
- [x] Supabase dev and prod projects created
- [x] Database schema created in dev — all tables and enums, RLS enabled
- [x] Initial commit pushed to main
- [x] Phase 1.1 — Auth complete: email/password sign up and sign in, protected routes, session handling via middleware
- [x] Phase 1.2 — RLS policies complete: all tables have select/insert/update/delete policies scoped to auth.uid(). task_roles joins through tasks.
- [x] Phase 1.3 — Onboarding complete: 3-step wizard (display name, role categories, mission). Dashboard layout redirects to /onboarding if no profile exists.
- [ ] Next: Phase 1.4 — Role category management

## How to continue in a new session

Read this file, check the Phase 1 checklist for the first unchecked item, and continue from there. Ask before making any changes to the database schema or architecture decisions marked as locked. Update the Current State section as items are completed.
