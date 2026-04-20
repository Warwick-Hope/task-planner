-- Phase 0.9: rooms, meals, meal_plan, ingredients tables with RLS
-- All household workspace only.

-- rooms
create table public.rooms (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.rooms enable row level security;

create policy "members can view rooms"
  on public.rooms for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = rooms.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "adults can insert rooms"
  on public.rooms for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = rooms.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

create policy "adults can update rooms"
  on public.rooms for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = rooms.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

create policy "adults can delete rooms"
  on public.rooms for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = rooms.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

-- meals
create table public.meals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  notes         text,
  created_at    timestamptz not null default now()
);

alter table public.meals enable row level security;

create policy "members can view meals"
  on public.meals for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meals.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "adults can insert meals"
  on public.meals for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meals.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

create policy "adults can update meals"
  on public.meals for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meals.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

create policy "adults can delete meals"
  on public.meals for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meals.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

-- meal_plan
create table public.meal_plan (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  meal_id       uuid not null references public.meals(id) on delete cascade,
  planned_date  date not null,
  servings      smallint,
  created_at    timestamptz not null default now()
);

alter table public.meal_plan enable row level security;

create policy "members can view meal_plan"
  on public.meal_plan for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meal_plan.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "adults can insert meal_plan"
  on public.meal_plan for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meal_plan.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

create policy "adults can update meal_plan"
  on public.meal_plan for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meal_plan.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

create policy "adults can delete meal_plan"
  on public.meal_plan for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meal_plan.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

-- ingredients
create table public.ingredients (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references public.meals(id) on delete cascade,
  name       text not null,
  quantity   text,
  unit       text,
  created_at timestamptz not null default now()
);

alter table public.ingredients enable row level security;

-- Ingredients are visible to members of the workspace that owns the meal
create policy "members can view ingredients"
  on public.ingredients for select
  using (
    exists (
      select 1 from public.meals m
      join public.workspace_members wm on wm.workspace_id = m.workspace_id
      where m.id = ingredients.meal_id
        and wm.user_id = auth.uid()
    )
  );

create policy "adults can insert ingredients"
  on public.ingredients for insert
  with check (
    exists (
      select 1 from public.meals m
      join public.workspace_members wm on wm.workspace_id = m.workspace_id
      where m.id = ingredients.meal_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

create policy "adults can update ingredients"
  on public.ingredients for update
  using (
    exists (
      select 1 from public.meals m
      join public.workspace_members wm on wm.workspace_id = m.workspace_id
      where m.id = ingredients.meal_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

create policy "adults can delete ingredients"
  on public.ingredients for delete
  using (
    exists (
      select 1 from public.meals m
      join public.workspace_members wm on wm.workspace_id = m.workspace_id
      where m.id = ingredients.meal_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );
