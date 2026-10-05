-- 0017_rpc_pod_correction_and_verification.sql
-- Phase 2 §11: versioned POD correction, rider-only, 10-minute window,
-- delivered-status only. Also: admin business verification/suspension,
-- routed through RPCs (not the raw column grant alone) so each action is
-- explicitly logged rather than just permitted.

create or replace function submit_replacement_pod(
  p_delivery_id uuid,
  p_photo_url text,
  p_recipient_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries%rowtype;
  v_latest_version int;
  v_first_uploaded_at timestamptz;
  v_new_pod_id uuid;
begin
  select * into v_delivery from deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'Delivery not found'; end if;
  if v_delivery.assigned_rider_id is distinct from auth.uid() then
    raise exception 'This delivery is not assigned to you';
  end if;
  if v_delivery.status <> 'delivered' then
    raise exception 'Proof of delivery can only be corrected on a delivered delivery';
  end if;

  select max(version), min(uploaded_at) into v_latest_version, v_first_uploaded_at
  from proof_of_delivery where delivery_id = p_delivery_id;

  if v_latest_version is null then
    raise exception 'No existing proof of delivery to correct';
  end if;
  if now() - v_first_uploaded_at > interval '10 minutes' then
    raise exception 'The correction window has passed (10 minutes from original upload)';
  end if;

  insert into proof_of_delivery (delivery_id, version, photo_url, recipient_name, notes, uploaded_by)
  values (p_delivery_id, v_latest_version + 1, p_photo_url, p_recipient_name, p_notes, auth.uid())
  returning id into v_new_pod_id;

  perform log_delivery_event(
    p_delivery_id, 'proof_corrected', auth.uid(), 'rider',
    jsonb_build_object('new_pod_id', v_new_pod_id, 'version', v_latest_version + 1)
  );
  -- Deliberately no notification -- a same-rider, same-window correction
  -- is not an attention-worthy deviation per the notification-filtering
  -- rule established in Stage 15/17/20; the Owner sees it in the
  -- delivery's timeline/POD view whenever they next open it.

  return v_new_pod_id;
end;
$$;

grant execute on function submit_replacement_pod to authenticated;


create or replace function admin_set_business_verification(p_business_id uuid, p_status business_verification_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admin privileges required'; end if;

  update businesses set verification_status = p_status where id = p_business_id;
  if not found then raise exception 'Business not found'; end if;
end;
$$;

grant execute on function admin_set_business_verification to authenticated;
