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
