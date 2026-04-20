-- Phase 0.7: non_negotiables table with RLS
-- Records which tasks a user has committed to for a specific date (max 3 per user per day).
-- Does not duplicate task data — task_id links to the task, date records the commitment day.

create table public.non_negotiables (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  task_id       uuid not null references public.tasks(id) on delete cascade,
  date          date not null,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  unique (user_id, task_id, date)
);

alter table public.non_negotiables enable row level security;

-- Users can only see their own non-negotiables
create policy "users can view own non_negotiables"
  on public.non_negotiables for select
  using (user_id = auth.uid());

create policy "users can insert own non_negotiables"
  on public.non_negotiables for insert
  with check (user_id = auth.uid());

create policy "users can update own non_negotiables"
  on public.non_negotiables for update
  using (user_id = auth.uid());

create policy "users can delete own non_negotiables"
  on public.non_negotiables for delete
  using (user_id = auth.uid());
