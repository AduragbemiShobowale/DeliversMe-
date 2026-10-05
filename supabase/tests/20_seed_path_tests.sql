-- Verifies the service-role path used by scripts/seed-demo.mjs works with the triggers:
-- insert at 'pending', walk every status, backdate timestamps, add a rating.
\set ON_ERROR_STOP on
\set ss '99999999-0000-0000-0000-000000000001'
\set sr '99999999-0000-0000-0000-000000000002'
\set sc '99999999-0000-0000-0000-000000000003'
insert into auth.users (id, email, raw_user_meta_data) values
 (:'ss', 'demo.sme@example.com', '{"full_name":"Seed Owner","account_type":"sme_owner","business_name":"Seed Biz","business_category":"logistics"}'),
 (:'sr', 'demo.rider@example.com', '{"full_name":"Seed Rider","account_type":"rider","vehicle_type":"motorcycle"}'),
 (:'sc', 'demo.customer@example.com', '{"full_name":"Seed Customer","account_type":"customer"}');

set role service_role;
update rider_profiles set is_verified = true, availability = 'available', plate_number = 'LAG 1' where id = :'sr';
insert into deliveries (business_id, customer_user_id, created_by, status, pickup_address, dropoff_address, item_description, recipient_name, recipient_phone)
select b.id, :'sc', :'sc', 'requested', '12 Allen Avenue, Ikeja', 'Victoria Island, Lagos', 'Seed walk item', 'Seed Customer', '+2348000000009'
  from businesses b where owner_id = :'ss';
reset role;
create temp table seed_d as select id from deliveries where item_description = 'Seed walk item';
grant select on seed_d to service_role;
set role service_role;
update deliveries set status = 'pending' where id = (select id from seed_d);
update deliveries set status = 'assigned', rider_id = :'sr' where id = (select id from seed_d);
update deliveries set status = 'accepted' where id = (select id from seed_d);
update deliveries set status = 'picked_up' where id = (select id from seed_d);
update deliveries set status = 'in_transit' where id = (select id from seed_d);
update deliveries set status = 'arrived' where id = (select id from seed_d);
update deliveries set status = 'delivered' where id = (select id from seed_d);
update deliveries set created_at = now() - interval '3 days', accepted_at = now() - interval '3 days', delivered_at = now() - interval '3 days' + interval '2 hours' where id = (select id from seed_d);
update delivery_status_history set created_at = now() - interval '3 days' where delivery_id = (select id from seed_d);
insert into delivery_ratings (delivery_id, business_id, customer_id, rating) select d.id, d.business_id, :'sc', 5 from deliveries d where d.id = (select id from seed_d);
reset role;

select tests.ok((select status from deliveries where id = (select id from seed_d)) = 'delivered', 'seed path: service role can walk a delivery to delivered');
select tests.ok((select count(*) from delivery_status_history where delivery_id = (select id from seed_d)) = 8, 'seed path: creation + 7 status steps recorded in history');
select tests.ok((select count(*) from notifications where delivery_id = (select id from seed_d)) > 0, 'seed path: notifications generated');
select tests.ok((select delivered_at - accepted_at from deliveries where id = (select id from seed_d)) = interval '2 hours', 'seed path: timestamps can be backdated');
set role service_role;
select tests.fails($$update deliveries set status = 'pending' where id = (select id from seed_d)$$, 'seed path: transitions still enforced for service role');
reset role;
select 'SEED PATH TESTS PASSED' as result;
