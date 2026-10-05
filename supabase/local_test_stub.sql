-- LOCAL TEST STUB ONLY -- not part of the real migration set, not to be
-- deployed. Simulates the pieces of Supabase's platform (auth schema,
-- auth.uid()/auth.jwt(), storage.buckets/objects) that migrations 0001+
-- assume already exist on a real Supabase project, so they can be
-- syntax/logic-checked against a real Postgres locally.

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Session simulation: tests SET this before running as a given user.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
$$;

create schema if not exists storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

-- Real Supabase projects grant these by default; the local stub must do
-- so explicitly since it's not a real Supabase-provisioned database.
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function auth.jwt() to authenticated;
grant select on storage.buckets, storage.objects to authenticated;

-- Real Supabase projects pre-create this publication for Realtime.
create publication supabase_realtime;
