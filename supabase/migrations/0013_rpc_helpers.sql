-- 0013_rpc_helpers.sql
-- Internal helper, not exposed to clients directly (no GRANT EXECUTE to
-- authenticated). Every state-changing RPC below calls this so the
-- delivery_events + notifications pairing (Stage 15's transactional
-- requirement) happens in exactly one place rather than being
-- re-implemented, and re-risked, in every RPC.

create or replace function log_delivery_event(
  p_delivery_id uuid,
  p_event_type delivery_event_type,
  p_actor_profile_id uuid,
  p_actor_role event_actor_role,
  p_metadata jsonb default '{}'::jsonb,
  p_notify_recipient uuid default null,
  p_notify_title text default null,
  p_notify_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_business_id uuid;
begin
  insert into delivery_events (delivery_id, event_type, actor_profile_id, actor_role, metadata)
  values (p_delivery_id, p_event_type, p_actor_profile_id, p_actor_role, p_metadata)
  returning id into v_event_id;

  if p_notify_recipient is not null then
    select business_id into v_business_id from deliveries where id = p_delivery_id;

    insert into notifications (
      business_id, recipient_profile_id, delivery_id, source_event_id,
      notification_type, title, message
    )
    values (
      v_business_id, p_notify_recipient, p_delivery_id, v_event_id,
      p_event_type, coalesce(p_notify_title, p_event_type::text), coalesce(p_notify_message, '')
    );
  end if;

  return v_event_id;
end;
$$;

comment on function log_delivery_event is
  'Internal only -- not GRANTed to authenticated. Writes delivery_events unconditionally and notifications only when p_notify_recipient is supplied, in the same transaction as the caller''s state change (Stage 15''s requirement). p_notify_recipient is left NULL for routine-progress events like started (Stage 17/20 correction).';

-- Recomputes a rider's derived availability_status from their current
-- active-delivery count (Stage 6: never client-set for available/busy).
create or replace function recompute_rider_availability(p_rider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_count int;
  v_current_status rider_availability;
begin
  select availability_status into v_current_status from riders where profile_id = p_rider_id;
  if v_current_status = 'offline' then
    return; -- offline is the rider's own explicit choice; never overridden here
  end if;

  select count(*) into v_active_count
  from deliveries
  where assigned_rider_id = p_rider_id and status in ('assigned', 'accepted', 'in_transit');

  update riders
  set availability_status = (case when v_active_count = 0 then 'available' else 'busy' end)::rider_availability
  where profile_id = p_rider_id;
end;
$$;
