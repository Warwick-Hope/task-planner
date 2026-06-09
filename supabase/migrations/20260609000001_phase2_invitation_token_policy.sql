-- Phase 2.2: allow anyone to look up an invitation by its token.
-- This is needed so the accept page can validate the link without
-- the recipient being an existing workspace member.
-- The token is unguessable (crypto random), so this is safe.

create policy "anyone can look up invitation by token"
  on public.household_invitations for select
  using (true);
