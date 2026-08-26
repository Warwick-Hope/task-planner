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

**Updated:** 2026-08-26

Phases 0 to 3 are complete and running in production at
<https://task-planner-nine-sigma.vercel.app>. Security hardening tiers 1 and 2 shipped to prod
on 17 Aug 2026. On 25 Aug 2026 four pieces landed in a row: the Playwright smoke suite, the
consolidation refactor, the RLS `initplan` rewrite, and the Phase 4.1 mobile pass — **all four
merged, and 4.1 auto-deployed to prod on merge. It has not yet been checked on a real phone.**
The documents were retrofitted to the standard set the same day, and Phase 4.2, the PWA, merged
that evening. **The app was then used on a real handset for the first time**, which produced
three findings in an hour — a section nav you had to scroll to see, no install offer, and a
production invitation link with no host on it — all fixed on PRs #15 and #16. Clarity is now
installed on Android and running standalone. Web push for assignments merged on 26 Aug 2026 as
PR #18. **That morning also produced a process failure worth more than the feature** — two
sessions worked the same checkout at once and nearly overwrote each other, which is now guarded
by a worktree per session, `npm run session` and the claim board
([WORKSTREAMS.md](WORKSTREAMS.md), [KB.md](KB.md) #39). **The same day the direction changed**:
the next substantial build is the **Claude connector**, specified in §"The Claude connector" —
a token-authed API and an MCP server, so tasks can be created from wherever the thought
happened rather than only in the app.

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
9. ✅ **Phase 4.2 — Progressive Web App.** PR #14, merged 25 Aug 2026 and auto-deployed.
   Manifest, icon set, service worker, offline page. The worker is deliberately **not** an
   offline cache ([KB.md](KB.md) #32), and the three install files are exempt from the
   middleware matcher, without which Chrome's install fails silently ([KB.md](KB.md) #31).
   Verified against the live URL with `npm run verify:pwa`: the manifest parses, the worker
   activates, the offline page works, and the cache holds nothing user-specific.
10. ✅ **Real-phone fixes — PRs #15 and #16, merged 25 Aug 2026.** Using the app on an actual
    handset produced three findings in an hour, none of which any automated check had caught.
    The 4.1 section nav had to be scrolled sideways to reach half the app, so below `md` it is
    now a bottom tab bar with a More sheet ([KB.md](KB.md) #34). Nothing in the app offered to
    install it — and the reason the *browser* was not offering either was our own
    `preventDefault()` on `beforeinstallprompt`, which suppresses exactly that
    ([KB.md](KB.md) #35). And every invitation link created on production was a bare
    `/invite/<token>`, because it was built from `NEXT_PUBLIC_APP_URL`, which is set in
    `.env.local` and in CI and not in production ([KB.md](KB.md) #36).

    **The app is installed on an Android handset and running standalone**, and the invitation
    link was confirmed correct on production after #16 deployed.
11. 🔄 **Phase 4.3 — web push, assignment notifications.** PR #18, merged 26 Aug 2026 and
    auto-deployed, and `20260826000001_push_subscriptions` applied to **prod** the same day —
    CLI re-linked to dev afterwards and checked. Being assigned a task by another adult pushes
    to whatever devices that person has turned on, from the notification bell. **Scheduled
    reminders are deliberately not in it** — see the decisions log for 26 Aug 2026.

    **Not finished.** Prod has no VAPID pair, so subscribing there answers 503 and nothing can
    be sent. *Done* means a real notification arriving on the handset (§Open items 2).
12. ✅ **Parallel-session guard — 26 Aug 2026.** A worktree per session, `npm run session`
    (`scripts/session-check.mjs`, on a `SessionStart` hook) and
    [WORKSTREAMS.md](WORKSTREAMS.md), the claim board. Prompted by two sessions colliding in one
    checkout the same morning ([KB.md](KB.md) #39).
13. ⏭ **Next, in this order** — **4.8** two small fixes (the install icon's white corners and
    revoking a household invitation), then **4.9** the token-authed API, then **4.10** the
    Claude connector itself. SSO (4.4, now Google *and* Microsoft) and push reminders come
    after them, not before. The design is in §"The Claude connector"; the reasoning is in
    §Decisions log, 26 Aug 2026.
14. **Phase 5.6 is no longer "M365 integration."** Reading Outlook, Teams, Plaud or Fathom
    *interactively* is what the connector gives away for nothing, because Claude already holds
    connectors for all four. 5.6 is now only the **unattended** case — a sweep that runs with
    nothing open. See §Phases, Phase 5.
15. **Deferred by decision, not oversight** — Phase 1 items 1.15 (AI planning assistant), 1.16
    (brain dump AI steering) and 1.17 (calendar time slots) are unbuilt and not blockers.
    **1.18 (UI density pass) was largely absorbed by 4.1** — touch target sizes and hover states
    were reworked throughout. Check what 4.1 actually did before rebuilding any of it.
16. **Open manual items** — see §Open items. Two are blocked on Supabase Pro, one is deferred
    until an external user exists. None block 4.8. **Two of them stop being optional the day
    4.10 ships** — the brain-dump quota and the Pro decision.

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
| 4.2 | Progressive Web App — manifest, service worker, installable | ✅ PR #14, 25 Aug 2026 — installed and running standalone on Android |
| 4.3 | Web push notifications — assignments. Reminders deferred, 26 Aug 2026 | ✅ PR #18, merged 26 Aug 2026 — prod VAPID pair outstanding |
| 4.4 | **Google and Microsoft** OAuth — **additive**, not a replacement for email/password | After 4.10 |
| 4.5 | Voice input — Whisper transcription into the brain dump | Not started |
| 4.6 | Billing — Stripe, free personal tier vs paid household tier | Deferred until an external household wants in |
| 4.7 | Onboarding improvements — guided household setup | Not started |
| 4.8 | Two small fixes — the install icon's white corners, and revoking a household invitation | **Next** |
| 4.9 | Token-authed API — personal access tokens, bearer auth alongside the session cookie | Then |
| 4.10 | Claude connector — `/api/mcp`, the tool surface, authenticated with a pasted token | Then |
| 4.11 | Connector OAuth 2.1 — one-click install as a claude.ai connector | Deferred — §"The Claude connector" |

**4.8 in detail, because both halves are already diagnosed.** The install icon shows four white
wedges on a dark Windows taskbar: `scripts/generate-icons.mjs` rasterises the SVG with
`omitBackground: false`, so the page's white background bakes into the corners outside the
`rx="112"` rounded rect, and the PNGs have no alpha channel at all — `icon-192`, `icon-512` and
`apple-touch-icon` are 24bpp RGB with a `#FFFFFF` corner pixel. The fix is `omitBackground: true`
for the two `purpose: "any"` icons; **not** for `apple-touch-icon.png`, which wants the maskable
treatment instead, because iOS ignores `purpose`, composites transparency to black and applies
its own rounding. Revoking an invitation is smaller than it looks: the DELETE policy already
exists in `20260420000011`, the list already renders on the invite page and the API already has
a GET — what is missing is a DELETE route and a button. Both get a `KB.md` entry when they land,
not before.

**Exit criterion:** the app is usable on a phone as the primary device, installs to an Android
home screen, tells you about things without you opening it, **and a task can be created in it
from outside it** — from Claude, from a meeting, from wherever the thought actually happened.

### Phase 5 — Android native and extended features — not started

5.1 Capacitor wrapper · 5.2 FCM push · 5.3 recipe system with quantities and scaling ·
5.4 entertaining event templates · 5.5 AI meal suggestions · 5.6 **unattended inbox and calendar
sweep** · 5.7 extended family access · 5.8 multiple households.

**5.6 is no longer "M365 integration"; it is now something much narrower**, and the change is a
consequence of the connector rather than a change of mind about the goal. Reading Outlook,
Teams, Plaud or Fathom *interactively* costs nothing once 4.10 exists: Claude already holds
connectors for all four, so it does the reading and calls Clarity's tools. What a connector
cannot do is run when nothing is open. 5.6 is therefore only the **scheduled** case — a sweep at
7am with no one present — and it needs a stored OAuth grant per provider, refresh handling and a
per-user background job, none of which the free tier carries comfortably. It also inherits the
scheduler problem 4.3 declined to solve (§Decisions log, 26 Aug 2026). Do not start it until the
connector has been lived with, because it may turn out not to be wanted.

**Exit criterion:** a real Android app another household could be handed.

**The Capacitor decision waits until the PWA has been lived with** — 5.1 may prove unnecessary.

---

## The Claude connector

Agreed 26 Aug 2026, before any code. **Phase 4 items 4.9, 4.10 and 4.11.**

### What it is

A **remote MCP server at `/api/mcp`**, so Claude — desktop, web, Claude Code or a scheduled
routine — can read and write Clarity's tasks directly. The direction is the part worth being
precise about: this is not "sign into Claude from the app", it is Claude signing into Clarity
and calling it as a tool.

The goal it serves is the one the whole app exists for: **whatever you are using, a task gets
into the system without opening the app**, and the system can be updated fast enough that it
stays true rather than becoming a second thing to maintain.

### What it is not — the decision that saves the most work

**Clarity does not integrate with Teams, Outlook, Plaud or Fathom.** Claude already holds
connectors for all four. Once Clarity exposes tools, a meeting sweep is a prompt: Claude reads
the transcript, decides what the actions are, and calls `create_tasks`. Building those four
integrations into Clarity would mean four OAuth flows, four token stores, four sets of refresh
handling and four polling jobs, to reproduce something the model on the other end can already
do.

That is why the connector is worth doing early. **It is not one integration, it is the last
integration** — every future source of tasks that Claude can already read comes free, including
ones that do not exist yet.

The one thing it does not cover is the **unattended** case: a sweep that runs at 7am with
nothing open. That is Phase 5.6, and deliberately after.

### Authentication — personal access tokens first, OAuth later

- An `api_tokens` table: `id`, `user_id`, `name`, `token_hash`, `scopes`, `last_used_at`,
  `expires_at`, `revoked_at`. Deliberately the same shape as `household_invitations`, which
  already works and already has the RLS pattern.
- **Only the hash is stored.** The token is shown once, at creation, and never again.
- Managed from a settings page: create, name, see last use, revoke. That revoke flow is the same
  one 4.8 builds for invitations — which is part of why 4.8 comes first rather than being
  tidied up afterwards.
- Scopes stay coarse to begin with — `tasks:read`, `tasks:write` — because a scope nobody can
  explain is a scope nobody sets correctly.

**The API accepts either a session cookie or a bearer token.** Every route today resolves the
caller through `createClient()` and `supabase.auth.getUser()`. A single helper in
[lib/api.ts](lib/api.ts) resolves from whichever is present and returns the same shape, so route
bodies do not change. RLS is untouched: a token resolves to a `user_id`, and every existing
policy already keys off workspace membership for that user rather than off how they
authenticated.

**One prerequisite that is already written down.** The middleware matcher covers `/api/**`, so a
request with no session is redirected to `/login` and the caller gets a 200 and an HTML page
([KB.md](KB.md) #37). A bearer-token client would receive that HTML instead of JSON. #37 records
this as "worth fixing one day… nothing currently depends on it" — 4.9 is the thing that depends
on it. Exempting `/api` from the redirect and letting the routes answer for themselves is part
of that item, not a separate tidy-up.

**Deferred to 4.11: OAuth 2.1.** A claude.ai custom connector installs cleanly when the server
advertises protected-resource metadata and supports dynamic client registration — authorize,
token, registration and metadata endpoints, layered over the Supabase session. That is the
difference between pasting a token once and clicking Connect. It is polish over real work, so
it waits until the tool surface has proved itself.

### The tool surface

Deliberately small. Every tool goes through the existing route logic or the same `lib/`
helpers, never straight at a table.

| Tool | Notes |
|---|---|
| `list_workspaces` | Personal plus every household. Everything else takes a workspace id |
| `list_categories` | Needed before any write, because a task's category is what decides who can see it |
| `list_tasks` | Filter by workspace, status, horizon, due date, category |
| `create_tasks` | **Plural.** A meeting sweep produces several at once, and one round trip beats six |
| `update_task` | Title, category, due date, horizon, assignee |
| `complete_task` | Separate from update, because completing also advances a recurrence |
| `capture` | Free text in, structured tasks out — the brain dump, callable |

Two rules the tools inherit rather than reimplement:

- **Horizon fields are built by [lib/horizon.ts](lib/horizon.ts)**, never set directly
  ([KB.md](KB.md) #22). A model handed seven raw horizon columns will fill them inconsistently,
  and inconsistently is worse than not at all.
- **`capture` is the existing brain dump**, not a second parser. The model extracts; the server
  decides the dates ([KB.md](KB.md) #23).

`create_tasks` and `capture` return what they actually wrote, with ids, so the calling model can
report it back instead of guessing.

### What it forces

Two things stop being deferrable the day this ships, and both are already open items:

- **A quota on `capture`** (§Open items 6). Someone typing into a textarea does not call it
  forty times. A model in a loop does.
- **The Supabase Pro decision** (§Open items 5). A web app that is slow because the project was
  asleep is an annoyance you fix by waiting. A connector that returns a 500 to Claude is a tool
  the model records as broken and stops reaching for, in the middle of doing something for you.

### Sequence

4.8 small fixes → 4.9 tokens, bearer auth and the `/api` redirect exemption → 4.10 `/api/mcp`
and the tools → live with it → 4.11 OAuth. Then 5.6, the unattended sweep, only if it still
looks worth it.

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
| A token-authed API is a way in that needs no browser and no session (4.9) | A leaked token is silent, durable write access to every workspace its owner belongs to | Hash at rest, show once, scope it, expire it, list and revoke it in the UI, record last use. §"The Claude connector" |

---

## Verification

```bash
npm run lint          # ESLint: next/core-web-vitals, next/typescript, prettier
npm run build         # production build — also type-checks, since noEmit + strict
npm run test:e2e      # Playwright suite; starts the dev server itself
npm run check:docs    # the documentation guard
npm run verify:pwa    # the PWA, against a production build — see below
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

**The PWA is verified in two halves, because the suite cannot see all of it.** `e2e/pwa.spec.ts`
covers what the dev server can prove, all of it logged out — the manifest, the worker script,
the offline page and the icons are served rather than redirected to `/login`, and every page
links the manifest. Registration itself is production-only ([KB.md](KB.md) #32), so it is
checked by `npm run verify:pwa` against a real build:

```bash
npm run build
npx next start -p 3100     # in another shell
npm run verify:pwa         # BASE=<url> to point it at a deployment
```

It asserts Chrome parses the manifest without errors, the worker reaches `activated`, a failed
navigation lands on the offline page, and **nothing but hashed build assets is in the cache** —
that last one is the check that would catch a well-meant change starting to cache user data.

**Push is verified up to the push service, not onto a device.** `e2e/push.spec.ts` covers the
storage boundary — a registration needs a session, malformed endpoints are refused, re-registering
a device does not duplicate it, and one account can neither delete nor read another's devices,
including through the security definer function the assignment route uses. It also sends for
real: one test registers a syntactically valid endpoint belonging to nobody, so the push service
answers 404, and asserts both that the assignment still succeeds and that the dead subscription is
retired. What no test here can do is put a notification on a handset — the worker registers in
production builds only ([KB.md](KB.md) #32, #38).

---

## Open items to resolve as we go

1. **Use it for a week, not an hour.** The first handset session on 25 Aug 2026 found three
   things no automated check had (§Where we are, item 10) — a hit rate that says the remaining
   bugs of that kind are found by use, not by another test. The app is installed and running
   standalone; what is left is living with it.

   One thing genuinely cannot be re-checked on that device: **whether the browser now makes the
   install offer itself**, since it is already installed and Chrome will not offer again. If it
   matters, confirm it from a second device or a fresh browser profile — or accept the code
   reading, which is that suppressing it was the only thing stopping it ([KB.md](KB.md) #35).
2. **Generate the production VAPID pair and set it in Vercel.** The code and the migration are
   both live as of 26 Aug 2026; this is the only thing between them and a working notification.
   Dev has its own pair in `.env.local`; prod needs a different one, and until it exists push
   subscribes answer 503 and nothing can be sent. Vercel applies new variables to **new
   deployments only**, so redeploy after adding them. `npx web-push generate-vapid-keys`, then
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in the Production
   scope ([KB.md](KB.md) #38). Then confirm a real assignment notification arrives on the
   handset — that is what closes 4.3.
3. **Re-run the Supabase Performance advisor on prod** after the `initplan` migration reaches
   it, to confirm the `auth_rls_initplan` findings clear.
4. **Leaked password protection — blocked on plan.** Authentication → Providers → Email, and
   the setting is Pro-plan and above. Both projects are free tier, so there is nothing to
   toggle. Revisit with the Pro decision.
5. **The Pro decision itself.** It would unblock item 4, stop the projects pausing (§Risks), and
   make wiring the e2e suite into CI sensible. Settle it as one decision, not three — **now
   four**: a connector that 500s because the project is asleep is materially worse than a web
   page that is slow for the same reason (§"The Claude connector").
6. **Per-user daily quota on the brain dump.** Deferred while single-user. **Required before
   4.10 ships**, not before an external user arrives — `capture` exposed as an MCP tool can be
   called in a loop by a model, which is not a thing a person with a textarea does.
7. **Whether 1.18 has anything left in it** after 4.1. Look at what 4.1 changed before
   scheduling any of it.
8. **`shopping_list` UPDATE column rule lives only in the route layer.** RLS cannot express
   "restricted members may change `is_purchased` only". A trigger would be needed. Recorded
   rather than fixed.
9. **Google and Microsoft SSO are one job, not two.** 4.4 named only Microsoft. Each is a
   Supabase Auth provider toggle, a redirect URL on the allow-list and a button — the same work
   either way, so do the pair together. Both need an app registration on the provider side,
   which is the manual half and the reason this is listed here rather than only in §Phases.

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

- **25 Aug 2026** — the service worker is **not** an offline cache, and registers in production
  only. Every page is server-rendered per user and every API response is that user's live data,
  so a cached copy is planning data that looks current and is not — worse than an error, because
  you act on it. It therefore caches only Next's content-hashed build assets, where a hit cannot
  be the wrong version, plus a static offline page. Offline-first stays deferred to the Android
  phase, where a real local store would be the answer rather than an HTTP cache. Production-only
  registration is separate and practical: dev chunk URLs are not content-hashed, so a worker in
  development would serve stale JavaScript over a hot reload ([KB.md](KB.md) #32).

- **25 Aug 2026** — the browser makes the install offer; the in-app row is a backstop. The
  capture script for `beforeinstallprompt` originally called `preventDefault()`, which is what
  every tutorial does so the page can present its own button — and which suppresses the address
  bar icon on desktop and the prompt on Android. That traded the offer people already recognise
  for one they have to go looking for, and the first thing said about it on a real phone was
  that it should behave like the desktop. The default is left alone now. The row in the More
  sheet stays, because iOS Safari never fires the event and some Android browsers only offer
  install through their own menu ([KB.md](KB.md) #35).

- **26 Aug 2026** — Phase 4.3 ships assignment notifications and **no scheduler**. Web push needs
  something to decide when a reminder is due, and both free options were worse than waiting: a
  Vercel Hobby cron is limited to roughly daily, which makes a "reminder" a morning digest rather
  than a nudge before the task; and a GitHub Actions schedule every fifteen minutes would be
  accurate but adds a second system, a shared secret and a drift of five to fifteen minutes to
  reason about. Neither is worth it while the only user is one person who opens the app anyway.
  The push stack — subscriptions, worker, permission flow — is all built, so adding a scheduler
  later is an endpoint and a trigger, not a rewrite. Revisit with the Pro decision.

- **26 Aug 2026** — one session, one working tree, enforced by convention plus a briefing rather
  than by a gate. Two sessions ran in `C:\Dev\task-planner` at once and nearly overwrote each
  other's work on `PLAN.md`; the rule that would have prevented it was already written in
  `CONTRIBUTING.md` and simply not followed, so writing it more firmly was not the answer.
  `scripts/session-check.mjs` runs on a `SessionStart` hook and states the position — other
  working trees, their dirtiness, distance from `origin/main`, open PRs, live claims — because
  the failure was never disobedience, it was not knowing. It exits 0 always: a session blocked by
  its own tooling at startup is a session that disables the tooling.

- **26 Aug 2026** — `WORKSTREAMS.md` added, the second of the standard document set's Tier 2
  files. Its trigger is "the second concurrent session", and that fired. It is deliberately the
  *second* line of defence: a claim board cannot stop two processes writing the same file on
  disk, only two branches rewriting the same section of a document. The guard already validated
  the file before it existed — `check-docs` has looked for it since the retrofit — so adopting
  it cost a template and a seed, not a mechanism.

- **26 Aug 2026** — Clarity gets a **Claude connector**, and therefore does **not** get Teams,
  Outlook, Plaud or Fathom integrations. Those four were on the list as Phase 5.6 "M365
  integration", now retired: the connector removes the reason for them, because Claude holds
  connectors
  for all four, so once Clarity exposes tools it reads the meeting and calls `create_tasks`.
  Building them natively would mean four OAuth flows, four token stores, four refresh
  implementations and four polling jobs, to reproduce what the model on the other end does
  already. The connector is not one integration, it is the last one — every future source of
  tasks that Claude can read comes free. What it cannot do is run unattended, so 5.6 survives
  as the scheduled sweep only, and stays after.

- **26 Aug 2026** — the connector is sequenced **ahead of SSO and push reminders**, behind only
  two small fixes. The goal it serves — get a task in from wherever the thought happened — is
  the app's whole reason for existing, and its first item (4.9, the token-authed API) is a
  prerequisite for the Google and Microsoft work anyway, so doing it first costs nothing and
  unblocks the rest. The two fixes go first because one of them, revoking an invitation, builds
  the revoke flow the token settings page then reuses.

- **26 Aug 2026** — the connector authenticates with **personal access tokens, not OAuth**, for
  its first version. OAuth 2.1 with dynamic client registration is what makes it a one-click
  claude.ai connector, and it is real work — authorize, token, registration and metadata
  endpoints over the Supabase session. Pasting a token once buys the entire capability for a
  fraction of that, and the thing worth learning early is whether the *tool surface* is right,
  which a pasted token tests just as well. OAuth stays as 4.11, after the tools have been used.
