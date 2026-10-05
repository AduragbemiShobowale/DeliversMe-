-- ============================================================
-- LIVE PROJECT TEST SCRIPT (v2 -- manual provisioning throughout)
-- ============================================================
-- DASHBOARD STEP (do this first):
-- Authentication -> Users -> Add user. Create THREE users, each with
-- just an email and password, "Auto Confirm User" turned ON. No
-- metadata needed for any of them.
--   1) owner@test.com
--   2) rider@test.com
--   3) customer@test.com
-- After creating all three, click each one and copy its UUID (shown
-- at the top of that user's detail page). You'll need all three below.
--
-- Run ONE numbered block at a time. Some blocks return a value you'll
-- need to paste into a LATER block -- copy it from the Results panel
-- before moving on.
-- ============================================================


-- ============================================================
-- BLOCK 1 -- provision the Owner's business + profile manually.
-- Replace <PASTE_OWNER_AUTH_UID_HERE> with owner@test.com's UUID.
-- ============================================================
insert into businesses (id, owner_profile_id, name)
values (gen_random_uuid(), '<PASTE_OWNER_AUTH_UID_HERE>', 'Test Business')
returning id;
-- COPY the returned id -- this is your business_id, needed in every
-- block below.

insert into profiles (id, role, business_id, full_name, phone)
values ('<PASTE_OWNER_AUTH_UID_HERE>', 'owner', '<PASTE_BUSINESS_ID_HERE>', 'Test Owner', '+2348010000001');

select role, business_id, full_name from profiles where id = '<PASTE_OWNER_AUTH_UID_HERE>';


-- ============================================================
-- BLOCK 2 -- provision the Rider's profile.
-- Replace <PASTE_RIDER_AUTH_UID_HERE> and <PASTE_BUSINESS_ID_HERE>
-- (same business_id from Block 1).
-- ============================================================
insert into profiles (id, role, business_id, full_name, phone)
values ('<PASTE_RIDER_AUTH_UID_HERE>', 'rider', '<PASTE_BUSINESS_ID_HERE>', 'Test Rider', '+2348020000002');

insert into riders (profile_id, business_id, availability_status)
values ('<PASTE_RIDER_AUTH_UID_HERE>', '<PASTE_BUSINESS_ID_HERE>', 'available');

select role, business_id, full_name from profiles where id = '<PASTE_RIDER_AUTH_UID_HERE>';


-- ============================================================
-- BLOCK 3 -- provision the Customer's profile.
-- Replace <PASTE_CUSTOMER_AUTH_UID_HERE>. Note the phone number here
-- -- you'll need to type this SAME number again in Block 4.
-- ============================================================
insert into profiles (id, role, business_id, full_name, phone)
values ('<PASTE_CUSTOMER_AUTH_UID_HERE>', 'customer', null, 'Test Customer', '+2348030000009');

select role, business_id, full_name, phone from profiles where id = '<PASTE_CUSTOMER_AUTH_UID_HERE>';


-- ============================================================
-- BLOCK 4 -- acting AS THE OWNER: link the customer to the business.
-- Replace <PASTE_OWNER_AUTH_UID_HERE> and the phone number (must
-- match Block 3 exactly).
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '<PASTE_OWNER_AUTH_UID_HERE>';

select find_or_create_business_customer('+2348030000009', null, 'Test Customer', '14 Allen Ave, Ikeja');
-- COPY the returned id -- this is your business_customer_id.

reset role;
reset request.jwt.claim.sub;


-- ============================================================
-- BLOCK 5 -- still as the Owner: create the delivery.
-- Replace <PASTE_OWNER_AUTH_UID_HERE> and <PASTE_BC_ID_HERE>
-- (the id from Block 4).
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '<PASTE_OWNER_AUTH_UID_HERE>';

select create_delivery('<PASTE_BC_ID_HERE>', 'urgent');
-- COPY the returned id -- this is your delivery_id, needed for every
-- remaining block.

reset role;
reset request.jwt.claim.sub;


-- ============================================================
-- BLOCK 6 -- still as the Owner: assign the rider.
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '<PASTE_OWNER_AUTH_UID_HERE>';

select assign_rider('<PASTE_DELIVERY_ID_HERE>', '<PASTE_RIDER_AUTH_UID_HERE>');

select status, assigned_rider_id from deliveries where id = '<PASTE_DELIVERY_ID_HERE>';
-- Expect: assigned

reset role;
reset request.jwt.claim.sub;


-- ============================================================
-- BLOCK 7 -- acting AS THE RIDER: accept, start, send a GPS ping.
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '<PASTE_RIDER_AUTH_UID_HERE>';

select accept_delivery_assignment('<PASTE_DELIVERY_ID_HERE>');
select status from deliveries where id = '<PASTE_DELIVERY_ID_HERE>';
-- Expect: accepted

select start_delivery('<PASTE_DELIVERY_ID_HERE>');
select status from deliveries where id = '<PASTE_DELIVERY_ID_HERE>';
-- Expect: in_transit

insert into delivery_locations (delivery_id, rider_id, lat, lng)
values ('<PASTE_DELIVERY_ID_HERE>', '<PASTE_RIDER_AUTH_UID_HERE>', 6.5244, 3.3792);

select count(*) from delivery_locations where delivery_id = '<PASTE_DELIVERY_ID_HERE>';
-- Expect: 1

reset role;
reset request.jwt.claim.sub;


-- ============================================================
-- BLOCK 8 -- still as the Rider: complete the delivery with proof.
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '<PASTE_RIDER_AUTH_UID_HERE>';

select complete_delivery('<PASTE_DELIVERY_ID_HERE>', 'https://example.com/placeholder-photo.jpg', 'Test Customer', 'Left at reception');

select status, delivered_at is not null as has_timestamp from deliveries where id = '<PASTE_DELIVERY_ID_HERE>';
-- Expect: delivered, has_timestamp = true

reset role;
reset request.jwt.claim.sub;


-- ============================================================
-- BLOCK 9 -- back as the Owner: view the audit trail, record a
-- rating.
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '<PASTE_OWNER_AUTH_UID_HERE>';

select event_type, actor_role, created_at from delivery_events
where delivery_id = '<PASTE_DELIVERY_ID_HERE>' order by created_at;
-- Expect, in order: created, assigned, accepted, started,
-- proof_uploaded, delivered

update deliveries set rating = 5, rating_comment = 'Great service', rating_recorded_by = auth.uid()
where id = '<PASTE_DELIVERY_ID_HERE>';

select rating, rating_comment from deliveries where id = '<PASTE_DELIVERY_ID_HERE>';
-- Expect: rating = 5

reset role;
reset request.jwt.claim.sub;

-- If Block 9 showed all six timeline events in order and the rating
-- saved, your backend works end to end.
