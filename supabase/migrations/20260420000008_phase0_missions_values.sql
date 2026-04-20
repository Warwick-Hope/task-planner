-- Phase 0.8: missions and values tables with RLS
-- Personal workspace only — reference layer, not per-task metadata.

create table public.missions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.missions enable row level security;

create policy "users can view own missions"
  on public.missions for select
  using (user_id = auth.uid());

create policy "users can insert own missions"
  on public.missions for insert
  with check (user_id = auth.uid());

create policy "users can update own missions"
  on public.missions for update
  using (user_id = auth.uid());

create policy "users can delete own missions"
  on public.missions for delete
  using (user_id = auth.uid());

-- values is a reserved word in SQL so we quote it in the table definition
create table public.values (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.values enable row level security;

create policy "users can view own values"
  on public.values for select
  using (user_id = auth.uid());

create policy "users can insert own values"
  on public.values for insert
  with check (user_id = auth.uid());

create policy "users can update own values"
  on public.values for update
  using (user_id = auth.uid());

create policy "users can delete own values"
  on public.values for delete
  using (user_id = auth.uid());
