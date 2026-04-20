-- Phase 0.4: profiles table with RLS
-- One row per auth user. Created on signup via trigger or onboarding flow.

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can view their own profile, or profiles of users in a shared workspace
create policy "users can view relevant profiles"
  on public.profiles for select
  using (
    profiles.id = auth.uid()
    or exists (
      select 1 from public.workspace_members a
      join public.workspace_members b on b.workspace_id = a.workspace_id
      where a.user_id = auth.uid()
        and b.user_id = profiles.id
    )
  );

-- Users can only insert their own profile
create policy "users can insert own profile"
  on public.profiles for insert
  with check (profiles.id = auth.uid());

-- Users can only update their own profile
create policy "users can update own profile"
  on public.profiles for update
  using (profiles.id = auth.uid());
