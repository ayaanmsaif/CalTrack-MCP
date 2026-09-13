-- OAuth 2.1 + Dynamic Client Registration schema for CalTrack's own
-- authorization server (spec §8/§9/§10). Managed exclusively by the
-- MCP/HTTP server process via the Supabase service-role key.
--
-- RLS is enabled with NO policies on every table below — same pattern as
-- goal_adjustments_log in 20260828000003_rls_policies.sql: service_role
-- bypasses RLS entirely; anon/authenticated get zero rows. These tables are
-- never touched by an end-user's own session, only by the server itself.

create extension if not exists pgcrypto;

-- Dynamically registered OAuth clients (RFC 7591) --------------------------

create table oauth_clients (
  client_id text primary key,
  client_secret text,                       -- plaintext — see note below
  client_secret_expires_at bigint,          -- unix seconds; null/0 = never
  client_id_issued_at bigint not null,
  redirect_uris text[] not null,
  token_endpoint_auth_method text not null default 'client_secret_post',
  grant_types text[] not null default array['authorization_code', 'refresh_token'],
  response_types text[] not null default array['code'],
  client_name text,
  client_uri text,
  logo_uri text,
  scope text,
  contacts text[],
  tos_uri text,
  policy_uri text,
  jwks_uri text,
  jwks jsonb,
  software_id text,
  software_version text,
  created_at timestamptz not null default now()
);
-- client_secret is stored in PLAINTEXT, not hashed. The MCP SDK's built-in
-- client-auth middleware does a direct string comparison against whatever
-- oauth_clients.getClient() returns — it never hashes on its side, so a
-- one-way hash here would break every client-secret token request. This
-- table is reachable only via the service-role key (RLS below); same trust
-- boundary as the rest of this schema.

-- Pending login/authorize transactions (the redirect-chain handoff) --------

create table oauth_login_transactions (
  id text primary key,                       -- 256-bit random token; also the signed cookie value
  client_id text not null references oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,              -- the AI client's PKCE challenge (S256)
  scopes text[] not null default '{}',
  state text,
  resource text,                             -- RFC 8707 resource indicator, if any
  google_code_verifier text,                 -- our own PKCE verifier for the Supabase<->Google leg
  user_id uuid references auth.users(id) on delete cascade,  -- set once identity resolves
  status text not null default 'pending' check (status in ('pending', 'authenticated')),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);
create index idx_oauth_login_transactions_expires_at on oauth_login_transactions (expires_at);

-- Issued authorization codes (one-time use, short-lived) -------------------

create table oauth_authorization_codes (
  code text primary key,
  client_id text not null references oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scopes text[] not null default '{}',
  resource text,
  used boolean not null default false,
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  created_at timestamptz not null default now()
);
create index idx_oauth_authorization_codes_expires_at on oauth_authorization_codes (expires_at);

-- Issued access/refresh token pairs, one row per (user, client) connection -

create table oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token_hash text not null unique,    -- sha256 hex
  refresh_token_hash text unique,
  scopes text[] not null default '{}',
  resource text,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_oauth_tokens_user_client on oauth_tokens (user_id, client_id);
create index idx_oauth_tokens_access_expires on oauth_tokens (access_token_expires_at);
-- Unlike oauth_clients.client_secret, access/refresh tokens are verified
-- entirely by our own code (never compared by the SDK itself), so hashing
-- them here is both safe and worthwhile: a DB leak alone doesn't hand out
-- live bearer tokens.

-- Remembered per-(user,client) consent — spec §10 "approve once" ----------

create table oauth_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references oauth_clients(client_id) on delete cascade,
  scopes text[] not null default '{}',
  granted_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

-- RLS: deny all client access, service-role only ---------------------------

alter table oauth_clients enable row level security;
alter table oauth_login_transactions enable row level security;
alter table oauth_authorization_codes enable row level security;
alter table oauth_tokens enable row level security;
alter table oauth_consents enable row level security;
-- No policies defined anywhere above — intentional, matches the
-- goal_adjustments_log precedent in 20260828000003_rls_policies.sql.
