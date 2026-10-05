#!/usr/bin/env node
/**
 * DEMO DATA ONLY — never run against a production project.
 *
 * Creates demo accounts (all @example.com, password from DEMO_PASSWORD), businesses, riders,
 * saved customers and deliveries at every stage, walking each delivery through the real
 * status trigger so history and notifications are generated exactly as in the app.
 *
 * Usage:
 *   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... DEMO_PASSWORD='Demo!2345' node scripts/seed-demo.mjs
 *   ... node scripts/seed-demo.mjs --reset     # delete previous demo data first
 *
 * The service-role key bypasses RLS. Keep it out of the frontend, .env files served by Vite and git.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !key || !password) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD (8+ chars with a letter, number and symbol).');
  process.exit(1);
}
if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
  console.error('DEMO_PASSWORD must be 8+ characters with a letter, a number and a special character.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const DOMAIN = '@example.com';

const USERS = [
  { email: `demo.customer${DOMAIN}`, account_type: 'customer', full_name: 'David Okafor (Demo)', phone: '+2348021234567' },
  { email: `demo.customer2${DOMAIN}`, account_type: 'customer', full_name: 'Ada Nwosu (Demo)', phone: '+2348031112222' },
  { email: `demo.sme${DOMAIN}`, account_type: 'sme_owner', full_name: 'Tunde Adebayo (Demo)', phone: '+2348123456789', business_name: 'Bisedge Ltd (Demo)', business_category: 'logistics' },
  { email: `demo.pharmacy${DOMAIN}`, account_type: 'sme_owner', full_name: 'Kemi Bello (Demo)', phone: '+2348055556666', business_name: 'MediQuick Pharmacy (Demo)', business_category: 'pharmacy' },
  { email: `demo.rider${DOMAIN}`, account_type: 'rider', full_name: 'Chinedu Okafor (Demo)', phone: '+2348101234567', vehicle_type: 'motorcycle' },
  { email: `demo.rider2${DOMAIN}`, account_type: 'rider', full_name: 'Emeka Daniels (Demo)', phone: '+2348036004567', vehicle_type: 'motorcycle' },
  { email: `demo.rider3${DOMAIN}`, account_type: 'rider', full_name: 'Ruth James (Demo, unverified)', phone: '+2348098887777', vehicle_type: 'bicycle' },
];

const PLACES = {
  allen: ['12 Allen Avenue, Ikeja, Lagos', 6.6018, 3.3515],
  admiralty: ['3 Admiralty Way, Lekki Phase 1, Lagos', 6.4474, 3.4723],
  vi: ['Adeola Odeku Street, Victoria Island, Lagos', 6.4281, 3.4219],
  yaba: ['Herbert Macaulay Way, Yaba, Lagos', 6.5095, 3.3711],
  surulere: ['Adeniran Ogunsanya Street, Surulere, Lagos', 6.4969, 3.3553],
  gbagada: ['Gbagada Phase 2, Lagos', 6.5550, 3.3890],
};

const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data; };

async function findDemoUsers() {
  const found = [];
  for (let page = 1; page < 20; page += 1) {
    const { users } = must(await db.auth.admin.listUsers({ page, perPage: 200 }), 'list users');
    found.push(...users.filter((u) => u.email?.startsWith('demo.') && u.email.endsWith(DOMAIN)));
    if (users.length < 200) break;
  }
  return found;
}

async function reset() {
  const users = await findDemoUsers();
  if (!users.length) { console.log('No demo users to remove.'); return; }
  const ids = users.map((u) => u.id);
  const businesses = must(await db.from('businesses').select('id').in('owner_id', ids), 'find demo businesses');
  if (businesses.length) must(await db.from('deliveries').delete().in('business_id', businesses.map((b) => b.id)), 'delete demo deliveries');
  for (const u of users) must(await db.auth.admin.deleteUser(u.id), `delete ${u.email}`);
  console.log(`Removed ${users.length} demo users and their data.`);
}

async function walk(id, statuses, riderId) {
  for (const status of statuses) {
    const patch = { status };
    if (status === 'assigned') patch.rider_id = riderId;
    must(await db.from('deliveries').update(patch).eq('id', id), `move ${id} to ${status}`);
  }
}

async function backdate(id, daysAgo, hoursToDeliver = 1.5) {
  const created = new Date(Date.now() - daysAgo * 86400000);
  const plus = (h) => new Date(created.getTime() + h * 3600000).toISOString();
  const d = must(await db.from('deliveries').select('status').eq('id', id).single(), 'read delivery');
  const patch = { created_at: created.toISOString(), requested_at: created.toISOString() };
  if (['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'].includes(d.status)) patch.assigned_at = plus(0.2);
  if (['accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'].includes(d.status)) patch.accepted_at = plus(0.3);
  if (['picked_up', 'in_transit', 'arrived', 'delivered'].includes(d.status)) patch.picked_up_at = plus(0.6);
  if (d.status === 'delivered') patch.delivered_at = plus(0.3 + hoursToDeliver);
  if (['cancelled', 'rejected'].includes(d.status)) patch.cancelled_at = plus(0.5);
  must(await db.from('deliveries').update(patch).eq('id', id), 'backdate');
  // Spread history rows across the delivery's lifetime so timelines read naturally.
  const history = must(await db.from('delivery_status_history').select('id').eq('delivery_id', id).order('id'), 'read history');
  const span = d.status === 'delivered' ? 0.3 + hoursToDeliver : 0.6;
  for (const [i, h] of history.entries()) {
    must(await db.from('delivery_status_history').update({ created_at: plus((span * (i + 1)) / history.length) }).eq('id', h.id), 'backdate history');
  }
}

async function main() {
  if (process.argv.includes('--reset')) await reset();
  else if ((await findDemoUsers()).length) {
    console.error('Demo users already exist. Re-run with --reset to replace them.');
    process.exit(1);
  }

  const ids = {};
  for (const u of USERS) {
    const { email, ...meta } = u;
    const { user } = must(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta }), `create ${email}`);
    ids[email.split('@')[0].replace('demo.', '')] = user.id;
  }
  console.log('Created demo accounts.');

  const biz = must(await db.from('businesses').select('id, owner_id').in('owner_id', [ids.sme, ids.pharmacy]), 'load businesses');
  const bisedge = biz.find((b) => b.owner_id === ids.sme).id;
  const pharmacy = biz.find((b) => b.owner_id === ids.pharmacy).id;
  must(await db.from('businesses').update({ is_verified: true, tagline: 'Logistics & Supply Chain', address: PLACES.allen[0] }).eq('id', bisedge), 'update business');
  must(await db.from('businesses').update({ is_verified: true, tagline: 'Pharmaceuticals', address: PLACES.yaba[0] }).eq('id', pharmacy), 'update business');

  must(await db.from('rider_profiles').update({ is_verified: true, availability: 'available', plate_number: 'LAG 123 AB', last_lat: 6.59, last_lng: 3.36, last_location_at: new Date().toISOString() }).eq('id', ids.rider), 'rider');
  must(await db.from('rider_profiles').update({ is_verified: true, availability: 'available', plate_number: 'KJA 456 CD', last_lat: 6.50, last_lng: 3.37, last_location_at: new Date().toISOString() }).eq('id', ids.rider2), 'rider2');

  const customers = must(await db.from('business_customers').insert([
    { business_id: bisedge, full_name: 'John Doe', phone: '+2348123456789', address: PLACES.admiralty[0] },
    { business_id: bisedge, full_name: 'Ada Nwosu', phone: '+2348031112222', address: PLACES.vi[0], user_id: ids.customer2 },
    { business_id: bisedge, full_name: 'Kola Adeyemi', phone: '+2348063334444', address: PLACES.yaba[0] },
    { business_id: bisedge, full_name: 'Mary Johnson', phone: '+2348175556666', address: PLACES.surulere[0] },
  ]).select(), 'customers');

  const mk = (business_id, from, to, extra) => ({
    business_id, pickup_address: from[0], pickup_lat: from[1], pickup_lng: from[2],
    dropoff_address: to[0], dropoff_lat: to[1], dropoff_lng: to[2], item_description: 'Office documents', package_size: 'small', ...extra,
  });
  const P = PLACES;
  const plan = [
    // [row, statuses to walk, rider, daysAgo, hoursToDeliver]
    [mk(bisedge, P.allen, P.vi, { customer_user_id: ids.customer, created_by: ids.customer, status: 'requested', recipient_name: 'David Okafor', recipient_phone: '+2348021234567' }), [], null, 0],
    [mk(bisedge, P.allen, P.surulere, { business_customer_id: customers[3].id, created_by: ids.sme, status: 'pending', recipient_name: 'Mary Johnson', recipient_phone: '+2348175556666', priority: 'express' }), [], null, 0],
    [mk(bisedge, P.allen, P.yaba, { business_customer_id: customers[2].id, created_by: ids.sme, status: 'pending', recipient_name: 'Kola Adeyemi', recipient_phone: '+2348063334444' }), ['assigned'], ids.rider, 0],
    [mk(bisedge, P.allen, P.vi, { customer_user_id: ids.customer, created_by: ids.customer, status: 'requested', recipient_name: 'David Okafor', recipient_phone: '+2348021234567', item_description: 'Parcel' }), ['pending', 'assigned', 'accepted', 'picked_up', 'in_transit'], ids.rider2, 0],
    [mk(bisedge, P.allen, P.admiralty, { business_customer_id: customers[0].id, created_by: ids.sme, status: 'pending', recipient_name: 'John Doe', recipient_phone: '+2348123456789' }), ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'], ids.rider, 1, 1.2],
    [mk(bisedge, P.allen, P.vi, { customer_user_id: ids.customer, created_by: ids.customer, status: 'requested', recipient_name: 'David Okafor', recipient_phone: '+2348021234567' }), ['pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'], ids.rider, 3, 2.1],
    [mk(bisedge, P.allen, P.gbagada, { business_customer_id: customers[1].id, customer_user_id: ids.customer2, created_by: ids.sme, status: 'pending', recipient_name: 'Ada Nwosu', recipient_phone: '+2348031112222' }), ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'], ids.rider2, 5, 1.8],
    [mk(bisedge, P.allen, P.surulere, { business_customer_id: customers[3].id, created_by: ids.sme, status: 'pending', recipient_name: 'Mary Johnson', recipient_phone: '+2348175556666', cancel_reason: 'Customer no longer needed it' }), ['cancelled'], null, 6],
    [mk(pharmacy, P.yaba, P.vi, { customer_user_id: ids.customer, created_by: ids.customer, status: 'requested', recipient_name: 'David Okafor', recipient_phone: '+2348021234567', item_description: 'Prescription medicine' }), ['pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'], ids.rider2, 2, 0.9],
    [mk(pharmacy, P.yaba, P.admiralty, { customer_user_id: ids.customer, created_by: ids.customer, status: 'requested', recipient_name: 'David Okafor', recipient_phone: '+2348021234567', item_description: 'Vitamins', cancel_reason: 'Outside our delivery area' }), ['rejected'], null, 4],
  ];

  let delivered = [];
  for (const [row, steps, rider, daysAgo, hours] of plan) {
    const d = must(await db.from('deliveries').insert(row).select('id').single(), 'insert delivery');
    await walk(d.id, steps, rider);
    await backdate(d.id, daysAgo, hours);
    if (steps.at(-1) === 'delivered' && row.customer_user_id === ids.customer) delivered.push({ id: d.id, business_id: row.business_id });
  }
  delivered = delivered.map((d, i) => ({ delivery_id: d.id, business_id: d.business_id, customer_id: ids.customer, rating: [5, 4][i % 2], comment: 'Demo rating' }));
  if (delivered.length) must(await db.from('delivery_ratings').insert(delivered), 'ratings');

  // Rider 3 is left unverified so the admin verification queue has an entry.
  console.log(`Seeded ${plan.length} demo deliveries.`);
  console.log('\nDemo logins (password = DEMO_PASSWORD):');
  USERS.forEach((u) => console.log(`  ${u.account_type.padEnd(10)} ${u.email}`));
  console.log('\nAdmin: sign up normally, then run supabase/bootstrap_admin.sql with your email.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
