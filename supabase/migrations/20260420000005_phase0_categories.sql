-- Phase 0.5: categories table with RLS
-- Replaces role_categories. Personal categories have owner_id set; household categories have owner_id null.
-- is_shared = true exposes tasks in that category to all household members.

create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  owner_id      uuid references auth.users(id) on delete cascade, -- null = household-level
  name          text not null,
  colour        text not null default '#6366f1',
  is_shared     boolean not null default false,
  sort_order    integer not null default 0,
  parent_id     uuid references public.categories(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.categories enable row level security;

-- Members see household categories (owner_id null) and their own personal categories
create policy "members can view relevant categories"
  on public.categories for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = categories.workspace_id
        and wm.user_id = auth.uid()
    )
    and (categories.owner_id is null or categories.owner_id = auth.uid())
  );

-- Any workspace member can create a personal category (owner_id = self)
-- Adult/owner members can create household categories (owner_id null)
create policy "members can insert categories"
  on public.categories for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = categories.workspace_id
        and wm.user_id = auth.uid()
        and (
          -- personal category: must own it
          (categories.owner_id = auth.uid())
          -- household category: must be owner or adult
          or (categories.owner_id is null and wm.role in ('owner', 'adult'))
        )
    )
  );

-- Personal category: only the owner can update; household category: owner/adult members
create policy "members can update categories"
  on public.categories for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = categories.workspace_id
        and wm.user_id = auth.uid()
        and (
          (categories.owner_id = auth.uid())
          or (categories.owner_id is null and wm.role in ('owner', 'adult'))
        )
    )
  );

-- Same rules for delete
create policy "members can delete categories"
  on public.categories for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = categories.workspace_id
        and wm.user_id = auth.uid()
        and (
          (categories.owner_id = auth.uid())
          or (categories.owner_id is null and wm.role in ('owner', 'adult'))
        )
    )
  );
