# Security hardening — the 14 Aug 2026 review

**Scope.** The findings of one full code and migration sweep on 14 Aug 2026, and a record of
what was done about each. Tier 1 items were live-prod exposures; tier 2 is robustness. It
covers security only — it is not a plan, and it does not state where the project is.

**It does not hold status.** The current position, including anything from this review that is
still open, is in [PLAN.md](PLAN.md) §"Where we are, and what's next" and §Open items. The
checkbox history below is a record of what happened, not a live to-do list.

Every schema change here was a new migration in `supabase/migrations/`, applied to dev first
and pushed to prod on merge — see [CONTRIBUTING.md](CONTRIBUTING.md).

## What shipped — 17 Aug 2026 (branch `feat/security-hardening`, PR #4)

Tiers 1 and 2 code-complete, `verify` green, three migrations applied to dev and then to prod:

```
supabase/migrations/20260815000001_sec_invitation_token_rpc.sql
supabase/migrations/20260815000002_sec_indexes.sql
supabase/migrations/20260815000003_sec_rls_tighten.sql
```

Migration 1 and `app/invite/[token]/page.tsx` had to land together — the page reads the
invitation through the new RPC, so the page is broken until the migration runs, and the table
stays anon-readable until it does.

### The review's own items, and how each closed

- [x] Merge PR #4, then push the three migrations to prod. Done 17 Aug 2026 — dry run first,
      all three applied, CLI re-linked to dev. Verified live: `/invite/<token>` returns 200 and
      renders on prod rather than redirecting to `/login`.
- [x] Supabase Advisors on dev. **0 errors**, 16 warnings, 1 suggestion. Acted on in
      `20260817000001_advisor_cleanup.sql` — see below.
- [~] **Leaked password protection — blocked on plan, not on us.** The location this review
      originally gave for it was wrong; the setting lives at **Authentication → Providers →
      Email**, and the Supabase docs are explicit that it is *"available on the Pro Plan and
      above"*. Both projects are on the free tier, so there is nothing to toggle. Revisit when
      the project moves to Pro — which is also what stops the projects pausing after ~7 days
      idle. Live rule in [KB.md](KB.md) #12.
- [x] **`public.rls_auto_enable()` identified — keep it.** It returns `event_trigger` and takes
      no arguments, so it fires on DDL rather than being callable through the API; it almost
      certainly auto-enables RLS on newly created tables. Not a pre-Phase-0 leftover, and the
      advisor's "public can execute" warning against it is noise, because PostgREST cannot
      invoke an event-trigger function at all. Worth reading the body if it ever matters.
- [x] **`auth_rls_initplan` — done in `20260825000001_rls_initplan.sql`.** 53 policies rewritten
      to `(select auth.uid())`, 6 skipped because they call the security definer helpers rather
      than `auth.uid()` directly. The migration rewrites from `pg_policies` rather than listing
      the policies by hand: the live set is the result of 89 create/drop statements across 14
      migrations, so transcribing the survivors would have been a guess, and a wrong guess
      silently changes who can read what. It is idempotent and announces every policy it
      rewrites. Verified with the Playwright suite (19 passed), which exercises reads and writes
      across both workspace types plus the non-member and restricted-member refusals.
      **Re-run the Performance advisor after this reaches prod to confirm the findings clear.**
- [ ] Per-user daily quota on brain dump. Deliberately deferred — the spec scopes it to
      "before any external user", and the app is still single-user.

### Advisor findings and what was done (17 Aug 2026)

`20260817000001_advisor_cleanup.sql` handles three of them:

- **`task_roles` dropped — both it and `role_categories` are dead names, retained here only as
  history.** A pre-Phase-0 join table from the retired role-category tagging model; the 0.1
  rebuild missed it. No migration, no code, 0 rows, 0 seq scans. RLS was on with no policies, so
  it already denied everything — litter, not an exposure.
- **`set_updated_at` search_path pinned.** Every other function in the schema sets it.
- **anon `EXECUTE` revoked** on `accept_household_invitation`, `create_household_workspace`
  and `create_personal_workspace`. Each already ran `revoke all … from public`, but Supabase's
  default privileges grant EXECUTE to `anon` explicitly and that survives a revoke from PUBLIC.
  All three raise 'Not authenticated' anyway; this closes the door properly. Verified on dev:
  `create_household_workspace` now returns 401 to an anon caller.

The other 13 SECURITY DEFINER warnings are by design and deliberately left:
`get_invitation_by_token` **must** stay anon-callable (that is the invite landing page), and
`is_workspace_member` / `is_workspace_owner` are evaluated inside RLS policies as the querying
role — revoking anon there turns an anonymous read into a permission error instead of an empty
result, and both return false when `auth.uid()` is null.

### Findings beyond the original spec

All three were found while verifying the spec's own items, and are fixed on this branch.

1. **`household_profiles` RLS was a tautology** (fixed in migration 3). The four policies
   compared `wm.workspace_id` to an unqualified `workspace_id`, which Postgres resolves to the
   inner table's own column. Membership of *any* workspace therefore granted read/write access
   to *every* household's child profiles. The same migration tightens `shopping_list`
   INSERT/DELETE to owner/adult and makes `meal_plan` INSERT check the meal's workspace.
2. **The invite link never reached the invite page.** `middleware.ts` redirected every
   unauthenticated request to `/login`, so `/invite/[token]` never rendered for a logged-out
   visitor and the page's own "sign in to accept" branch was dead code. The invite path is now
   exempt, and the redirect carries `?next=` (same-origin paths only) so signing in returns the
   visitor to the invite rather than the dashboard.
3. **`GET /api/tasks/[id]` did not exist.** `CleaningTaskForm` fetches a task back after
   creating it; the route exported only PATCH and DELETE, so Next.js answered 405 with an empty
   body and the form died on `res.json()`. Pre-existing, unrelated to this spec, surfaced by the
   smoke test. Added and scoped like the other handlers.

### Brain dump changes (same branch, beyond spec item 1.4)

Item 1.4's cap exposed two further problems, both fixed here:

- `max_tokens` was 2048, so a dump near the new 10,000-character cap truncated the JSON array
  mid-string and surfaced as `Unterminated string in JSON` to the user. Raised to 16,000, with
  a `stop_reason: max_tokens` check returning a clear 422 instead of a parse error.
- The prompt asked the model to keep `horizon_year`/`quarter`/`month`/`week` mutually
  consistent. That arithmetic now happens server-side through `lib/horizon.ts`: the model
  returns a precision plus any one date inside the period, and unrecognised precisions or
  malformed dates fall back to `unplanned` rather than writing a partial field set. With the
  arithmetic gone the task is extraction only, so the model moved from Sonnet 4.6 to
  **Haiku 4.5** — a third of the token cost and faster. `ParsedTask` is unchanged, so the
  review UI and confirm route were untouched.

### Known limitation, recorded rather than fixed

`shopping_list` UPDATE stays open to every member at the RLS layer, because row-level policies
cannot express "restricted members may change `is_purchased` only". The route enforces that
column rule; a trigger would be needed to enforce it in the database.

---

## Tier 1 — prod exposures

### 1.1 `household_invitations` readable by anyone with the anon key

`supabase/migrations/20260609000001_phase2_invitation_token_policy.sql` created:

```sql
create policy "anyone can look up invitation by token"
  on public.household_invitations for select
  using (true);
```

Because permissive policies OR together and this one has no `to` clause, **any caller holding
the public anon key can dump the whole table**: tokens, invitee emails, workspace ids, roles.
The migration comment claims token unguessability makes it safe — wrong, because the policy
permits unfiltered scans, not just lookup-by-token. `accept_household_invitation()` binds
acceptance to the invited email, so a harvested token can't be redeemed by someone else; the
exposure is PII disclosure and invite-phishing material, not account takeover. Still: fix.

**Fix:** new migration that drops this policy, restores owner-only SELECT, and adds a
`security definer` RPC `get_invitation_by_token(p_token text)` returning only what the landing
page needs (workspace name, role, email, expired/accepted flags). Then update
`app/invite/[token]/page.tsx` to call the RPC instead of selecting the table directly (it
currently reads it anonymously before any auth check — that read stops working once the policy
drops, so page and migration must land together).

### 1.2 No indexes anywhere

Zero `create index` statements across all 16 migrations. Only implicit PK/unique indexes
exist. Every RLS policy evaluation runs `is_workspace_member()` /
`is_workspace_owner()` as a **seq scan of `workspace_members` per row**. Invisible at 2
users; a cliff as data grows.

**Fix:** one migration adding, at minimum:

- `workspace_members (workspace_id, user_id)` — the critical one; backs both helper functions
- `tasks (workspace_id)`, `tasks (category_id)`, `tasks (created_by)`,
  `tasks (assigned_to_user_id)`, `tasks (parent_task_id)`
- `categories (workspace_id)`, `categories (owner_id)`, `categories (parent_id)`
- `household_profiles (workspace_id)`
- `non_negotiables (workspace_id)`, `non_negotiables (task_id)`
- `missions (user_id)`, `values (user_id)`
- `rooms (workspace_id)`, `meals (workspace_id)`, `meal_plan (workspace_id)`,
  `meal_plan (meal_id)`, `ingredients (meal_id)`
- `shopping_list (workspace_id)`
- `household_invitations (workspace_id)`
- `workspaces (created_by)` — backs `getPersonalWorkspaceId`
- composites for hot queries: `tasks (workspace_id, status)`, `meal_plan (workspace_id, planned_date)`

### 1.3 Household routes missing membership/role checks

**12 of 20 household route files never touch `workspace_members`** — they authenticate, then
trust `params.id` and lean on RLS. RLS enforces membership but not roles, so a `restricted`
member can: delete rooms, edit/delete child profiles, delete meal-plan entries, edit/delete
meals and ingredients, bulk-clear the shopping list. Affected files (all under
`app/api/household/[id]/`): `rooms/route.ts`, `rooms/[roomId]/route.ts`,
`meals/[mealId]/route.ts`, `meals/[mealId]/ingredients/route.ts`,
`meals/[mealId]/ingredients/[ingredientId]/route.ts`, `meal-plan/route.ts`,
`meal-plan/[planId]/route.ts`, `profiles/route.ts`, `profiles/[profileId]/route.ts`,
`shopping/[itemId]/route.ts`, `shopping/task/route.ts`, `tasks/[taskId]/respond/route.ts`.

A `getMembership()` helper already exists but is copy-pasted (not shared) in
`categories/route.ts` and `categories/[categoryId]/route.ts`; five more files inline the same
query.

**Fix:** one helper in `lib/workspace-server.ts`:

```ts
requireMember(supabase, workspaceId, userId, opts?: { blockRestricted?: boolean })
// returns { role } or null → route responds 403
```

Apply to every household route. Decide per route whether `restricted` is blocked (writes:
yes; reads: no). While in each file, standardise the misspelt `'Unauthorised'`/`'Unauthorized'`
split (19 vs 37 occurrences — pick one) and the ingredients routes that ignore `params.id`
entirely (scope by meal → workspace linkage, the pattern already used in
`meals/[mealId]/ingredients/route.ts:31`).

Also (same theme, RLS side): `shopping_list` UPDATE/DELETE policies let `restricted` members
modify anything (`20260420000010`); `meal_plan` INSERT doesn't validate `meal_id` belongs to
the same workspace (`20260420000009`). Tighten both in the 1.1/1.2 migration or a third.

### 1.4 Brain-dump route unbounded

`app/api/brain-dump/route.ts` — authenticated users can POST unlimited text to the Anthropic
API on your key. Only validation is non-empty; no length cap, no rate limit, `text` not even
runtime-type-checked (non-string → unhandled 500).

**Fix now:** reject `typeof text !== 'string'`; cap at ~10,000 chars (413 response); add
`metadata: { user_id }` to the Anthropic call for attribution. Client textarea gets
`maxLength` to match. **Before any external user:** per-user daily quota (simple counter
table).

---

## Tier 2 — robustness (same branch, second commit/PR)

- **21 routes parse `request.json()` unguarded** → malformed body = raw 500. Add a
  `parseJson(request)` helper next to `requireMember`; the guarded pattern already exists in
  the 8 personal routes.
- **Recurring-task silent failure:** `app/api/tasks/[id]/route.ts` (~lines 76–110) discards
  the error from the next-occurrence insert. Capture it; at minimum return it in the response.
- **Idempotency mismatch in the same file:** DELETE returns 204 for a missing task, PATCH
  returns 404 — fine, but deliberate; leave unless touching anyway.
- **`tasks/[id]` PATCH accepts arbitrary `assigned_to_user_id`** with no membership validation
  of the assignee — the `assign` route validates; mirror that check.

## Verification

- [x] `npm run lint` + `npm run build` green (CI enforces on the PR).
- [x] Invite landing page renders for a logged-out visitor via the new RPC — confirmed on dev
      with a real token, after the middleware fix above.
- [x] Brain dump parses; the 10,000-character cap holds in the textarea and the server returns
      413 above it.
- [x] Restricted-member write to a room/meal/shopping item returns 403. **Now covered by the
      Playwright suite** (`e2e/invite.spec.ts`), which invites a second account as `restricted`,
      accepts, then asserts 200 on a read and 403 on creating a room, creating a meal, adding a
      child profile and clearing the shopping list. It also pins the deliberately nuanced rule:
      a restricted member **may** tick a shopping item off but **may not** rename it — a
      distinction that lives only in the route layer, so nothing else would catch it regressing.
- [ ] Supabase dashboard → Advisors (Security + Performance) on dev after the migrations — MCP
      lacks permission to run these, so it's a dashboard step.
- [x] Delete `components/tasks/TaskPreviewPanel.tsx` (168 lines, never imported) while here.

## After this (separate work, in order — from the same review)

1. Thin Playwright smoke suite (login, task CRUD, invite accept, brain dump) — before any
   refactor.
2. Consolidation refactor: 3 task-row components → 1; `STATUS_CYCLE` ×6 → shared; category
   colour helper ×5 → shared; the two 87%-identical route-group layouts → shared shell.
   **Must land before Phase 4.1** (mobile pass) or the mobile work gets done three times.
3. Phase 4 amendments agreed 14 Aug 2026: 4.4 Microsoft OAuth is **additive**, not a
   replacement; 4.6 billing deferred until an external household actually wants in; Phase 5
   Capacitor decision waits until the PWA has been lived with.
