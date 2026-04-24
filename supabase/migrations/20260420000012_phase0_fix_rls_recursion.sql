-- Phase 0 fix: infinite recursion in workspace_members RLS
--
-- Root cause: workspace_members SELECT policy queries workspace_members,
-- which triggers the SELECT policy again → infinite recursion.
--
-- Fix: security definer helper functions that run as postgres (bypasses RLS),
-- used in all policies that need to check workspace membership.

-- ── Helper functions ──────────────────────────────────────────────────────────

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  )
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  )
$$;

-- ── workspace_members: drop and recreate all policies ─────────────────────────

drop policy if exists "members can view workspace members" on public.workspace_members;
drop policy if exists "owner can insert members" on public.workspace_members;
drop policy if exists "owner or self can update member" on public.workspace_members;
drop policy if exists "owner or self can delete member" on public.workspace_members;

-- SELECT: uses helper (security definer → no recursion)
create policy "members can view workspace members"
  on public.workspace_members for select
  using (is_workspace_member(workspace_id));

-- INSERT: allow first row (owner self-insert on workspace creation) or existing owner
create policy "owner can insert members"
  on public.workspace_members for insert
  with check (
    not exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
    )
    or is_workspace_owner(workspace_members.workspace_id)
  );

create policy "owner or self can update member"
  on public.workspace_members for update
  using (
    user_id = auth.uid()
    or is_workspace_owner(workspace_id)
  );

create policy "owner or self can delete member"
  on public.workspace_members for delete
  using (
    user_id = auth.uid()
    or is_workspace_owner(workspace_id)
  );

-- ── workspaces: update policies to use helpers ────────────────────────────────

drop policy if exists "members can view their workspaces" on public.workspaces;
drop policy if exists "owner can update workspace" on public.workspaces;
drop policy if exists "owner can delete workspace" on public.workspaces;

create policy "members can view their workspaces"
  on public.workspaces for select
  using (is_workspace_member(id));

create policy "owner can update workspace"
  on public.workspaces for update
  using (is_workspace_owner(id));

create policy "owner can delete workspace"
  on public.workspaces for delete
  using (is_workspace_owner(id));
