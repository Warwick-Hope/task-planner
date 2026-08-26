-- Phase 4.10: a per-user daily budget for the brain dump.
--
-- The quota exists because of the connector, not because of the app. A person
-- typing into a textarea does not press the button forty times; a model in a
-- loop calls the `capture` tool as often as its own reasoning tells it to, and
-- every call is an Anthropic request paid for by whoever owns the key.
--
-- **One budget, not two.** The count is consumed by the shared brain-dump
-- helper that both the textarea and the MCP tool go through, so twenty calls is
-- twenty calls however they arrived. Counting them separately would mean a
-- limit of twenty was really a limit of forty, which is the kind of number
-- nobody can reason about at 2am.
--
-- The day is the **UTC** date. Simpler than storing a timezone per user, and the
-- consequence is only that a British summer evening's dumps after 01:00 BST
-- count against the next day. A quota is a blunt instrument; a blunt instrument
-- with an obvious rule beats a precise one nobody can predict.

create table if not exists public.capture_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  -- UTC date, not a timestamp: the row *is* the day's tally.
  day      date not null,
  count    integer not null default 0,
  primary key (user_id, day)
);

comment on table public.capture_usage is
  'Daily brain-dump/capture call tally per user. Written only by consume_capture_quota(); readable by its owner so the app can show what is left.';

alter table public.capture_usage enable row level security;

-- ── RLS: read your own tally, write nothing ──────────────────────────────────
--
-- There is deliberately no insert, update or delete policy. The only writer is
-- consume_capture_quota(), which is security definer — so a caller cannot raise
-- their own limit by editing the row that enforces it, which is exactly what a
-- writable quota table would allow.
-- auth.uid() is wrapped in a select so the planner evaluates it once per query
-- rather than once per row (see 20260825000001_rls_initplan.sql).

drop policy if exists "own capture usage is readable" on public.capture_usage;
create policy "own capture usage is readable"
  on public.capture_usage for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ── Consuming one call ───────────────────────────────────────────────────────
--
-- Increments and decides in a single statement, so two concurrent calls cannot
-- both see "19 used" and both proceed. The conditional DO UPDATE is what makes
-- that true: at the limit the update matches no row, nothing is returned, and
-- the function reports a refusal rather than a raised count.
--
-- It takes the limit as an argument rather than hard-coding it, because the
-- number belongs with the other input limits in lib/limits.ts where a human
-- reads it. The database's job is to make the count atomic.

create or replace function public.consume_capture_quota(p_limit integer)
returns table (
  allowed boolean,
  used    integer,
  quota   integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_used  integer;
begin
  if v_user is null then
    raise exception 'consume_capture_quota requires an authenticated caller';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'consume_capture_quota requires a positive limit';
  end if;

  -- Both sides of the comparison are qualified: an unqualified column here binds
  -- to the row being inserted and the guard silently stops guarding (KB.md #8).
  insert into public.capture_usage as u (user_id, day, count)
  values (v_user, v_today, 1)
  on conflict (user_id, day) do update
     set count = u.count + 1
   where u.count < p_limit
  returning u.count into v_used;

  if v_used is not null then
    return query select true, v_used, p_limit;
    return;
  end if;

  -- No row came back, so the caller is at or over the limit. Report the tally
  -- as it stands rather than the increment that did not happen.
  select c.count into v_used
    from public.capture_usage c
   where c.user_id = v_user
     and c.day = v_today;

  return query select false, coalesce(v_used, 0), p_limit;
end;
$$;

revoke all on function public.consume_capture_quota(integer) from public;
-- authenticated only: unlike resolve_api_token, this one identifies its caller
-- from the session it is running under, so anon has nothing to ask it.
grant execute on function public.consume_capture_quota(integer) to authenticated;
