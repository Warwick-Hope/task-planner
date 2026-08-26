# Clarity — database schema

**Scope.** A readable summary of the shape of the database: the enums, the tables and the
columns that carry meaning. It is here so a session can understand the model without reading 21
migration files.

**What it is not.** It is **not** the authority. The authority is
[supabase/migrations/](supabase/migrations/) for the schema itself and
[types/index.ts](types/index.ts) for the TypeScript shapes. RLS policies, indexes, constraints
and functions are **not** reproduced here — read the migrations for those. If this file and a
migration disagree, the migration is right and this file needs fixing.

**Keeping it true.** Every schema change is a committed migration applied to dev first. When one
lands, update `types/index.ts` in the same change, and update this file if the change is
visible in the columns below.

The product-level rules behind this shape — what a workspace is, how visibility works, what
assignment requires — are in [PLAN.md](PLAN.md) §"Decisions already taken (locked)". Read those
before writing anything that touches multi-tenancy.

---

## Enums

```sql
task_status:       not_started | wip | done | cancelled
workspace_type:    personal | household
member_role:       owner | adult | restricted
task_source:       manual | brain_dump | cleaning | meal | shopping
assignment_status: none | pending | accepted | declined
```

---

## Core tables

### `workspaces`

`id, type (workspace_type), name, created_by, created_at`

### `workspace_members`

`id, workspace_id, user_id, role (member_role), display_name, joined_at`

`user_id` is **nullable** — null means a child profile rather than an auth user.

### `household_profiles` — non-auth members (children)

`id, workspace_id, name, avatar_colour, created_by, created_at`

### `profiles`

`id (references auth.users), display_name, created_at, updated_at`

### `categories`

| Column | Notes |
|---|---|
| `id` | |
| `workspace_id` | |
| `owner_id` | Null = a household-level category. Set = a personal category for that user |
| `name` | |
| `colour` | |
| `is_shared` | True = tasks in this category are visible to all household members |
| `sort_order` | |
| `parent_id` | Self-reference, **two levels maximum** |
| `created_at` | |

A subcategory inherits its top-level parent's colour — see
[lib/category-colour.ts](lib/category-colour.ts).

### `tasks`

```text
id
workspace_id
created_by
assigned_to_user_id      — nullable, references auth.users
assigned_to_profile_id   — nullable, references household_profiles
assignment_status        — assignment_status, default none
title
notes
status                   — task_status, default not_started
priority                 — nullable int, 1–3
due_date                 — nullable date
due_time                 — nullable time
horizon_year             — nullable int
horizon_half             — nullable int, 1–2
horizon_quarter          — nullable int, 1–4
horizon_month            — nullable int, 1–12
horizon_week             — nullable date (week start)
horizon_day              — nullable date
horizon_time_slot        — nullable text
is_recurring             — boolean, default false
recurrence_rule          — nullable text (rrule string)
recurrence_end_date      — nullable date
parent_task_id           — nullable self-reference, one level only
source                   — task_source, default manual
source_id                — nullable uuid (a room, meal, etc.)
category_id              — nullable, references categories
created_at
updated_at
```

**Never set the `horizon_*` columns directly.** Build them through
[lib/horizon.ts](lib/horizon.ts) so the cascade stays consistent — [KB.md](KB.md) #22.

All seven horizon fields null means unplanned.

---

## Personal workspace only

### `non_negotiables` — three per user per day

`id, user_id, workspace_id, task_id, date, sort_order, created_at`

### `missions`

`id, user_id, content, is_active, created_at`

### `values`

`id, user_id, name, description, sort_order, created_at`

---

## Household workspace only

### `rooms`

`id, workspace_id, name, sort_order, created_at`

### `meals` — name and notes only until Phase 5

`id, workspace_id, name, notes, created_at`

### `meal_plan` — assigns meals to days

`id, workspace_id, meal_id, planned_date, servings, created_at`

### `ingredients`

`id, meal_id, name, quantity, unit, created_at`

### `shopping_list`

| Column | Notes |
|---|---|
| `id` | |
| `workspace_id` | |
| `name` | |
| `quantity`, `unit` | Both nullable |
| `shop_tag` | Nullable text, e.g. Tesco, Asda |
| `source` | `manual` or `meal` |
| `source_id` | Nullable uuid, references a meal |
| `is_purchased` | Boolean, default false |
| `added_by` | References auth.users |
| `created_at` | |

Restricted members may change `is_purchased` and nothing else — a rule the **route layer**
enforces, because RLS cannot express it. [KB.md](KB.md) #13.

### `household_invitations`

`id, workspace_id, email, role (member_role), token, expires_at, accepted_at, created_by,
created_at`

Read through the `get_invitation_by_token` RPC, never by selecting the table — the open
`select using (true)` policy that once made it anon-readable was removed in
`20260815000001_sec_invitation_token_rpc.sql`. See
[SECURITY_HARDENING.md](SECURITY_HARDENING.md) §1.1.

## Access

### `api_tokens`

`id, user_id, name, token_hash (unique), token_prefix, scopes (text[]), expires_at, revoked_at,
last_used_at, created_at`

Personal access tokens for bearer auth on `/api` (Phase 4.9). **Only the SHA-256 hash is stored** —
the token is shown once at creation and cannot be recovered. `token_prefix` is the first ten
characters, kept so the UI can tell two rows apart without being able to reconstruct either.
Scopes are coarse on purpose: `tasks:read`, `tasks:write`.

Owner-only under RLS. An incoming token cannot be resolved through RLS at all, because the caller
has no session yet — that is what the token is for — so it goes through
`resolve_api_token(p_token_hash)`, a security definer function that stamps `last_used_at` in the
same statement and returns nothing for a token that is unknown, revoked or expired. It is
executable by `anon` for the same reason `get_invitation_by_token` is: presenting the hash of a
32-byte secret is proof of holding it. See [KB.md](KB.md) #44 and #45 for the mechanism and the
opt-in rule.

Revoking sets `revoked_at` rather than deleting the row, so `last_used_at` survives the
revocation.

## Notifications

### `push_subscriptions`

`id, user_id, endpoint (unique), p256dh, auth, user_agent, created_at, last_used_at`

One row per device per browser. A subscription is a **capability** — whoever holds the endpoint
and its two keys can push to that device — so RLS restricts every operation to the owner.

The one place that legitimately needs someone else's rows is the assignment route, pushing to the
person being assigned a task. It reads them through `get_push_subscriptions_for_member(p_user_id,
p_workspace_id)`, a security definer function that returns endpoints only when **both** the
caller and the subject are members of that workspace. A dead endpoint (404/410 from the push
service) is removed by `delete_push_subscription(p_endpoint)`, since the sender is usually not
its owner. Both are in `20260826000001_push_subscriptions.sql`; neither is executable by `anon`.
