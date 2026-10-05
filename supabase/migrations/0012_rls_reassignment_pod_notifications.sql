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
