-- =====================================================================
-- DeliverSME Lagos — 004 RPCs (the only write path for deliveries)
-- Every function: SECURITY DEFINER, fixed search_path, authorises the
-- caller from auth.uid() — never from arguments supplied by the browser.
-- =====================================================================

-- Small internal guard used by every RPC
create or replace function app.require_role(p_roles public.user_role[])
returns public.user_role language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select role into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role is null then
    raise exception 'Account is inactive or missing' using errcode = '42501';
  end if;
  if not (v_role = any (p_roles)) then
    raise exception 'This action is not available for your account type' using errcode = '42501';
  end if;
  return v_role;
end $$;

create or replace function app.clean(p text, p_max int)
returns text language sql immutable as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F]', '', 'g')), p_max), '')
$$;

-- ---------------------------------------------------------------------
-- Onboarding for OAuth users (Google / Microsoft) who have no account type yet
-- ---------------------------------------------------------------------
create or replace function public.complete_onboarding(
  p_account_type text, p_business_name text default null, p_business_category text default 'other',
  p_phone text default null)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if v_profile.onboarded then
    raise exception 'Account type has already been chosen' using errcode = '42501';
  end if;
  if p_account_type not in ('customer', 'sme_owner', 'rider') then
    raise exception 'Invalid account type' using errcode = '22023';
  end if;

  update public.profiles
     set role = p_account_type::public.user_role, onboarded = true,
         phone = coalesce(app.clean(p_phone, 20), phone)
   where id = auth.uid()
  returning * into v_profile;

  if p_account_type = 'rider' then
    insert into public.rider_profiles (id) values (auth.uid()) on conflict (id) do nothing;
  elsif p_account_type = 'sme_owner' then
    insert into public.businesses (owner_id, name, category, email, phone)
    values (auth.uid(),
            coalesce(app.clean(p_business_name, 120), v_profile.full_name || ' Business'),
            case when p_business_category in ('retail','pharmacy','food','logistics','electronics','other')
                 then p_business_category else 'other' end,
            v_profile.email, v_profile.phone)
    on conflict (owner_id) do nothing;
  end if;
  return v_profile;
end $$;

-- ---------------------------------------------------------------------
-- Customer: request a delivery from a business
-- ---------------------------------------------------------------------
create or replace function public.create_delivery_request(
  p_business_id uuid,
  p_pickup_address text, p_dropoff_address text, p_item_description text,
  p_recipient_name text default null, p_recipient_phone text default null,
  p_package_size public.package_size default 'small',
  p_priority public.delivery_priority default 'standard',
  p_special_instructions text default null,
  p_pickup_lat double precision default null, p_pickup_lng double precision default null,
  p_dropoff_lat double precision default null, p_dropoff_lng double precision default null)
returns public.deliveries language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me       public.profiles;
  v_business public.businesses;
  v_bc_id    uuid;
  v_row      public.deliveries;
begin
  perform app.require_role(array['customer']::public.user_role[]);
  select * into v_me from public.profiles where id = auth.uid();
  select * into v_business from public.businesses where id = p_business_id and is_active;
  if v_business.id is null then
    raise exception 'Business not found or not accepting deliveries' using errcode = 'P0002';
  end if;

  if coalesce(app.clean(p_recipient_phone, 20), v_me.phone) is null then
    raise exception 'Add a recipient phone number or a phone number on your profile' using errcode = '22023';
  end if;

  -- Link the customer into the business contact list
  insert into public.business_customers (business_id, user_id, full_name, phone, email, address)
  values (v_business.id, v_me.id, v_me.full_name,
          coalesce(v_me.phone, app.clean(p_recipient_phone, 20)),
          v_me.email, app.clean(p_dropoff_address, 300))
  on conflict (business_id, user_id) do update set updated_at = now()
  returning id into v_bc_id;

  insert into public.deliveries (
    business_id, customer_user_id, business_customer_id, created_by, status, priority, package_size,
    pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
    item_description, special_instructions, recipient_name, recipient_phone)
  values (
    v_business.id, v_me.id, v_bc_id, v_me.id, 'requested', p_priority, p_package_size,
    app.clean(p_pickup_address, 300), p_pickup_lat, p_pickup_lng,
    app.clean(p_dropoff_address, 300), p_dropoff_lat, p_dropoff_lng,
    app.clean(p_item_description, 300), app.clean(p_special_instructions, 500),
    coalesce(app.clean(p_recipient_name, 120), v_me.full_name),
    coalesce(app.clean(p_recipient_phone, 20), v_me.phone))
  returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- SME owner: create a delivery for one of their customers
-- ---------------------------------------------------------------------
create or replace function public.create_business_delivery(
  p_business_customer_id uuid,
  p_pickup_address text, p_dropoff_address text, p_item_description text,
  p_recipient_name text default null, p_recipient_phone text default null,
  p_package_size public.package_size default 'small',
  p_priority public.delivery_priority default 'standard',
  p_special_instructions text default null,
  p_pickup_lat double precision default null, p_pickup_lng double precision default null,
  p_dropoff_lat double precision default null, p_dropoff_lng double precision default null)
returns public.deliveries language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_business_id uuid;
  v_customer    public.business_customers;
  v_row         public.deliveries;
begin
  perform app.require_role(array['sme_owner']::public.user_role[]);
  v_business_id := app.owned_business_id();
  if v_business_id is null then raise exception 'No business on this account' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.businesses where id = v_business_id and is_active) then
    raise exception 'Your business is suspended' using errcode = '42501';
  end if;

  select * into v_customer from public.business_customers
   where id = p_business_customer_id and business_id = v_business_id;
  if v_customer.id is null then
    raise exception 'Customer not found in your customer list' using errcode = 'P0002';
  end if;

  insert into public.deliveries (
    business_id, customer_user_id, business_customer_id, created_by, status, priority, package_size,
    pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
    item_description, special_instructions, recipient_name, recipient_phone)
  values (
    v_business_id, v_customer.user_id, v_customer.id, auth.uid(), 'pending', p_priority, p_package_size,
    app.clean(p_pickup_address, 300), p_pickup_lat, p_pickup_lng,
    coalesce(app.clean(p_dropoff_address, 300), v_customer.address), p_dropoff_lat, p_dropoff_lng,
    app.clean(p_item_description, 300), app.clean(p_special_instructions, 500),
    coalesce(app.clean(p_recipient_name, 120), v_customer.full_name),
    coalesce(app.clean(p_recipient_phone, 20), v_customer.phone))
  returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- SME owner: accept or decline a customer's request
-- ---------------------------------------------------------------------
create or replace function public.review_delivery_request(p_delivery_id uuid, p_accept boolean, p_reason text default null)
returns public.deliveries language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.deliveries;
begin
  perform app.require_role(array['sme_owner']::public.user_role[]);
  select * into v_row from public.deliveries
   where id = p_delivery_id and business_id = app.owned_business_id() for update;
  if v_row.id is null then raise exception 'Delivery not found' using errcode = 'P0002'; end if;
  if v_row.status <> 'requested' then raise exception 'This request has already been reviewed' using errcode = 'P0001'; end if;

  perform set_config('app.status_note', coalesce(app.clean(p_reason, 300), ''), true);
  update public.deliveries
     set status = case when p_accept then 'pending'::public.delivery_status else 'rejected'::public.delivery_status end,
         cancel_reason = case when p_accept then null else app.clean(p_reason, 300) end
   where id = p_delivery_id
  returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- SME owner: offer a pending delivery to a verified, online rider
-- ---------------------------------------------------------------------
create or replace function public.assign_rider(p_delivery_id uuid, p_rider_id uuid)
returns public.deliveries language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.deliveries;
begin
  perform app.require_role(array['sme_owner', 'admin']::public.user_role[]);
  select * into v_row from public.deliveries
   where id = p_delivery_id and (business_id = app.owned_business_id() or app.is_admin()) for update;
  if v_row.id is null then raise exception 'Delivery not found' using errcode = 'P0002'; end if;
  if v_row.status <> 'pending' then
    raise exception 'Only deliveries in the dispatch queue can be assigned' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.rider_profiles r join public.profiles p on p.id = r.id
     where r.id = p_rider_id and r.is_verified and r.availability = 'available'
       and p.is_active and p.role = 'rider') then
    raise exception 'Rider is not verified or not online' using errcode = 'P0001';
  end if;

  perform set_config('app.status_note', 'Offered to rider', true);
  update public.deliveries set status = 'assigned', rider_id = p_rider_id
   where id = p_delivery_id returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Rider: accept or decline an offered job
-- ---------------------------------------------------------------------
create or replace function public.respond_to_job(p_delivery_id uuid, p_accept boolean)
returns public.deliveries language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.deliveries;
begin
  perform app.require_role(array['rider']::public.user_role[]);
  select * into v_row from public.deliveries where id = p_delivery_id and rider_id = auth.uid() for update;
  if v_row.id is null then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if v_row.status <> 'assigned' then raise exception 'This job is no longer open' using errcode = 'P0001'; end if;

  if p_accept then
    perform set_config('app.status_note', 'Rider accepted', true);
    update public.deliveries set status = 'accepted' where id = p_delivery_id returning * into v_row;
  else
    perform set_config('app.status_note', 'Rider declined', true);
    update public.deliveries set status = 'pending', rider_id = null, assigned_at = null
     where id = p_delivery_id returning * into v_row;
  end if;
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Rider: move an accepted job forward (picked_up -> in_transit -> arrived)
-- ---------------------------------------------------------------------
create or replace function public.advance_delivery(p_delivery_id uuid, p_status public.delivery_status)
returns public.deliveries language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.deliveries;
begin
  perform app.require_role(array['rider']::public.user_role[]);
  if p_status not in ('picked_up', 'in_transit', 'arrived') then
    raise exception 'Use the dedicated action for this status' using errcode = '22023';
  end if;
  select * into v_row from public.deliveries where id = p_delivery_id and rider_id = auth.uid() for update;
  if v_row.id is null then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not app.valid_transition(v_row.status, p_status) then
    raise exception 'Cannot move from % to %', v_row.status, p_status using errcode = 'P0001';
  end if;
  perform set_config('app.status_note', '', true);
  update public.deliveries set status = p_status where id = p_delivery_id returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Rider: complete with optional proof photo (already uploaded to storage)
-- ---------------------------------------------------------------------
create or replace function public.complete_delivery(p_delivery_id uuid, p_proof_path text default null, p_notes text default null)
returns public.deliveries language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.deliveries;
begin
  perform app.require_role(array['rider']::public.user_role[]);
  select * into v_row from public.deliveries where id = p_delivery_id and rider_id = auth.uid() for update;
  if v_row.id is null then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if v_row.status <> 'arrived' then
    raise exception 'Mark the delivery as arrived before completing it' using errcode = 'P0001';
  end if;
  if p_proof_path is not null and p_proof_path not like p_delivery_id::text || '/%' then
    raise exception 'Invalid proof of delivery path' using errcode = '22023';
  end if;
  perform set_config('app.status_note', coalesce(app.clean(p_notes, 500), ''), true);
  update public.deliveries
     set status = 'delivered', proof_path = p_proof_path, completion_notes = app.clean(p_notes, 500)
   where id = p_delivery_id returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Cancel: customer (before a rider accepts), business (before pickup), admin (any non-final)
-- ---------------------------------------------------------------------
create or replace function public.cancel_delivery(p_delivery_id uuid, p_reason text default null)
returns public.deliveries language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role public.user_role;
  v_row  public.deliveries;
  v_ok   boolean := false;
begin
  v_role := app.require_role(array['customer', 'sme_owner', 'admin']::public.user_role[]);
  select * into v_row from public.deliveries where id = p_delivery_id for update;
  if v_row.id is null then raise exception 'Delivery not found' using errcode = 'P0002'; end if;

  if v_role = 'admin' then
    v_ok := v_row.status not in ('delivered', 'cancelled', 'rejected');
  elsif v_role = 'customer' then
    if v_row.customer_user_id <> auth.uid() then raise exception 'Delivery not found' using errcode = 'P0002'; end if;
    v_ok := v_row.status in ('requested', 'pending', 'assigned');
  elsif v_role = 'sme_owner' then
    if v_row.business_id is distinct from app.owned_business_id() then raise exception 'Delivery not found' using errcode = 'P0002'; end if;
    v_ok := v_row.status in ('requested', 'pending', 'assigned', 'accepted');
  end if;

  if not v_ok then
    raise exception 'This delivery can no longer be cancelled by you' using errcode = 'P0001';
  end if;
  perform set_config('app.status_note', coalesce(app.clean(p_reason, 300), ''), true);
  update public.deliveries set status = 'cancelled', cancel_reason = app.clean(p_reason, 300)
   where id = p_delivery_id returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Customer: rate a completed delivery (once)
-- ---------------------------------------------------------------------
create or replace function public.rate_delivery(p_delivery_id uuid, p_rating int, p_comment text default null)
returns public.delivery_ratings language plpgsql security definer set search_path = public, pg_temp as $$
declare v_d public.deliveries; v_r public.delivery_ratings;
begin
  perform app.require_role(array['customer']::public.user_role[]);
  select * into v_d from public.deliveries where id = p_delivery_id and customer_user_id = auth.uid();
  if v_d.id is null then raise exception 'Delivery not found' using errcode = 'P0002'; end if;
  if v_d.status <> 'delivered' then raise exception 'Only completed deliveries can be rated' using errcode = 'P0001'; end if;
  if p_rating not between 1 and 5 then raise exception 'Rating must be 1 to 5' using errcode = '22023'; end if;
  insert into public.delivery_ratings (delivery_id, business_id, customer_id, rating, comment)
  values (v_d.id, v_d.business_id, auth.uid(), p_rating, app.clean(p_comment, 500))
  returning * into v_r;
  return v_r;
exception when unique_violation then
  raise exception 'You have already rated this delivery' using errcode = 'P0001';
end $$;

-- ---------------------------------------------------------------------
-- Directory: businesses with real stats (customers' "Find a Business")
-- ---------------------------------------------------------------------
create or replace function public.list_businesses(p_search text default null, p_category text default null)
returns table (id uuid, name text, category text, tagline text, logo_url text, address text, phone text,
               is_verified boolean, completed_deliveries bigint, avg_rating numeric, rating_count bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select b.id, b.name, b.category, b.tagline, b.logo_url, b.address, b.phone, b.is_verified,
         (select count(*) from public.deliveries d where d.business_id = b.id and d.status = 'delivered'),
         (select round(avg(r.rating)::numeric, 1) from public.delivery_ratings r where r.business_id = b.id),
         (select count(*) from public.delivery_ratings r where r.business_id = b.id)
    from public.businesses b
   where b.is_active
     and auth.uid() is not null
     and (p_category is null or p_category = '' or b.category = p_category)
     and (p_search is null or p_search = '' or b.name ilike '%' || replace(replace(p_search, '%', ''), '_', '') || '%')
   order by b.is_verified desc, b.name
   limit 100
$$;

-- ---------------------------------------------------------------------
-- Riders available to SME owners (and admins) for assignment
-- ---------------------------------------------------------------------
create or replace function public.list_riders(p_search text default null)
returns table (id uuid, full_name text, phone text, avatar_url text, vehicle_type text, plate_number text,
               availability public.rider_availability, is_verified boolean, active_jobs bigint,
               last_lat double precision, last_lng double precision, last_location_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_role public.user_role;
begin
  v_role := app.require_role(array['sme_owner', 'admin']::public.user_role[]);
  return query
  select p.id, p.full_name, p.phone, p.avatar_url, r.vehicle_type, r.plate_number, r.availability, r.is_verified,
         (select count(*) from public.deliveries d
           where d.rider_id = p.id and d.status in ('assigned','accepted','picked_up','in_transit','arrived')),
         r.last_lat, r.last_lng, r.last_location_at
    from public.rider_profiles r
    join public.profiles p on p.id = r.id
   where p.is_active and p.role = 'rider'
     and (v_role = 'admin' or r.is_verified)
     and (p_search is null or p_search = '' or p.full_name ilike '%' || replace(replace(p_search, '%', ''), '_', '') || '%')
   order by (r.availability = 'available') desc, p.full_name;
end $$;

-- ---------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.profiles;
begin
  perform app.require_role(array['admin']::public.user_role[]);
  if p_user_id = auth.uid() then raise exception 'You cannot change your own role' using errcode = '42501'; end if;
  update public.profiles set role = p_role, onboarded = true where id = p_user_id returning * into v_row;
  if v_row.id is null then raise exception 'User not found' using errcode = 'P0002'; end if;
  if p_role = 'rider' then
    insert into public.rider_profiles (id) values (p_user_id) on conflict (id) do nothing;
  elsif p_role = 'sme_owner' then
    insert into public.businesses (owner_id, name, email, phone)
    values (p_user_id, v_row.full_name || ' Business', v_row.email, v_row.phone)
    on conflict (owner_id) do nothing;
  end if;
  return v_row;
end $$;

create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.profiles;
begin
  perform app.require_role(array['admin']::public.user_role[]);
  if p_user_id = auth.uid() then raise exception 'You cannot suspend your own account' using errcode = '42501'; end if;
  update public.profiles set is_active = p_active where id = p_user_id returning * into v_row;
  if v_row.id is null then raise exception 'User not found' using errcode = 'P0002'; end if;
  if not p_active then
    update public.rider_profiles set availability = 'offline' where id = p_user_id;
  end if;
  return v_row;
end $$;

create or replace function public.admin_verify_rider(p_rider_id uuid, p_verified boolean)
returns public.rider_profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.rider_profiles;
begin
  perform app.require_role(array['admin']::public.user_role[]);
  update public.rider_profiles set is_verified = p_verified,
         availability = case when p_verified then availability else 'offline' end
   where id = p_rider_id returning * into v_row;
  if v_row.id is null then raise exception 'Rider not found' using errcode = 'P0002'; end if;
  perform app.notify(p_rider_id, 'system',
    case when p_verified then 'Profile verified' else 'Verification removed' end,
    case when p_verified then 'You can now receive delivery jobs.' else 'Contact support for details.' end, null);
  return v_row;
end $$;

create or replace function public.admin_set_business_status(p_business_id uuid, p_verified boolean, p_active boolean)
returns public.businesses language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.businesses;
begin
  perform app.require_role(array['admin']::public.user_role[]);
  update public.businesses set is_verified = p_verified, is_active = p_active
   where id = p_business_id returning * into v_row;
  if v_row.id is null then raise exception 'Business not found' using errcode = 'P0002'; end if;
  perform app.notify(v_row.owner_id, 'business_update', 'Business status updated',
    format('Verified: %s. Active: %s.', case when p_verified then 'yes' else 'no' end,
           case when p_active then 'yes' else 'no' end), null);
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Grants: only these RPCs are callable by signed-in users
-- ---------------------------------------------------------------------
grant execute on function
  public.complete_onboarding(text, text, text, text),
  public.create_delivery_request(uuid, text, text, text, text, text, public.package_size, public.delivery_priority, text, double precision, double precision, double precision, double precision),
  public.create_business_delivery(uuid, text, text, text, text, text, public.package_size, public.delivery_priority, text, double precision, double precision, double precision, double precision),
  public.review_delivery_request(uuid, boolean, text),
  public.assign_rider(uuid, uuid),
  public.respond_to_job(uuid, boolean),
  public.advance_delivery(uuid, public.delivery_status),
  public.complete_delivery(uuid, text, text),
  public.cancel_delivery(uuid, text),
  public.rate_delivery(uuid, int, text),
  public.list_businesses(text, text),
  public.list_riders(text),
  public.admin_set_user_role(uuid, public.user_role),
  public.admin_set_user_active(uuid, boolean),
  public.admin_verify_rider(uuid, boolean),
  public.admin_set_business_status(uuid, boolean, boolean)
to authenticated;

grant execute on all functions in schema app to authenticated, service_role;
