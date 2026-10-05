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
