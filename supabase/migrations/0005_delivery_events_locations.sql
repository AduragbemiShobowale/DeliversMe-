-- 0005_delivery_events_locations.sql
-- Phase 2 §13: the append-only audit trail and GPS breadcrumb tables.
-- Grants are locked down in 0010's RLS file; this file is structure only.

create table delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries (id) on delete cascade,
  event_type delivery_event_type not null,
  actor_profile_id uuid references profiles (id), -- null for system-generated events (timeout sweep)
  actor_role event_actor_role not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_events_delivery_created on delivery_events (delivery_id, created_at);

comment on table delivery_events is
  'Canonical, unconditional operational history. Append-only: INSERT privilege granted only to SECURITY DEFINER RPCs (see 0013-0015); UPDATE/DELETE revoked from all roles at the grant level in 0010, not merely denied by RLS.';

create table delivery_locations (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries (id) on delete cascade,
  rider_id uuid not null references riders (profile_id),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  recorded_at timestamptz not null default now()
);

-- Latest-point lookups only -- see Stage 7's indexing note.
create index idx_locations_delivery_recorded on delivery_locations (delivery_id, recorded_at desc);

comment on table delivery_locations is
  'GPS breadcrumb trail. Deliberately separate from delivery_events (different write frequency/semantic weight, per Stage 7). Direct client INSERT permitted under narrow RLS (0010) -- not RPC-wrapped, per Stage 18''s latency reasoning -- but UPDATE/DELETE are revoked.';
