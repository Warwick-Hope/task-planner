-- Phase 0.3: household_profiles table with RLS
-- Non-auth household members (children) — name and avatar only, cannot log in

create table public.household_profiles (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  avatar_colour text not null default '#6366f1',
  created_by    uuid not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now()
);

alter table public.household_profiles enable row level security;

-- Any workspace member can view child profiles in their workspace
create policy "members can view household profiles"
  on public.household_profiles for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Only adult members and owners can add child profiles
create policy "adults can insert household profiles"
  on public.household_profiles for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

-- Only adult members and owners can update child profiles
create policy "adults can update household profiles"
  on public.household_profiles for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

-- Only adult members and owners can delete child profiles
create policy "adults can delete household profiles"
  on public.household_profiles for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );
