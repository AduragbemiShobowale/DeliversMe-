-- =====================================================================
-- DeliverSME Lagos — 001 core schema
-- Tables, enums, constraints, indexes. Access control lives in 003.
-- =====================================================================


create schema if not exists app;          -- private helpers, NOT exposed through the API
comment on schema app is 'Private helper functions used by RLS policies and RPCs. Not exposed via PostgREST.';

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.user_role as enum ('customer', 'sme_owner', 'rider', 'admin');

create type public.delivery_status as enum (
  'requested',   -- customer asked a business for a delivery; business has not reviewed it
  'pending',     -- in the business dispatch queue, waiting for a rider
  'assigned',    -- offered to a specific rider, waiting for accept/decline
  'accepted',    -- rider accepted, heading to pickup
  'picked_up',   -- rider has the item
  'in_transit',  -- on the way to drop-off
  'arrived',     -- rider at destination
  'delivered',   -- completed (terminal)
  'cancelled',   -- cancelled by customer/business/admin (terminal)
  'rejected'     -- business declined a customer request (terminal)
);

create type public.delivery_priority as enum ('standard', 'express');
create type public.package_size as enum ('small', 'medium', 'large');
create type public.rider_availability as enum ('available', 'offline');
create type public.notification_type as enum (
  'delivery_request', 'delivery_update', 'job_offer', 'rider_assigned',
  'delivery_completed', 'delivery_cancelled', 'business_update', 'system'
);

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text not null check (char_length(btrim(full_name)) between 2 and 120),
  email              text,
  phone              text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  avatar_url         text check (avatar_url is null or char_length(avatar_url) <= 500),
  role               public.user_role not null default 'customer',
  is_active          boolean not null default true,
  onboarded          boolean not null default false,
  notification_prefs jsonb not null default '{"in_app": true, "email": true}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------
-- Businesses (one per SME owner)
-- ---------------------------------------------------------------------
create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references public.profiles (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  category    text not null default 'other'
              check (category in ('retail', 'pharmacy', 'food', 'logistics', 'electronics', 'other')),
  tagline     text check (tagline is null or char_length(tagline) <= 120),
  description text check (description is null or char_length(description) <= 1000),
  phone       text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  email       text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address     text check (address is null or char_length(address) <= 300),
  logo_url    text check (logo_url is null or char_length(logo_url) <= 500),
  is_verified boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index businesses_category_idx on public.businesses (category) where is_active;
create index businesses_name_idx on public.businesses (lower(name));

-- ---------------------------------------------------------------------
-- Rider profiles (1:1 with profiles where role = rider)
-- ---------------------------------------------------------------------
create table public.rider_profiles (
  id               uuid primary key references public.profiles (id) on delete cascade,
  vehicle_type     text not null default 'motorcycle'
                   check (vehicle_type in ('motorcycle', 'bicycle', 'tricycle', 'car', 'van')),
  plate_number     text check (plate_number is null or char_length(plate_number) <= 20),
  availability     public.rider_availability not null default 'offline',
  is_verified      boolean not null default false,
  last_lat         double precision check (last_lat is null or last_lat between -90 and 90),
  last_lng         double precision check (last_lng is null or last_lng between -180 and 180),
  last_location_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index rider_profiles_available_idx on public.rider_profiles (availability) where is_verified;

-- ---------------------------------------------------------------------
-- Business customers (an SME's contact list; may link to a platform user)
-- ---------------------------------------------------------------------
create table public.business_customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  full_name   text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone       text not null check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  email       text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address     text check (address is null or char_length(address) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, user_id)
);
create index business_customers_business_idx on public.business_customers (business_id, full_name);

-- ---------------------------------------------------------------------
-- Deliveries
-- ---------------------------------------------------------------------
create sequence public.delivery_code_seq start 1;

create table public.deliveries (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique
                        default ('DLV' || lpad(nextval('public.delivery_code_seq')::text, 6, '0')),
  business_id           uuid not null references public.businesses (id) on delete restrict,
  customer_user_id      uuid references public.profiles (id) on delete set null,
  business_customer_id  uuid references public.business_customers (id) on delete set null,
  created_by            uuid references public.profiles (id) on delete set null,
  rider_id              uuid references public.profiles (id) on delete set null,
  status                public.delivery_status not null,
  priority              public.delivery_priority not null default 'standard',
  package_size          public.package_size not null default 'small',
  pickup_address        text not null check (char_length(btrim(pickup_address)) between 5 and 300),
  pickup_lat            double precision check (pickup_lat is null or pickup_lat between -90 and 90),
  pickup_lng            double precision check (pickup_lng is null or pickup_lng between -180 and 180),
  dropoff_address       text not null check (char_length(btrim(dropoff_address)) between 5 and 300),
  dropoff_lat           double precision check (dropoff_lat is null or dropoff_lat between -90 and 90),
  dropoff_lng           double precision check (dropoff_lng is null or dropoff_lng between -180 and 180),
  item_description      text not null check (char_length(btrim(item_description)) between 2 and 300),
  special_instructions  text check (special_instructions is null or char_length(special_instructions) <= 500),
  recipient_name        text not null check (char_length(btrim(recipient_name)) between 2 and 120),
  recipient_phone       text not null check (recipient_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  proof_path            text check (proof_path is null or char_length(proof_path) <= 300),
  completion_notes      text check (completion_notes is null or char_length(completion_notes) <= 500),
  cancel_reason         text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  requested_at          timestamptz not null default now(),
  assigned_at           timestamptz,
  accepted_at           timestamptz,
  picked_up_at          timestamptz,
  delivered_at          timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint rider_required_when_active check (
    status in ('requested', 'pending', 'cancelled', 'rejected', 'delivered') or rider_id is not null
  )
);
create index deliveries_business_idx on public.deliveries (business_id, created_at desc);
create index deliveries_customer_idx on public.deliveries (customer_user_id, created_at desc);
create index deliveries_rider_idx on public.deliveries (rider_id, status);
create index deliveries_status_idx on public.deliveries (status);
create index deliveries_created_idx on public.deliveries (created_at desc);

create table public.delivery_status_history (
  id          bigint generated always as identity primary key,
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  status      public.delivery_status not null,
  note        text,
  changed_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index delivery_status_history_delivery_idx on public.delivery_status_history (delivery_id, created_at);

create table public.delivery_ratings (
  delivery_id uuid primary key references public.deliveries (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (comment is null or char_length(comment) <= 500),
  created_at  timestamptz not null default now()
);
create index delivery_ratings_business_idx on public.delivery_ratings (business_id);

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  body        text,
  delivery_id uuid references public.deliveries (id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------
-- Public website submissions
-- ---------------------------------------------------------------------
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (char_length(btrim(full_name)) between 2 and 120),
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  subject    text not null check (subject in ('general', 'support', 'partnership', 'rider', 'billing', 'other')),
  message    text not null check (char_length(btrim(message)) between 10 and 2000),
  status     text not null default 'new' check (status in ('new', 'resolved')),
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);

create table public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  created_at timestamptz not null default now()
);
create unique index newsletter_subscribers_email_key on public.newsletter_subscribers (lower(email));
