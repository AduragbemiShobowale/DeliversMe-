-- Functional test: creates an Owner (via the same trigger path real
-- signup uses), a Rider, a Customer, exercises the full dispatch
-- lifecycle, and probes several RLS boundaries an attacker-shaped client
-- would try. Run as postgres superuser but SET ROLE authenticated and set
-- the request.jwt.claim.sub setting to simulate each user's session,
-- matching how PostgREST/Supabase actually authorizes requests.

\set ON_ERROR_STOP off
\pset pager off

-- ===== Bootstrap: Owner signup (via the real trigger, as the client would) =====
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'adaeze@bellofashions.test',
  '{"role":"owner","full_name":"Adaeze Nwosu","business_name":"Bello Fashions","phone":"+2348010000001"}'::jsonb);

select id as owner_business_id from businesses where owner_profile_id = '11111111-1111-1111-1111-111111111111' \gset

\echo '--- Owner + business provisioned via trigger ---'
select role, business_id, full_name from profiles where id = '11111111-1111-1111-1111-111111111111';
select name, verification_status, assignment_timeout_minutes from businesses where id = :'owner_business_id';

-- ===== Rider provisioning (simulating the invite Edge Function's own inserts, service-role) =====
insert into auth.users (id, email, raw_user_meta_data)
values ('22222222-2222-2222-2222-222222222222', 'tunde@rider.test', '{"role":"rider"}'::jsonb);
-- The 'rider' branch of handle_new_user() is a deliberate no-op; the
-- invite Edge Function itself inserts this row directly with service-role
-- privileges, bypassing RLS. Simulated here as a superuser insert.
insert into profiles (id, role, business_id, full_name, phone)
values ('22222222-2222-2222-2222-222222222222', 'rider', :'owner_business_id', 'Tunde Balogun', '+2348020000002');
insert into riders (profile_id, business_id, availability_status)
values ('22222222-2222-2222-2222-222222222222', :'owner_business_id', 'available');

\echo '--- Rider provisioned ---'
select role, business_id, full_name from profiles where id = '22222222-2222-2222-2222-222222222222';

-- ===== Customer self-registration =====
insert into auth.users (id, email, raw_user_meta_data)
values ('33333333-3333-3333-3333-333333333333', 'chidinma@customer.test',
  '{"role":"customer","full_name":"Chidinma Okafor","phone":"+2348030000003"}'::jsonb);

\echo '--- Customer provisioned ---'
select role, business_id, full_name, phone from profiles where id = '33333333-3333-3333-3333-333333333333';

-- ===== Owner links customer, creates delivery =====
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select find_or_create_business_customer('+2348030000003', null, 'Chidinma Okafor', '14 Allen Ave') as bc_id \gset
\echo '--- business_customers row created ---'
select status, customer_profile_id, pending_phone from business_customers where id = :'bc_id';

select create_delivery(:'bc_id', 'urgent') as delivery_id \gset
\echo '--- Delivery created ---'
select status, priority, business_id from deliveries where id = :'delivery_id';

-- Second SME linking the SAME customer -- must create a SEPARATE row,
-- never touch the first business's relationship (§14 probe #1).
-- Reset to superuser context first -- auth.users/businesses inserts are
-- never something an authenticated client does directly in real usage
-- either (see the RPC-only comments throughout).
reset role;
reset request.jwt.claim.sub;
insert into auth.users (id, email, raw_user_meta_data)
values ('44444444-4444-4444-4444-444444444444', 'oga@storeflex.test',
  '{"role":"owner","full_name":"Oga Musa","business_name":"StoreFlex"}'::jsonb);
select id as second_business_id from businesses where owner_profile_id = '44444444-4444-4444-4444-444444444444' \gset

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select find_or_create_business_customer('+2348030000003', null, 'Chidinma Okafor', 'Different address') as second_bc_id \gset
\echo '--- Second business_customers row for same global customer (should be a DIFFERENT id) ---'
select :'bc_id' as first_bc, :'second_bc_id' as second_bc;
select (:'bc_id' <> :'second_bc_id') as ids_are_different;

-- PRIVACY PROBE: can Business B see Business A's relationship/delivery data?
\echo '--- PRIVACY PROBE: Business B querying Business A delivery (should return 0 rows) ---'
select count(*) as leaked_rows from deliveries where id = :'delivery_id';
\echo '--- PRIVACY PROBE: Business B querying Business A business_customers row (should return 0 rows) ---'
select count(*) as leaked_rows from business_customers where id = :'bc_id';

reset role;
reset request.jwt.claim.sub;

-- ===== Full dispatch lifecycle, as Owner A =====
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select assign_rider(:'delivery_id', '22222222-2222-2222-2222-222222222222');
\echo '--- After assign: status + rider availability ---'
select status, assigned_rider_id from deliveries where id = :'delivery_id';
reset role; reset request.jwt.claim.sub;
select availability_status from riders where profile_id = '22222222-2222-2222-2222-222222222222';

-- ===== RLS PROBE: can Rider B (nonexistent here, but simulate a second rider) read Rider A's assignment? =====
reset role; reset request.jwt.claim.sub;
insert into auth.users (id, email, raw_user_meta_data) values ('55555555-5555-5555-5555-555555555555', 'david@rider.test', '{"role":"rider"}'::jsonb);
insert into profiles (id, role, business_id, full_name) values ('55555555-5555-5555-5555-555555555555', 'rider', :'owner_business_id', 'David Ade');
insert into riders (profile_id, business_id, availability_status) values ('55555555-5555-5555-5555-555555555555', :'owner_business_id', 'available');

set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
\echo '--- RLS PROBE: Rider David querying Tundes assigned delivery directly (should return 0 rows) ---'
select count(*) as leaked_rows from deliveries where id = :'delivery_id';
\echo '--- RLS PROBE: Rider David attempting to accept Tundes assignment (should raise an exception) ---'
select accept_delivery_assignment(:'delivery_id');
reset role; reset request.jwt.claim.sub;

-- ===== Correct rider accepts, starts, GPS, completes =====
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select accept_delivery_assignment(:'delivery_id');
\echo '--- After accept ---'
select status from deliveries where id = :'delivery_id';

-- Verify GPS cannot be inserted before start_delivery (Stage 17/20's
-- explicit "GPS must not begin merely because rider accepted" rule)
\echo '--- GPS PROBE: inserting location while status=accepted (should FAIL) ---'
insert into delivery_locations (delivery_id, rider_id, lat, lng) values (:'delivery_id', '22222222-2222-2222-2222-222222222222', 6.5244, 3.3792);

select start_delivery(:'delivery_id');
\echo '--- After start: status should be in_transit, an event but NO notification ---'
select status from deliveries where id = :'delivery_id';
select event_type, actor_role from delivery_events where delivery_id = :'delivery_id' and event_type = 'started';
select count(*) as should_be_zero from notifications where delivery_id = :'delivery_id' and notification_type = 'started';

\echo '--- GPS PROBE: inserting location now that status=in_transit (should SUCCEED) ---'
insert into delivery_locations (delivery_id, rider_id, lat, lng) values (:'delivery_id', '22222222-2222-2222-2222-222222222222', 6.5244, 3.3792);
select count(*) as location_rows from delivery_locations where delivery_id = :'delivery_id';

-- Illegal transition probe: attempt to skip straight to delivered from a
-- fresh accepted-only delivery (create a second delivery for this)
reset role; reset request.jwt.claim.sub;
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select create_delivery(:'bc_id', 'normal') as delivery2_id \gset
select assign_rider(:'delivery2_id', '22222222-2222-2222-2222-222222222222');
reset role; reset request.jwt.claim.sub;
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
\echo '--- STATE MACHINE PROBE: complete_delivery while status=assigned, not in_transit (should FAIL) ---'
select complete_delivery(:'delivery2_id', 'https://example.test/photo.jpg', 'Chidinma', null);

-- Complete the original delivery properly
select complete_delivery(:'delivery_id', 'https://storage.test/proof-of-delivery/xyz.jpg', 'Chidinma Okafor', 'Left at reception');
\echo '--- After complete: status delivered, one POD row version 1 ---'
select status, delivered_at is not null as has_delivered_at from deliveries where id = :'delivery_id';
select version, recipient_name from proof_of_delivery where delivery_id = :'delivery_id';

reset role; reset request.jwt.claim.sub;

-- ===== Owner records rating =====
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update deliveries set rating = 5, rating_comment = 'Great service', rating_recorded_by = auth.uid() where id = :'delivery_id';
\echo '--- Rating recorded ---'
select rating, rating_comment from deliveries where id = :'delivery_id';
reset role; reset request.jwt.claim.sub;

\echo '=== ALL FUNCTIONAL TESTS COMPLETE ==='
