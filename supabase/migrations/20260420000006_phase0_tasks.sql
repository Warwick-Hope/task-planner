-- Phase 0.6: tasks table with all fields and RLS

create table public.tasks (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  created_by              uuid not null references auth.users(id) on delete restrict,
  assigned_to_user_id     uuid references auth.users(id) on delete set null,
  assigned_to_profile_id  uuid references public.household_profiles(id) on delete set null,
  assignment_status       public.assignment_status not null default 'none',
  title                   text not null,
  notes                   text,
  status                  public.task_status not null default 'not_started',
  priority                smallint check (priority between 1 and 3),
  due_date                date,
  due_time                time,
  horizon_year            integer,
  horizon_half            smallint check (horizon_half between 1 and 2),
  horizon_quarter         smallint check (horizon_quarter between 1 and 4),
  horizon_month           smallint check (horizon_month between 1 and 12),
  horizon_week            date, -- week start date
  horizon_day             date,
  horizon_time_slot       text,
  is_recurring            boolean not null default false,
  recurrence_rule         text,
  recurrence_end_date     date,
  parent_task_id          uuid references public.tasks(id) on delete cascade,
  source                  public.task_source not null default 'manual',
  source_id               uuid,
  category_id             uuid references public.categories(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.tasks enable row level security;

-- A task is visible if the user is a workspace member AND at least one of:
--   • they created it
--   • it is assigned to them
--   • it has no category (uncategorised tasks in their workspace)
--   • its category is their personal category or is marked shared
create policy "members can view relevant tasks"
  on public.tasks for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = tasks.workspace_id
        and wm.user_id = auth.uid()
    )
    and (
      tasks.created_by = auth.uid()
      or tasks.assigned_to_user_id = auth.uid()
      or tasks.category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = tasks.category_id
          and (c.owner_id = auth.uid() or c.is_shared = true)
      )
    )
  );

-- Any workspace member can create tasks
create policy "members can insert tasks"
  on public.tasks for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = tasks.workspace_id
        and wm.user_id = auth.uid()
    )
    and tasks.created_by = auth.uid()
  );

-- Creator, assignee, or workspace owner can update
create policy "members can update tasks"
  on public.tasks for update
  using (
    tasks.created_by = auth.uid()
    or tasks.assigned_to_user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = tasks.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

-- Creator or workspace owner can delete
create policy "members can delete tasks"
  on public.tasks for delete
  using (
    tasks.created_by = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = tasks.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();
