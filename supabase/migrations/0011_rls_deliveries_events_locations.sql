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
