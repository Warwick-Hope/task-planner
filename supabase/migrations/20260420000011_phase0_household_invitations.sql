-- Phase 0.11: household_invitations table with RLS
-- Tracks pending email invitations to join a household workspace.
-- Token is a secure random string sent via email link.

create table public.household_invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  email         text not null,
  role          public.member_role not null default 'adult',
  token         text not null unique,
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  created_by    uuid not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now()
);

alter table public.household_invitations enable row level security;

-- Workspace owners can see all invitations for their workspace
create policy "owners can view invitations"
  on public.household_invitations for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = household_invitations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

-- Only workspace owners can send invitations
create policy "owners can insert invitations"
  on public.household_invitations for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = household_invitations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
    and household_invitations.created_by = auth.uid()
  );

-- Only workspace owners can update invitations (e.g. cancel/revoke)
create policy "owners can update invitations"
  on public.household_invitations for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = household_invitations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

-- Only workspace owners can delete invitations
create policy "owners can delete invitations"
  on public.household_invitations for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = household_invitations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );
