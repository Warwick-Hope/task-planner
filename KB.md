# Clarity — Knowledge Base

Hard-won lessons and gotchas for this app, its Supabase projects, its test suite and its
deploy. **Read this before starting any non-trivial task.**

**Adding an entry.** Take the next number after the highest in the index below — not the
highest you can see at the end of the file. Append the entry to the end of its section, add its
row to the end of the index, and leave every existing number alone: they are cited from
`CLAUDE.md`, `PLAN.md` and commit messages.

**Reading it.** Start at the index. Most tasks need one section, not the whole file. The status
column matters more than it looks — an entry can hold a live rule and a dead number at the same
time.

**Correcting an entry.** Fix the sentence that states the wrong thing, and put the withdrawal
note at the *top* of the entry, where a skim-reader meets it first. Never leave a dead figure
standing with its retraction further down. Add the figure to the retired-facts registry in
[CLAUDE.md](CLAUDE.md).

---

## Environment

Two Supabase projects, both in `eu-west-1`, both on the **free tier**, both under Warwick's
**personal** Supabase org (transferred from Plant Plan; the project IDs did not change).

| | Project ref | Used by |
|---|---|---|
| **Dev** | `fxczpsznrcxykfsiyvty` | Local dev, the Playwright suite, the Supabase MCP, the linked CLI |
| **Prod** | `ialovkohwdlkpgsrqrjo` | The live app at <https://task-planner-nine-sigma.vercel.app> |

**The MCP points at dev only.** Never touch prod through it, and never run a destructive
operation on prod at all.

**GitHub:** <https://github.com/Warwick-Hope/task-planner>, private, personal account
`Warwick-Hope`. **Vercel:** project `task-planner-nine-sigma`, team `warwick-hope-pvt-projects`.

### `.env.local` — local dev, points at **dev**

Never committed. The same variable names are used in both environments; only the values differ.

```env
NEXT_PUBLIC_SUPABASE_URL=https://fxczpsznrcxykfsiyvty.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev anon key>
ANTHROPIC_API_KEY=<anthropic key — same key for dev and prod>
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Playwright only — the two dedicated test accounts (#14)
E2E_USER_EMAIL=warwickhope93+e2e@gmail.com
E2E_USER_PASSWORD=<password>
E2E_USER2_EMAIL=warwickhope93+e2e2@gmail.com
E2E_USER2_PASSWORD=<password>

# Web push (#38). Dev pair only — prod has its own, set in Vercel.
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key from: npx web-push generate-vapid-keys>
VAPID_PRIVATE_KEY=<the matching private key — server only, never NEXT_PUBLIC_>
VAPID_SUBJECT=mailto:warwickhope93@gmail.com

# Supabase CLI only — NOT read by the app (#5)
SUPABASE_ACCESS_TOKEN=<personal-account token from supabase.com → Account → Access Tokens>
```

### Vercel environment variables — production, points at **prod**

Set in Vercel → Project → Settings → Environment Variables, Production scope only:
`NEXT_PUBLIC_SUPABASE_URL` (prod), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (prod), `ANTHROPIC_API_KEY`
(the same key), `NEXT_PUBLIC_APP_URL` = the Vercel URL, and the **prod** web push pair —
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (#38).

`NEXT_PUBLIC_APP_URL` was missing here for months and nothing said so, because the only thing
that read it was the invitation link — which quietly came out as a bare path (#36). Nothing reads
it on the critical path now, but the same trap applies to the VAPID pair: without it, push
subscribes fail with a 503 that only shows in the notification bell.

Prod Supabase → Authentication → URL Configuration must have **Site URL** set to the Vercel URL
and a **wildcard redirect** `https://task-planner-nine-sigma.vercel.app/**` — signup redirects
to `/api/auth/callback` and the allow-list is exact-match, so a bare origin is not enough.

---

## Index

Every entry, in number order. Statuses are the point of this table.

| # | Entry | Where | Status |
|---|---|---|---|
| 1 | `supabase db push` has no project-ref flag | Supabase and migrations | Live |
| 2 | IPv6-only direct host — use the IPv4 pooler URL | Supabase and migrations | Live |
| 3 | The Supabase MCP cannot apply migrations | Supabase and migrations | Live |
| 4 | Free-tier projects pause after ~7 days idle | Supabase and migrations | Live |
| 5 | The CLI login is the wrong account, and it prompts for a password | Supabase and migrations | Live |
| 6 | `getUser()` in middleware, never `getSession()` | Auth, RLS and security | Live |
| 7 | `/invite/[token]` must be exempt from the auth redirect | Auth, RLS and security | Live |
| 8 | An unqualified column in an RLS subquery binds to the inner table | Auth, RLS and security | Live |
| 9 | Supabase grants `anon` EXECUTE explicitly, and it survives a revoke from PUBLIC | Auth, RLS and security | Live |
| 10 | `auth.uid()` in a policy must be `(select auth.uid())` | Auth, RLS and security | Live |
| 11 | `rls_auto_enable()` is a DDL event trigger — the advisor warning is noise | Auth, RLS and security | Live |
| 12 | Leaked password protection is Pro-plan only, and not where you would look | Auth, RLS and security | Live rule, corrects a dead one |
| 13 | RLS cannot express a column-level rule — the route layer holds it | Auth, RLS and security | Live |
| 14 | The e2e accounts are fixed, not created per run | The e2e suite | Live |
| 15 | Email confirmation is off on dev and on in prod | The e2e suite | Live |
| 16 | Do not read `page.url()` immediately after sign-in | The e2e suite | Live |
| 17 | Storage-state paths live in `helpers.ts`, not the setup file | The e2e suite | Live |
| 18 | The overflow check walks the DOM, because `body` has `overflow-x: clip` | The e2e suite | Live |
| 19 | The brain-dump happy path is stubbed; the real call is `@live` | The e2e suite | Live |
| 20 | Teardown sweeps `[e2e]` rows because a failing test skips its own cleanup | The e2e suite | Live |
| 21 | The suite is deliberately not in CI | The e2e suite | Live |
| 22 | `lib/horizon.ts` is the only place horizon fields are derived | The app | Live |
| 23 | The brain dump: what the model does, and what it must not do | The app | Live |
| 24 | Five components render a task — the logic is shared, not copied | The app | Live |
| 25 | Drag activation constraints, or a swipe drags instead of scrolling | The app | Live |
| 26 | `group-hover` controls do not exist on a touch screen | The app | Live |
| 27 | Two GitHub accounts — pin per repo, never switch | Git and deploy | Live |
| 28 | A push to `main` is a production deploy | Git and deploy | Live |
| 29 | `git branch -d` refuses after a squash merge | Git and deploy | Live |
| 30 | Worktrees go outside the repository | Git and deploy | Live |
| 31 | The PWA's three files must be exempt from the middleware matcher | Auth, RLS and security | Live |
| 32 | The service worker caches no user data, and registers in production only | The app | Live |
| 33 | Editing `next.config.mjs` wedges a running dev server, and Playwright reuses it | The e2e suite | Live |
| 34 | Phone navigation is a bottom tab bar, not a scrolling strip | The app | Live |
| 35 | `beforeinstallprompt` fires before hydration, and often not at all | The app | Live |
| 36 | A link that leaves the app is built from the request, not `NEXT_PUBLIC_APP_URL` | The app | Live |
| 37 | The whole API answers HTML to a caller with no session | Auth, RLS and security | Live |
| 38 | Web push: a VAPID pair per environment, and what cannot be tested | The app | Live |
| 39 | Two sessions in one working tree — git isolates branches, not directories | Git and deploy | Live |
| 40 | An app icon needs alpha in some places and not others | The app | Live |
| 41 | An accepted invitation is a record, not a pending action | The app | Live |
| 42 | An optimistic UI means a reload can beat the write it is asserting | The e2e suite | Live |

---

## Supabase and migrations

### 1. `supabase db push` has no project-ref flag

`db push` pushes to whichever project the CLI is **linked** to. There is no `--project-ref` on
it, so the pattern of naming the target on the command line does not work and never did.

To push to prod you must re-link, push, and re-link back:

```powershell
supabase link --project-ref ialovkohwdlkpgsrqrjo   # prod
supabase db push --linked
supabase link --project-ref fxczpsznrcxykfsiyvty   # dev — always do this after
```

**Never leave the CLI pointed at prod.** The next `db push` from a session that assumes dev
would apply an untested migration to the live database.

### 2. IPv6-only direct host — use the IPv4 pooler URL

If the CLI reports `IPv6 is not supported on your current network`, pass the IPv4 pooler URL
explicitly instead of relying on the link:

```powershell
$pw = "<the matching database password>"
$u  = "postgresql://postgres.<project-ref>:" + [uri]::EscapeDataString($pw) + "@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
supabase db push --db-url $u --dry-run     # always dry-run first
supabase db push --db-url $u --yes
supabase inspect db table-stats --db-url $u
```

The direct host `db.<ref>.supabase.co` resolves to IPv6 only, so on an IPv4-only network every
command that uses it fails. `link` caches an IPv4 pooler URL in `supabase/.temp/pooler-url`,
but it holds **one project at a time** — after linking to prod it may still contain dev's,
which is what produces the confusing IPv6 error when you thought you had linked correctly.
`--db-url` sidesteps the whole problem.

**A paused project produces the same message for a different reason** (`no such host` — the DNS
record is withdrawn while it sleeps). Check the project is awake before debugging the network.
See #4.

### 3. The Supabase MCP cannot apply migrations

It lacks the permission. Every migration is a CLI step, from a shell, with the token set. The
MCP is for reading — tables, logs, advisors — and it points at dev only.

The dashboard **Advisors** (Security and Performance) are also dashboard-only; the MCP cannot
run them.

### 4. Free-tier projects pause after ~7 days idle

Both projects are on the free tier. A paused **prod** project takes the live app down until
somebody restores it by hand from the dashboard. A paused **dev** project breaks the Playwright
suite and produces #2's misleading network error.

This is the single strongest argument for the Pro decision — it is the same upgrade that
unblocks #12.

### 5. The CLI login is the wrong account, and it prompts for a password

The CLI's stored login is the **Plant Plan** account, not the personal one that owns these
projects. Set the token per session rather than running `supabase login`, which would disrupt
the Plant Plan CLI:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<value from .env.local>"
$env:SUPABASE_DB_PASSWORD  = "<dev database password>"
supabase db push --linked
```

`SUPABASE_DB_PASSWORD` matters as much as the token: without it the CLI prompts for the
password, and **in a non-interactive shell that hangs** rather than failing.

---

## Auth, RLS and security

### 6. `getUser()` in middleware, never `getSession()`

[middleware.ts](middleware.ts) calls `supabase.auth.getUser()` on every request, per Supabase
SSR guidance. `getSession()` reads the cookie without validating it against the auth server, so
it will happily report a session that has been revoked. Do not swap it in for speed.

### 7. `/invite/[token]` must be exempt from the auth redirect

The middleware redirected **every** unauthenticated request to `/login`, so `/invite/[token]`
never rendered for a logged-out visitor and the page's own "sign in to accept" branch was dead
code — the entire point of an invitation link. The invite path is now exempt, and the redirect
carries `?next=` (same-origin paths only) so signing in returns the visitor to the invite
rather than the dashboard.

Any new publicly-reachable route needs the same exemption, and the same `?next=` handling.

### 8. An unqualified column in an RLS subquery binds to the inner table

The four `household_profiles` policies compared `wm.workspace_id` to an unqualified
`workspace_id`. Postgres resolves that to the **inner** table's own column, making the
comparison a tautology — so membership of *any* workspace granted read and write access to
*every* household's child profiles.

Qualify both sides of every comparison in a policy subquery. Fixed in
`20260815000003_sec_rls_tighten.sql`.

### 9. Supabase grants `anon` EXECUTE explicitly, and it survives a revoke from PUBLIC

`accept_household_invitation`, `create_household_workspace` and `create_personal_workspace`
each ran `revoke all … from public` and were still callable by `anon`, because Supabase's
default privileges grant EXECUTE to the `anon` role **explicitly** — and an explicit grant is
not removed by revoking from PUBLIC.

Revoke from `anon` (and `authenticated` where appropriate) by name. Done in
`20260817000001_advisor_cleanup.sql`; verified on dev by an anon call to
`create_household_workspace` returning 401.

### 10. `auth.uid()` in a policy must be `(select auth.uid())`

Bare `auth.uid()` in a policy is re-evaluated **per row**. Wrapping it in a scalar subquery lets
the planner evaluate it once per query — the `auth_rls_initplan` advisor finding.
`20260825000001_rls_initplan.sql` rewrote 53 policies; 6 were skipped because they call the
security-definer helpers rather than `auth.uid()` directly.

The migration **rewrites from `pg_policies` rather than listing the policies by hand.** The live
set is the result of 89 create/drop statements across 14 migrations, so transcribing the
survivors would have been a guess, and a wrong guess silently changes who can read what. It is
idempotent and announces every policy it rewrites. Copy that approach for any future
across-the-board policy change.

### 11. `rls_auto_enable()` is a DDL event trigger — the advisor warning is noise

`public.rls_auto_enable()` returns `event_trigger` and takes no arguments, so it fires on DDL
and **PostgREST cannot invoke it at all**. The advisor's "public can execute" warning against it
is therefore meaningless. It almost certainly auto-enables RLS on newly created tables. Keep it.

Thirteen other SECURITY DEFINER warnings are also deliberate — see the decisions log in
[PLAN.md](PLAN.md) for why `get_invitation_by_token` and the two membership helpers keep their
anon access.

### 12. Leaked password protection is Pro-plan only, and not where you would look

> The location previously recorded for this setting was wrong, and the item was recorded as
> actionable when it is not. Both are corrected here.

The setting lives at **Authentication → Providers → Email**. Supabase documents it as available
on the **Pro Plan and above**. Both projects are on the free tier, so **there is nothing to
toggle** — this is blocked on the plan, not on us. Revisit with the Pro decision
([PLAN.md](PLAN.md) §Open items 3 and 4).

### 13. RLS cannot express a column-level rule — the route layer holds it

`shopping_list` UPDATE stays open to every member at the RLS layer, because row-level policies
cannot say "restricted members may change `is_purchased` only". The **route** enforces that
column rule; a trigger would be needed to enforce it in the database.

This is why `e2e/invite.spec.ts` pins the distinction explicitly: a restricted member **may**
tick a shopping item off but **may not** rename it. Nothing else would catch that regressing.

### 31. The PWA's three files must be exempt from the middleware matcher

`manifest.webmanifest`, `sw.js` and `offline.html` are fetched **outside any page context** —
Chrome reads the manifest and the worker script itself, with no session in hand. The middleware
matcher excludes `_next/static` and image extensions, so all three were matched, and a
session-less request was answered with a 307 to `/login`.

A redirect is neither a manifest nor JavaScript, so the install fails — and it fails *quietly*:
no console error worth reading, no failed request in the network tab that looks wrong, just an
app Chrome declines to offer to install. All three are now named in the matcher's negative
lookahead, alongside the `/invite/` exemption (#7).

They expose nothing: static files with no user data on them. `e2e/pwa.spec.ts` asserts each one
answers **logged out**, which is the only state in which this breaks.

### 37. The whole API answers HTML to a caller with no session

The middleware matcher covers `/api/**`, so an unauthenticated request to any route is redirected
to `/login` and the caller receives a 200 and an HTML page. The `unauthorised()` 401 in each route
is therefore **unreachable from a browser without a session** — it only fires for a request that
carries a session cookie the route itself rejects.

Two consequences. Writing a test that asserts 401 for an anonymous caller will fail with a
confusing `Received: 200`, and the honest assertion is that the response URL is `/login`
(`e2e/push.spec.ts` does this). And client code that assumes a failed `fetch` returns JSON will
throw a parse error rather than see a status — which is a real if minor wart in the app, not
something any one route chose.

Worth fixing one day by exempting `/api` from the redirect and letting the routes answer for
themselves. Not done: it changes the behaviour of every route at once, and nothing currently
depends on it.

---

## The e2e suite

### 14. The e2e accounts are fixed, not created per run

Two dedicated accounts, never Warwick's own login: `warwickhope93+e2e@gmail.com` (owner, does
almost everything) and `warwickhope93+e2e2@gmail.com` (invitee, exists so the invitation flow
has someone to accept).

They are fixed because **without a `service_role` key the suite cannot delete auth users**, so
disposable accounts would accumulate forever. Freshness comes from creating a **new household
each run** and deleting it in teardown — which also stops the invitee staying a member, since
`accept_household_invitation` rejects a second attempt with "Already a member of this
household" and would make the invite test pass once and then fail forever.

`auth.setup.ts` signs both in and saves sessions to `e2e/.auth/user.json` and `user2.json`
(gitignored). Specs default to the owner's; the invite spec opens a second context with
`INVITEE_STATE`. Logged-out assertions opt out with `test.use({ storageState: … })`.

**Single worker, no parallelism** — every test shares one account and one workspace.

### 15. Email confirmation is off on dev and on in prod

Deliberately disabled on the dev project (Authentication → Providers → Email) so accounts can
be created without a mailbox. **Prod keeps it on.**

If it is ever re-enabled on dev, new test accounts need a confirmation click before they can
sign in, and `auth.setup.ts` will report `Sign-in failed: Email not confirmed`.

### 16. Do not read `page.url()` immediately after sign-in

`auth.setup.ts` completes onboarding if the account needs it, so the suite works against a
brand-new account. Do **not** detect that from `page.url()` straight after sign-in: the client
pushes `/dashboard` and the server redirects to `/onboarding` a moment later, so an instant
check sees the wrong thing and skips the wizard.

### 17. Storage-state paths live in `helpers.ts`, not the setup file

Playwright forbids a spec importing a setup file. The storage-state paths are therefore defined
in `e2e/helpers.ts` and imported from both sides. Moving them "closer to where they are set"
breaks the whole suite.

### 18. The overflow check walks the DOM, because `body` has `overflow-x: clip`

`mobile.spec.ts` checks every personal route for content past the edge of the screen by walking
the DOM **element by element** rather than reading `documentElement.scrollWidth`.

`body` carries `overflow-x: clip`. That is what stops a stray wide child panning the whole
page — and it would also hide that child from a `scrollWidth` check, so the obvious
implementation of this test silently passes on a real fault.

### 19. The brain-dump happy path is stubbed; the real call is `@live`

The brain dump is not called for real in the default run. Its deterministic paths are exercised
genuinely, because they never reach Anthropic: 413 over the character cap, 400 on empty or
non-string input, and the textarea `maxLength`. The happy path is stubbed with `page.route()`
so the review panel and save flow are deterministic.

The real call is tagged `@live` and skipped unless `E2E_LIVE=1`. Model output varies, so
asserting on extracted titles would produce a flaky suite.

### 20. Teardown sweeps `[e2e]` rows because a failing test skips its own cleanup

Everything the suite creates is titled `[e2e] …` with a timestamp. Each spec deletes what it
made, but **only on the happy path** — a test that fails before its cleanup leaves its row
behind. `global.teardown.ts` therefore removes every `[e2e]` task at the end of the run
regardless of outcome.

It talks to Supabase directly, under the test account's own RLS, because there is no list
endpoint on `/api/tasks`.

### 21. The suite is deliberately not in CI

Not an oversight. The dev Supabase project sleeps after ~7 days idle (#4), and a sleeping
project would turn `verify` red for reasons unrelated to the code.

The config already reads `E2E_BASE_URL` and the credentials from the environment, so enabling
it later is a workflow file plus two repository secrets. Revisit alongside the Pro decision.

### 33. Editing `next.config.mjs` wedges a running dev server, and Playwright reuses it

Symptom: every spec fails in `auth.setup.ts` with *"Sign-in neither succeeded nor errored"* — the
sign-in button does nothing, no inline error appears, and the page sits on `/login`. Nothing in
the diff touched auth, and the same suite passed twenty minutes earlier.

Cause: `next.config.mjs` had been edited while a dev server was running. Next restarts itself on
a config change and the restarted server was left half-alive. Playwright's `webServer` is
configured `reuseExistingServer: !isCI`, so it attached to that broken server rather than
starting a healthy one, and the failure surfaced as an auth problem.

**Fix: kill whatever is listening on 3000 and re-run.** `netstat -ano | grep ":3000 "` then
`taskkill //F //PID <pid>`. Suspect this whenever the whole suite fails at setup after a change
to `next.config.mjs`, `middleware.ts` or anything else Next reads once at boot — and check the
dev server before reading anything into the error message, which describes a symptom rather than
a cause.

### 42. An optimistic UI means a reload can beat the write it is asserting

`tasks.spec.ts` clicks the status indicator, asserts the title says `wip`, then reloads to prove
the change reached the database. The assertion passes the instant the click lands, because the
row updates optimistically — so the reload can start before the PATCH has been answered, and the
page comes back saying `not_started`. It failed exactly that way once in forty tests, and passed
on every re-run, which is what a race looks like.

**Wait for the response, not for the rendered value:** set up
`page.waitForResponse(res => res.request().method() === 'PATCH' && res.url().includes('/api/tasks/'))`
*before* the click, then await it before reloading. A `waitForTimeout` would hide the same race
behind a delay that is either wasted or insufficient. This applies to every optimistic control in
the app — the status cycle, task-status toggling, the shopping tick — so any new spec that
reloads to check persistence needs the same treatment.

---

## The app

### 22. `lib/horizon.ts` is the only place horizon fields are derived

The single source of truth for the seven-level horizon model, shared by personal and household
tasks:

- `buildHorizonFields()` derives every coarser field (year / half / quarter / month / week) from
  whichever precision the user actually set.
- `getHorizonReviewStatus()` flags tasks approaching or overdue for re-planning.
- `horizonSortKey()` and `formatHorizon()` back the list and calendar views.

**Any UI that touches horizons must build fields through this module** rather than setting
`horizon_*` columns directly, or the cascade stops being consistent and two views disagree
about when a task is due.

### 23. The brain dump: what the model does, and what it must not do

- **Model: `claude-haiku-4-5`.** The task is extraction only, so it does not need more.
- **`max_tokens` is 16,000, with a `stop_reason: max_tokens` check** returning a clear 422. At
  2,048 a dump near the character cap truncated its own JSON array mid-string and surfaced to
  the user as `Unterminated string in JSON`.
- **The model returns a precision plus any one date inside the period. It does not do calendar
  arithmetic.** That happens server-side through `lib/horizon.ts` (#22). Unrecognised
  precisions and malformed dates fall back to `unplanned` rather than writing a partial field
  set.
- **Input is capped at 10,000 characters** (413 above it), `typeof text !== 'string'` is
  rejected, and the client textarea carries a matching `maxLength`.
- The call passes `metadata: { user_id }` for attribution. There is still **no per-user quota**
  — see [PLAN.md](PLAN.md) §Open items 5.

### 24. Five components render a task — the logic is shared, not copied

The status cycle and its icons ([lib/task-status.ts](lib/task-status.ts)), the optimistic toggle
with rollback ([lib/use-task-status.ts](lib/use-task-status.ts)) and subcategory colour
inheritance ([lib/category-colour.ts](lib/category-colour.ts)) each existed in five or six
copies and had begun to drift. So had the two route-group layouts, now
[components/layout/AppShell.tsx](components/layout/AppShell.tsx).

**Add to these rather than re-deriving the logic in a component.** The cost of not doing so is
measured: the consolidation had to happen before the mobile pass, or the mobile work would have
been done three times.

### 25. Drag activation constraints, or a swipe drags instead of scrolling

[lib/dnd-sensors.ts](lib/dnd-sensors.ts) holds the `@dnd-kit` sensor configuration. Without an
activation constraint, a touch that starts on a draggable task chip begins a drag, so the user
cannot scroll a list of tasks on a phone at all — the page appears frozen.

Any new drag surface must use these sensors, not a bare `useSensors(useSensor(PointerSensor))`.

### 26. `group-hover` controls do not exist on a touch screen

Every control revealed by `group-hover` — the edit and delete buttons on a task row, most
obviously — was **completely unreachable on a phone**, because a touch screen never hovers.
They are not merely hard to hit; they never render.

All such controls now show unconditionally below `md`. `mobile.spec.ts` asserts the task row's
edit and delete controls are visible without a hover, which is the guard on this class of bug
coming back. Task rows also stack category and horizon under the title where the columns are
hidden, and the calendar and planner sidebars stack rather than taking 224px beside the grid.

### 32. The service worker caches no user data, and registers in production only

`public/sw.js` exists to make the app installable and to fail politely with no signal. It is
**not** an offline cache, and adding pages or API responses to it would be a bug, not an
improvement: every page is server-rendered per user and every API response is that user's live
data, so a cached copy is planning data that looks current and is not. An error tells you to try
again; stale data gets acted on.

What it caches is Next's `/_next/static/` assets — whose URLs carry a content hash, so a hit can
never be the wrong version — plus `/offline.html` and one icon, precached at install. Everything
else is not handled by the fetch listener at all, which sends it straight to the network.
`npm run verify:pwa` asserts the cache holds nothing else; that check is the guard.

**Registration is production-only** (`components/pwa/ServiceWorkerRegistration.tsx`). Dev chunk
URLs are *not* content-hashed, so the same cache-first rule in development would serve yesterday's
JavaScript over a hot reload. The consequence for testing: the Playwright suite runs against
`npm run dev` and therefore never registers the worker, so registration is verified separately
against a production build — see `PLAN.md` §Verification.

Bump `VERSION` in `sw.js` when its caching behaviour changes; `activate` deletes every older
`clarity-static-*` cache.

### 34. Phone navigation is a bottom tab bar, not a scrolling strip

Phase 4.1 put the seven sections in a swipeable strip under the header. It passed the viewport
check — nothing overflowed, because the strip scrolled — and it was still wrong: **on a handset
only four sections were visible, and you had to scroll a navigation bar to find out what the app
could do.** Reported the first time it was used on a real phone, which is the whole argument for
doing that (#26 was found the same way).

Below `md` the nav is now a fixed bottom bar: the first four items in `SECTIONS` as tabs, the
rest in a More sheet. **Order in `PersonalNav`/`HouseholdNav` therefore decides what is a tab** —
the first four are the daily loop, not an arbitrary order. The grid is `grid-cols-5` (four plus
More), so `PRIMARY_COUNT` in `SectionNav.tsx` cannot be changed on its own.

Consequences worth knowing before touching layout: the shell reserves `pb-24` on `main` so a list
never ends under the bar, and any full-height screen must subtract it — the calendar is
`h-[calc(100dvh-12rem)]` for exactly this reason. The bar carries
`pb-[env(safe-area-inset-bottom)]` for the gesture area on a modern handset.

### 35. `beforeinstallprompt` fires before hydration, and often not at all

Chrome fires the event **once**, early — frequently before React has hydrated — and it cannot be
retrieved later. A listener registered in a `useEffect` therefore misses it on a cold load, and
the install button never appears. It is captured instead by an inline script in `app/layout.tsx`,
which parks the event on `window.__clarityInstallPrompt` and dispatches
`clarity:installprompt`; `InstallButton` reads whichever arrives first. The event is single-use:
after `prompt()` it must be discarded.

**Do not call `preventDefault()` on it.** That is what suppresses the browser's *own* install
offer — the address-bar icon on desktop, the prompt on Android — and it is the offer people
expect, because it puts the app where every other installed app lives. Every tutorial calls
`preventDefault` so the page can present its own button; doing that here traded the offer
everyone recognises for one nobody looks for. Capture the event, leave the default alone, and
treat the in-app row as the backstop. `prompt()` may then throw because the browser already
consumed it — catch that and fall back to the instructions.

**Plenty of browsers never fire it at all** — iOS Safari has no such event, and some Android
browsers only offer the option through their own menu. So the More sheet always shows a row: a
one-tap *Install app* when the prompt was captured, and *Add to home screen* with instructions
when it was not. The original complaint was that the app was installable and nothing in it said
so, which from the outside is indistinguishable from not being installable.

This is also why headless Chromium shows the instructions variant — do not read that as a
broken manifest. `npm run verify:pwa` is what proves installability.
### 36. A link that leaves the app is built from the request, not `NEXT_PUBLIC_APP_URL`

The household invitation link was `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/invite/${token}`.
That variable is set in `.env.local` and in CI, and **is not set in production** — so every
invite created on the live site was a bare `/invite/<token>`, a path with no host, useless the
moment it was pasted into a message.

It survived because of the shape of the failure, which is worth recognising elsewhere: the value
is present in every environment that gets tested and absent in the one that matters, so the code
looks right locally and the e2e suite passes. Nothing was broken *here*.

Use `requestOrigin(request)` from [lib/api.ts](lib/api.ts) for anything that has to be absolute.
It reads `x-forwarded-host`/`x-forwarded-proto` (what Vercel sets), falls back to `host`, and
only then to the environment variable — so the link points at whatever host the user was
actually on, and there is no variable to forget on the next deployment or custom domain.

`e2e/invite.spec.ts` now asserts the returned `inviteUrl` equals `${baseURL}/invite/${token}`.

### 38. Web push: a VAPID pair per environment, and what cannot be tested

**The keypair identifies the sender, and dev and prod need different ones.** Both live in the
environment, never the repo: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (the browser needs it to subscribe)
and `VAPID_PRIVATE_KEY` (server only — a `NEXT_PUBLIC_` prefix on that would publish the ability
to push to every subscriber). Generate with `npx web-push generate-vapid-keys`. Without a pair,
`/api/push/subscribe` answers 503 rather than storing a subscription nothing can ever send to.

**A subscription is a capability, not a preference.** Anyone holding the endpoint plus its two
keys can notify that device, which is why `push_subscriptions` is owner-only under RLS and the
assignment route reads other members' rows through `get_push_subscriptions_for_member` — security
definer, membership checked on both sides. Do not "simplify" that into a broader policy.

**Sending must never fail the request that triggered it.** The assignment is written before the
push is attempted; a push service that is down is not a reason to tell the user their assignment
failed. `pushToMember` swallows everything, and retires the endpoint only on 404/410 — anything
else is transient and the row stays.

**One account cannot trigger a real push except through the test route.** The only thing that
sends is an assignment, and assigning to yourself deliberately notifies nobody — so a single user
can turn push on, see the toggle say it is on, and have no way to find out whether anything would
ever arrive. `POST /api/push/test` sends to the caller's own devices, and the bell offers it once
push is on. It takes no arguments and reads the caller's own rows under RLS, so it cannot be
aimed at anyone else. This is the same trap the install offer shipped in (#35): a feature that is
working and cannot be seen to be working is indistinguishable from a broken one.

**What cannot be tested here:** delivery. The worker registers in production builds only (#32), so
the dev server never has one, and a real push needs a live push service and a browser
registration. What `e2e/push.spec.ts` does cover is the storage boundary and the send path up to
the push service — including a deliberately dead endpoint, which proves both that a 404 retires
the subscription and that it cannot break the assignment.

### 40. An app icon needs alpha in some places and not others

**The `purpose: "any"` icons must be transparent outside the rounded rect; the maskable and iOS
ones must not.** `scripts/generate-icons.mjs` rasterises `public/icon.svg` in Chromium, and a
screenshot keeps the page background unless `omitBackground` is set — so `icon-192`, `icon-512`
and `apple-touch-icon` shipped as 24bpp RGB with white corners, which showed as four white
wedges on a dark Windows taskbar. Byte 25 of a PNG is the IHDR colour type: 6 is RGBA, 2 is RGB,
and it is the quickest way to tell whether an icon has an alpha channel at all.

**The rule is per icon, and iOS is the opposite of the other two:**

- `purpose: "any"` — composited onto a tab or a taskbar, so **alpha**, rounded corners.
- `purpose: "maskable"` — the launcher crops it to its own shape, so **full bleed, opaque**, and
  the mark shrunk to 62% to stay inside the safe area.
- `apple-touch-icon.png` — iOS ignores `purpose`, applies its **own** rounding to whatever
  square it is handed, and composites transparency to **black**. So: full bleed, opaque, mark at
  full size. Handing it the rounded artwork leaves slivers outside the radius; handing it alpha
  turns those slivers black.

**Nothing about the icon's size, type or URL was wrong**, which is why every existing check
passed — `e2e/pwa.spec.ts` now asserts the colour type of all four, because the appearance of an
icon is not otherwise observable from a test.

### 41. An accepted invitation is a record, not a pending action

**Revoking a household invitation deletes the row, so it can only apply to one nobody has
accepted.** `DELETE /api/household/[id]/invite/[invitationId]` filters on `accepted_at is null`
and answers 404 otherwise. Deleting an accepted one would not remove the person's membership —
that is `workspace_members` — and would destroy the only record that they were invited and by
whom. The owner-only DELETE policy has existed since `20260420000011`; the route and the button
are what was missing.

**What has to stop working is the link, not the row.** An invitation is shared as a URL, and by
the time anyone changes their mind it is already in somebody's messages. The landing page reads
the row through `get_invitation_by_token`, so deleting it is what makes the token fall through to
"Invalid invite link" — which is the assertion worth making in a test, rather than the 404.

**A route that creates something the UI can then act on has to return its id.** `InviteForm`
built its own optimistic row with `crypto.randomUUID()`, so Revoke on a just-created invitation
would have 404'd on an id the database never saw. The POST returns the inserted row now.

---

## Git and deploy

### 27. Two GitHub accounts — pin per repo, never switch

There are two GitHub accounts on this machine, `Warwick-Hope` (personal, owns this repo) and
`WarwickHope` (Plant Plan). **`gh auth switch` changes the active one globally**, so working on
a Plant Plan repo leaves the wrong account active here. The symptom is a bare `403` on push
naming no cause.

Each account has **read** access to the other's repos but not push — which is why
`git ls-remote` succeeds when a push is about to 403. Never use it to test credentials.

The fix is repo-local, and `npm run setup:hooks` applies it:

```bash
git config --local credential.https://github.com.username Warwick-Hope
```

Git passes it to `gh auth git-credential` as a hint, and gh returns that account's token
whatever is globally active. The `pre-push` hook refuses to push if the pin is missing or names
an account `gh` is not logged into.

**Never resolve a 403 with `gh auth switch`** — that moves the breakage to the other repo rather
than fixing it. Pin both sides. A fresh clone needs pinning again: the pin is repo-local config
and does not survive cloning.

### 28. A push to `main` is a production deploy

Vercel publishes on every push to `main`, with no staging step, in about two minutes. The repo
is private on a free personal plan, so **server-side branch protection is unavailable** and the
`verify` check cannot be *required*. A red `verify` merged to `main` goes straight to
production.

The substitutes are a local `pre-push` hook and the convention in
[CONTRIBUTING.md](CONTRIBUTING.md). Both are conventions, not enforcement. Wait for green.

### 29. `git branch -d` refuses after a squash merge

The repo is squash-only, and a squash commit is not an ancestor of the branch it came from — so
`git branch -d <branch>` reports the branch as unmerged. Use `-D` after a confirmed squash
merge. The remote branch auto-deletes on merge; only the local one needs removing.

The squash commit takes the **PR title as its subject and the PR body as its message**, so write
the PR title as an imperative commit subject.

### 30. Worktrees go outside the repository

Parallel sessions each get a worktree at `C:/Dev/.worktrees/task-planner/<slug>`, never nested
inside the repo. A worktree is a complete copy of every source file, so a nested one puts a
second copy of the repo inside the repo — and every tool that walks files then has to be taught
to skip it, including the documentation guard, which would read each document twice and let a
dead command resolve against a copy of the manifest.

`.env.local` is untracked, so **copy it into a new worktree** — dev and the CLI both need it.

### 39. Two sessions in one working tree — git isolates branches, not directories

On **26 Aug 2026** two Claude Code sessions ran in `C:\Dev\task-planner` at the same time. One
read `PLAN.md` §"Where we are", spent forty minutes designing a feature, and went to write it
back. In that gap the other session had committed twice, opened PR #18 and rewritten the same
section. The write was caught only because a string replacement failed to match — had the
section been untouched, it would have silently clobbered the other session's work.

**The mistake was not using git wrong. It was expecting git to help at all.** Its unit of
isolation is a branch *with its own working tree*: one HEAD, one index, one set of files. Two
processes in one directory share all three, so a checkout in one yanks the files out from under
the other, and GitHub never sees a conflict because nothing ever reaches it. Concurrency support
does not begin until the second working tree exists.

Three things guard it now, in descending order of how much they actually help:

1. **A worktree per session**, at `C:/Dev/.worktrees/task-planner/<slug>`, branched from
   `origin/main` — not local `HEAD`, which is usually somebody else's feature branch.
   `.env.local` must be copied in; it is untracked (#30, and [CONTRIBUTING.md](CONTRIBUTING.md)
   §"Two sessions at once").
2. **`npm run session`** — `scripts/session-check.mjs`, wired to a `SessionStart` hook in
   `.claude/settings.json`. It prints the other working trees and whether they are dirty, the
   distance from `origin/main`, the open PRs and the claim board, and warns loudly when you are
   in the shared checkout while another tree is live. It is a briefing and always exits 0 — the
   gates are `pre-push` and `npm run check:docs`.
3. **[WORKSTREAMS.md](WORKSTREAMS.md)**, the claim board — which `check-docs` already validated
   before the file existed: it fails on a claim naming a dead branch, or one more than two days
   old.

Two smaller consequences worth knowing:

- **Re-read a shared document section immediately before writing it**, not at session start. The
  gap between read and write is the whole exposure, and nothing about it is visible.
- **`KB.md` numbering races across branches.** Two branches appending "#39" in different
  sections merge cleanly and produce two #39s. `duplicate-kb-entry` catches it on the second PR
  to merge; renumber that one, because the first is already cited elsewhere.
