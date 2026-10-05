-- 0014_rpc_customer_and_delivery.sql
-- Phase 2 §C: the existing-customer / new-customer / independent-second-SME
-- flows, all resolved through one RPC so the deduplication logic can't be
-- bypassed by a raw client INSERT on business_customers (which has no
-- direct INSERT grant -- see 0010).

create or replace function find_or_create_business_customer(
  p_phone text,
  p_email text,
  p_name text,
  p_default_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_matched_profile_id uuid;
  v_bc_id uuid;
begin
  if current_profile_role() <> 'owner' then
    raise exception 'Only an SME Owner may link a customer to their business';
  end if;
  v_business_id := current_business_id();

  if p_phone is null and p_email is null then
    raise exception 'At least one of phone or email is required';
  end if;

  -- Existing relationship check first -- avoid duplicate rows for a
  -- customer already linked (or already pending) with THIS business
  -- (bc_unique_claimed_customer would reject a claimed duplicate anyway,
  -- but this gives a clean early return instead of a constraint-violation
  -- error for a completely ordinary case).
  select bc.id into v_bc_id
  from business_customers bc
  left join profiles p on p.id = bc.customer_profile_id
  where bc.business_id = v_business_id
    and (
      (bc.status = 'pending_invitation' and p_phone is not null and bc.pending_phone = p_phone)
      or (bc.status = 'pending_invitation' and p_email is not null and bc.pending_email = p_email)
      or (bc.status = 'active' and p_phone is not null and p.phone = p_phone)
    )
  limit 1;

  if v_bc_id is not null then
    return v_bc_id;
  end if;

  -- Global customer lookup by phone (the reliable match key stored
  -- directly on profiles per Phase 2 §3's dedup requirement; email
  -- matching would require querying auth.users, which this function
  -- deliberately avoids touching).
  select id into v_matched_profile_id
  from profiles
  where role = 'customer' and phone is not null and phone = p_phone
  limit 1;

  if v_matched_profile_id is not null then
    -- Existing global customer, new relationship for THIS business only.
    insert into business_customers (business_id, customer_profile_id, status, default_address)
    values (v_business_id, v_matched_profile_id, 'active', p_default_address)
    returning id into v_bc_id;
  else
    -- No matching account -- pending relationship, snapshot the contact
    -- info as entered. Delivery creation is NOT blocked on this (Phase 2
    -- §C's explicit instruction).
    insert into business_customers (
      business_id, status, pending_name, pending_phone, pending_email, default_address
    )
    values (v_business_id, 'pending_invitation', p_name, p_phone, p_email, p_default_address)
    returning id into v_bc_id;
  end if;

  return v_bc_id;
end;
$$;

comment on function find_or_create_business_customer is
  'Server-side dedup: never lets the client learn whether a phone/email matches an existing account beyond linking to it -- no separate "check if exists" endpoint is exposed, which would itself leak account-existence information.';

grant execute on function find_or_create_business_customer to authenticated;


-- Claims a pending relationship (and, transitively, its historical
-- deliveries become visible) or creates a fresh 'active' relationship for
-- a customer discovering a business independently. Phase 2 §C, third flow.
create or replace function claim_business_customer(p_business_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row business_customers%rowtype;
  v_caller_phone text;
begin
  if current_profile_role() <> 'customer' then
    raise exception 'Only a customer account may claim a business relationship';
  end if;

  select * into v_row from business_customers where id = p_business_customer_id;
  if v_row is null then
    raise exception 'No such business_customers row';
  end if;
  if v_row.status <> 'pending_invitation' then
    raise exception 'This relationship is not pending -- nothing to claim';
  end if;

  select phone into v_caller_phone from profiles where id = auth.uid();
  if v_caller_phone is null or v_caller_phone <> v_row.pending_phone then
    raise exception 'Claim phone does not match the pending relationship''s contact info';
  end if;

  update business_customers
  set customer_profile_id = auth.uid(), status = 'active'
  where id = p_business_customer_id;
  -- pending_name/pending_phone/pending_email are deliberately left in
  -- place, not cleared -- Phase 2 report: historical record of what the
  -- Owner originally entered.
end;
$$;

grant execute on function claim_business_customer to authenticated;


create or replace function create_delivery(
  p_business_customer_id uuid,
  p_priority delivery_priority default 'normal',
  p_scheduled_window_start timestamptz default null,
  p_scheduled_window_end timestamptz default null,
  p_estimated_delivery_minutes int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_bc_business_id uuid;
  v_delivery_id uuid;
begin
  if current_profile_role() <> 'owner' then
    raise exception 'Only an SME Owner may create a delivery';
  end if;
  v_business_id := current_business_id();

  select business_id into v_bc_business_id from business_customers where id = p_business_customer_id;
  if v_bc_business_id is null or v_bc_business_id <> v_business_id then
    raise exception 'business_customer_id does not belong to your business';
  end if;

  insert into deliveries (
    business_id, business_customer_id, priority,
    scheduled_window_start, scheduled_window_end, estimated_delivery_minutes
  )
  values (
    v_business_id, p_business_customer_id, p_priority,
    p_scheduled_window_start, p_scheduled_window_end, p_estimated_delivery_minutes
  )
  returning id into v_delivery_id;

  perform log_delivery_event(v_delivery_id, 'created', auth.uid(), 'owner');

  return v_delivery_id;
end;
$$;

grant execute on function create_delivery to authenticated;
