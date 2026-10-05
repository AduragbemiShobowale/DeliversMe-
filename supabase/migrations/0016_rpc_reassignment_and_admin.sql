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
