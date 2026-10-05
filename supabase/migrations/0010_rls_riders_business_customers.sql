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
