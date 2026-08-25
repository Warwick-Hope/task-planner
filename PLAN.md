# Clarity — Plan

**This is the single plan.** It is dynamic — edited in place as decisions get made, not
rewritten from scratch. Supporting evidence lives in separate documents (table below); where
any of them disagrees with this file about a *finding*, the supporting document wins, because
it is the primary measurement. Where anything disagrees about *sequence or decision*, this
file wins.

| Document | What it holds |
|---|---|
| [CLAUDE.md](CLAUDE.md) | The facts card — what prevents mistakes, and where each fact lives |
| [KB.md](KB.md) | **Read before any non-trivial task.** Numbered, hard-won gotchas — start at its index |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branch model, hooks, PR flow, migration deploys |
| [SCHEMA.md](SCHEMA.md) | The database shape in readable form — enums, tables, columns |
| [SECURITY_HARDENING.md](SECURITY_HARDENING.md) | Evidence: the 14 Aug 2026 security review, what was found and what was done |
| [README.md](README.md) | Public-facing: what the app is and how to run it locally |

---

## Where we are, and what's next

**Updated:** 2026-08-25

Phases 0 to 3 are complete and running in production at
<https://task-planner-nine-sigma.vercel.app>. Security hardening tiers 1 and 2 shipped to prod
on 17 Aug 2026. On 25 Aug 2026 four pieces landed in a row: the Playwright smoke suite, the
consolidation refactor, the RLS `initplan` rewrite, and the Phase 4.1 mobile pass — **all four
merged, and 4.1 auto-deployed to prod on merge. It has not yet been checked on a real phone.**
The documents were retrofitted to the standard set the same day. The next build item is 4.2,
the PWA.

1. ✅ **Phases 0–3** — schema rebuild, personal workspace, household foundation, cleaning /
   shopping / meals. Live on prod. Detail in §Phases.
2. ✅ **First deploy** — 14 Aug 2026. Vercel project live, prod migrations applied, prod auth
   URLs configured.
3. ✅ **Security hardening tiers 1 and 2** — shipped to prod 17 Aug 2026 (PR #4, migrations
   `20260815000001`–`3`). Advisor cleanup `20260817000001` followed. Evidence and rationale in
   [SECURITY_HARDENING.md](SECURITY_HARDENING.md).
4. ✅ **Playwright smoke suite** — PR #8, merged 25 Aug 2026. Two browser projects; see
   §Verification.
5. ✅ **Consolidation refactor** — PR #9, merged 25 Aug 2026. Three task-row components to one,
   the status cycle and colour helper into `lib/`, the two route-group layouts into one shell.
   Deliberately done *before* the mobile pass so the mobile work happened once, not three times.
6. ✅ **RLS `initplan` rewrite** — PR #10, merged 25 Aug 2026. 53 policies rewritten to
   `(select auth.uid())`. **Re-run the Supabase Performance advisor once this reaches prod** to
   confirm the findings clear — that has not been done.
7. ✅ **Phase 4.1 — mobile-optimised layouts.** PR #11, merged 25 Aug 2026 and auto-deployed.
   Guarded by the `mobile-chromium` Playwright project. **Still to do: look at it on a real
   phone** — a Pixel 5 viewport in Playwright is not the same test (§Open items 1).
8. ✅ **Documentation retrofitted to the standard set** — PR #12, merged 25 Aug 2026. Status,
   knowledge, contribution rules and schema split out of `CLAUDE.md`; `npm run check:docs` runs
   in CI ahead of lint.
9. ⏭ **Next — Phase 4.2, Progressive Web App.** Manifest, service worker, installable on
   Android. *Done* means the prod URL installs to an Android home screen and launches
   standalone.
10. **Deferred by decision, not oversight** — Phase 1 items 1.15 (AI planning assistant), 1.16
    (brain dump AI steering) and 1.17 (calendar time slots) are unbuilt and not blockers.
    **1.18 (UI density pass) was largely absorbed by 4.1** — touch target sizes and hover states
    were reworked throughout. Check what 4.1 actually did before rebuilding any of it.
11. **Open manual items** — see §Open items. Two are blocked on Supabase Pro, one is deferred
    until an external user exists. None block 4.2.

---

## Context

A unified personal planning and household coordination app. One login, one planning system.
A personal workspace for individual task planning (horizon-based, AI brain dump, role
categories), and a household workspace for shared family tasks, cleaning schedules, meal
planning and shopping. The distinction between personal and household is **visibility and
permissions** — not separate modes or apps.

The differentiators are AI-powered brain-dump capture (personal) and seamless task flow
between personal and household contexts via shared categories.

Built for Warwick's own personal and household use first, but architected multi-tenant from
day one with a view to a wider market later. It is a **personal project on personal accounts**
— GitHub `Warwick-Hope`, a personal Supabase org — not a Plant Plan system. Both Supabase
projects are on the free tier, and that constraint shapes several decisions below.

### Decisions already taken (locked — ask before changing)

These shape everything else. Do not reopen one without asking.

- **Workspace model** — every user gets a personal workspace on signup (auto-created).
  Household workspaces are created explicitly and joined by invitation. All data belongs to a
  workspace, not directly to a user.
- **`workspace_id` on all tables** — replaces the old `user_id` pattern. RLS checks workspace
  membership, not raw user identity.
- **Visibility via categories** — tasks are visible to household members if their category has
  `is_shared = true`. Personal categories are private. This is how a task tagged "Family" in a
  personal brain dump surfaces in the household view.
- **The horizon model applies everywhere** — personal and household tasks use the same seven
  horizon fields. All null = unplanned. Same model, same logic, same UI.
- **The calendar is a view, not a data model** — it renders tasks that have `due_date` set.
  No events table. Dragging on the calendar sets `due_date`.
- **Categories are the tagging model** — personal categories have `owner_id` set and are
  private; household categories have `owner_id` null and are shared across all members.
- **Assignment flow** — assigning to another adult member requires their acceptance
  (pending → accepted/declined). Assigning to a child profile requires no approval.
- **Child/restricted profiles** — non-auth household members stored as `household_profiles`,
  name and avatar only, cannot log in, can be assigned tasks.
- **Membership tiers** — owner and adult members see all shared household content. Restricted
  members have limited visibility (for older children with their own login, future use).
- **Minimum horizon** — every task should eventually carry at least a quarter-level horizon.
  Fully unplanned is a transient state, surfaced by the review prompts, not a permanent one.
- **Subtasks** — one level deep via `parent_task_id`. No recursive nesting.
- **Mission and values** — personal workspace only. A reference layer, not per-task metadata.
- **AI parsing is server-side only** — the Anthropic API is called from a Next.js API route.
  The key is never exposed client-side.
- **All DB calls server-side** — via API routes or server components. Client components talk to
  Supabase for auth and nothing else.
- **Entertaining templates and recipe steps are out of scope until Phase 5.** MVP meal planning
  is meal name plus ingredients list only.
- **Offline-first is deferred** — revisit for the Android phase.

---

## Approach

- **Route groups mirror the personal/household split.** `app/(auth)`, `app/(dashboard)`
  (personal: tasks, calendar, plan, brain-dump, mission, roles), `app/(household)`. API routes
  under `app/api/**`, one folder per resource.
- **[middleware.ts](middleware.ts)** refreshes the session on every request and does the
  redirects.
- **Two Supabase client helpers, not interchangeable** — [lib/supabase.ts](lib/supabase.ts) is
  the browser client (auth only); [lib/supabase-server.ts](lib/supabase-server.ts) is the
  cookie-aware server client for server components and API routes.
- **Shared logic lives in `lib/`, never copied between components.**
  [lib/horizon.ts](lib/horizon.ts) owns the horizon model,
  [lib/workspace-server.ts](lib/workspace-server.ts) owns workspace resolution and
  `requireMember`, [lib/task-status.ts](lib/task-status.ts) and
  [lib/use-task-status.ts](lib/use-task-status.ts) own the status cycle,
  [lib/category-colour.ts](lib/category-colour.ts) owns colour inheritance,
  [lib/dnd-sensors.ts](lib/dnd-sensors.ts) owns drag activation,
  [lib/recurrence.ts](lib/recurrence.ts) wraps `rrule`. Each of these was duplicated five or six
  times and had begun to drift — add to them rather than re-deriving.
- **[components/layout/AppShell.tsx](components/layout/AppShell.tsx)** is the chrome both route
  groups share. The two layouts are ten lines each and differ only in which nav they pass.
- **[types/index.ts](types/index.ts)** is the single TypeScript source for every table shape.
  Update it alongside any migration.
- **Every schema change is a committed migration** in [supabase/migrations/](supabase/migrations/),
  applied to dev first. Never hand-edited on the dashboard.

**Tech stack:** Next.js 14 (App Router), TypeScript strict, Tailwind, Supabase (Postgres, RLS,
Auth), Anthropic API for the brain dump, Vercel hosting. Key libraries: `rrule`, `date-fns`,
`@dnd-kit/core`, `shadcn/ui`.

---

## Phases

### Phase 0 — Schema migration — ✅ complete

Rebuild the dev database on the combined personal + household schema. Enums, workspaces,
members, household profiles, profiles, categories, tasks, non-negotiables, missions and values,
rooms/meals/meal-plan/ingredients, shopping list, invitations — each with RLS. Then
`types/index.ts` and all existing app code onto the new shape.

**Exit criterion:** ✅ auth, onboarding, category CRUD, task entry and task list all working on
the new schema. Passed.

### Phase 1 — Personal workspace complete — ✅ complete, with three items deferred

| # | Item | State |
|---|---|---|
| 1.1 | Auth — email/password, protected routes, sessions | ✅ |
| 1.2 | RLS on all tables | ✅ |
| 1.3 | Onboarding — 3-step wizard | ✅ |
| 1.4 | Category management — CRUD, two levels, colour picker | ✅ |
| 1.5 | Manual task entry | ✅ |
| 1.6 | Task list view — filters, horizon sort, status toggle, delete | ✅ |
| 1.7 | AI brain dump — parse to structured tasks, review before save | ✅ |
| 1.8 | Horizon logic — cascade clear, derive upward | ✅ |
| 1.9 | Review prompts — surface tasks needing horizon resolution | ✅ |
| 1.10 | Non-negotiables — 3 per day, dashboard, daily reset | ✅ |
| 1.11 | Calendar view — drag to set `due_date` | ✅ |
| 1.12 | Recurring tasks — rrule, next occurrence on completion | ✅ |
| 1.13 | Mission and values UI | ✅ |
| 1.14 | Dashboard — today, non-negotiables, upcoming, quick links | ✅ |
| 1.15 | AI planning assistant — read access, proposes changes, user approves | Deferred |
| 1.16 | Brain dump AI steering — prime the prompt with the user's own context | Deferred |
| 1.17 | Calendar time slots — time + duration, 15-min day view | Deferred |
| 1.18 | UI density pass | Largely absorbed by 4.1 — check before rebuilding |
| 1.19 | Horizon Planner at `/plan` — Year → Quarter → Month → Week buckets, drag to advance | ✅ |

**Exit criterion:** ✅ a single user can capture, plan, schedule and complete work end to end in
the personal workspace. Met. 1.15–1.17 are enhancements, not gaps in that criterion.

### Phase 2 — Household workspace foundation — ✅ complete

2.1 household creation · 2.2 invitation flow · 2.3 child profiles · 2.4 household categories ·
2.5 shared task visibility · 2.6 task assignment with acceptance · 2.7 assignment notifications ·
2.8 household dashboard · 2.9 workspace switcher · 2.10 horizon model in household.

**Exit criterion:** ✅ a second user can join a household, see shared tasks, and be assigned
work they must accept. Met.

### Phase 3 — Cleaning and shopping — ✅ complete

3.1 rooms · 3.2 cleaning tasks linked to rooms · 3.3 cleaning schedule view · 3.4 shopping list
with shop tags · 3.5 meal planning · 3.6 ingredients with Have/Need · 3.7 meal → shopping push ·
3.8 shopping list deduplication · 3.9 auto "Go shopping" task.

**Exit criterion:** ✅ the household workspace is usable day to day without falling back to
paper. Met.

### Phase 4 — Polish, mobile, notifications — in progress

| # | Item | State |
|---|---|---|
| 4.1 | Mobile-optimised layouts throughout | ✅ merged 25 Aug 2026 — real-phone check outstanding |
| 4.2 | Progressive Web App — manifest, service worker, installable | Next |
| 4.3 | Web push notifications — reminders, assignments | Not started |
| 4.4 | Microsoft OAuth — **additive**, not a replacement for email/password | Not started |
| 4.5 | Voice input — Whisper transcription into the brain dump | Not started |
| 4.6 | Billing — Stripe, free personal tier vs paid household tier | Deferred until an external household wants in |
| 4.7 | Onboarding improvements — guided household setup | Not started |

**Exit criterion:** the app is usable on a phone as the primary device, installs to an Android
home screen, and tells you about things without you opening it.

### Phase 5 — Android native and extended features — not started

5.1 Capacitor wrapper · 5.2 FCM push · 5.3 recipe system with quantities and scaling ·
5.4 entertaining event templates · 5.5 AI meal suggestions · 5.6 M365 integration ·
5.7 extended family access · 5.8 multiple households.

**Exit criterion:** a real Android app another household could be handed.

**The Capacitor decision waits until the PWA has been lived with** — 5.1 may prove unnecessary.

---

## Risks

| Risk | What is lost | Mitigation |
|---|---|---|
| Prod Supabase pauses after ~7 days idle on the free tier | The live app goes down until manually restored from the dashboard | Fine once in daily use. A keep-alive or the Pro upgrade fixes it properly — the same upgrade unblocks leaked-password protection |
| `verify` cannot be *required* on a free GitHub plan | A red check merged to `main` deploys straight to production | Convention plus the `pre-push` hook. Wait for green before merging — nothing enforces it |
| A push to `main` is a production deploy, with no staging step | A bad merge is live in ~2 minutes | Branch-per-change, PR-only, squash merges. See [CONTRIBUTING.md](CONTRIBUTING.md) |
| The e2e suite is not wired into CI | A regression reaches `main` unnoticed | Deliberate — a sleeping dev project would turn `verify` red for unrelated reasons. Revisit with the Pro decision |
| Two GitHub accounts on the machine, and `gh auth switch` is global | A bare `403` on push, naming no cause | Repo-local credential pin, enforced by `pre-push`. See [KB.md](KB.md) #27 |
| The brain dump has no per-user quota | An authenticated user could run up the Anthropic bill | Deferred deliberately while single-user. A 10,000-character cap is in place |
| Prod is on the free tier with no backups worth the name | Data loss with no restore | Accepted for now. Revisit before any external household joins |

---

## Verification

```bash
npm run lint          # ESLint: next/core-web-vitals, next/typescript, prettier
npm run build         # production build — also type-checks, since noEmit + strict
npm run test:e2e      # Playwright suite; starts the dev server itself
npm run check:docs    # the documentation guard
```

`npm run lint` and `npm run build` are what CI's `verify` job runs on every PR. There is **no
unit-test runner** — do not assume Jest or Vitest exists.

The Playwright suite runs against **dev** Supabase with two dedicated accounts, single worker,
no parallelism. Two browser projects:

- **`chromium`** — the behaviour specs at desktop size, ignoring `mobile.spec.ts`.
- **`mobile-chromium`** — only `mobile.spec.ts`, on a Pixel 5 viewport. This is the guard on
  Phase 4.1: every personal route is checked for content past the edge of the screen, and the
  task row's edit and delete controls must be visible without a hover.

Properties that must hold, because they are what catch the bugs that look fine on one run:

- **Freshness comes from a new household per run**, deleted in teardown — not from disposable
  accounts, which cannot be deleted without a `service_role` key ([KB.md](KB.md) #14).
- **Teardown sweeps every `[e2e]` row** regardless of outcome, because a test that fails before
  its own cleanup leaves rows behind ([KB.md](KB.md) #20).
- **The overflow check walks the DOM element by element**, not
  `documentElement.scrollWidth` — `body` carries `overflow-x: clip` ([KB.md](KB.md) #18).
- **Migrations are idempotent and announce what they change** — the `initplan` rewrite reads
  `pg_policies` rather than listing policies by hand ([KB.md](KB.md) #10).

---

## Open items to resolve as we go

1. **Check 4.1 on a real phone.** It is merged and deployed; what has not happened is anyone
   using it on an actual handset. A Pixel 5 viewport in Chromium catches layout overflow and
   missing controls — it does not catch a tap target that is technically 44px and still awkward,
   or a scroll that fights the browser chrome. Do this before starting 4.2, because the PWA
   makes the phone the primary device.
2. **Re-run the Supabase Performance advisor on prod** after the `initplan` migration reaches
   it, to confirm the `auth_rls_initplan` findings clear.
3. **Leaked password protection — blocked on plan.** Authentication → Providers → Email, and
   the setting is Pro-plan and above. Both projects are free tier, so there is nothing to
   toggle. Revisit with the Pro decision.
4. **The Pro decision itself.** It would unblock item 3, stop the projects pausing (§Risks), and
   make wiring the e2e suite into CI sensible. Settle it as one decision, not three.
5. **Per-user daily quota on the brain dump.** Deferred while single-user; required before any
   external user.
6. **Whether 1.18 has anything left in it** after 4.1. Look at what 4.1 changed before
   scheduling any of it.
7. **`shopping_list` UPDATE column rule lives only in the route layer.** RLS cannot express
   "restricted members may change `is_purchased` only". A trigger would be needed. Recorded
   rather than fixed.

---

## Decisions log

**Append-only. Absolute dates. The reasoning is the point — it is what stops a decision being
re-litigated.**

- **14 Aug 2026** — Phase 4 amended after the security review: 4.4 Microsoft OAuth is
  *additive* rather than replacing email/password, because removing the password path would
  strand the e2e accounts and the invite flow; 4.6 billing deferred until an external household
  actually wants in, because there is nothing to bill for yet; the Phase 5 Capacitor decision
  waits until the PWA has been lived with, since the PWA may make it unnecessary.
- **14 Aug 2026** — Git process adopted: branch per change, PR only, squash merge, `pre-push`
  guard on `main`. The repo is private on a free personal plan, so server-side branch protection
  is unavailable and a local hook is the only substitute.
- **17 Aug 2026** — `get_invitation_by_token` stays anon-callable, and `is_workspace_member` /
  `is_workspace_owner` keep their anon EXECUTE, against the advisor's advice. The invite landing
  page *is* the anonymous caller; and the two helpers run inside RLS policies as the querying
  role, so revoking anon turns an anonymous read into a permission error instead of an empty
  result. Both already return false when `auth.uid()` is null.
- **17 Aug 2026** — `public.rls_auto_enable()` kept. It returns `event_trigger` and takes no
  arguments, so PostgREST cannot invoke it at all; the advisor's "public can execute" warning
  against it is noise.
- **17 Aug 2026** — the brain dump moved down to Haiku 4.5. Horizon arithmetic moved
  server-side into `lib/horizon.ts`, leaving the model doing extraction only — a third of the
  token cost, faster, and the calendar maths is now consistent with the rest of the app.
- **25 Aug 2026** — the consolidation refactor was done *before* the mobile pass, not after.
  Three task-row components, six copies of the status cycle and five of the colour helper would
  otherwise each have needed the same mobile treatment.
- **25 Aug 2026** — the `initplan` migration rewrites policies by reading `pg_policies` rather
  than listing them by hand. The live policy set is the result of 89 create/drop statements
  across 14 migrations; transcribing the survivors would have been a guess, and a wrong guess
  silently changes who can read what.
- **25 Aug 2026** — the e2e suite stays out of CI. The dev Supabase project sleeps after ~7
  days idle on the free tier, and a sleeping project would turn `verify` red for reasons
  unrelated to the code. Config already reads `E2E_BASE_URL` and credentials from the
  environment, so enabling it later is a workflow file plus two secrets.
- **25 Aug 2026** — the project documentation was retrofitted to the standard set: the status
  extracted from `CLAUDE.md` into this file, the hard-won facts into `KB.md`, the git and deploy
  mechanics into `CONTRIBUTING.md`, the schema into `SCHEMA.md`, and `CLAUDE.md` cut to a facts
  card. The trigger was measured drift: `CLAUDE.md` listed two security items as open that
  `SECURITY_HARDENING.md` had already closed or reclassified, and named the wrong dashboard
  location for one of them.
