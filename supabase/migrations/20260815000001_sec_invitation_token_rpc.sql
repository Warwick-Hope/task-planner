-- Security hardening 1.1: stop household_invitations being readable by anyone
-- holding the public anon key.
--
-- 20260609000001 added a permissive `using (true)` SELECT policy so the invite
-- landing page could resolve a token before the visitor signs in. Permissive
-- policies OR together and that one has no `to` clause, so any caller with the
-- anon key could scan the whole table — tokens, invited emails, workspace ids,
-- roles. Acceptance is still bound to the invited email inside
-- accept_household_invitation(), so this was PII disclosure and phishing
-- material rather than account takeover, but it has no business being open.
--
-- Replaced with a security definer RPC that resolves exactly one row by exact
-- token and returns only what the landing page renders.

drop policy if exists "anyone can look up invitation by token" on public.household_invitations;

create or replace function public.get_invitation_by_token(p_token text)
returns table (
  workspace_id   uuid,
  workspace_name text,
  invited_email  text,
  invited_role   public.member_role,
  expired        boolean,
  accepted       boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.workspace_id,
    w.name,
    i.email,
    i.role,
    i.expires_at <= now(),
    i.accepted_at is not null
  from public.household_invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token
$$;

-- Anonymous execution is deliberate: the invite link has to work before the
-- recipient signs in. The token is the only key, and nothing else is exposed.
revoke all on function public.get_invitation_by_token(text) from public;
grant execute on function public.get_invitation_by_token(text) to anon, authenticated;
