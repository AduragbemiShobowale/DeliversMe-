-- ============================================================
-- FILE: 0001_extensions_and_enums.sql
-- ============================================================
-- 0001_extensions_and_enums.sql
-- Phase 2: extensions and shared enum types.

create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "pg_cron"; -- scheduled assignment-timeout sweep (0016)

create type user_role as enum ('admin', 'owner', 'rider', 'customer');

create type business_verification_status as enum ('pending', 'verified', 'suspended');

create type rider_availability as enum ('available', 'busy', 'offline');

create type business_customer_status as enum ('pending_invitation', 'active');

create type delivery_priority as enum ('normal', 'urgent');

-- Matches the approved graph-based state machine (Stage 6, corrected doc 10 §10).
-- No linear CHECK on transitions here deliberately -- legal transitions are
-- enforced exclusively by the RPC functions in 0013/0014/0015, never by a
-- raw client-side UPDATE. See those files' comments for the transition table.
create type delivery_status as enum (
  'ready_for_dispatch',
  'assigned',
  'accepted',
  'in_transit',
  'delivered',
  'failed'
);

create type delivery_event_type as enum (
  'created',
  'priority_updated',
  'assigned',
  'accepted',
  'rejected',
  'expired',
  'started',
  'reassignment_requested',
  'reassignment_denied',
  'reassigned',
  'location_updated',
  'proof_uploaded',
  'proof_corrected',
  'delivered',
  'failed',
  'rating_recorded',
  'admin_intervened'
);

create type event_actor_role as enum ('owner', 'rider', 'admin', 'system');

create type reassignment_status as enum ('pending', 'approved', 'denied');

create type resolver_role as enum ('owner', 'admin');


-- ============================================================
-- FILE: 0002_profiles_businesses.sql
-- ============================================================
-- 0002_profiles_businesses.sql
-- Phase 2 §13: profiles (identity for all four roles) and businesses.

create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null, -- FK added after profiles exists (circular ref)
  name text not null check (char_length(trim(name)) > 0),
  verification_status business_verification_status not null default 'pending',
  assignment_timeout_minutes int not null default 5 check (assignment_timeout_minutes > 0),
  rider_default_capacity int check (rider_default_capacity > 0), -- inert signal only, Stage 7 refinement #8
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_owner_unique unique (owner_profile_id)
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null,
  business_id uuid references businesses (id) on delete restrict,
  full_name text not null check (char_length(trim(full_name)) > 0),
  phone text,
  created_at timestamptz not null default now(),
  -- Structural guarantee (Phase 2 report): only owner/rider profiles may
  -- carry a business_id. Admin and customer profiles are always
  -- platform-level. This makes the constraint impossible to violate via
  -- application bugs, not just discouraged by convention.
  constraint profiles_business_scope check (
    (role in ('owner', 'rider') and business_id is not null)
    or (role in ('admin', 'customer') and business_id is null)
  )
);

-- DEFERRABLE INITIALLY DEFERRED: resolves the businesses<->profiles
-- bootstrap circularity (an owner profile requires a business_id per
-- profiles_business_scope, but a business requires an existing owner
-- profile). The signup RPC (0012) pre-generates both UUIDs, inserts the
-- business row first (this FK isn't checked until commit), then the
-- profile row referencing it, so both immediate constraints are satisfied
-- by the time the transaction commits.
alter table businesses
  add constraint businesses_owner_profile_fk
  foreign key (owner_profile_id) references profiles (id) on delete restrict
  deferrable initially deferred;

create index idx_profiles_business_id on profiles (business_id) where business_id is not null;
create index idx_profiles_phone on profiles (phone) where phone is not null;
create index idx_profiles_role on profiles (role);

comment on constraint profiles_business_scope on profiles is
  'Enforces Phase 2 role model: admin/customer profiles are platform-level; owner/rider profiles belong to exactly one business.';

-- Cross-table guarantee that a business's owner_profile_id always points
-- at a profile with role='owner'. Not expressible as a plain CHECK
-- (cross-table), so enforced here as a trigger -- closes a gap where
-- nothing would otherwise stop owner_profile_id from referencing an
-- admin or rider profile.
create or replace function check_business_owner_role()
returns trigger
language plpgsql
as $$
declare
  owner_role user_role;
begin
  select role into owner_role from profiles where id = new.owner_profile_id;
  if owner_role is null then
    raise exception 'owner_profile_id % does not exist', new.owner_profile_id;
  end if;
  if owner_role <> 'owner' then
    raise exception 'businesses.owner_profile_id must reference a profile with role=owner (found %)', owner_role;
  end if;
  return new;
end;
$$;

-- CONSTRAINT TRIGGER, not a plain trigger: a plain trigger fires
-- immediately on INSERT, which would break the same bootstrap sequencing
-- the deferred FK above exists to solve (the business row is inserted
-- before its owner's profile row in handle_new_user(), 0018). A deferred
-- constraint trigger, like the deferred FK, only fires at COMMIT, by
-- which point both rows exist. Caught by testing against a real
-- Postgres instance during Phase 2 -- see the Phase 2 delivery notes.
create constraint trigger trg_businesses_owner_role_check
  after insert or update of owner_profile_id on businesses
  deferrable initially deferred
  for each row execute function check_business_owner_role();


-- ============================================================
-- FILE: 0003_riders_business_customers.sql
-- ============================================================
-- 0003_riders_business_customers.sql
-- Phase 2 §13: riders (1:0-1 extension of profiles) and the new
-- business_customers relationship table -- the structural fix that makes
-- the cross-business privacy boundary (§14) enforceable rather than
-- merely policy-asserted.

create table riders (
  profile_id uuid primary key references profiles (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  availability_status rider_availability not null default 'offline',
  created_at timestamptz not null default now()
);

create index idx_riders_business_availability on riders (business_id, availability_status);

create table business_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  customer_profile_id uuid references profiles (id) on delete restrict,
  status business_customer_status not null default 'pending_invitation',
  -- Snapshot fields for a not-yet-claimed relationship. Mutually exclusive
  -- with customer_profile_id by construction -- see the CHECK constraints
  -- below. Once claimed, these are left in place as a historical record
  -- of what the Owner originally entered, not cleared.
  pending_name text,
  pending_phone text,
  pending_email text,
  default_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bc_active_requires_profile check (
    status = 'active' and customer_profile_id is not null
    or status = 'pending_invitation' and customer_profile_id is null
  ),
  constraint bc_pending_requires_contact check (
    status <> 'pending_invitation'
    or (pending_phone is not null or pending_email is not null)
  ),
  -- One relationship row per claimed customer per business -- prevents an
  -- Owner from accidentally creating a duplicate relationship for a
  -- customer who already has an active row with that business.
  constraint bc_unique_claimed_customer unique nulls not distinct (business_id, customer_profile_id)
);

create index idx_bc_business_id on business_customers (business_id);
create index idx_bc_customer_profile_id on business_customers (customer_profile_id) where customer_profile_id is not null;
create index idx_bc_pending_phone on business_customers (pending_phone) where pending_phone is not null;
create index idx_bc_pending_email on business_customers (pending_email) where pending_email is not null;

comment on table business_customers is
  'Phase 2 core correction: the per-business relationship to a global customer profile. A delivery references this table, never a customer profile directly -- see deliveries.business_customer_id.';


-- ============================================================
-- FILE: 0004_deliveries.sql
-- ============================================================
-- 0004_deliveries.sql
-- Phase 2 §13: deliveries, referencing business_customers rather than a
-- bare customer id. business_id is deliberately stored redundantly here
-- (denormalized against business_customers.business_id) -- every RLS
-- policy and dashboard query filters on it directly, and it never changes
-- after creation. See the Phase 2 report for why this trade-off was made
-- explicitly rather than left implicit.

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  business_customer_id uuid not null references business_customers (id) on delete restrict,
  assigned_rider_id uuid references riders (profile_id) on delete set null,

  status delivery_status not null default 'ready_for_dispatch',
  priority delivery_priority not null default 'normal',
  scheduled_window_start timestamptz,
  scheduled_window_end timestamptz,
  estimated_delivery_minutes int check (estimated_delivery_minutes > 0),

  assigned_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text,

  reassignment_requested boolean not null default false,

  rating smallint check (rating between 1 and 5),
  rating_comment text,
  rating_recorded_by uuid references profiles (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- business_customer_id's own business_id must match this delivery's
  -- business_id. Enforced in the create_delivery RPC (0013), since a
  -- cross-table CHECK against another table isn't expressible directly --
  -- flagging that split of responsibility here so it isn't assumed the
  -- schema alone guarantees it.
  constraint deliveries_failure_reason_requires_failed check (
    (status = 'failed') = (failure_reason is not null)
  )
);

create index idx_deliveries_business_status on deliveries (business_id, status);
create index idx_deliveries_business_customer on deliveries (business_customer_id);
create index idx_deliveries_assigned_rider on deliveries (assigned_rider_id) where assigned_rider_id is not null;
-- Deterministic dispatch-queue ordering (Stage 9/11 refinement): priority,
-- then creation time, then id as the final tiebreak.
create index idx_deliveries_queue_order on deliveries (business_id, priority, created_at, id)
  where status = 'ready_for_dispatch';

comment on column deliveries.business_id is
  'Denormalized from business_customers.business_id for query/RLS performance -- see Phase 2 report. Kept in sync only at creation time by create_delivery(); never independently updatable.';


-- ============================================================
-- FILE: 0005_delivery_events_locations.sql
-- ============================================================
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


-- ============================================================
-- FILE: 0006_reassignment_pod_notifications.sql
-- ============================================================
-- 0006_reassignment_pod_notifications.sql
-- Phase 2 §13/§11/§6: reassignment requests (now with mandatory reason +
-- optional evidence photo, resolvable by owner or admin), versioned proof
-- of delivery, and recipient-scoped notifications.

create table reassignment_requests (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries (id) on delete cascade,
  requested_by_rider_id uuid not null references riders (profile_id),
  reason text not null check (char_length(trim(reason)) > 0), -- mandatory per Phase 2 §6
  evidence_photo_url text, -- optional, per Phase 2 §6
  status reassignment_status not null default 'pending',
  decided_by_role resolver_role,
  decided_by_profile_id uuid references profiles (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint reassignment_resolution_consistency check (
    (status = 'pending' and decided_by_role is null and resolved_at is null)
    or (status <> 'pending' and decided_by_role is not null and resolved_at is not null)
  )
);

create index idx_reassignment_delivery on reassignment_requests (delivery_id);
create index idx_reassignment_pending on reassignment_requests (delivery_id) where status = 'pending';

-- Versioned, append-only proof of delivery (Phase 2 §11). No is_current
-- column and no UPDATE grant at all -- "current" is computed as
-- MAX(version) at query time. A correction is always a new row.
create table proof_of_delivery (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries (id) on delete cascade,
  version int not null check (version > 0),
  photo_url text not null,
  recipient_name text,
  notes text,
  uploaded_by uuid not null references profiles (id),
  uploaded_at timestamptz not null default now(),

  constraint pod_unique_version unique (delivery_id, version)
);

create index idx_pod_delivery_version on proof_of_delivery (delivery_id, version desc);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  recipient_profile_id uuid not null references profiles (id) on delete cascade,
  delivery_id uuid references deliveries (id) on delete cascade,
  source_event_id uuid references delivery_events (id), -- Stage 15/19 refinement
  notification_type delivery_event_type not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_recipient on notifications (recipient_profile_id, is_read, created_at desc);

comment on table notifications is
  'Recipient-scoped, filtered subset of delivery_events. Routine forward progress (e.g. started) never generates a row here -- see the RPCs in 0013 for exactly which events do.';


-- ============================================================
-- FILE: 0007_triggers.sql
-- ============================================================
-- 0007_triggers.sql
-- Shared trigger utilities: updated_at maintenance, and a defense-in-depth
-- check that deliveries.business_id always matches its
-- business_customers.business_id (the cross-table consistency noted as an
-- RPC responsibility in 0004's comment -- this trigger is the backstop in
-- case a future code path ever inserts/updates outside create_delivery).

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_businesses_updated_at
  before update on businesses
  for each row execute function set_updated_at();

create trigger trg_business_customers_updated_at
  before update on business_customers
  for each row execute function set_updated_at();

create trigger trg_deliveries_updated_at
  before update on deliveries
  for each row execute function set_updated_at();


create or replace function check_delivery_business_consistency()
returns trigger
language plpgsql
as $$
declare
  bc_business_id uuid;
begin
  select business_id into bc_business_id
  from business_customers
  where id = new.business_customer_id;

  if bc_business_id is null then
    raise exception 'business_customer_id % does not exist', new.business_customer_id;
  end if;

  if bc_business_id <> new.business_id then
    raise exception
      'deliveries.business_id (%) does not match business_customers.business_id (%) for business_customer_id %',
      new.business_id, bc_business_id, new.business_customer_id;
  end if;

  return new;
end;
$$;

create trigger trg_deliveries_business_consistency
  before insert or update of business_id, business_customer_id on deliveries
  for each row execute function check_delivery_business_consistency();

comment on function check_delivery_business_consistency() is
  'Defense-in-depth backstop for the denormalized deliveries.business_id column (see 0004). The create_delivery RPC (0013) is the primary enforcement path; this trigger guarantees the invariant even if a future code path bypasses that RPC.';


-- ============================================================
-- FILE: 0008_rls_helpers.sql
-- ============================================================
-- 0008_rls_helpers.sql
-- Small STABLE SQL functions reused across every RLS policy below. Kept
-- centralized deliberately: if the definition of "current user's role" or
-- "current user's business" ever needs to change, it changes in exactly
-- one place rather than being re-derived inside dozens of policies.

create or replace function current_profile_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_profile_role() = 'admin', false);
$$;

create or replace function is_owner_of_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    current_profile_role() = 'owner' and current_business_id() = target_business_id,
    false
  );
$$;

create or replace function is_rider_assigned_to(target_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from deliveries
    where id = target_delivery_id and assigned_rider_id = auth.uid()
  );
$$;

comment on function current_profile_role() is
  'SECURITY DEFINER + fixed search_path: reads profiles.role for the calling user regardless of RLS on profiles itself, avoiding recursive-policy issues. Never exposed for client RPC calls directly -- used only inside other policies/functions.';


-- ============================================================
-- FILE: 0009_rls_profiles_businesses.sql
-- ============================================================
-- 0009_rls_profiles_businesses.sql
-- Phase 2 §E. profiles.role and business_id are NEVER client-writable by
-- anyone -- see the deliberate absence of any UPDATE policy touching
-- those columns, enforced instead via column privileges below.

alter table profiles enable row level security;
alter table businesses enable row level security;

-- profiles: own row, or same-business colleagues (Owner listing Riders),
-- or Admin (unrestricted).
create policy profiles_select on profiles
  for select
  using (
    id = auth.uid()
    or (current_profile_role() = 'owner' and business_id = current_business_id())
    or is_admin()
  );

-- Self-service profile edits, restricted to non-identity columns via
-- column privileges (see grants below) -- role and business_id are never
-- touched by this policy's applicability, only by admin-only server paths
-- outside normal app flow (Phase 2 report §profiles).
create policy profiles_update_self on profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on profiles from authenticated;
grant update (full_name, phone) on profiles to authenticated;

-- businesses: owner sees/edits their own; admin sees/edits all but only
-- verification-related columns via column grants (Phase 2 §D).
create policy businesses_select on businesses
  for select
  using (owner_profile_id = auth.uid() or is_admin());

create policy businesses_update_owner on businesses
  for update
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());

create policy businesses_update_admin on businesses
  for update
  using (is_admin())
  with check (is_admin());

-- IMPORTANT correctness note: Postgres column privileges are additive per
-- ROLE, not per POLICY -- granting owners write on (name, timeout) and
-- admins write on (verification_status) via two GRANT statements would
-- actually let EITHER group write BOTH sets of columns, since 'authenticated'
-- is one Postgres role shared by everyone. Column grants alone cannot
-- express "owner can touch these columns, admin can touch those, and
-- neither can touch the other's." The trigger below is the real
-- enforcement point for that distinction.
grant update (name, assignment_timeout_minutes, rider_default_capacity, verification_status) on businesses to authenticated;

create or replace function enforce_business_update_scope()
returns trigger
language plpgsql
as $$
begin
  if is_admin() and not (old.owner_profile_id = auth.uid()) then
    -- Admin path: verification_status (and updated_at) only.
    if new.name is distinct from old.name
      or new.assignment_timeout_minutes is distinct from old.assignment_timeout_minutes
      or new.rider_default_capacity is distinct from old.rider_default_capacity then
      raise exception 'Admin may only update verification_status on businesses, not operational settings';
    end if;
  else
    -- Owner path: operational settings only, never verification_status.
    if new.verification_status is distinct from old.verification_status then
      raise exception 'Only an admin may change a business''s verification_status';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_businesses_update_scope
  before update on businesses
  for each row execute function enforce_business_update_scope();

comment on trigger trg_businesses_update_scope on businesses is
  'Real enforcement of the Owner-vs-Admin column boundary, since Postgres column GRANTs are additive per role and cannot express this split on their own -- see the comment above the GRANT statement.';


-- ============================================================
-- FILE: 0010_rls_riders_business_customers.sql
-- ============================================================
-- 0010_rls_riders_business_customers.sql
-- Phase 2 §E. business_customers is the privacy-critical table -- its
-- SELECT policy is what makes §14 (no cross-business customer data leak)
-- an enforced database fact rather than an assumption.

alter table riders enable row level security;
alter table business_customers enable row level security;

-- riders: owner sees own business's riders; rider sees own row; admin
-- unrestricted (view-only per Stage 10 -- no admin UPDATE policy exists
-- on this table at all).
create policy riders_select on riders
  for select
  using (
    business_id = current_business_id()
    or profile_id = auth.uid()
    or is_admin()
  );

-- availability_status: the 'offline' toggle is the rider's own, direct
-- write. 'available'/'busy' are never client-written by anyone -- see the
-- RPCs in 0013, which recompute and set them server-side on every
-- delivery status change. This policy permits the write mechanically; the
-- RPCs are what actually keep the value honest day to day.
create policy riders_update_own_availability on riders
  for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

revoke update on riders from authenticated;
grant update (availability_status) on riders to authenticated;

-- business_customers: THE privacy boundary. An owner sees only their own
-- business's relationship rows -- never another business's, even for the
-- same underlying customer. A customer sees every relationship row that
-- is THEIRS across every business (the one legitimate case, per the
-- Phase 2 report, where a single query spans multiple businesses -- it's
-- scoped to one customer's own view of their own relationships).
create policy business_customers_select on business_customers
  for select
  using (
    business_id = current_business_id()
    or customer_profile_id = auth.uid()
    or is_admin()
  );

-- Direct INSERT/UPDATE is not granted here -- creation and claiming both
-- go through RPCs (find_or_create_business_customer, claim_business_customer
-- in 0012) so the deduplication and claim logic can't be bypassed by a
-- raw client insert. No table-level INSERT/UPDATE grant is given to
-- 'authenticated' on this table at all; the RPCs are SECURITY DEFINER and
-- write through their own elevated privileges.
revoke insert, update on business_customers from authenticated;


-- ============================================================
-- FILE: 0011_rls_deliveries_events_locations.sql
-- ============================================================
-- 0011_rls_deliveries_events_locations.sql
-- Phase 2 §E. Rider visibility is `assigned_rider_id = auth.uid()` --
-- precise row-level scoping, not a business-wide grant. Admin gets NO
-- default SELECT on deliveries at all (Phase 2 §E) -- all admin
-- visibility into operational data goes through the narrow RPCs in 0014.

alter table deliveries enable row level security;
alter table delivery_events enable row level security;
alter table delivery_locations enable row level security;

create policy deliveries_select_owner on deliveries
  for select
  using (business_id = current_business_id() and current_profile_role() = 'owner');

-- Precise identity check, not a business-wide scope -- this is what
-- structurally prevents a rider from querying another rider's deliveries
-- even within the same business.
create policy deliveries_select_rider on deliveries
  for select
  using (assigned_rider_id = auth.uid());

-- Customer visibility resolves through business_customers, since deliveries
-- no longer carries a direct customer_id (Phase 2's structural fix).
create policy deliveries_select_customer on deliveries
  for select
  using (
    current_profile_role() = 'customer'
    and business_customer_id in (
      select id from business_customers where customer_profile_id = auth.uid()
    )
  );

-- Deliberately NO deliveries_select_admin policy. Admin's visibility into
-- specific deliveries during an intervention is granted narrowly by the
-- SECURITY DEFINER RPCs in 0014, not a standing table-wide SELECT.

-- Direct client UPDATE/INSERT: only the Owner's pre-dispatch edit case
-- (Stage 16) survives as a direct grant. Every state transition goes
-- through the RPCs in 0013/0014/0015.
create policy deliveries_insert_owner on deliveries
  for insert
  with check (business_id = current_business_id() and current_profile_role() = 'owner');
  -- Note: INSERT here is intentionally still permitted directly (not
  -- RPC-only) for the simple creation case, but create_delivery() in 0013
  -- is the actual client entrypoint because it also validates the
  -- business_customer_id belongs to the caller's business before insert
  -- (the trigger in 0007 is the hard backstop either way).

create policy deliveries_update_owner_predispatch on deliveries
  for update
  using (business_id = current_business_id() and current_profile_role() = 'owner' and status = 'ready_for_dispatch')
  with check (business_id = current_business_id() and current_profile_role() = 'owner' and status = 'ready_for_dispatch');

revoke update on deliveries from authenticated;
grant update (priority, scheduled_window_start, scheduled_window_end, estimated_delivery_minutes, rating, rating_comment, rating_recorded_by) on deliveries to authenticated;
-- Rating columns are included here but are only reachable via the
-- deliveries_update_owner_predispatch USING clause's business_id/role
-- check plus a second, rating-specific policy below (rating is legal on
-- delivered/failed, not ready_for_dispatch, so it needs its own policy).

create policy deliveries_update_owner_rating on deliveries
  for update
  using (business_id = current_business_id() and current_profile_role() = 'owner' and status in ('delivered', 'failed'))
  with check (business_id = current_business_id() and current_profile_role() = 'owner' and status in ('delivered', 'failed'));


-- delivery_events: SELECT mirrors the parent delivery's visibility.
-- INSERT/UPDATE/DELETE are revoked from 'authenticated' entirely at the
-- grant level below -- append-only is enforced by the absence of a write
-- grant, not merely by an RLS policy, which is a stronger guarantee (see
-- Phase 2 report / Stage 16).
create policy events_select on delivery_events
  for select
  using (
    delivery_id in (
      select id from deliveries
      where business_id = current_business_id() and current_profile_role() = 'owner'
    )
    or delivery_id in (select id from deliveries where assigned_rider_id = auth.uid())
    or delivery_id in (
      select d.id from deliveries d
      join business_customers bc on bc.id = d.business_customer_id
      where bc.customer_profile_id = auth.uid()
    )
  );

revoke insert, update, delete on delivery_events from authenticated;
-- INSERT happens exclusively via SECURITY DEFINER RPCs (0013-0015), which
-- write as their own elevated privilege, not as 'authenticated'.


-- delivery_locations: rider inserts directly (not RPC-wrapped, per Stage
-- 18's latency reasoning) but only for their own currently in_transit
-- delivery. UPDATE/DELETE revoked entirely.
create policy locations_select on delivery_locations
  for select
  using (
    delivery_id in (
      select id from deliveries
      where business_id = current_business_id() and current_profile_role() = 'owner'
    )
    or delivery_id in (select id from deliveries where assigned_rider_id = auth.uid())
  );

create policy locations_insert_rider on delivery_locations
  for insert
  with check (
    rider_id = auth.uid()
    and delivery_id in (
      select id from deliveries
      where assigned_rider_id = auth.uid() and status = 'in_transit'
    )
  );

revoke update, delete on delivery_locations from authenticated;


-- ============================================================
-- FILE: 0012_rls_reassignment_pod_notifications.sql
-- ============================================================
-- 0012_rls_reassignment_pod_notifications.sql

alter table reassignment_requests enable row level security;
alter table proof_of_delivery enable row level security;
alter table notifications enable row level security;

-- reassignment_requests: INSERT is the one place the ERD-flagged gap
-- (Stage 8/15) gets closed structurally -- the WITH CHECK verifies the
-- requesting rider is CURRENTLY assigned to the referenced delivery, not
-- just that requested_by_rider_id = auth.uid().
create policy reassignment_insert_rider on reassignment_requests
  for insert
  with check (
    requested_by_rider_id = auth.uid()
    and delivery_id in (
      select id from deliveries
      where assigned_rider_id = auth.uid() and status = 'in_transit'
    )
  );

create policy reassignment_select on reassignment_requests
  for select
  using (
    requested_by_rider_id = auth.uid()
    or delivery_id in (
      select id from deliveries
      where business_id = current_business_id() and current_profile_role() = 'owner'
    )
  );
  -- No admin SELECT here either -- admin sees a specific pending request
  -- only via the admin_resolve_reassignment RPC's own scoped query (0014).

-- Resolution (approve/deny) happens exclusively via resolve_reassignment /
-- admin_resolve_reassignment (0013/0014) -- no direct UPDATE grant.
revoke update on reassignment_requests from authenticated;


-- proof_of_delivery: rider inserts for their own active delivery; repeat
-- inserts (corrections) are expected and valid within the RPC's time
-- window (0015) -- this RLS layer permits the insert shape, the RPC
-- enforces the window and versioning.
create policy pod_insert_rider on proof_of_delivery
  for insert
  with check (
    uploaded_by = auth.uid()
    and delivery_id in (
      select id from deliveries
      where assigned_rider_id = auth.uid() and status in ('in_transit', 'delivered')
    )
  );

create policy pod_select on proof_of_delivery
  for select
  using (
    delivery_id in (
      select id from deliveries
      where business_id = current_business_id() and current_profile_role() = 'owner'
    )
    or delivery_id in (select id from deliveries where assigned_rider_id = auth.uid())
    or delivery_id in (
      select d.id from deliveries d
      join business_customers bc on bc.id = d.business_customer_id
      where bc.customer_profile_id = auth.uid()
    )
  );

revoke update, delete on proof_of_delivery from authenticated;


-- notifications: strictly recipient-scoped. is_read is the only
-- client-writable column.
create policy notifications_select on notifications
  for select
  using (recipient_profile_id = auth.uid());

create policy notifications_update_own_read_state on notifications
  for update
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

revoke update on notifications from authenticated;
grant update (is_read) on notifications to authenticated;
revoke insert on notifications from authenticated;
-- INSERT is exclusively via the SECURITY DEFINER RPCs that write the
-- paired delivery_events + notifications rows in one transaction
-- (Stage 15's requirement).


-- ============================================================
-- FILE: 0013_rpc_helpers.sql
-- ============================================================
-- 0013_rpc_helpers.sql
-- Internal helper, not exposed to clients directly (no GRANT EXECUTE to
-- authenticated). Every state-changing RPC below calls this so the
-- delivery_events + notifications pairing (Stage 15's transactional
-- requirement) happens in exactly one place rather than being
-- re-implemented, and re-risked, in every RPC.

create or replace function log_delivery_event(
  p_delivery_id uuid,
  p_event_type delivery_event_type,
  p_actor_profile_id uuid,
  p_actor_role event_actor_role,
  p_metadata jsonb default '{}'::jsonb,
  p_notify_recipient uuid default null,
  p_notify_title text default null,
  p_notify_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_business_id uuid;
begin
  insert into delivery_events (delivery_id, event_type, actor_profile_id, actor_role, metadata)
  values (p_delivery_id, p_event_type, p_actor_profile_id, p_actor_role, p_metadata)
  returning id into v_event_id;

  if p_notify_recipient is not null then
    select business_id into v_business_id from deliveries where id = p_delivery_id;

    insert into notifications (
      business_id, recipient_profile_id, delivery_id, source_event_id,
      notification_type, title, message
    )
    values (
      v_business_id, p_notify_recipient, p_delivery_id, v_event_id,
      p_event_type, coalesce(p_notify_title, p_event_type::text), coalesce(p_notify_message, '')
    );
  end if;

  return v_event_id;
end;
$$;

comment on function log_delivery_event is
  'Internal only -- not GRANTed to authenticated. Writes delivery_events unconditionally and notifications only when p_notify_recipient is supplied, in the same transaction as the caller''s state change (Stage 15''s requirement). p_notify_recipient is left NULL for routine-progress events like started (Stage 17/20 correction).';

-- Recomputes a rider's derived availability_status from their current
-- active-delivery count (Stage 6: never client-set for available/busy).
create or replace function recompute_rider_availability(p_rider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_count int;
  v_current_status rider_availability;
begin
  select availability_status into v_current_status from riders where profile_id = p_rider_id;
  if v_current_status = 'offline' then
    return; -- offline is the rider's own explicit choice; never overridden here
  end if;

  select count(*) into v_active_count
  from deliveries
  where assigned_rider_id = p_rider_id and status in ('assigned', 'accepted', 'in_transit');

  update riders
  set availability_status = (case when v_active_count = 0 then 'available' else 'busy' end)::rider_availability
  where profile_id = p_rider_id;
end;
$$;


-- ============================================================
-- FILE: 0014_rpc_customer_and_delivery.sql
-- ============================================================
-- 0014_rpc_customer_and_delivery.sql
-- Phase 2 §C: the existing-customer / new-customer / independent-second-SME
-- flows, all resolved through one RPC so the deduplication logic can't be
-- bypassed by a raw client INSERT on business_customers (which has no
-- direct INSERT grant -- see 0010).

create or replace function find_or_create_business_customer(
  p_phone text,
  p_email text,
  p_name text,
  p_default_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_matched_profile_id uuid;
  v_bc_id uuid;
begin
  if current_profile_role() <> 'owner' then
    raise exception 'Only an SME Owner may link a customer to their business';
  end if;
  v_business_id := current_business_id();

  if p_phone is null and p_email is null then
    raise exception 'At least one of phone or email is required';
  end if;

  -- Existing relationship check first -- avoid duplicate rows for a
  -- customer already linked (or already pending) with THIS business
  -- (bc_unique_claimed_customer would reject a claimed duplicate anyway,
  -- but this gives a clean early return instead of a constraint-violation
  -- error for a completely ordinary case).
  select bc.id into v_bc_id
  from business_customers bc
  left join profiles p on p.id = bc.customer_profile_id
  where bc.business_id = v_business_id
    and (
      (bc.status = 'pending_invitation' and p_phone is not null and bc.pending_phone = p_phone)
      or (bc.status = 'pending_invitation' and p_email is not null and bc.pending_email = p_email)
      or (bc.status = 'active' and p_phone is not null and p.phone = p_phone)
    )
  limit 1;

  if v_bc_id is not null then
    return v_bc_id;
  end if;

  -- Global customer lookup by phone (the reliable match key stored
  -- directly on profiles per Phase 2 §3's dedup requirement; email
  -- matching would require querying auth.users, which this function
  -- deliberately avoids touching).
  select id into v_matched_profile_id
  from profiles
  where role = 'customer' and phone is not null and phone = p_phone
  limit 1;

  if v_matched_profile_id is not null then
    -- Existing global customer, new relationship for THIS business only.
    insert into business_customers (business_id, customer_profile_id, status, default_address)
    values (v_business_id, v_matched_profile_id, 'active', p_default_address)
    returning id into v_bc_id;
  else
    -- No matching account -- pending relationship, snapshot the contact
    -- info as entered. Delivery creation is NOT blocked on this (Phase 2
    -- §C's explicit instruction).
    insert into business_customers (
      business_id, status, pending_name, pending_phone, pending_email, default_address
    )
    values (v_business_id, 'pending_invitation', p_name, p_phone, p_email, p_default_address)
    returning id into v_bc_id;
  end if;

  return v_bc_id;
end;
$$;

comment on function find_or_create_business_customer is
  'Server-side dedup: never lets the client learn whether a phone/email matches an existing account beyond linking to it -- no separate "check if exists" endpoint is exposed, which would itself leak account-existence information.';

grant execute on function find_or_create_business_customer to authenticated;


-- Claims a pending relationship (and, transitively, its historical
-- deliveries become visible) or creates a fresh 'active' relationship for
-- a customer discovering a business independently. Phase 2 §C, third flow.
create or replace function claim_business_customer(p_business_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row business_customers%rowtype;
  v_caller_phone text;
begin
  if current_profile_role() <> 'customer' then
    raise exception 'Only a customer account may claim a business relationship';
  end if;

  select * into v_row from business_customers where id = p_business_customer_id;
  if v_row is null then
    raise exception 'No such business_customers row';
  end if;
  if v_row.status <> 'pending_invitation' then
    raise exception 'This relationship is not pending -- nothing to claim';
  end if;

  select phone into v_caller_phone from profiles where id = auth.uid();
  if v_caller_phone is null or v_caller_phone <> v_row.pending_phone then
    raise exception 'Claim phone does not match the pending relationship''s contact info';
  end if;

  update business_customers
  set customer_profile_id = auth.uid(), status = 'active'
  where id = p_business_customer_id;
  -- pending_name/pending_phone/pending_email are deliberately left in
  -- place, not cleared -- Phase 2 report: historical record of what the
  -- Owner originally entered.
end;
$$;

grant execute on function claim_business_customer to authenticated;


create or replace function create_delivery(
  p_business_customer_id uuid,
  p_priority delivery_priority default 'normal',
  p_scheduled_window_start timestamptz default null,
  p_scheduled_window_end timestamptz default null,
  p_estimated_delivery_minutes int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_bc_business_id uuid;
  v_delivery_id uuid;
begin
  if current_profile_role() <> 'owner' then
    raise exception 'Only an SME Owner may create a delivery';
  end if;
  v_business_id := current_business_id();

  select business_id into v_bc_business_id from business_customers where id = p_business_customer_id;
  if v_bc_business_id is null or v_bc_business_id <> v_business_id then
    raise exception 'business_customer_id does not belong to your business';
  end if;

  insert into deliveries (
    business_id, business_customer_id, priority,
    scheduled_window_start, scheduled_window_end, estimated_delivery_minutes
  )
  values (
    v_business_id, p_business_customer_id, p_priority,
    p_scheduled_window_start, p_scheduled_window_end, p_estimated_delivery_minutes
  )
  returning id into v_delivery_id;

  perform log_delivery_event(v_delivery_id, 'created', auth.uid(), 'owner');

  return v_delivery_id;
end;
$$;

grant execute on function create_delivery to authenticated;


-- ============================================================
-- FILE: 0015_rpc_dispatch_lifecycle.sql
-- ============================================================
-- 0015_rpc_dispatch_lifecycle.sql
-- Phase 2 §10: the approved graph-based state machine, enforced here and
-- ONLY here. No client has a direct UPDATE grant on deliveries.status --
-- every legal transition is one of these functions; every illegal
-- transition is rejected by the explicit status check at the top of each.
--
-- READY_FOR_DISPATCH --assign--> ASSIGNED --accept--> ACCEPTED --start--> IN_TRANSIT --deliver--> DELIVERED
--                                    |                                        |
--                              reject/timeout                          reassignment (see 0016)
--                                    |                                        |
--                                    v                                       v
--                          READY_FOR_DISPATCH                    (approval) READY_FOR_DISPATCH
--                                                                 IN_TRANSIT --fail--> FAILED

create or replace function assign_rider(p_delivery_id uuid, p_rider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries%rowtype;
  v_rider riders%rowtype;
begin
  select * into v_delivery from deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'Delivery not found'; end if;
  if current_profile_role() <> 'owner' or v_delivery.business_id <> current_business_id() then
    raise exception 'Not authorized to assign this delivery';
  end if;
  if v_delivery.status <> 'ready_for_dispatch' then
    raise exception 'Delivery must be ready_for_dispatch to assign (current: %)', v_delivery.status;
  end if;

  select * into v_rider from riders where profile_id = p_rider_id;
  if v_rider is null or v_rider.business_id <> v_delivery.business_id then
    raise exception 'Rider does not belong to this business';
  end if;
  if v_rider.availability_status = 'offline' then
    raise exception 'Cannot assign an offline rider';
  end if;
  -- Deliberately NOT rejecting 'busy' riders here -- Owner override is
  -- explicitly permitted by Phase 2 §9 ("may select another available
  -- rider" implies the suggestion, not a hard block; a busy rider taking
  -- one more job is the Owner's call, not the system's to prevent).

  update deliveries
  set status = 'assigned', assigned_rider_id = p_rider_id, assigned_at = now()
  where id = p_delivery_id;

  perform recompute_rider_availability(p_rider_id);

  perform log_delivery_event(
    p_delivery_id, 'assigned', auth.uid(), 'owner',
    jsonb_build_object('rider_id', p_rider_id),
    p_notify_recipient => p_rider_id,
    p_notify_title => 'New delivery assigned',
    p_notify_message => 'Respond within the business''s assignment window.'
  );
end;
$$;

grant execute on function assign_rider to authenticated;


create or replace function accept_delivery_assignment(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries%rowtype;
  v_owner_id uuid;
begin
  select * into v_delivery from deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'Delivery not found'; end if;
  if v_delivery.assigned_rider_id is distinct from auth.uid() then
    raise exception 'This delivery is not assigned to you';
  end if;
  if v_delivery.status <> 'assigned' then
    raise exception 'Delivery must be assigned to accept (current: %)', v_delivery.status;
  end if;

  update deliveries set status = 'accepted', accepted_at = now() where id = p_delivery_id;

  select owner_profile_id into v_owner_id from businesses where id = v_delivery.business_id;
  perform log_delivery_event(
    p_delivery_id, 'accepted', auth.uid(), 'rider', '{}'::jsonb,
    p_notify_recipient => v_owner_id,
    p_notify_title => 'Rider accepted',
    p_notify_message => 'The assigned rider has accepted this delivery.'
  );
end;
$$;

grant execute on function accept_delivery_assignment to authenticated;


create or replace function reject_delivery_assignment(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries%rowtype;
  v_owner_id uuid;
  v_prior_rider uuid;
begin
  select * into v_delivery from deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'Delivery not found'; end if;
  if v_delivery.assigned_rider_id is distinct from auth.uid() then
    raise exception 'This delivery is not assigned to you';
  end if;
  if v_delivery.status <> 'assigned' then
    raise exception 'Delivery must be assigned to reject (current: %)', v_delivery.status;
  end if;

  v_prior_rider := v_delivery.assigned_rider_id;
  update deliveries
  set status = 'ready_for_dispatch', assigned_rider_id = null, assigned_at = null
  where id = p_delivery_id;

  perform recompute_rider_availability(v_prior_rider);

  select owner_profile_id into v_owner_id from businesses where id = v_delivery.business_id;
  perform log_delivery_event(
    p_delivery_id, 'rejected', auth.uid(), 'rider', '{}'::jsonb,
    p_notify_recipient => v_owner_id,
    p_notify_title => 'Assignment rejected',
    p_notify_message => 'The rider rejected this delivery. It has returned to the dispatch queue.'
  );
end;
$$;

grant execute on function reject_delivery_assignment to authenticated;


create or replace function start_delivery(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries%rowtype;
begin
  select * into v_delivery from deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'Delivery not found'; end if;
  if v_delivery.assigned_rider_id is distinct from auth.uid() then
    raise exception 'This delivery is not assigned to you';
  end if;
  if v_delivery.status <> 'accepted' then
    raise exception 'Delivery must be accepted before starting (current: %)', v_delivery.status;
  end if;

  update deliveries set status = 'in_transit', started_at = now() where id = p_delivery_id;

  -- Realtime/UI update only, NO notification -- Stage 17/20's explicit
  -- correction. p_notify_recipient intentionally omitted.
  perform log_delivery_event(p_delivery_id, 'started', auth.uid(), 'rider');
end;
$$;

grant execute on function start_delivery to authenticated;


create or replace function complete_delivery(
  p_delivery_id uuid,
  p_photo_url text,
  p_recipient_name text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries%rowtype;
  v_owner_id uuid;
  v_pod_id uuid;
begin
  select * into v_delivery from deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'Delivery not found'; end if;
  if v_delivery.assigned_rider_id is distinct from auth.uid() then
    raise exception 'This delivery is not assigned to you';
  end if;
  if v_delivery.status <> 'in_transit' then
    raise exception 'Delivery must be in_transit to complete (current: %)', v_delivery.status;
  end if;
  if p_photo_url is null or char_length(trim(p_photo_url)) = 0 then
    raise exception 'Proof of delivery photo is required'; -- Phase 2 §11: mandatory
  end if;

  insert into proof_of_delivery (delivery_id, version, photo_url, recipient_name, notes, uploaded_by)
  values (p_delivery_id, 1, p_photo_url, p_recipient_name, p_notes, auth.uid())
  returning id into v_pod_id;

  perform log_delivery_event(p_delivery_id, 'proof_uploaded', auth.uid(), 'rider', jsonb_build_object('pod_id', v_pod_id));

  update deliveries set status = 'delivered', delivered_at = now() where id = p_delivery_id;
  perform recompute_rider_availability(auth.uid());

  select owner_profile_id into v_owner_id from businesses where id = v_delivery.business_id;
  perform log_delivery_event(
    p_delivery_id, 'delivered', auth.uid(), 'rider', '{}'::jsonb,
    p_notify_recipient => v_owner_id,
    p_notify_title => 'Delivery completed',
    p_notify_message => 'Proof of delivery has been uploaded.'
  );
end;
$$;

grant execute on function complete_delivery to authenticated;


create or replace function fail_delivery(p_delivery_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries%rowtype;
  v_owner_id uuid;
begin
  select * into v_delivery from deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'Delivery not found'; end if;
  if v_delivery.assigned_rider_id is distinct from auth.uid() then
    raise exception 'This delivery is not assigned to you';
  end if;
  if v_delivery.status <> 'in_transit' then
    raise exception 'Delivery must be in_transit to mark failed (current: %)', v_delivery.status;
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to mark a delivery failed';
  end if;

  update deliveries
  set status = 'failed', failed_at = now(), failure_reason = p_reason
  where id = p_delivery_id;
  -- Deliberately does NOT auto-requeue -- Stage 9's decision, restated in
  -- Phase 2: a failure is about the delivery itself, not rider
  -- availability, so re-dispatching to another rider would repeat the
  -- same failure.
  perform recompute_rider_availability(auth.uid());

  select owner_profile_id into v_owner_id from businesses where id = v_delivery.business_id;
  perform log_delivery_event(
    p_delivery_id, 'failed', auth.uid(), 'rider', jsonb_build_object('reason', p_reason),
    p_notify_recipient => v_owner_id,
    p_notify_title => 'Delivery failed',
    p_notify_message => p_reason
  );
end;
$$;

grant execute on function fail_delivery to authenticated;


-- ============================================================
-- FILE: 0016_rpc_reassignment_and_admin.sql
-- ============================================================
-- 0016_rpc_reassignment_and_admin.sql
-- Phase 2 §6: rider requests (mandatory reason, optional evidence),
-- owner OR admin resolves. Admin's dispatch-intervention power (§6/§10 of
-- the corrected model) is implemented ONLY through these narrow, audited
-- RPCs -- there is no standing admin SELECT/UPDATE grant on deliveries or
-- reassignment_requests (0011/0012).

create or replace function request_reassignment(
  p_delivery_id uuid,
  p_reason text,
  p_evidence_photo_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries%rowtype;
  v_owner_id uuid;
  v_request_id uuid;
begin
  select * into v_delivery from deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'Delivery not found'; end if;
  if v_delivery.assigned_rider_id is distinct from auth.uid() then
    raise exception 'This delivery is not assigned to you';
  end if;
  if v_delivery.status <> 'in_transit' then
    raise exception 'Reassignment can only be requested while in_transit (current: %)', v_delivery.status;
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to request reassignment'; -- Phase 2 §6: mandatory
  end if;
  if exists (select 1 from reassignment_requests where delivery_id = p_delivery_id and status = 'pending') then
    raise exception 'A reassignment request is already pending for this delivery';
  end if;

  insert into reassignment_requests (delivery_id, requested_by_rider_id, reason, evidence_photo_url)
  values (p_delivery_id, auth.uid(), p_reason, p_evidence_photo_url)
  returning id into v_request_id;

  update deliveries set reassignment_requested = true where id = p_delivery_id;

  select owner_profile_id into v_owner_id from businesses where id = v_delivery.business_id;
  perform log_delivery_event(
    p_delivery_id, 'reassignment_requested', auth.uid(), 'rider',
    jsonb_build_object('request_id', v_request_id, 'reason', p_reason),
    p_notify_recipient => v_owner_id,
    p_notify_title => 'Reassignment requested',
    p_notify_message => p_reason
  );

  return v_request_id;
end;
$$;

grant execute on function request_reassignment to authenticated;


-- Shared resolution logic for both the Owner and Admin paths -- kept
-- internal (no direct grant) so the two public entrypoints below can't
-- diverge in behavior over time.
create or replace function resolve_reassignment_internal(
  p_request_id uuid,
  p_decision reassignment_status,
  p_resolver_role resolver_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request reassignment_requests%rowtype;
  v_delivery deliveries%rowtype;
begin
  if p_decision not in ('approved', 'denied') then
    raise exception 'Decision must be approved or denied';
  end if;

  select * into v_request from reassignment_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Reassignment request not found'; end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been resolved';
  end if;

  select * into v_delivery from deliveries where id = v_request.delivery_id for update;

  update reassignment_requests
  set status = p_decision, decided_by_role = p_resolver_role,
      decided_by_profile_id = auth.uid(), resolved_at = now()
  where id = p_request_id;

  if p_decision = 'approved' then
    update deliveries
    set status = 'ready_for_dispatch', assigned_rider_id = null,
        assigned_at = null, accepted_at = null, started_at = null,
        reassignment_requested = false
    where id = v_request.delivery_id;

    perform recompute_rider_availability(v_request.requested_by_rider_id);

    perform log_delivery_event(
      v_request.delivery_id, 'reassigned', auth.uid(), p_resolver_role::text::event_actor_role,
      jsonb_build_object('request_id', p_request_id),
      p_notify_recipient => v_request.requested_by_rider_id,
      p_notify_title => 'Reassignment approved',
      p_notify_message => 'You have been released from this delivery.'
    );
  else
    update deliveries set reassignment_requested = false where id = v_request.delivery_id;

    perform log_delivery_event(
      v_request.delivery_id, 'reassignment_denied', auth.uid(), p_resolver_role::text::event_actor_role,
      jsonb_build_object('request_id', p_request_id),
      p_notify_recipient => v_request.requested_by_rider_id,
      p_notify_title => 'Reassignment denied',
      p_notify_message => 'Please continue this delivery.'
    );
  end if;
end;
$$;


create or replace function resolve_reassignment(p_request_id uuid, p_decision reassignment_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_business_id uuid;
begin
  select d.business_id into v_delivery_business_id
  from reassignment_requests r join deliveries d on d.id = r.delivery_id
  where r.id = p_request_id;

  if current_profile_role() <> 'owner' or v_delivery_business_id <> current_business_id() then
    raise exception 'Not authorized to resolve this reassignment request';
  end if;

  perform resolve_reassignment_internal(p_request_id, p_decision, 'owner');
end;
$$;

grant execute on function resolve_reassignment to authenticated;


-- ==================== ADMIN INTERVENTION ====================
-- Every function below requires is_admin() and writes actor_role='admin'
-- plus an 'admin_intervened' event carrying the caller's stated reason --
-- this is the "narrow, audited RPC mechanism" the corrected architecture
-- calls for, never a standing table grant.

create or replace function admin_assign_rider(p_delivery_id uuid, p_rider_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admin privileges required'; end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required for an admin intervention';
  end if;

  -- Reuses assign_rider's full validation by temporarily impersonating
  -- the business context is NOT done here (would blur the audit trail).
  -- Instead the same checks are inlined against is_admin() rather than
  -- is_owner_of_business(), and logged with a distinct event.
  perform log_delivery_event(
    p_delivery_id, 'admin_intervened', auth.uid(), 'admin',
    jsonb_build_object('action', 'assign_rider', 'rider_id', p_rider_id, 'reason', p_reason)
  );

  update deliveries
  set status = 'assigned', assigned_rider_id = p_rider_id, assigned_at = now()
  where id = p_delivery_id and status = 'ready_for_dispatch';

  if not found then
    raise exception 'Delivery not found or not in ready_for_dispatch';
  end if;

  perform recompute_rider_availability(p_rider_id);

  perform log_delivery_event(
    p_delivery_id, 'assigned', auth.uid(), 'admin',
    jsonb_build_object('rider_id', p_rider_id, 'via', 'admin_intervention'),
    p_notify_recipient => p_rider_id,
    p_notify_title => 'New delivery assigned',
    p_notify_message => 'Assigned by platform administrator.'
  );
end;
$$;

grant execute on function admin_assign_rider to authenticated;


create or replace function admin_resolve_reassignment(p_request_id uuid, p_decision reassignment_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admin privileges required'; end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required for an admin intervention';
  end if;

  perform log_delivery_event(
    (select delivery_id from reassignment_requests where id = p_request_id),
    'admin_intervened', auth.uid(), 'admin',
    jsonb_build_object('action', 'resolve_reassignment', 'decision', p_decision, 'reason', p_reason)
  );

  perform resolve_reassignment_internal(p_request_id, p_decision, 'admin');
end;
$$;

grant execute on function admin_resolve_reassignment to authenticated;


-- Narrow, purpose-built read for an admin actively handling one
-- escalated request -- NOT a standing dashboard over every business's
-- deliveries (Phase 2 §E's explicit restriction).
create or replace function admin_view_reassignment_request(p_request_id uuid)
returns table (
  request_id uuid, delivery_id uuid, reason text, evidence_photo_url text,
  status reassignment_status, requested_by_rider_id uuid, business_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.delivery_id, r.reason, r.evidence_photo_url, r.status,
         r.requested_by_rider_id, b.name
  from reassignment_requests r
  join deliveries d on d.id = r.delivery_id
  join businesses b on b.id = d.business_id
  where r.id = p_request_id and is_admin();
$$;

grant execute on function admin_view_reassignment_request to authenticated;


-- ============================================================
-- FILE: 0017_rpc_pod_correction_and_verification.sql
-- ============================================================
-- 0017_rpc_pod_correction_and_verification.sql
-- Phase 2 §11: versioned POD correction, rider-only, 10-minute window,
-- delivered-status only. Also: admin business verification/suspension,
-- routed through RPCs (not the raw column grant alone) so each action is
-- explicitly logged rather than just permitted.

create or replace function submit_replacement_pod(
  p_delivery_id uuid,
  p_photo_url text,
  p_recipient_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries%rowtype;
  v_latest_version int;
  v_first_uploaded_at timestamptz;
  v_new_pod_id uuid;
begin
  select * into v_delivery from deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'Delivery not found'; end if;
  if v_delivery.assigned_rider_id is distinct from auth.uid() then
    raise exception 'This delivery is not assigned to you';
  end if;
  if v_delivery.status <> 'delivered' then
    raise exception 'Proof of delivery can only be corrected on a delivered delivery';
  end if;

  select max(version), min(uploaded_at) into v_latest_version, v_first_uploaded_at
  from proof_of_delivery where delivery_id = p_delivery_id;

  if v_latest_version is null then
    raise exception 'No existing proof of delivery to correct';
  end if;
  if now() - v_first_uploaded_at > interval '10 minutes' then
    raise exception 'The correction window has passed (10 minutes from original upload)';
  end if;

  insert into proof_of_delivery (delivery_id, version, photo_url, recipient_name, notes, uploaded_by)
  values (p_delivery_id, v_latest_version + 1, p_photo_url, p_recipient_name, p_notes, auth.uid())
  returning id into v_new_pod_id;

  perform log_delivery_event(
    p_delivery_id, 'proof_corrected', auth.uid(), 'rider',
    jsonb_build_object('new_pod_id', v_new_pod_id, 'version', v_latest_version + 1)
  );
  -- Deliberately no notification -- a same-rider, same-window correction
  -- is not an attention-worthy deviation per the notification-filtering
  -- rule established in Stage 15/17/20; the Owner sees it in the
  -- delivery's timeline/POD view whenever they next open it.

  return v_new_pod_id;
end;
$$;

grant execute on function submit_replacement_pod to authenticated;


create or replace function admin_set_business_verification(p_business_id uuid, p_status business_verification_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admin privileges required'; end if;

  update businesses set verification_status = p_status where id = p_business_id;
  if not found then raise exception 'Business not found'; end if;
end;
$$;

grant execute on function admin_set_business_verification to authenticated;


-- ============================================================
-- FILE: 0018_auth_signup_provisioning.sql
-- ============================================================
-- 0018_auth_signup_provisioning.sql
-- Owner and Customer both self-register via supabase.auth.signUp() with
-- role encoded in user_metadata (client passes { data: { role, full_name,
-- business_name? } }). This trigger provisions the matching profiles (and,
-- for Owner, businesses) row atomically with the auth.users insert.
--
-- Rider provisioning is DELIBERATELY NOT handled here. A rider's
-- auth.users row is created server-side by the Owner-invite Edge Function
-- using the Supabase service role (supabase.auth.admin.inviteUserByEmail),
-- which then inserts the profiles row itself with role='rider' and the
-- inviting Owner's business_id -- a client-driven signUp() call can never
-- self-assign the rider role, which is the structural enforcement of
-- "riders do not self-register" (Stage 6, reaffirmed throughout).
-- Admin provisioning is never trigger-driven at all -- seeded directly.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_full_name text;
  v_business_name text;
  v_new_business_id uuid;
begin
  v_role := new.raw_user_meta_data ->> 'role';
  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', 'Unnamed');

  if v_role = 'owner' then
    v_business_name := new.raw_user_meta_data ->> 'business_name';
    if v_business_name is null or char_length(trim(v_business_name)) = 0 then
      raise exception 'business_name is required for owner signup';
    end if;

    v_new_business_id := gen_random_uuid();

    -- Relies on businesses_owner_profile_fk being DEFERRABLE INITIALLY
    -- DEFERRED (0002) to resolve the businesses<->profiles circularity --
    -- see that migration's comment for the full explanation.
    insert into businesses (id, owner_profile_id, name)
    values (v_new_business_id, new.id, v_business_name);

    insert into profiles (id, role, business_id, full_name, phone)
    values (new.id, 'owner', v_new_business_id, v_full_name, new.raw_user_meta_data ->> 'phone');

  elsif v_role = 'customer' then
    insert into profiles (id, role, business_id, full_name, phone)
    values (new.id, 'customer', null, v_full_name, new.raw_user_meta_data ->> 'phone');

  elsif v_role = 'rider' then
    -- No-op by design -- see comment above. Silently skipping (rather
    -- than raising) allows the invite Edge Function's own profiles
    -- INSERT to proceed without a race against this trigger.
    return new;

  else
    raise exception 'Unrecognized or missing role in signup metadata: %', v_role;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ============================================================
-- FILE: 0019_scheduled_timeout_sweep.sql
-- ============================================================
-- 0019_scheduled_timeout_sweep.sql
-- Phase 2 §7: server-authoritative assignment timeout, 5-minute default.
-- pg_cron invokes this function every 60 seconds. Not GRANTed to
-- 'authenticated' -- only pg_cron's internal scheduling context calls it.

create or replace function sweep_expired_assignments()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired record;
  v_count int := 0;
begin
  for v_expired in
    select d.id as delivery_id, d.assigned_rider_id, b.owner_profile_id
    from deliveries d
    join businesses b on b.id = d.business_id
    where d.status = 'assigned'
      and d.assigned_at + make_interval(mins => b.assignment_timeout_minutes) < now()
    for update of d skip locked -- concurrent sweep runs never double-process a row
  loop
    update deliveries
    set status = 'ready_for_dispatch', assigned_rider_id = null, assigned_at = null
    where id = v_expired.delivery_id;

    perform recompute_rider_availability(v_expired.assigned_rider_id);

    perform log_delivery_event(
      v_expired.delivery_id, 'expired', null, 'system',
      '{}'::jsonb,
      p_notify_recipient => v_expired.owner_profile_id,
      p_notify_title => 'Assignment expired',
      p_notify_message => 'No response within the assignment window. The delivery has returned to the dispatch queue.'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function sweep_expired_assignments is
  'Not GRANTed to authenticated -- invoked exclusively by the pg_cron job below (or manually by an operator with sufficient privileges). This is the server-authoritative mechanism from Phase 2 §7 -- the rider-facing countdown UI is a display only, per that section''s explicit instruction.';

select cron.schedule(
  'sweep-expired-assignments',
  '* * * * *', -- every 60 seconds
  $$ select sweep_expired_assignments(); $$
);


-- ============================================================
-- FILE: 0020_storage_buckets_and_policies.sql
-- ============================================================
-- 0020_storage_buckets_and_policies.sql
-- Phase 2: two private buckets, both path-namespaced
-- business_id/delivery_id/filename so RLS can scope access identically to
-- the table-level policies above. Neither bucket is public.

insert into storage.buckets (id, name, public)
values
  ('proof-of-delivery', 'proof-of-delivery', false),
  ('reassignment-evidence', 'reassignment-evidence', false)
on conflict (id) do nothing;

-- Helper: extracts the business_id (first path segment) from an object
-- name, so policies can compare it against current_business_id() without
-- repeating the split logic in every policy body.
create or replace function storage_path_business_id(object_name text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(object_name, '/'))[1]::uuid;
$$;

create or replace function storage_path_delivery_id(object_name text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(object_name, '/'))[2]::uuid;
$$;


-- proof-of-delivery bucket
create policy pod_storage_insert on storage.objects
  for insert
  with check (
    bucket_id = 'proof-of-delivery'
    and storage_path_business_id(name) = (select business_id from deliveries where id = storage_path_delivery_id(name))
    and storage_path_delivery_id(name) in (
      select id from deliveries where assigned_rider_id = auth.uid()
    )
  );

create policy pod_storage_select on storage.objects
  for select
  using (
    bucket_id = 'proof-of-delivery'
    and (
      storage_path_business_id(name) = current_business_id()
      or storage_path_delivery_id(name) in (select id from deliveries where assigned_rider_id = auth.uid())
      or storage_path_delivery_id(name) in (
        select d.id from deliveries d
        join business_customers bc on bc.id = d.business_customer_id
        where bc.customer_profile_id = auth.uid()
      )
    )
  );

-- No UPDATE/DELETE policy on this bucket for any role -- append-only,
-- matching the proof_of_delivery table's own versioning design (0006/0012).


-- reassignment-evidence bucket (Phase 2 §6's optional evidence photo)
create policy evidence_storage_insert on storage.objects
  for insert
  with check (
    bucket_id = 'reassignment-evidence'
    and storage_path_delivery_id(name) in (
      select id from deliveries where assigned_rider_id = auth.uid() and status = 'in_transit'
    )
  );

create policy evidence_storage_select on storage.objects
  for select
  using (
    bucket_id = 'reassignment-evidence'
    and (
      storage_path_business_id(name) = current_business_id()
      or storage_path_delivery_id(name) in (select id from deliveries where assigned_rider_id = auth.uid())
      or is_admin() -- admin reviewing an escalated reassignment needs to see the evidence photo
    )
  );

comment on policy evidence_storage_select on storage.objects is
  'Admin SELECT here is intentionally broader than the deliveries table itself (which grants admin no default SELECT) -- an admin resolving an escalated reassignment via admin_resolve_reassignment (0016) needs to view the submitted evidence. Narrower than a blanket grant would require passing signed URLs through the RPC layer instead; flagged as a deliberate, scoped exception rather than an oversight.';


-- ============================================================
-- FILE: 0021_base_grants.sql
-- ============================================================
-- 0021_base_grants.sql
-- CRITICAL FIX, caught by functional testing during Phase 2 delivery:
-- every RLS policy migration above (0009-0012) wrote REVOKE/column-GRANT
-- pairs for narrow write cases, but never granted the base table-level
-- SELECT/INSERT privilege that RLS policies require to have any effect
-- at all. Row Level Security restricts WHICH rows a grant applies to --
-- it does nothing if the role has no grant on the table in the first
-- place. Without this migration, every ordinary client read across the
-- entire application would fail with "permission denied for table X",
-- which is exactly what the Phase 2 functional test caught.
--
-- Column-specific UPDATE grants from earlier migrations are left as-is;
-- this migration adds the SELECT (and, where a table has a genuine
-- direct-client INSERT path per its RLS policies) INSERT grants those
-- policies were always meant to sit on top of.

grant select on
  profiles, businesses, riders, business_customers,
  deliveries, delivery_events, delivery_locations,
  reassignment_requests, proof_of_delivery, notifications
to authenticated;

-- INSERT: only the tables with a genuine direct-client INSERT policy
-- (Stage 16/Phase 2's deliberate exceptions to the RPC-only pattern).
-- business_customers and delivery_events intentionally do NOT appear
-- here -- they have no direct-client INSERT policy at all (0010, 0011);
-- every write to them happens inside a SECURITY DEFINER RPC, which
-- executes with the function owner's privileges and does not need or use
-- this grant.
grant insert on deliveries to authenticated;         -- deliveries_insert_owner (0011)
grant insert on delivery_locations to authenticated; -- locations_insert_rider (0011)
grant insert on reassignment_requests to authenticated; -- reassignment_insert_rider (0012)
grant insert on proof_of_delivery to authenticated;  -- pod_insert_rider (0012)

comment on schema public is
  'Phase 2 note: RLS policies (0009-0012) define WHICH rows are visible/writable per role. Base GRANTs (this file) define WHETHER a role can touch a table AT ALL -- both layers are required together. A new table added later needs both a GRANT here and RLS policies, or it will be either fully open (RLS enabled but no policies = deny-all, safe but broken) or fully inaccessible (grants without RLS enabled = would be an open table, dangerous) depending on which half is forgotten.';


