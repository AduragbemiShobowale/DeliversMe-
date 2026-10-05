-- =====================================================================
-- DeliverSME Lagos — 002 helper functions and triggers
-- =====================================================================

-- ---------------------------------------------------------------------
-- Private helpers (schema app). SECURITY DEFINER so RLS policies can call
-- them without recursive policy evaluation. They only ever answer
-- questions about the *calling* user (auth.uid()).
-- ---------------------------------------------------------------------
create or replace function app.current_user_role()
returns public.user_role language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active)
$$;

create or replace function app.is_active_user()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active)
$$;

create or replace function app.owned_business_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select b.id from public.businesses b
  join public.profiles p on p.id = b.owner_id
  where b.owner_id = auth.uid() and p.is_active and p.role = 'sme_owner'
$$;

create or replace function app.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- Is the calling user a party to this delivery (customer, owning business, assigned rider) or an admin?
create or replace function app.can_view_delivery(p_delivery_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_admin() or exists (
    select 1 from public.deliveries d
    where d.id = p_delivery_id
      and (d.customer_user_id = auth.uid()
           or d.rider_id = auth.uid()
           or d.business_id = app.owned_business_id())
  )
$$;

-- May the calling user see another person's profile?
-- Allowed when they share a delivery, or the target is a verified rider and caller is an SME owner
-- (needed to choose a rider to assign).
create or replace function app.can_view_profile(p_target uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select
    p_target = auth.uid()
    or app.is_admin()
    or exists (
      select 1 from public.deliveries d
      left join public.businesses b on b.id = d.business_id
      where
        -- caller is customer: may see rider + business owner
        (d.customer_user_id = auth.uid() and (d.rider_id = p_target or b.owner_id = p_target))
        -- caller is rider: may see customer + business owner of their deliveries
        or (d.rider_id = auth.uid() and (d.customer_user_id = p_target or b.owner_id = p_target))
        -- caller is business owner: may see customer + rider of their deliveries
        or (b.owner_id = auth.uid() and (d.customer_user_id = p_target or d.rider_id = p_target))
    )
    or (
      app.current_user_role() = 'sme_owner'
      and exists (select 1 from public.rider_profiles r where r.id = p_target and r.is_verified)
    )
$$;

-- Delivery state machine. Mirrors src/features/deliveries/status.js (kept in sync by tests).
create or replace function app.valid_transition(p_from public.delivery_status, p_to public.delivery_status)
returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('requested'::public.delivery_status, 'pending'::public.delivery_status),
    ('requested', 'rejected'), ('requested', 'cancelled'),
    ('pending', 'assigned'), ('pending', 'cancelled'),
    ('assigned', 'accepted'), ('assigned', 'pending'), ('assigned', 'cancelled'),
    ('accepted', 'picked_up'), ('accepted', 'cancelled'),
    ('picked_up', 'in_transit'), ('picked_up', 'cancelled'),
    ('in_transit', 'arrived'), ('in_transit', 'cancelled'),
    ('arrived', 'delivered'), ('arrived', 'cancelled')
  )
$$;

grant usage on schema app to authenticated, anon, service_role;
grant execute on all functions in schema app to authenticated, service_role;

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function app.set_updated_at();
create trigger businesses_updated_at before update on public.businesses for each row execute function app.set_updated_at();
create trigger rider_profiles_updated_at before update on public.rider_profiles for each row execute function app.set_updated_at();
create trigger business_customers_updated_at before update on public.business_customers for each row execute function app.set_updated_at();
create trigger deliveries_updated_at before update on public.deliveries for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------
-- New auth user -> profile (+ business / rider profile)
-- The browser may *request* an account type via user metadata, but only
-- customer / sme_owner / rider are honoured. 'admin' can never be self-assigned.
-- ---------------------------------------------------------------------
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type     text := v_meta ->> 'account_type';
  v_role     public.user_role;
  v_name     text := nullif(btrim(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', '')), '');
  v_phone    text := nullif(btrim(coalesce(v_meta ->> 'phone', '')), '');
  v_category text := coalesce(v_meta ->> 'business_category', 'other');
begin
  if v_type in ('customer', 'sme_owner', 'rider') then
    v_role := v_type::public.user_role;
  else
    v_role := 'customer';
  end if;

  if v_name is null or char_length(v_name) < 2 then
    v_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'New user');
    if char_length(v_name) < 2 then v_name := 'New user'; end if;
  end if;
  v_name := left(v_name, 120);
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()-]{7,20}$' then v_phone := null; end if;

  insert into public.profiles (id, full_name, email, phone, role, onboarded)
  values (new.id, v_name, new.email, v_phone, v_role, v_type in ('customer', 'sme_owner', 'rider'));

  if v_role = 'rider' then
    insert into public.rider_profiles (id, vehicle_type)
    values (new.id, case when v_meta ->> 'vehicle_type' in ('motorcycle','bicycle','tricycle','car','van')
                         then v_meta ->> 'vehicle_type' else 'motorcycle' end);
  elsif v_role = 'sme_owner' then
    if v_category not in ('retail', 'pharmacy', 'food', 'logistics', 'electronics', 'other') then
      v_category := 'other';
    end if;
    insert into public.businesses (owner_id, name, category, phone, email)
    values (new.id,
            left(coalesce(nullif(btrim(v_meta ->> 'business_name'), ''), v_name || ' Business'), 120),
            v_category, v_phone, new.email);
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function app.handle_new_user();

-- Keep profile email in sync when the auth email changes.
create or replace function app.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed
  after update of email on auth.users for each row
  when (old.email is distinct from new.email)
  execute function app.handle_user_email_change();

-- ---------------------------------------------------------------------
-- Column guards: direct client writes (role = authenticated/anon) may not
-- change privileged columns. SECURITY DEFINER RPCs run as the owner and
-- are allowed; they perform their own authorisation.
-- ---------------------------------------------------------------------
create or replace function app.guard_profile_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.onboarded is distinct from old.onboarded
       or new.email is distinct from old.email
       or new.id is distinct from old.id then
      raise exception 'Not allowed to change role, status or email directly' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function app.guard_profile_update();

create or replace function app.guard_rider_profile_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.is_verified is distinct from old.is_verified or new.id is distinct from old.id then
      raise exception 'Not allowed to change rider verification' using errcode = '42501';
    end if;
    if new.availability = 'available' and old.availability is distinct from 'available' and not old.is_verified then
      raise exception 'Your rider profile must be verified before you can go online' using errcode = '42501';
    end if;
    if new.last_lat is distinct from old.last_lat or new.last_lng is distinct from old.last_lng then
      new.last_location_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger rider_profiles_guard before update on public.rider_profiles for each row execute function app.guard_rider_profile_update();

create or replace function app.guard_business_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.is_verified is distinct from old.is_verified
       or new.is_active is distinct from old.is_active
       or new.owner_id is distinct from old.owner_id
       or new.id is distinct from old.id then
      raise exception 'Not allowed to change verification, status or owner' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger businesses_guard before update on public.businesses for each row execute function app.guard_business_update();

-- ---------------------------------------------------------------------
-- Delivery state machine enforcement (defence in depth — applies to every
-- writer, including RPCs and the service role).
-- ---------------------------------------------------------------------
create or replace function app.enforce_delivery_transition()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if not app.valid_transition(old.status, new.status) then
      raise exception 'Invalid delivery status change: % -> %', old.status, new.status using errcode = 'P0001';
    end if;
    case new.status
      when 'assigned'  then new.assigned_at  := now();
      when 'accepted'  then new.accepted_at  := now();
      when 'picked_up' then new.picked_up_at := now();
      when 'delivered' then new.delivered_at := now();
      when 'cancelled' then new.cancelled_at := now();
      when 'rejected'  then new.cancelled_at := now();
      else null;
    end case;
  end if;
  -- immutable columns
  if new.business_id is distinct from old.business_id
     or new.customer_user_id is distinct from old.customer_user_id
     or new.code is distinct from old.code
     or new.created_by is distinct from old.created_by then
    raise exception 'Delivery ownership fields are immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger deliveries_transition before update on public.deliveries for each row execute function app.enforce_delivery_transition();

-- ---------------------------------------------------------------------
-- Status history + notifications
-- ---------------------------------------------------------------------
create or replace function app.notify(p_user uuid, p_type public.notification_type, p_title text, p_body text, p_delivery uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_user is null or p_user = auth.uid() then
    return; -- nobody to notify, or the actor themself
  end if;
  if exists (select 1 from public.profiles where id = p_user and coalesce((notification_prefs ->> 'in_app')::boolean, true)) then
    insert into public.notifications (user_id, type, title, body, delivery_id)
    values (p_user, p_type, p_title, p_body, p_delivery);
  end if;
end $$;

create or replace function app.on_delivery_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_owner    uuid;
  v_business text;
  v_note     text := nullif(current_setting('app.status_note', true), '');
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.delivery_status_history (delivery_id, status, note, changed_by)
  values (new.id, new.status, v_note, auth.uid());

  select owner_id, name into v_owner, v_business from public.businesses where id = new.business_id;

  if tg_op = 'INSERT' then
    if new.status = 'requested' then
      perform app.notify(v_owner, 'delivery_request', 'New delivery request',
        format('Delivery #%s to %s is waiting for your review.', new.code, new.dropoff_address), new.id);
    else
      perform app.notify(new.customer_user_id, 'delivery_update', 'Delivery created',
        format('%s created delivery #%s for you.', v_business, new.code), new.id);
    end if;
    return new;
  end if;

  case new.status
    when 'pending' then
      if old.status = 'requested' then
        perform app.notify(new.customer_user_id, 'delivery_update', 'Request accepted',
          format('%s accepted delivery #%s and will assign a rider shortly.', v_business, new.code), new.id);
      else
        perform app.notify(v_owner, 'delivery_update', 'Rider declined the job',
          format('Delivery #%s is back in your dispatch queue.', new.code), new.id);
      end if;
    when 'rejected' then
      perform app.notify(new.customer_user_id, 'delivery_cancelled', 'Request declined',
        format('%s could not take delivery #%s.%s', v_business, new.code,
               coalesce(' Reason: ' || new.cancel_reason, '')), new.id);
    when 'assigned' then
      perform app.notify(new.rider_id, 'job_offer', 'New job available',
        format('#%s: %s to %s.', new.code, new.pickup_address, new.dropoff_address), new.id);
    when 'accepted' then
      perform app.notify(v_owner, 'rider_assigned', 'Rider accepted',
        format('A rider accepted delivery #%s.', new.code), new.id);
      perform app.notify(new.customer_user_id, 'rider_assigned', 'Rider assigned',
        format('A rider has been assigned to #%s.', new.code), new.id);
    when 'picked_up' then
      perform app.notify(new.customer_user_id, 'delivery_update', 'Picked up',
        format('Delivery #%s has been picked up.', new.code), new.id);
      perform app.notify(v_owner, 'delivery_update', 'Picked up',
        format('Delivery #%s has been picked up.', new.code), new.id);
    when 'in_transit' then
      perform app.notify(new.customer_user_id, 'delivery_update', 'In transit',
        format('Delivery #%s is now in transit.', new.code), new.id);
    when 'arrived' then
      perform app.notify(new.customer_user_id, 'delivery_update', 'Rider has arrived',
        format('The rider for #%s is at the drop-off location.', new.code), new.id);
    when 'delivered' then
      perform app.notify(new.customer_user_id, 'delivery_completed', 'Delivery completed',
        format('Delivery #%s has been completed.', new.code), new.id);
      perform app.notify(v_owner, 'delivery_completed', 'Delivery completed',
        format('Delivery #%s has been completed.', new.code), new.id);
    when 'cancelled' then
      perform app.notify(new.customer_user_id, 'delivery_cancelled', 'Delivery cancelled',
        format('Delivery #%s was cancelled.%s', new.code, coalesce(' Reason: ' || new.cancel_reason, '')), new.id);
      perform app.notify(v_owner, 'delivery_cancelled', 'Delivery cancelled',
        format('Delivery #%s was cancelled.%s', new.code, coalesce(' Reason: ' || new.cancel_reason, '')), new.id);
      perform app.notify(old.rider_id, 'delivery_cancelled', 'Job cancelled',
        format('Delivery #%s was cancelled.', new.code), new.id);
    else null;
  end case;
  return new;
end $$;

create trigger deliveries_status_log
  after insert or update of status on public.deliveries
  for each row execute function app.on_delivery_status();
