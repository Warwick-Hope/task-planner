-- Phase 2.2: allow an authenticated user to insert themselves as a workspace
-- member when a valid (unexpired, unaccepted) invitation exists for their email.
-- Uses a SECURITY DEFINER function to keep the logic server-side and avoid
-- exposing auth.users email to client-side RLS.

create or replace function public.accept_household_invitation(
  p_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid;
  v_user_email text;
  v_invite    record;
  v_display_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get caller's email from auth.users
  select email into v_user_email
  from auth.users
  where id = v_user_id;

  -- Find the invitation
  select * into v_invite
  from public.household_invitations
  where token = p_token
    and lower(email) = lower(v_user_email)
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'Invitation not found, expired, or email mismatch';
  end if;

  -- Check not already a member
  if exists (
    select 1 from public.workspace_members
    where workspace_id = v_invite.workspace_id
      and user_id = v_user_id
  ) then
    raise exception 'Already a member of this household';
  end if;

  -- Get display name from profile
  select display_name into v_display_name
  from public.profiles
  where id = v_user_id;

  if v_display_name is null then
    raise exception 'Profile not found — complete onboarding first';
  end if;

  -- Add as member
  insert into public.workspace_members (workspace_id, user_id, role, display_name)
  values (v_invite.workspace_id, v_user_id, v_invite.role, v_display_name);

  -- Mark accepted
  update public.household_invitations
  set accepted_at = now()
  where id = v_invite.id;

  return v_invite.workspace_id;
end;
$$;

revoke all on function public.accept_household_invitation(text) from public;
grant execute on function public.accept_household_invitation(text) to authenticated;
