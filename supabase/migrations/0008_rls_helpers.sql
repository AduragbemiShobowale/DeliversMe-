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
