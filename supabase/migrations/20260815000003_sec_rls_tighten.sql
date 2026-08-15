-- Security hardening 1.3 (database side).
--
-- Three fixes:
--   1. household_profiles policies compared a column to itself, so membership
--      of ANY workspace granted access to EVERY workspace's child profiles.
--   2. shopping_list INSERT/DELETE were open to restricted members.
--   3. meal_plan INSERT never checked the meal belonged to the same workspace.

-- ── 1. household_profiles: cross-workspace leak ───────────────────────────────
--
-- The original policies (20260420000003) read:
--     where wm.workspace_id = workspace_id
-- Inside the subquery, the unqualified `workspace_id` resolves to the INNER
-- table's column, not the row being checked — i.e. `wm.workspace_id =
-- wm.workspace_id`, always true. The policy therefore only asked "is this user
-- a member of some workspace?", letting any authenticated household user read,
-- edit and delete child profiles belonging to unrelated households.
--
-- Recreated using the security definer helpers, which take the row's
-- workspace_id explicitly and cannot be shadowed this way.

drop policy if exists "members can view household profiles"   on public.household_profiles;
drop policy if exists "adults can insert household profiles"  on public.household_profiles;
drop policy if exists "adults can update household profiles"  on public.household_profiles;
drop policy if exists "adults can delete household profiles"  on public.household_profiles;

create policy "members can view household profiles"
  on public.household_profiles for select
  using (is_workspace_member(household_profiles.workspace_id));

create policy "adults can insert household profiles"
  on public.household_profiles for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = household_profiles.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

create policy "adults can update household profiles"
  on public.household_profiles for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = household_profiles.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

create policy "adults can delete household profiles"
  on public.household_profiles for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = household_profiles.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

-- ── 2. shopping_list: restricted members ──────────────────────────────────────
--
-- Adding and removing items is an adult action; ticking an item off is not.
-- UPDATE therefore stays open to every member — RLS is row-level and cannot
-- express "restricted members may change is_purchased only". The API route
-- (app/api/household/[id]/shopping/[itemId]) enforces that column rule, and a
-- restricted member reaching Postgres directly could still edit an item's text.
-- Revisit with a trigger if restricted logins are ever handed to anyone the
-- household does not trust with the list itself.

drop policy if exists "members can insert shopping list items" on public.shopping_list;
drop policy if exists "members can delete shopping list items" on public.shopping_list;

create policy "adults can insert shopping list items"
  on public.shopping_list for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = shopping_list.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
    and shopping_list.added_by = auth.uid()
  );

create policy "adults can delete shopping list items"
  on public.shopping_list for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = shopping_list.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
  );

-- ── 3. meal_plan: meal must belong to the same workspace ──────────────────────
--
-- Without this an adult in household A could plan household B's meal onto their
-- calendar, and the joined select would then expose B's meal name and notes.

drop policy if exists "adults can insert meal_plan" on public.meal_plan;

create policy "adults can insert meal_plan"
  on public.meal_plan for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = meal_plan.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'adult')
    )
    and exists (
      select 1 from public.meals m
      where m.id = meal_plan.meal_id
        and m.workspace_id = meal_plan.workspace_id
    )
  );
