-- Phase 0.2: workspaces and workspace_members tables with RLS
-- Tables created first, then policies (workspace policies reference workspace_members)

-- workspaces
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  type        public.workspace_type not null,
  name        text not null,
  created_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

-- workspace_members
create table public.workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade, -- nullable: null = child profile
  role          public.member_role not null default 'adult',
  display_name  text not null,
  joined_at     timestamptz not null default now()
);

-- RLS: workspaces
alter table public.workspaces enable row level security;

create policy "members can view their workspaces"
  on public.workspaces for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id
        and wm.user_id = auth.uid()
    )
  );

create policy "authenticated users can create workspaces"
  on public.workspaces for insert
  with check (auth.uid() = created_by);

create policy "owner can update workspace"
  on public.workspaces for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "owner can delete workspace"
  on public.workspaces for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

-- RLS: workspace_members
alter table public.workspace_members enable row level security;

create policy "members can view workspace members"
  on public.workspace_members for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Allow insert when: user is an owner of the workspace, OR no members exist yet (first row = owner self-insert on creation)
create policy "owner can insert members"
  on public.workspace_members for insert
  with check (
    not exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
    )
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "owner or self can update member"
  on public.workspace_members for update
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "owner or self can delete member"
  on public.workspace_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );
