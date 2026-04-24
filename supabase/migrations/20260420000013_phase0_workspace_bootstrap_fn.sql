-- Phase 0 fix: SECURITY DEFINER function for workspace bootstrapping
-- Bypasses RLS for the onboarding workspace + member creation, which is
-- a controlled server-side operation and cannot be done reliably via
-- user-context RLS across multiple tables.

create or replace function public.create_personal_workspace(
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Create personal workspace
  insert into public.workspaces (type, name, created_by)
  values ('personal', p_display_name || '''s workspace', v_user_id)
  returning id into v_workspace_id;

  -- Add calling user as owner member
  insert into public.workspace_members (workspace_id, user_id, role, display_name)
  values (v_workspace_id, v_user_id, 'owner', p_display_name);

  return v_workspace_id;
end;
$$;

-- Only authenticated users can call this function
revoke all on function public.create_personal_workspace(text) from public;
grant execute on function public.create_personal_workspace(text) to authenticated;
