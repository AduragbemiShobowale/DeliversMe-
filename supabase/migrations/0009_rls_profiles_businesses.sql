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
