-- End-to-end security + workflow tests. Each role is simulated with request.jwt.claims + SET ROLE authenticated,
-- exactly how PostgREST executes requests on Supabase.
\set ON_ERROR_STOP on
\set c1 '11111111-1111-1111-1111-111111111111'
\set c2 '22222222-2222-2222-2222-222222222222'
\set s1 '33333333-3333-3333-3333-333333333333'
\set s2 '44444444-4444-4444-4444-444444444444'
\set r1 '55555555-5555-5555-5555-555555555555'
\set r2 '66666666-6666-6666-6666-666666666666'
\set ad '77777777-7777-7777-7777-777777777777'
\set fake '88888888-8888-8888-8888-888888888888'

-- ---- sign-ups (as Supabase Auth would insert them) ----
insert into auth.users (id, email, raw_user_meta_data) values
 (:'c1', 'c1@example.com', '{"full_name":"Demo Customer One","account_type":"customer","phone":"+2348000000001"}'),
 (:'c2', 'c2@example.com', '{"full_name":"Demo Customer Two","account_type":"customer","phone":"+2348000000002"}'),
 (:'s1', 's1@example.com', '{"full_name":"Demo Owner One","account_type":"sme_owner","business_name":"Demo Foods","business_category":"food"}'),
 (:'s2', 's2@example.com', '{"full_name":"Demo Owner Two","account_type":"sme_owner","business_name":"Demo Pharmacy","business_category":"pharmacy"}'),
 (:'r1', 'r1@example.com', '{"full_name":"Demo Rider One","account_type":"rider"}'),
 (:'r2', 'r2@example.com', '{"full_name":"Demo Rider Two","account_type":"rider"}'),
 (:'ad', 'admin@example.com', '{"full_name":"Demo Admin","account_type":"customer"}'),
 (:'fake', 'fake@example.com', '{"full_name":"Wannabe Admin","account_type":"admin","role":"admin"}');

-- bootstrap admin the documented way (SQL editor runs as postgres)
update public.profiles set role = 'admin' where id = :'ad';

select tests.ok((select role from profiles where id = :'fake') = 'customer', 'self-assigned admin at sign-up is downgraded to customer');
select tests.ok((select count(*) from businesses where owner_id = :'s1') = 1, 'SME sign-up creates a business');
select tests.ok((select count(*) from rider_profiles where id = :'r1') = 1, 'rider sign-up creates rider profile');

-- ================= customer c1 =================
select set_config('request.jwt.claims', json_build_object('sub', :'c1')::text, false);
set role authenticated;
select tests.fails($$update profiles set role = 'admin' where id = auth.uid()$$, 'customer cannot promote self to admin');
select tests.fails($$update profiles set is_active = false where id = auth.uid()$$, 'customer cannot change own active flag');
update profiles set full_name = 'Demo Customer Uno' where id = auth.uid();
select tests.ok((select full_name from profiles where id = auth.uid()) = 'Demo Customer Uno', 'customer can edit own name');
select tests.fails($$insert into deliveries (business_id, status, pickup_address, dropoff_address, item_description, recipient_name, recipient_phone)
  select id, 'delivered', 'Allen Avenue, Ikeja', 'Victoria Island', 'docs', 'X Y', '+2348000000000' from businesses limit 1$$, 'customer cannot insert deliveries directly');
select tests.fails($$select * from list_riders()$$, 'customer cannot list riders');
select tests.ok(tests.count_visible('select 1 from contact_messages') = 0, 'customer cannot read contact messages');
select tests.ok(tests.count_visible('select 1 from profiles') = 1, 'customer sees only own profile before any delivery');

select * from create_delivery_request(
  (select id from businesses where name = 'Demo Foods'),
  'Allen Avenue, Ikeja', 'Victoria Island, Lagos', 'Office documents', null, null, 'small', 'standard', 'Call before arrival') \gset d1_
select tests.ok(:'d1_status' = 'requested', 'customer request starts as requested');
select tests.ok(:'d1_code' like 'DLV%', 'delivery gets human code');
reset role;

-- ================= customer c2 (other customer) =================
select set_config('request.jwt.claims', json_build_object('sub', :'c2')::text, false);
set role authenticated;
select tests.ok(tests.count_visible('select 1 from deliveries') = 0, 'other customer cannot see c1 delivery');
select tests.ok(tests.count_visible(format('select 1 from delivery_status_history where delivery_id = %L', :'d1_id')) = 0, 'other customer cannot see history');
select tests.fails(format($$select cancel_delivery(%L)$$, :'d1_id'), 'other customer cannot cancel c1 delivery');
select tests.ok(tests.count_visible(format('select 1 from profiles where id = %L', :'c1')) = 0, 'other customer cannot read c1 profile');
reset role;

-- ================= other SME s2 =================
select set_config('request.jwt.claims', json_build_object('sub', :'s2')::text, false);
set role authenticated;
select tests.ok(tests.count_visible('select 1 from deliveries') = 0, 'other SME cannot see delivery');
select tests.fails(format($$select review_delivery_request(%L, true)$$, :'d1_id'), 'other SME cannot review delivery');
select tests.fails($$update businesses set is_verified = true where owner_id = auth.uid()$$, 'SME cannot self-verify business');
select tests.fails($$insert into business_customers (business_id, full_name, phone) select id, 'Injected', '+2348000000000' from businesses where name = 'Demo Foods'$$, 'SME cannot add customers to another business');
reset role;

-- ================= admin verifies rider r1 only =================
select set_config('request.jwt.claims', json_build_object('sub', :'ad')::text, false);
set role authenticated;
select admin_verify_rider(:'r1', true);
select tests.fails(format($$select admin_set_user_role(%L, 'customer')$$, :'ad'), 'admin cannot change own role');
reset role;

-- ================= rider r1 goes online, cannot self-verify =================
select set_config('request.jwt.claims', json_build_object('sub', :'r1')::text, false);
set role authenticated;
update rider_profiles set availability = 'available', last_lat = 6.6, last_lng = 3.35 where id = auth.uid();
select tests.ok((select last_location_at is not null from rider_profiles where id = auth.uid()), 'location timestamp is set by the server');
select tests.fails($$update rider_profiles set is_verified = false where id = auth.uid()$$, 'rider cannot change verification');
select tests.ok(tests.count_visible('select 1 from deliveries') = 0, 'rider cannot see unassigned deliveries');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'r2')::text, false);
set role authenticated;
select tests.fails($$update rider_profiles set availability = 'available' where id = auth.uid()$$, 'unverified rider cannot go online');
reset role;

-- ================= owning SME s1 =================
select set_config('request.jwt.claims', json_build_object('sub', :'s1')::text, false);
set role authenticated;
select tests.ok(tests.count_visible('select 1 from deliveries') = 1, 'owning SME sees the request');
select tests.ok(tests.count_visible('select 1 from business_customers') = 1, 'requesting customer is linked to SME contact list');
select tests.fails(format($$select assign_rider(%L, %L)$$, :'d1_id', :'r1'), 'cannot assign before accepting request');
select review_delivery_request(:'d1_id', true);
select tests.fails(format($$select assign_rider(%L, %L)$$, :'d1_id', :'r2'), 'cannot assign unverified rider');
select assign_rider(:'d1_id', :'r1');
select tests.ok((select status from deliveries where id = :'d1_id') = 'assigned', 'delivery offered to rider');
select tests.ok(tests.count_visible(format('select 1 from profiles where id = %L', :'r1')) = 1, 'SME can see assigned rider profile');
select tests.fails(format($$update deliveries set status = 'delivered' where id = %L$$, :'d1_id'), 'SME cannot update delivery row directly');
reset role;

-- ================= rider r2 cannot touch r1 job =================
select set_config('request.jwt.claims', json_build_object('sub', :'r2')::text, false);
set role authenticated;
select tests.fails(format($$select respond_to_job(%L, true)$$, :'d1_id'), 'other rider cannot accept job');
reset role;

-- ================= rider r1 workflow =================
select set_config('request.jwt.claims', json_build_object('sub', :'r1')::text, false);
set role authenticated;
select tests.fails(format($$select advance_delivery(%L, 'picked_up')$$, :'d1_id'), 'cannot pick up before accepting');
select respond_to_job(:'d1_id', true);
select tests.fails(format($$select advance_delivery(%L, 'arrived')$$, :'d1_id'), 'cannot skip straight to arrived');
select tests.fails(format($$select advance_delivery(%L, 'delivered')$$, :'d1_id'), 'advance cannot complete');
select advance_delivery(:'d1_id', 'picked_up');
select advance_delivery(:'d1_id', 'in_transit');
select tests.fails(format($$select complete_delivery(%L)$$, :'d1_id'), 'cannot complete before arrived');
insert into storage.objects (bucket_id, name) values ('proofs', :'d1_id' || '/proof.jpg');
select tests.fails(format($$insert into storage.objects (bucket_id, name) values ('proofs', '%s/x.jpg')$$, :'d1_id'::uuid::text || 'x'), 'rider cannot upload proof to arbitrary folder');
select advance_delivery(:'d1_id', 'arrived');
select tests.fails(format($$select complete_delivery(%L, 'someone-else/evil.jpg')$$, :'d1_id'), 'proof path must belong to delivery');
select complete_delivery(:'d1_id', :'d1_id' || '/proof.jpg', 'Handed to reception');
select tests.fails(format($$insert into storage.objects (bucket_id, name) values ('proofs', '%s/late.jpg')$$, :'d1_id'), 'no proof upload after completion');
reset role;

select tests.ok((select count(*) from delivery_status_history where delivery_id = :'d1_id') = 8, 'status history has all 8 steps');
select tests.ok((select delivered_at is not null and picked_up_at is not null from deliveries where id = :'d1_id'), 'timestamps recorded');
select tests.ok((select count(*) from notifications where user_id = :'c1') >= 5, 'customer received notifications');
select tests.fails(format($$update deliveries set status = 'pending' where id = %L$$, :'d1_id'), 'trigger blocks invalid transition even for postgres');

-- ================= customer rates, sees proof, sees rider =================
select set_config('request.jwt.claims', json_build_object('sub', :'c1')::text, false);
set role authenticated;
select rate_delivery(:'d1_id', 5, 'Fast');
select tests.fails(format($$select rate_delivery(%L, 4)$$, :'d1_id'), 'cannot rate twice');
select tests.ok((select completed_deliveries from list_businesses('Demo Foods', null)) = 1, 'directory counts completed deliveries');
select tests.ok((select avg_rating from list_businesses(null, 'food')) = 5.0, 'directory shows average rating');
select tests.ok(tests.count_visible(format('select 1 from profiles where id = %L', :'r1')) = 1, 'customer can see their rider');
select tests.ok(tests.count_visible('select 1 from storage.objects where bucket_id = ''proofs''') = 1, 'customer can see proof of their delivery');
select tests.fails($$update notifications set title = 'hacked'$$, 'cannot edit notification text');
update notifications set read_at = now() where user_id = auth.uid();
select tests.ok(tests.count_visible('select 1 from notifications where read_at is null') = 0, 'customer can mark notifications read');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'c2')::text, false);
set role authenticated;
select tests.ok(tests.count_visible('select 1 from storage.objects where bucket_id = ''proofs''') = 0, 'other customer cannot see proof');
select tests.ok(tests.count_visible('select 1 from notifications') = 0, 'other customer sees no foreign notifications');
reset role;

-- ================= cancellation rules =================
select set_config('request.jwt.claims', json_build_object('sub', :'s1')::text, false);
set role authenticated;
insert into business_customers (business_id, full_name, phone, address)
  values ((select id from businesses where owner_id = auth.uid()), 'Walk-in Customer', '+2348000000009', 'Lekki Phase 1, Lagos');
select * from create_business_delivery((select id from business_customers where full_name = 'Walk-in Customer'),
  '12 Allen Avenue, Ikeja', 'Lekki Phase 1, Lagos', 'Parcel') \gset d2_
select tests.ok(:'d2_status' = 'pending', 'SME-created delivery goes straight to dispatch queue');
select assign_rider(:'d2_id', :'r1');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'r1')::text, false);
set role authenticated;
select respond_to_job(:'d2_id', true);
select advance_delivery(:'d2_id', 'picked_up');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'s1')::text, false);
set role authenticated;
select tests.fails(format($$select cancel_delivery(%L, 'changed mind')$$, :'d2_id'), 'SME cannot cancel after pickup');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'ad')::text, false);
set role authenticated;
select cancel_delivery(:'d2_id', 'Admin intervention');
select tests.ok(tests.count_visible('select 1 from deliveries') = 2, 'admin sees all deliveries');
select admin_set_user_active(:'c2', false);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'c2')::text, false);
set role authenticated;
select tests.fails($$select create_delivery_request((select id from businesses limit 1), 'Allen Avenue, Ikeja', 'Victoria Island', 'Parcel', null, '+2348000000002')$$, 'suspended user cannot create deliveries');
reset role;

-- ================= anonymous visitor =================
select set_config('request.jwt.claims', '', false);
set role anon;
insert into contact_messages (full_name, email, subject, message) values ('Visitor', 'v@example.com', 'general', 'Hello there, testing.');
insert into newsletter_subscribers (email) values ('news@example.com');
select tests.fails($$select * from contact_messages$$, 'anon cannot read contact messages');
select tests.fails($$select * from profiles$$, 'anon cannot read profiles');
select tests.fails($$select * from deliveries$$, 'anon cannot read deliveries');
select tests.fails($$insert into contact_messages (full_name, email, subject, message, status) values ('V', 'v@example.com', 'general', 'Hello there, testing.', 'resolved')$$, 'anon cannot set message status');
reset role;

select 'ALL DATABASE TESTS PASSED' as result;
