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
