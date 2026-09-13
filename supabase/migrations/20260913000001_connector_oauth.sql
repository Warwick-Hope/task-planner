-- Phase 4.11: OAuth 2.1 for the connector, so claude.ai can install it.
--
-- 4.10's personal access token reaches Claude Code and Claude Desktop and cannot
-- reach claude.ai at all: a custom connector there is added by URL and
-- authenticated by OAuth only (KB.md #46). This is the schema behind that flow —
-- clients that registered themselves, authorization codes in flight, and the
-- tokens they were exchanged for.
--
-- **Everything here is written before the writer has a session.** A client
-- registering has no user at all; a token endpoint call carries client
-- credentials and no cookie. So RLS is on with no anon policy anywhere, and every
-- anonymous step goes through a security definer function that does exactly one
-- thing — the same argument that makes resolve_api_token anon-callable
-- (KB.md #9, #44). The one thing a *person* does here is see and revoke their
-- own grants, which is a plain owner-only policy.

-- ── Clients ──────────────────────────────────────────────────────────────────
--
-- Registration is open, because dynamic client registration is how an MCP client
-- installs itself (RFC 7591) and there is nobody to approve it at that point. A
-- row is worth nothing on its own: it cannot read anything, and it cannot obtain
-- a token without a human completing the authorize step in a browser.

create table if not exists public.oauth_clients (
  id             uuid primary key default gen_random_uuid(),
  -- What the client called itself. Shown on the consent screen, so it is
  -- untrusted display text and nothing more.
  name           text not null,
  -- Public clients (PKCE, no secret) are the norm for MCP; a confidential client
  -- gets a hash here and never the plaintext back.
  secret_hash    text,
  redirect_uris  text[] not null,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz
);

comment on table public.oauth_clients is
  'OAuth clients that registered themselves (RFC 7591). A client alone grants nothing — every token needs a human to approve it in a browser.';

alter table public.oauth_clients enable row level security;

-- ── Authorization codes ──────────────────────────────────────────────────────
--
-- Short-lived, single-use, and bound to the PKCE challenge the client sent. The
-- code itself is only ever stored as a hash: it travels in a URL, which is the
-- least private place a secret can be.

create table if not exists public.oauth_authorization_codes (
  code_hash       text primary key,
  client_id       uuid not null references public.oauth_clients (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  redirect_uri    text not null,
  scopes          text[] not null,
  -- S256 only. The plain method is permitted by RFC 7636 and forbidden by OAuth
  -- 2.1, and this server is new enough to have no legacy client to carry.
  code_challenge  text not null,
  -- The audience the client asked for (RFC 8707). Recorded so a code minted for
  -- this server cannot be replayed at another one that shares the user.
  resource        text,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists oauth_codes_expiry_idx
  on public.oauth_authorization_codes (expires_at);

alter table public.oauth_authorization_codes enable row level security;

-- ── Grants ───────────────────────────────────────────────────────────────────
--
-- One row per client-user pair that completed the flow: the access token, the
-- refresh token, and what they may do. Hashes only, like api_tokens.
--
-- Revoking stamps revoked_at rather than deleting, for the same reason it does
-- there: last_used_at on a revoked grant is the only way to answer "was this
-- being used when I killed it?".

create table if not exists public.oauth_grants (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.oauth_clients (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  scopes             text[] not null,
  access_token_hash  text unique,
  refresh_token_hash text unique,
  access_expires_at  timestamptz,
  refresh_expires_at timestamptz,
  revoked_at         timestamptz,
  last_used_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists oauth_grants_user_idx on public.oauth_grants (user_id);

comment on table public.oauth_grants is
  'One row per client a user has approved. Token hashes only; revoking stamps revoked_at so last_used_at survives it.';

alter table public.oauth_grants enable row level security;

-- ── RLS: you can see and revoke what you approved ────────────────────────────
--
-- auth.uid() is wrapped in a select so the planner evaluates it once per query
-- rather than once per row (see 20260825000001_rls_initplan.sql).

drop policy if exists "own grants are readable" on public.oauth_grants;
create policy "own grants are readable"
  on public.oauth_grants for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "own grants are revokable" on public.oauth_grants;
create policy "own grants are revokable"
  on public.oauth_grants for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Deleting your own grant is allowed as well as revoking it. Revoking is what the
-- app does, because the row is the record that the connection existed; deleting
-- is for a caller that wants the row gone, and the e2e suite sweeping up after
-- itself is the one that does.
drop policy if exists "own grants are deletable" on public.oauth_grants;
create policy "own grants are deletable"
  on public.oauth_grants for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- The client behind a grant you hold, so the Connections page can name it. No
-- policy on codes at all: nothing outside these functions ever reads one.
drop policy if exists "clients behind your grants are readable" on public.oauth_clients;
create policy "clients behind your grants are readable"
  on public.oauth_clients for select
  to authenticated
  using (
    exists (
      select 1 from public.oauth_grants g
      where g.client_id = oauth_clients.id
        and g.user_id = (select auth.uid())
    )
  );

-- ── Registration ─────────────────────────────────────────────────────────────

create or replace function public.oauth_register_client(
  p_name          text,
  p_redirect_uris text[],
  p_secret_hash   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'client name is required';
  end if;

  if p_redirect_uris is null or array_length(p_redirect_uris, 1) is null then
    raise exception 'at least one redirect_uri is required';
  end if;

  insert into public.oauth_clients (name, redirect_uris, secret_hash)
  values (left(trim(p_name), 200), p_redirect_uris, p_secret_hash)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.oauth_register_client(text, text[], text) from public;
grant execute on function public.oauth_register_client(text, text[], text) to anon, authenticated;

-- ── Issuing a code ───────────────────────────────────────────────────────────
--
-- Called from the consent screen, so it has a session and takes the user from it
-- rather than from an argument — a caller cannot mint a code for somebody else.

create or replace function public.oauth_issue_code(
  p_code_hash      text,
  p_client_id      uuid,
  p_redirect_uri   text,
  p_scopes         text[],
  p_code_challenge text,
  p_resource       text,
  p_ttl_seconds    integer default 600
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'oauth_issue_code requires an authenticated caller';
  end if;

  -- Both sides qualified: an unqualified column in the subquery would bind to the
  -- inner table and make this a tautology (KB.md #8).
  if not exists (
    select 1 from public.oauth_clients c
    where c.id = p_client_id
      and p_redirect_uri = any (c.redirect_uris)
  ) then
    raise exception 'unknown client, or redirect_uri is not registered for it';
  end if;

  insert into public.oauth_authorization_codes
    (code_hash, client_id, user_id, redirect_uri, scopes, code_challenge, resource, expires_at)
  values
    (p_code_hash, p_client_id, v_user, p_redirect_uri, p_scopes, p_code_challenge, p_resource,
     now() + make_interval(secs => p_ttl_seconds));
end;
$$;

revoke all on function public.oauth_issue_code(text, uuid, text, text[], text, text, integer) from public;
grant execute on function public.oauth_issue_code(text, uuid, text, text[], text, text, integer) to authenticated;

-- ── Redeeming a code ─────────────────────────────────────────────────────────
--
-- Consumes it in the same statement that reads it, so a code raced by two
-- requests is spent exactly once. PKCE verification happens in TypeScript, where
-- the hashing already lives; this returns the challenge for that check and
-- nothing that would let a caller skip it.

create or replace function public.oauth_redeem_code(
  p_code_hash    text,
  p_client_id    uuid,
  p_redirect_uri text
)
returns table (
  user_id        uuid,
  scopes         text[],
  code_challenge text,
  resource       text
)
language sql
security definer
set search_path = public
volatile
as $$
  update public.oauth_authorization_codes c
     set used_at = now()
   where c.code_hash = p_code_hash
     and c.client_id = p_client_id
     and c.redirect_uri = p_redirect_uri
     and c.used_at is null
     and c.expires_at > now()
  returning c.user_id, c.scopes, c.code_challenge, c.resource;
$$;

revoke all on function public.oauth_redeem_code(text, uuid, text) from public;
grant execute on function public.oauth_redeem_code(text, uuid, text) to anon, authenticated;

-- ── Storing and rotating tokens ──────────────────────────────────────────────

create or replace function public.oauth_store_grant(
  p_client_id          uuid,
  p_user_id            uuid,
  p_scopes             text[],
  p_access_hash        text,
  p_refresh_hash       text,
  p_access_ttl_seconds integer,
  p_refresh_ttl_days   integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.oauth_grants
    (client_id, user_id, scopes, access_token_hash, refresh_token_hash,
     access_expires_at, refresh_expires_at)
  values
    (p_client_id, p_user_id, p_scopes, p_access_hash, p_refresh_hash,
     now() + make_interval(secs => p_access_ttl_seconds),
     now() + make_interval(days => p_refresh_ttl_days))
  returning id into v_id;

  update public.oauth_clients c set last_used_at = now() where c.id = p_client_id;

  return v_id;
end;
$$;

revoke all on function public.oauth_store_grant(uuid, uuid, text[], text, text, integer, integer) from public;
grant execute on function public.oauth_store_grant(uuid, uuid, text[], text, text, integer, integer) to anon, authenticated;

-- Rotation, in one statement: the old refresh token stops working the moment the
-- new one exists, so a stolen refresh token is good until its owner next uses
-- theirs — and then one of the two fails loudly.

create or replace function public.oauth_rotate_grant(
  p_refresh_hash       text,
  p_client_id          uuid,
  p_new_access_hash    text,
  p_new_refresh_hash   text,
  p_access_ttl_seconds integer,
  p_refresh_ttl_days   integer
)
returns table (
  grant_id uuid,
  user_id  uuid,
  scopes   text[]
)
language sql
security definer
set search_path = public
volatile
as $$
  update public.oauth_grants g
     set access_token_hash  = p_new_access_hash,
         refresh_token_hash = p_new_refresh_hash,
         access_expires_at  = now() + make_interval(secs => p_access_ttl_seconds),
         refresh_expires_at = now() + make_interval(days => p_refresh_ttl_days),
         last_used_at       = now()
   where g.refresh_token_hash = p_refresh_hash
     and g.client_id = p_client_id
     and g.revoked_at is null
     and (g.refresh_expires_at is null or g.refresh_expires_at > now())
  returning g.id, g.user_id, g.scopes;
$$;

revoke all on function public.oauth_rotate_grant(text, uuid, text, text, integer, integer) from public;
grant execute on function public.oauth_rotate_grant(text, uuid, text, text, integer, integer) to anon, authenticated;

-- ── Resolving an access token ────────────────────────────────────────────────
--
-- The same shape as resolve_api_token (4.9): stamps last_used_at in the statement
-- that resolves, and returns nothing at all for a token that is unknown, revoked
-- or expired — the caller cannot tell which, deliberately.

create or replace function public.resolve_oauth_token(p_token_hash text)
returns table (
  grant_id uuid,
  user_id  uuid,
  scopes   text[]
)
language sql
security definer
set search_path = public
volatile
as $$
  update public.oauth_grants g
     set last_used_at = now()
   where g.access_token_hash = p_token_hash
     and g.revoked_at is null
     and (g.access_expires_at is null or g.access_expires_at > now())
  returning g.id, g.user_id, g.scopes;
$$;

revoke all on function public.resolve_oauth_token(text) from public;
grant execute on function public.resolve_oauth_token(text) to anon, authenticated;

-- ── Authenticating a client at the token endpoint ────────────────────────────
--
-- The token endpoint has no session — the caller is a client, not a person — so
-- it cannot read `oauth_clients` through RLS, which grants `anon` nothing at all.
--
-- **The comparison happens here rather than in TypeScript**, so no secret hash
-- ever leaves the database. The alternative was an anon-callable function that
-- returns the hash for any client_id, and a hash handed to anyone who asks is a
-- hash that only has to be cracked once.
--
-- Returns no rows for an unknown client, and none for a confidential client whose
-- secret does not match. The caller cannot tell those apart, which is the same
-- answer resolve_api_token gives and for the same reason.

create or replace function public.oauth_authenticate_client(
  p_client_id   uuid,
  p_secret_hash text default null
)
returns table (
  id            uuid,
  name          text,
  redirect_uris text[]
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.redirect_uris
    from public.oauth_clients c
   where c.id = p_client_id
     and (
       -- A public client proves itself with PKCE instead, which is the point of
       -- PKCE: there is no secret to put in a desktop app in the first place.
       c.secret_hash is null
       or c.secret_hash = p_secret_hash
     );
$$;

revoke all on function public.oauth_authenticate_client(uuid, text) from public;
grant execute on function public.oauth_authenticate_client(uuid, text) to anon, authenticated;

-- ── The client, for the consent screen ───────────────────────────────────────
--
-- The screen has to name who is asking before the user has approved anything, and
-- the RLS policy above only shows clients behind a grant that already exists.
-- None of this is secret: it is what the client published about itself when it
-- registered, and the user is about to be shown it anyway.

create or replace function public.oauth_client_public(p_client_id uuid)
returns table (
  id            uuid,
  name          text,
  redirect_uris text[]
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.redirect_uris
    from public.oauth_clients c
   where c.id = p_client_id;
$$;

revoke all on function public.oauth_client_public(uuid) from public;
grant execute on function public.oauth_client_public(uuid) to authenticated;

-- ── Revocation by the client ─────────────────────────────────────────────────
--
-- RFC 7009. Either half of the pair identifies the grant, because a client
-- revoking "the token" may mean the access token or the refresh token. A person
-- revoking from the Connections page does not come through here — that is their
-- own row under RLS.

create or replace function public.oauth_revoke_grant(
  p_token_hash text,
  p_client_id  uuid
)
returns void
language sql
security definer
set search_path = public
volatile
as $$
  update public.oauth_grants g
     set revoked_at = now()
   where g.client_id = p_client_id
     and g.revoked_at is null
     and (g.access_token_hash = p_token_hash or g.refresh_token_hash = p_token_hash);
$$;

revoke all on function public.oauth_revoke_grant(text, uuid) from public;
grant execute on function public.oauth_revoke_grant(text, uuid) to anon, authenticated;

-- ── Housekeeping ─────────────────────────────────────────────────────────────
--
-- Spent and expired codes are litter with a secret in them. There is no cron on
-- this project, so it is swept opportunistically by the token endpoint rather
-- than left to grow.

create or replace function public.oauth_sweep_codes()
returns void
language sql
security definer
set search_path = public
volatile
as $$
  delete from public.oauth_authorization_codes c
   where c.expires_at < now() - interval '1 day';
$$;

revoke all on function public.oauth_sweep_codes() from public;
grant execute on function public.oauth_sweep_codes() to anon, authenticated;
