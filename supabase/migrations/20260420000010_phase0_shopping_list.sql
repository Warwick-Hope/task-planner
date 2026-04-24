-- Phase 0.10: shopping_list table with RLS

create table public.shopping_list (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  quantity      text,
  unit          text,
  shop_tag      text,
  source        text not null default 'manual' check (source in ('manual', 'meal')),
  source_id     uuid,
  is_purchased  boolean not null default false,
  added_by      uuid not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now()
);

alter table public.shopping_list enable row level security;

create policy "members can view shopping list"
  on public.shopping_list for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = shopping_list.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "members can insert shopping list items"
  on public.shopping_list for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = shopping_list.workspace_id
        and wm.user_id = auth.uid()
    )
    and shopping_list.added_by = auth.uid()
  );

-- Any member can update (mark purchased, edit quantities etc.)
create policy "members can update shopping list items"
  on public.shopping_list for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = shopping_list.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Any member can delete items
create policy "members can delete shopping list items"
  on public.shopping_list for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = shopping_list.workspace_id
        and wm.user_id = auth.uid()
    )
  );
