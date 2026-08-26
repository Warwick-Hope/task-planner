-- Phase 4.9: personal access tokens, so the API can be called without a browser.
--
-- A token is a bearer credential: whoever holds the string can act as its owner
-- until it is revoked. So only its SHA-256 hash is stored, the plaintext is
-- returned exactly once at creation, and the table is owner-only under RLS.
--
-- Resolving an incoming token cannot go through RLS, because the caller has no
-- session yet — that is the whole point of the token. It goes through
-- resolve_api_token(), a security definer function that takes the hash. The hash
-- is derived from a 32-byte secret, so being able to present it is proof of
-- holding the token, which is the same argument that makes
-- get_invitation_by_token anon-callable (KB.md #9, PLAN.md decisions log
-- 17 Aug 2026).

create table if not exists public.api_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- What it is for, in the owner's words: "Claude desktop", "meeting sweep".
  name          text not null,
  -- SHA-256 of the token, hex. Never the token itself.
  token_hash    text not null unique,
  -- The first few characters of the token, kept so the UI can show which token a
  -- row is without being able to reconstruct it.
  token_prefix  text not null,
  -- Coarse on purpose: a scope nobody can explain is a scope nobody sets right.
  scopes        text[] not null default array['tasks:read']::text[],
  expires_at    timestamptz,
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.api_tokens is
  'Personal access tokens for bearer auth on /api. Hash only, owner-only under RLS; incoming tokens are resolved by resolve_api_token().';

create index if not exists api_tokens_user_id_idx on public.api_tokens (user_id);

alter table public.api_tokens enable row level security;

-- ── RLS: your own tokens, nothing else ───────────────────────────────────────
-- auth.uid() is wrapped in a select so the planner evaluates it once per query
-- rather than once per row (see 20260825000001_rls_initplan.sql).

drop policy if exists "own api tokens are readable" on public.api_tokens;
create policy "own api tokens are readable"
  on public.api_tokens for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "own api tokens are insertable" on public.api_tokens;
create policy "own api tokens are insertable"
  on public.api_tokens for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "own api tokens are updatable" on public.api_tokens;
create policy "own api tokens are updatable"
  on public.api_tokens for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own api tokens are deletable" on public.api_tokens;
create policy "own api tokens are deletable"
  on public.api_tokens for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ── Resolving a presented token ──────────────────────────────────────────────
--
-- Returns the owner and scopes for a live token, and stamps last_used_at in the
-- same statement so a token's use cannot be recorded separately from its
-- resolution. Returns no rows for a token that is revoked, expired or unknown —
-- the caller cannot tell which, deliberately.
--
-- Both sides of every comparison are qualified: an unqualified column in a
-- subquery binds to the inner table and silently makes the check a tautology
-- (KB.md #8).

create or replace function public.resolve_api_token(p_token_hash text)
returns table (
  token_id uuid,
  user_id  uuid,
  scopes   text[]
)
language sql
security definer
set search_path = public
volatile
as $$
  update public.api_tokens t
     set last_used_at = now()
   where t.token_hash = p_token_hash
     and t.revoked_at is null
     and (t.expires_at is null or t.expires_at > now())
  returning t.id, t.user_id, t.scopes;
$$;

-- Supabase grants anon EXECUTE explicitly on new functions, and that survives a
-- revoke from PUBLIC — so grant to anon by name, on purpose: a bearer request
-- has no session, so anon is the role that resolves it.
revoke all on function public.resolve_api_token(text) from public;
grant execute on function public.resolve_api_token(text) to anon, authenticated;
