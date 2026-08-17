-- Security hardening 1.2: indexes.
--
-- Before this migration the schema had no explicit indexes at all — only the
-- implicit primary key and unique constraints. Every RLS policy evaluation
-- calls is_workspace_member() / is_workspace_owner(), each of which was a
-- sequential scan of workspace_members, per row. Invisible at two users,
-- a cliff as data grows.

-- The critical one: backs both RLS helper functions.
create index if not exists workspace_members_workspace_user_idx
  on public.workspace_members (workspace_id, user_id);
create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id);

-- Backs getPersonalWorkspaceId()
create index if not exists workspaces_created_by_idx
  on public.workspaces (created_by);

-- tasks: every list, calendar and planner query filters on workspace_id
create index if not exists tasks_workspace_idx           on public.tasks (workspace_id);
create index if not exists tasks_workspace_status_idx    on public.tasks (workspace_id, status);
create index if not exists tasks_category_idx            on public.tasks (category_id);
create index if not exists tasks_created_by_idx          on public.tasks (created_by);
create index if not exists tasks_assigned_to_user_idx    on public.tasks (assigned_to_user_id);
create index if not exists tasks_parent_idx              on public.tasks (parent_task_id);

create index if not exists categories_workspace_idx      on public.categories (workspace_id);
create index if not exists categories_owner_idx          on public.categories (owner_id);
create index if not exists categories_parent_idx         on public.categories (parent_id);

create index if not exists household_profiles_workspace_idx
  on public.household_profiles (workspace_id);

create index if not exists non_negotiables_workspace_idx on public.non_negotiables (workspace_id);
create index if not exists non_negotiables_task_idx      on public.non_negotiables (task_id);
create index if not exists non_negotiables_user_date_idx on public.non_negotiables (user_id, date);

create index if not exists missions_user_idx             on public.missions (user_id);
create index if not exists values_user_idx               on public."values" (user_id);

create index if not exists rooms_workspace_idx           on public.rooms (workspace_id);
create index if not exists meals_workspace_idx           on public.meals (workspace_id);
create index if not exists meal_plan_workspace_idx       on public.meal_plan (workspace_id);
create index if not exists meal_plan_workspace_date_idx  on public.meal_plan (workspace_id, planned_date);
create index if not exists meal_plan_meal_idx            on public.meal_plan (meal_id);
create index if not exists ingredients_meal_idx          on public.ingredients (meal_id);

create index if not exists shopping_list_workspace_idx   on public.shopping_list (workspace_id);

create index if not exists household_invitations_workspace_idx
  on public.household_invitations (workspace_id);
