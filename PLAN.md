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
13. ✅ **Phase 4.8 — two small fixes.** PR #24, 26 Aug 2026. The install icon's four
    white wedges on a dark taskbar were the page background baked into the corners, and the PNGs
    had no alpha channel at all; the `purpose: "any"` icons are transparent there now, and the
    iOS icon is full bleed for the mirror-image reason ([KB.md](KB.md) #40). A household owner
    can revoke a pending invitation, which stops a link that has already been shared; an
    accepted one deliberately cannot be revoked ([KB.md](KB.md) #41).
14. ✅ **Phase 4.9 — the token-authed API.** PR #25, merged 26 Aug 2026, migration
    `20260826000002_api_tokens` applied to **dev and prod**, and `SUPABASE_SECRET_KEY` set in
    Vercel. A Connections page mints personal access
    tokens, shows each once, and revokes them; `/api` no longer redirects an unauthenticated
    caller to a login page ([KB.md](KB.md) #37); and a route accepts a bearer token only where it
    names a scope ([KB.md](KB.md) #45).

    **One assumption in the design was wrong, and the fix is worth knowing.** A token cannot be
    turned into a Supabase JWT here — the project's signing key is asymmetric — so a token is
    exchanged for a genuine user session through the Auth admin API instead, which keeps RLS
    exactly as it is rather than reaching for the service-role key ([KB.md](KB.md) #44). That
    needs `SUPABASE_SECRET_KEY` per environment.

    **Live and checked on prod:** `/api/tokens` answers `401` JSON to a session-less caller
    rather than an HTML login page, and an unknown bearer token gets a clean `401` — not the
    `503` that a missing secret key produces, and not the `500` a missing table would. What has
    not been done is minting a real token on prod and calling a route with it; the whole path is
    proven on dev.
15. 🔄 **Phase 4.10 — the Claude connector.** PR #27, 26 Aug 2026, migration
    `20260826000003_capture_quota` applied to **dev**. `/api/mcp` speaks JSON-RPC over POST and
    exposes the seven tools; a personal access token in an `Authorization` header is how a client
    gets in. Two endpoints the tools needed and the app had never had — `GET /api/tasks` and
    `GET /api/workspaces` — went in with it, because a page knows its workspace from the URL and
    a connector has to ask ([KB.md](KB.md) #47).

    **The capture quota shipped with it, as agreed** — twenty a day per user, counted in
    `lib/brain-dump.ts` so the textarea and the `capture` tool draw on one budget rather than one
    each ([KB.md](KB.md) #48). §Open items 6 is closed.

    **The e2e run found a bug that predates the connector.** Completing a recurring task could
    create its replacement due the *same day*, depending on the time of day the call happened —
    `nextOccurrence` compared timestamps where its unit is a day ([KB.md](KB.md) #49). Fixed
    here, since `complete_task` is a tool now and a model completing a weekly task would have
    produced a duplicate.

    **Not finished.** Nothing has connected to it from a real client yet: that needs a token
    minted in a browser and one `claude mcp add` on Warwick's machine (§Open items 12). **The
    migration does not reach prod by merging** — nothing in CI or Vercel touches the database, so
    it is a `supabase db push` against the prod project by hand
    ([CONTRIBUTING.md](CONTRIBUTING.md) §"Deploying a database migration", §Open items 13).
16. ⏭ **Next** — **4.11**, connector OAuth. It stopped being polish on 26 Aug 2026: **a pasted
    token cannot reach claude.ai**, so 4.10 puts Clarity in Claude Code and nowhere near the
    phone ([KB.md](KB.md) #46, §"The Claude connector"). 4.10 was built so OAuth is a third way
    to produce a `Caller` rather than a rewrite ([KB.md](KB.md) #47). SSO (4.4, now Google *and*
    Microsoft) and push reminders come after it.
17. ✅ **Supabase Pro on prod, agreed 26 Aug 2026.** Dev stays on the free tier. It stops the
    live app sleeping, unblocks leaked-password protection, and matters more with a connector in
    the picture than it ever did for a web page (§Decisions log, §Risks).
18. **Phase 5.6 is no longer "M365 integration."** Reading Outlook, Teams, Plaud or Fathom
    *interactively* is what the connector gives away for nothing, because Claude already holds
    connectors for all four. 5.6 is now only the **unattended** case — a sweep that runs with
    nothing open. See §Phases, Phase 5.
19. **Deferred by decision, not oversight** — Phase 1 items 1.15 (AI planning assistant), 1.16
    (brain dump AI steering) and 1.17 (calendar time slots) are unbuilt and not blockers.
    **1.18 (UI density pass) was largely absorbed by 4.1** — touch target sizes and hover states
    were reworked throughout. Check what 4.1 actually did before rebuilding any of it.
20. **Open manual items** — see §Open items. Both of the items that 4.10 was going to force are
    settled: the quota shipped with it, and the Pro decision was taken. What is left is manual —
    the Pro upgrade itself, the prod VAPID pair, and connecting a real client to the connector.

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
| 4.4 | **Google and Microsoft** OAuth — **additive**, not a replacement for email/password | After 4.11 |
| 4.5 | Voice input — Whisper transcription into the brain dump | Not started |
| 4.6 | Billing — Stripe, free personal tier vs paid household tier | Deferred until an external household wants in |
| 4.7 | Onboarding improvements — guided household setup | Not started |
| 4.8 | Two small fixes — the install icon's white corners, and revoking a household invitation | ✅ PR #24, 26 Aug 2026 |
| 4.9 | Token-authed API — personal access tokens, bearer auth alongside the session cookie | ✅ PR #25, merged 26 Aug 2026, live on prod |
| 4.10 | Claude connector — `/api/mcp`, the tool surface, authenticated with a pasted token | ✅ PR #27, 26 Aug 2026 — nothing has connected from a real client yet |
| 4.11 | Connector OAuth 2.1 — the only way a connector reaches claude.ai and the phone | **Next** — §"The Claude connector" |

**4.8 is done, and both halves needed a little more than the diagnosis said.** The icons had no
alpha channel at all, and the fix is per icon rather than global: the `purpose: "any"` pair is
transparent outside the rounded rect, while the maskable icon and `apple-touch-icon.png` stay
opaque and are now *both* full bleed — iOS applies its own rounding to whatever square it is
handed, so the rounded artwork left slivers there for the same reason the taskbar showed wedges
([KB.md](KB.md) #40). Revoking an invitation was as small as expected — a DELETE route and a
button — with one addition: an *accepted* invitation is not revokable, because the row is the only
record that the person was invited and deleting it would not remove their membership
([KB.md](KB.md) #41). The invite POST returns the row it created, since the client was inventing
an id it could not then revoke.

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

**The API accepts either a session cookie or a bearer token.** Built 26 Aug 2026 as
`requireCaller()` in [lib/api-auth.ts](lib/api-auth.ts) — its own file rather than
[lib/api.ts](lib/api.ts), which holds response helpers and has no Supabase dependency. It resolves
from whichever credential is present and returns the same two things either way, so route bodies
barely change. **A route stays session-only until it names the scope it needs**, so the token
surface is what somebody chose rather than everything that exists ([KB.md](KB.md) #45).

RLS is untouched, and that took more than the sentence above it implies: a token resolves to a
`user_id`, but the client acting for that user has to hold a Supabase JWT, and this project's
signing key is asymmetric — so the session is bought from the Auth admin API and cached, rather
than signed here or faked with the service-role key ([KB.md](KB.md) #44, §Decisions log
26 Aug 2026).

**One prerequisite that was already written down, and is now done.** The middleware matcher covers
`/api/**`, so a request with no session was redirected to `/login` and the caller got a 200 and an
HTML page ([KB.md](KB.md) #37) — a bearer client would have received that HTML instead of JSON.
#37 recorded it as "worth fixing one day… nothing currently depends on it"; 4.9 was the thing that
depended on it. `/api` is exempt from the redirect as of 26 Aug 2026 and every route answers 401
itself, which each of them already did.

**4.11: OAuth 2.1 — and it is not polish.** This section said it was, on the grounds that it is
"the difference between pasting a token once and clicking Connect". That was wrong, and the
correction is the most important thing on this page: **a pasted token cannot reach claude.ai at
all.** Claude Code takes a static header —
`claude mcp add --transport http clarity <url>/api/mcp --header "Authorization: Bearer clr_…"` —
and Claude Desktop can be configured the same way. But a claude.ai custom connector, on the web
and in the phone app, is added by URL and authenticated by **OAuth only**; its advanced settings
take an OAuth client ID and secret, and there is no field for a static token or header
([KB.md](KB.md) #46).

So the split is not convenience versus effort, it is **the terminal versus the phone**. 4.10 with
a pasted token puts Clarity in Claude Code on this machine, which is enough to find out whether
the seven tools are the right seven. It does not put Clarity anywhere near the place most thoughts
actually happen, which is the goal the connector exists to serve. 4.11 is therefore the next thing
after 4.10 rather than a someday item: the server advertises protected-resource metadata and
supports dynamic client registration — authorize, token, registration and metadata endpoints,
layered over the Supabase session.

**Build 4.10 so that OAuth is an added path, not a rewrite.** `requireCaller()` already resolves a
credential into a `Caller`; an OAuth access token becomes a third way to produce one, alongside the
session cookie and the personal access token ([KB.md](KB.md) #44, #45).

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

**Built 26 Aug 2026, and three things about it are worth knowing before changing it**
([KB.md](KB.md) #47):

- **Two endpoints had to be added first.** `GET /api/tasks` did not exist — every page reads its
  tasks server-side and renders them, so listing was the one thing the API could not do — and
  nothing anywhere listed workspaces, because a page knows which one it is on from its URL. Both
  are now real routes, session or token, and the tools use them through the same `lib/` helpers.
- **Scope is checked per tool, not at the endpoint.** Reaching `/api/mcp` needs `tasks:read`; a
  tool that writes checks `tasks:write` itself. A read-only token gets a connector that lists and
  refuses to write, instead of a 403 on `initialize`.
- **`capture` saves what it extracts**, and returns the rows with ids — there is no review panel
  on the other end of a tool call. `save: false` extracts without writing, which still spends one
  of the day's twenty.

### What it forces

Two things stop being deferrable the day this ships, and both are already open items:

- **A quota on `capture`** (§Open items 6). Someone typing into a textarea does not call it
  forty times. A model in a loop does.
- **The Supabase Pro decision** (§Open items 5). A web app that is slow because the project was
  asleep is an annoyance you fix by waiting. A connector that returns a 500 to Claude is a tool
  the model records as broken and stops reaching for, in the middle of doing something for you.

### Sequence

4.8 small fixes ✅ → 4.9 tokens, bearer auth and the `/api` redirect exemption ✅ → 4.10 `/api/mcp`
and the tools ✅ → **live with it from Claude Code** → 4.11 OAuth, which is what reaches claude.ai
and the phone. Then 5.6, the unattended sweep, only if it still looks worth it.

**Adding it to Claude Code**, once a token exists on the Connections page:

```bash
claude mcp add --transport http clarity https://task-planner-nine-sigma.vercel.app/api/mcp   --header "Authorization: Bearer clr_…"
```

---

## Risks

| Risk | What is lost | Mitigation |
|---|---|---|
| Prod Supabase pauses after ~7 days idle on the free tier | The live app goes down until manually restored from the dashboard | **Being fixed: Pro on prod, agreed 26 Aug 2026** (§Decisions log). Dev stays free and still pauses, which only ever costs the e2e suite a wake-up |
| `verify` cannot be *required* on a free GitHub plan | A red check merged to `main` deploys straight to production | Convention plus the `pre-push` hook. Wait for green before merging — nothing enforces it |
| A push to `main` is a production deploy, with no staging step | A bad merge is live in ~2 minutes | Branch-per-change, PR-only, squash merges. See [CONTRIBUTING.md](CONTRIBUTING.md) |
| The e2e suite is not wired into CI | A regression reaches `main` unnoticed | Deliberate — a sleeping dev project would turn `verify` red for unrelated reasons. Revisit with the Pro decision |
| Two GitHub accounts on the machine, and `gh auth switch` is global | A bare `403` on push, naming no cause | Repo-local credential pin, enforced by `pre-push`. See [KB.md](KB.md) #27 |
| The brain dump calls a model on demand | A caller in a loop could run up the Anthropic bill | **Fixed in 4.10:** twenty captures per user per UTC day, counted atomically and shared between the textarea and the `capture` tool ([KB.md](KB.md) #48), on top of the 10,000-character cap |
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
links the manifest. It also asserts each icon's PNG colour type, which is the only observable
trace of the white-corner bug: the icons were the right size and type at the right URL and simply
looked wrong ([KB.md](KB.md) #40). Registration itself is production-only ([KB.md](KB.md) #32), so it is
checked by `npm run verify:pwa` against a real build:

```bash
npm run build
npx next start -p 3100     # in another shell
npm run verify:pwa         # BASE=<url> to point it at a deployment
```

It asserts Chrome parses the manifest without errors, the worker reaches `activated`, a failed
navigation lands on the offline page, and **nothing but hashed build assets is in the cache** —
that last one is the check that would catch a well-meant change starting to cache user data.

**Token auth is verified end to end, and needs a server secret to be.** `e2e/tokens.spec.ts`
covers the lifecycle (shown once, listed by prefix, revoked, revoked twice), scope enforcement,
that `/api/tokens` refuses a token, that a revoked token stops working on its next call, and —
the one that matters most — that a token cannot read another user's task. That last assertion is
what proves the token is a *user session* rather than a service-role client; if it ever passes
for the wrong reason, one token is a way into every workspace in the database. These tests are
deliberately **not** skipped when `SUPABASE_SECRET_KEY` is missing, because a deployment without
it answers 503 to every token call and a silent skip would read as a pass ([KB.md](KB.md) #44).

**Push is verified up to the push service, not onto a device.** `e2e/push.spec.ts` covers the
storage boundary — a registration needs a session, malformed endpoints are refused, re-registering
a device does not duplicate it, and one account can neither delete nor read another's devices,
including through the security definer function the assignment route uses. It also sends for
real: one test registers a syntactically valid endpoint belonging to nobody, so the push service
answers 404, and asserts both that the assignment still succeeds and that the dead subscription is
retired. What no test here can do is put a notification on a handset — the worker registers in
production builds only ([KB.md](KB.md) #32, #38). That last step is done by hand, from the
notification bell: turn push on, then **Send a test notification**. It exists because an
assignment to yourself notifies nobody, so one person otherwise has no way to see push work at
all.

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
4. **Leaked password protection — unblocked the moment prod is on Pro.** Authentication →
   Providers → Email, and the setting is Pro-plan and above ([KB.md](KB.md) #12). Prod is going to
   Pro (agreed 26 Aug 2026), so this becomes a single toggle there; dev stays free and therefore
   stays without it, which is the right way round — the passwords that matter are the live ones.
5. **The Pro decision — taken on 26 Aug 2026: Pro on prod, dev stays free.** What is left is the
   upgrade itself, in the Supabase dashboard, and then item 4's toggle. Dev staying free means the
   dev project still sleeps after ~7 days, so the e2e suite still meets a paused project after a
   quiet week (§Risks, [KB.md](KB.md) #4) — an annoyance with a known cause, which is why wiring
   the suite into CI stays out of scope (§Decisions log, 25 Aug 2026).
6. ✅ **Per-user daily quota on the brain dump — shipped with 4.10**, 26 Aug 2026.
   `MAX_CAPTURES_PER_DAY` is 20, in [lib/limits.ts](lib/limits.ts) with the other input limits,
   and the count lives in `capture_usage` with `consume_capture_quota()` doing the increment and
   the decision in one statement. It is consumed in **`lib/brain-dump.ts`**, which is one level
   below the route the agreed shape named — the textarea and the tool both go through the helper,
   which is what "one budget" required ([KB.md](KB.md) #48).
7. **Whether 1.18 has anything left in it** after 4.1. Look at what 4.1 changed before
   scheduling any of it.
8. **`shopping_list` UPDATE column rule lives only in the route layer.** RLS cannot express
   "restricted members may change `is_purchased` only". A trigger would be needed. Recorded
   rather than fixed.
9. **Google and Microsoft SSO are one job, not two.** 4.4 named only Microsoft. Each is a
   Supabase Auth provider toggle, a redirect URL on the allow-list and a button — the same work
   either way, so do the pair together. Both need an app registration on the provider side,
   which is the manual half and the reason this is listed here rather than only in §Phases.
10. **Mint a token on prod and call one route with it.** Everything under it is done — the key
    is in Vercel, the migration is applied, and prod answers 401 rather than 503 to an unknown
    token, which is what proves the key is being read. What is left is one real token used once,
    which needs a browser session on the live app and is therefore the only part nobody has done.
11. **`firstOccurrence` has the same day-vs-moment bug `nextOccurrence` had.** It asks for the
    first occurrence on or after midday, so an occurrence earlier that day is missed and the task
    form offers the next period instead of today ([KB.md](KB.md) #49). Left alone on purpose:
    nothing tests what the form offers, and the fix is a behaviour change made on a code reading.
    Worth doing with a test rather than without one.
12. **Connect a real client to `/api/mcp`.** The whole surface is proven by the e2e suite through
    the protocol, but no Claude has spoken to it yet — and the questions 4.10 exists to answer are
    whether the seven tools are the right seven and whether the descriptions are enough to be
    used correctly. It needs a token from the Connections page and one `claude mcp add`
    (§"The Claude connector"). **This is what closes 4.10.**
13. **Push `20260826000003_capture_quota` to prod.** It is on dev. **Merging does not apply it** —
    CI runs lint and build, Vercel builds and deploys the app, and neither touches the database.
    Until it is pushed, the live app answers 500 from the brain dump and from `capture`, because
    `consume_capture_quota` does not exist there. Commands in
    [CONTRIBUTING.md](CONTRIBUTING.md) §"Deploying a database migration"; the prod password is
    `SUPABASE_DB_PASSWORD_PROD` in `.env.local`, and the last step is re-linking the CLI to dev.

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

- **26 Aug 2026** — an accepted invitation cannot be revoked. Revoking deletes the invitation
  row, which is what makes the shared link stop resolving; on an accepted one that would destroy
  the only record that the person was invited and by whom, and would not remove their membership,
  which lives in `workspace_members`. Removing a member is a different feature and is not built.
  The route filters on `accepted_at is null` and answers 404 otherwise, so the two cases cannot
  be confused by a caller ([KB.md](KB.md) #41).

- **26 Aug 2026** — a bearer token is exchanged for a real user session, not run against the
  service-role key. The plan assumed a token could resolve to a `user_id` and leave RLS untouched,
  which is right about the goal and silent about the mechanism: doing that properly means signing a
  Supabase JWT, and this project's in-use signing key is ES256, so the private half is not ours to
  sign with. Of the three ways out — trust the legacy HS256 key that is already marked
  `previously_used`, register our own JWKS as a third-party auth provider on both projects, or buy
  a genuine session from the Auth admin API — the third is the only one that adds no project-level
  configuration and no key of our own to rotate. It costs a privileged secret in the environment
  and three Auth calls per hour per instance. The first was rejected because it works until Supabase
  finishes a rotation nobody here controls, and the second because it makes the app a token issuer
  for the whole project to save a cache lookup. Using the service-role key directly was rejected
  outright: it would turn 53 RLS policies into comments and leave the route layer as the only thing
  between a leaked token and every household in the database ([KB.md](KB.md) #44).

- **26 Aug 2026** — routes are session-only until they name a token scope, rather than accepting
  tokens everywhere and blocking the sensitive ones. Both directions are one line per route; they
  differ in what happens to the route somebody adds next month, which under the other default
  would be reachable by every token in existence before anyone had thought about it. It also keeps
  the token surface honestly small — tasks and categories — matching the tool surface rather than
  quietly exceeding it ([KB.md](KB.md) #45).

- **26 Aug 2026** — Supabase **Pro on prod, dev stays free**. The upgrade was on the list as one
  decision wearing four hats: leaked-password protection is Pro-only, both projects sleep after
  ~7 days idle, the e2e suite cannot sensibly join CI while dev sleeps, and a connector makes the
  sleeping worse. Splitting it by project settles all four honestly rather than paying twice: the
  live app must not sleep and its passwords must be checked against known breaches, while dev
  sleeping costs one wake-up before a test run and nothing else. It also keeps the e2e-in-CI
  decision where it already was — out of scope, for the same reason as before, now stated as a
  consequence rather than a coincidence.

- **26 Aug 2026** — **4.11 OAuth moves to immediately after 4.10**, and this file's description of
  it as polish is withdrawn (§"The Claude connector"). A claude.ai custom connector authenticates
  by OAuth only: it is added by URL, its advanced settings take an OAuth client ID and secret, and
  there is no field for a static token or header. Claude Code and Claude Desktop can both pass
  `Authorization: Bearer` from configuration, so a pasted token is genuinely useful — but only in
  the terminal and on the desktop. The connector exists so that a task gets in from wherever the
  thought happened, and that is usually a phone, so stopping after 4.10 would ship the mechanism
  without the goal. 4.10 still goes first, because what needs proving is whether the seven tools
  are the right seven and Claude Code proves that perfectly well ([KB.md](KB.md) #46).

- **26 Aug 2026** — **the MCP endpoint is written by hand, not with the MCP SDK.** The SDK's
  streamable-HTTP transport wants a Node request and response pair to write a stream into; an App
  Router route handler has a Web `Request` and returns a `Response`. Bridging them is more code
  than the protocol Clarity uses, which is four methods, no streaming and no session. The cost of
  the decision is that a future protocol revision is ours to follow rather than something a
  dependency does for us — accepted, because the surface is small enough to read in one sitting
  ([KB.md](KB.md) #47).

- **26 Aug 2026** — **scope is checked per tool rather than at the endpoint.** `/api/mcp` could
  have required `tasks:write` and been done with it. Instead reaching it needs `tasks:read` and
  each tool names what it needs, so a read-only token gets a connector that lists and refuses to
  write rather than a 403 on `initialize`. It also keeps #45's default intact one level down: a
  tool added next month is unreachable by every token in existence until it declares a scope.

- **26 Aug 2026** — **`capture` writes, and `create_tasks` does not parse.** The app's brain dump
  extracts, shows a review panel, and saves on confirmation. There is no review panel on the far
  end of a tool call, so `capture` saves what it extracted and returns the rows with their ids for
  the calling model to report back; `save: false` is there for a genuine preview and still spends
  one of the day's captures, because the model call is what the quota exists to limit. The two
  tools stay distinct for the same reason they read differently to a model: prose goes to
  `capture`, a decided list goes to `create_tasks`.

- **26 Aug 2026** — **the quota is enforced in `lib/brain-dump.ts`, one level below where
  §Open items 6 said "the route".** The intent of that wording was one budget rather than two, and
  the route is the wrong altitude for it now that the tool calls the same helper directly. Putting
  the count in the helper is what makes twenty mean twenty ([KB.md](KB.md) #48).
