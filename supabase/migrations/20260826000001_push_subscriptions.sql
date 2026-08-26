-- Phase 4.3: web push subscriptions, and the two functions that let one member
-- notify another without anyone being able to read anyone else's devices.
--
-- A push subscription is a capability: whoever holds the endpoint plus its keys
-- can send that device a notification. So the table is owner-only under RLS,
-- and the one place that legitimately needs someone else's — the assignment
-- route, pushing to the person being assigned a task — goes through a security
-- definer function that checks both parties share the workspace first.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- The endpoint URL identifies the device+browser and is unique per install.
  endpoint    text not null unique,
  -- The two keys the Web Push protocol encrypts the payload with.
  p256dh      text not null,
  auth        text not null,
  -- Purely for the user recognising their own devices in a list later.
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

comment on table public.push_subscriptions is
  'Web push endpoints per user per device. Owner-only under RLS; cross-member sends go through get_push_subscriptions_for_member().';

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- ── RLS: your own devices, nothing else ──────────────────────────────────────
-- auth.uid() is wrapped in a select so the planner evaluates it once per query
-- rather than once per row (see 20260825000001_rls_initplan.sql).

drop policy if exists "own push subscriptions are readable" on public.push_subscriptions;
create policy "own push subscriptions are readable"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "own push subscriptions are insertable" on public.push_subscriptions;
create policy "own push subscriptions are insertable"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "own push subscriptions are updatable" on public.push_subscriptions;
create policy "own push subscriptions are updatable"
  on public.push_subscriptions for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own push subscriptions are deletable" on public.push_subscriptions;
create policy "own push subscriptions are deletable"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ── Reading another member's devices, in order to notify them ────────────────
--
-- Both sides of every comparison are qualified: an unqualified column in a
-- subquery binds to the inner table and silently makes the check a tautology,
-- which is how the household_profiles policy was once wrong.

create or replace function public.get_push_subscriptions_for_member(
  p_user_id      uuid,
  p_workspace_id uuid
)
returns table (
  endpoint text,
  p256dh   text,
  auth     text
)
language sql
security definer
set search_path = public
stable
as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  where s.user_id = p_user_id
    -- the caller must be a member of the workspace they claim to be notifying from
    and exists (
      select 1 from public.workspace_members cm
      where cm.workspace_id = p_workspace_id
        and cm.user_id = (select auth.uid())
    )
    -- and so must the person being notified
    and exists (
      select 1 from public.workspace_members tm
      where tm.workspace_id = p_workspace_id
        and tm.user_id = p_user_id
    );
$$;

-- Supabase grants anon EXECUTE explicitly on new functions, and that survives a
-- revoke from PUBLIC — so revoke from anon by name.
revoke all on function public.get_push_subscriptions_for_member(uuid, uuid) from public, anon;
grant execute on function public.get_push_subscriptions_for_member(uuid, uuid) to authenticated;

-- ── Dropping an endpoint the push service has retired ────────────────────────
--
-- A 404 or 410 from the push service means that subscription is dead. The
-- sender is usually not its owner, so RLS would block the delete. Endpoint is
-- the whole key here: it is unguessable, and deleting a dead one is harmless.

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
volatile
as $$
  delete from public.push_subscriptions s where s.endpoint = p_endpoint;
$$;

revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.delete_push_subscription(text) to authenticated;
