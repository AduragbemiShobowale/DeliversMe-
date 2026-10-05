-- =====================================================================
-- DeliverSME Lagos — 003 privileges and Row Level Security
-- Principle: the browser can READ what RLS allows and can WRITE only a
-- small set of low-risk columns directly. Every delivery state change goes
-- through SECURITY DEFINER RPCs (004) that authorise the caller.
-- =====================================================================

-- Start from zero for API roles, then grant back exactly what is needed.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

alter table public.profiles                enable row level security;
alter table public.businesses              enable row level security;
alter table public.rider_profiles          enable row level security;
alter table public.business_customers      enable row level security;
alter table public.deliveries              enable row level security;
alter table public.delivery_status_history enable row level security;
alter table public.delivery_ratings        enable row level security;
alter table public.notifications           enable row level security;
alter table public.contact_messages        enable row level security;
alter table public.newsletter_subscribers  enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url, notification_prefs) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app.can_view_profile(id));

create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() and is_active)
  with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- businesses — any signed-in user can see active businesses (needed for
-- "Find a Business"); owners edit their own descriptive fields.
-- ---------------------------------------------------------------------
grant select on public.businesses to authenticated;
grant update (name, category, tagline, description, phone, email, address, logo_url) on public.businesses to authenticated;

create policy businesses_select on public.businesses for select to authenticated
  using (is_active or owner_id = auth.uid() or app.is_admin());

create policy businesses_update_owner on public.businesses for update to authenticated
  using (owner_id = auth.uid() and app.is_active_user())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- rider_profiles
-- ---------------------------------------------------------------------
grant select on public.rider_profiles to authenticated;
grant update (vehicle_type, plate_number, availability, last_lat, last_lng) on public.rider_profiles to authenticated;

create policy rider_profiles_select on public.rider_profiles for select to authenticated
  using (id = auth.uid() or app.can_view_profile(id));

create policy rider_profiles_update_self on public.rider_profiles for update to authenticated
  using (id = auth.uid() and app.is_active_user())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- business_customers — only the owning SME (and admins, read-only)
-- ---------------------------------------------------------------------
grant select, insert, delete on public.business_customers to authenticated;
grant update (full_name, phone, email, address) on public.business_customers to authenticated;

create policy business_customers_select on public.business_customers for select to authenticated
  using (business_id = app.owned_business_id() or app.is_admin());
create policy business_customers_insert on public.business_customers for insert to authenticated
  with check (business_id = app.owned_business_id() and user_id is null);
create policy business_customers_update on public.business_customers for update to authenticated
  using (business_id = app.owned_business_id())
  with check (business_id = app.owned_business_id());
create policy business_customers_delete on public.business_customers for delete to authenticated
  using (business_id = app.owned_business_id());

-- ---------------------------------------------------------------------
-- deliveries — read-only for clients. Writes only via RPCs.
-- ---------------------------------------------------------------------
grant select on public.deliveries to authenticated;

create policy deliveries_select on public.deliveries for select to authenticated
  using (
    customer_user_id = auth.uid()
    or rider_id = auth.uid()
    or business_id = app.owned_business_id()
    or app.is_admin()
  );

grant select on public.delivery_status_history to authenticated;
create policy delivery_status_history_select on public.delivery_status_history for select to authenticated
  using (app.can_view_delivery(delivery_id));

grant select on public.delivery_ratings to authenticated;
create policy delivery_ratings_select on public.delivery_ratings for select to authenticated
  using (customer_id = auth.uid() or business_id = app.owned_business_id() or app.is_admin());

-- ---------------------------------------------------------------------
-- notifications — own rows only; only read_at is writable
-- ---------------------------------------------------------------------
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- contact_messages / newsletter — write-only for the public; admin reads
-- ---------------------------------------------------------------------
grant insert (full_name, email, subject, message) on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
grant update (status) on public.contact_messages to authenticated;

create policy contact_messages_insert on public.contact_messages for insert to anon, authenticated
  with check (status = 'new');
create policy contact_messages_admin_select on public.contact_messages for select to authenticated
  using (app.is_admin());
create policy contact_messages_admin_update on public.contact_messages for update to authenticated
  using (app.is_admin()) with check (app.is_admin());

grant insert (email) on public.newsletter_subscribers to anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;
create policy newsletter_insert on public.newsletter_subscribers for insert to anon, authenticated
  with check (true);  -- insert-only; rows are never readable by the public
create policy newsletter_admin_select on public.newsletter_subscribers for select to authenticated
  using (app.is_admin());

-- ---------------------------------------------------------------------
-- Admin read access to everything operational
-- (select policies above already include app.is_admin() where relevant;
-- profiles/rider_profiles use app.can_view_profile which includes admin)
-- ---------------------------------------------------------------------
