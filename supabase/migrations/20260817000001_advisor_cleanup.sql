-- Supabase Advisor cleanup (Security tab, run 17 Aug 2026 after the hardening
-- migrations). The run reported 0 errors; these are the three findings worth
-- acting on. The remaining SECURITY DEFINER warnings are by design — see below.

-- ── 1. Drop the leftover task_roles table ─────────────────────────────────────
--
-- Advisor: "RLS Enabled No Policy" on public.task_roles.
--
-- task_roles is from the pre-Phase-0 schema, when tasks were tagged with
-- role_categories through a join table. Phase 0.1 rebuilt the schema and
-- categories replaced role_categories, but the drop missed this one. It appears
-- in no migration, no TypeScript, and no query: 0 rows and 0 sequential scans on
-- dev. RLS is on with no policies, so it already denies everything — this is
-- litter rather than an exposure.

drop table if exists public.task_roles;

-- ── 2. Pin set_updated_at's search_path ───────────────────────────────────────
--
-- Advisor: "Function Search Path Mutable" on public.set_updated_at.
--
-- The tasks trigger function (20260420000006) never set search_path, so it
-- resolves unqualified names against whatever the caller's search_path happens
-- to be. It is not SECURITY DEFINER, so the exposure is small, but every other
-- function in the schema pins it and this one should match.

alter function public.set_updated_at() set search_path = public;

-- ── 3. Remove anon EXECUTE on the functions that require a session ────────────
--
-- Advisor: "Public Can Execute SECURITY DEFINER Function".
--
-- Each of these already ran `revoke all ... from public`, but Supabase's default
-- privileges grant EXECUTE to the `anon` role explicitly, and an explicit grant
-- survives a revoke from PUBLIC. All three raise 'Not authenticated' when
-- auth.uid() is null, so this closes a door that was already locked — but an
-- anonymous caller should not be able to reach them at all.

revoke execute on function public.accept_household_invitation(text) from anon;
revoke execute on function public.create_household_workspace(text)   from anon;
revoke execute on function public.create_personal_workspace(text)    from anon;

-- Deliberately NOT changed:
--
--   get_invitation_by_token(text) — anon EXECUTE is the entire point. The invite
--     landing page has to resolve a token before the recipient signs in.
--
--   is_workspace_member(uuid) / is_workspace_owner(uuid) — these are evaluated
--     inside RLS policies as the querying role, so anon needs EXECUTE for any
--     anonymous read to return an empty result rather than a permission error.
--     Both return false when auth.uid() is null, so they disclose nothing.
