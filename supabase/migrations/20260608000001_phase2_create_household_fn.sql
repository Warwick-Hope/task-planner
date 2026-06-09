-- Phase 2.1: SECURITY DEFINER function for household workspace creation.
-- Creates the workspace and adds the calling user as owner in one transaction.

create or replace function public.create_household_workspace(
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_user_id uuid;
  v_display_name text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Look up display name from profiles
  select display_name into v_display_name
  from public.profiles
  where id = v_user_id;

  if v_display_name is null then
    raise exception 'Profile not found';
  end if;

  -- Create household workspace
  insert into public.workspaces (type, name, created_by)
  values ('household', p_name, v_user_id)
  returning id into v_workspace_id;

  -- Add calling user as owner member
  insert into public.workspace_members (workspace_id, user_id, role, display_name)
  values (v_workspace_id, v_user_id, 'owner', v_display_name);

  return v_workspace_id;
end;
$$;

revoke all on function public.create_household_workspace(text) from public;
grant execute on function public.create_household_workspace(text) to authenticated;
