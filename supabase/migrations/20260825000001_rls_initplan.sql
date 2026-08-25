-- Performance: stop RLS policies re-evaluating auth.uid() once per row.
--
-- Supabase Advisor, Performance tab: `auth_rls_initplan`, roughly 50 findings.
-- A bare `auth.uid()` in a policy is treated as volatile and re-evaluated for
-- every row scanned; wrapping it as `(select auth.uid())` makes it an
-- InitPlan — evaluated once per query. Same semantics, one call instead of N.
--
-- Why this rewrites from the catalogue rather than listing the policies:
-- the current policy set is the result of 89 create/drop statements across 14
-- migrations, several of which replace earlier ones. Transcribing the surviving
-- definitions by hand would be a guess, and a wrong guess silently changes who
-- can read what. Reading pg_policies takes the definition Postgres actually has.
--
-- Safety properties:
--   * idempotent — a policy already using (select auth.uid()) is skipped, so
--     re-running changes nothing
--   * faithful — name, command, roles, permissive/restrictive, USING and
--     WITH CHECK are all carried across unchanged apart from the wrapping
--   * auditable — every rewritten policy is announced with RAISE NOTICE, so the
--     push output lists exactly what changed
--
-- Not touched: auth.uid() inside the security definer helpers
-- (is_workspace_member / is_workspace_owner). Those are already called once per
-- row at most and are marked stable.

do $$
declare
  policy_record record;
  new_using     text;
  new_check     text;
  statement     text;
  rewritten     int := 0;
  skipped       int := 0;
begin
  for policy_record in
    select
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  loop
    -- Only the bare form needs rewriting. Postgres renders an existing
    -- (select auth.uid()) as "( SELECT auth.uid() AS uid)", so look for that.
    if (coalesce(policy_record.qual, '') || coalesce(policy_record.with_check, '')) not like '%auth.uid()%'
       or (coalesce(policy_record.qual, '') || coalesce(policy_record.with_check, '')) like '%SELECT auth.uid()%'
    then
      skipped := skipped + 1;
      continue;
    end if;

    new_using := replace(policy_record.qual,       'auth.uid()', '( select auth.uid() )');
    new_check := replace(policy_record.with_check, 'auth.uid()', '( select auth.uid() )');

    execute format('drop policy %I on %I.%I',
                   policy_record.policyname, policy_record.schemaname, policy_record.tablename);

    statement := format('create policy %I on %I.%I as %s for %s to %s',
                        policy_record.policyname,
                        policy_record.schemaname,
                        policy_record.tablename,
                        case when policy_record.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
                        policy_record.cmd,
                        array_to_string(policy_record.roles, ', '));

    if new_using is not null then
      statement := statement || format(' using (%s)', new_using);
    end if;

    if new_check is not null then
      statement := statement || format(' with check (%s)', new_check);
    end if;

    execute statement;
    rewritten := rewritten + 1;
    raise notice 'rewrote policy "%" on %.%',
      policy_record.policyname, policy_record.schemaname, policy_record.tablename;
  end loop;

  raise notice 'auth.uid() InitPlan rewrite: % policies rewritten, % already correct or not applicable',
    rewritten, skipped;
end
$$;
