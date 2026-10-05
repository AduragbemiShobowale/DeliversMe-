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
