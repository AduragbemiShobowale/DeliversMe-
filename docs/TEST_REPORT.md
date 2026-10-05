# Test report — DeliverSME Lagos

**Environment:** Ubuntu 24, Node 22.22.2, npm 10.9.7, PostgreSQL 16. **Date:** 30 September 2026.
Every result below comes from a real run in this environment. Nothing here is estimated.

## 1. Summary

| Check | Command | Result |
|---|---|---|
| Install | `npm install` | OK |
| Lint | `npm run lint` | **0 errors, 0 warnings** |
| Unit / component tests | `npm test` | **81 passed / 81** (8 files) |
| Production build | `npm run build` | **OK** (Vite 8) |
| Database security + workflow tests | `npm run test:db` | **66 assertions passed** (61 security/workflow + 5 seed-path) |
| Dependency audit | `npm audit` | **0 vulnerabilities** |

## 2. What was **not** tested

The app has **not been run against a live Supabase project**. That means none of the following have been exercised for real:

- Supabase Auth: email codes, password reset, OAuth.
- PostgREST calls from the browser.
- Realtime subscriptions.
- Storage uploads and signed URLs.
- `scripts/seed-demo.mjs` over the network. Its SQL path is covered by the seed-path tests.

Also:

- **Stand-in only for Supabase internals.** The database tests use a stand-in (`supabase/tests/00_supabase_stub.sql`) for `auth.uid()`, the `anon`/`authenticated`/`service_role` roles and the `storage` schema. They imitate how PostgREST runs each request (`SET ROLE authenticated` plus JWT claims), but they are not the real platform.
- **No browser testing.** No end-to-end browser tests (Playwright/Cypress) were run, and there were no manual checks on real phones.
- **No accessibility audit.** There were no screen-reader or automated accessibility audits (axe, Lighthouse).
- **Maps and GPS are mocked in tests.** Maps, geolocation and Nominatim are mocked or not exercised.

## 3. Frontend tests (`tests/`)

| File | Covers |
|---|---|
| `status.test.js` | The JS state machine is **parsed against `app.valid_transition()` in the SQL** and must match exactly. Also: no exits from terminal states, rider "next action", role cancel rules, timeline step states. |
| `cancel-rules.test.js` | UI cancel rules are consistent with the `cancel_delivery` RPC source. |
| `validation.test.js` | Registration (admin/clearing-agent cannot be chosen, SME needs a business name, password strength, terms), password confirmation, phone normalisation, delivery and customer schemas, RPC argument mapping. |
| `utils.test.js` | Distance, ETA, search sanitising (PostgREST filter injection), tel/maps links, names, relative time, error mapping (no SQL details leaked), analytics maths. |
| `guards.test.jsx` | Route guards: signed-out → login; wrong role → own dashboard; not onboarded → onboarding; missing profile → recoverable error; signed-in users kept off login. |
| `components.test.jsx` | DataTable empty/error/retry/row click; ConfirmDialog passes a trimmed reason and stays open on failure; status labels; pagination. |
| `public-pages.test.jsx` | Every public page, each `/for/:role` page, the legal pages and all auth pages render. The register form offers only the three allowed account types. |
| `dashboard-pages.test.jsx` | Every customer, SME, rider and admin page mounts and renders mocked data or its empty state. Also checks: assign-rider flow, request form, rider job page (offered → accept/decline; arrived → complete form with photo), delivery details actions by role, notifications, all settings tabs. |

**Limitation:** in `dashboard-pages.test.jsx` the service modules are mocked. These tests show the pages render and wire up correctly. They do not show that the real queries work, and they do not click through full workflows.

## 4. Database tests (`supabase/tests/`)

Every migration applies cleanly to an empty database. The individual assertions follow.

**`10_security_and_workflow_tests.sql`**

- self-assigned admin at sign-up is downgraded to customer
- SME sign-up creates a business
- rider sign-up creates rider profile
- customer cannot promote self to admin
- customer cannot change own active flag
- customer can edit own name
- customer cannot insert deliveries directly
- customer cannot list riders
- customer cannot read contact messages
- customer sees only own profile before any delivery
- customer request starts as requested
- delivery gets human code
- other customer cannot see c1 delivery
- other customer cannot see history
- other customer cannot cancel c1 delivery
- other customer cannot read c1 profile
- other SME cannot see delivery
- other SME cannot review delivery
- SME cannot self-verify business
- SME cannot add customers to another business
- admin cannot change own role
- location timestamp is set by the server
- rider cannot change verification
- rider cannot see unassigned deliveries
- unverified rider cannot go online
- owning SME sees the request
- requesting customer is linked to SME contact list
- cannot assign before accepting request
- cannot assign unverified rider
- delivery offered to rider
- SME can see assigned rider profile
- SME cannot update delivery row directly
- other rider cannot accept job
- cannot pick up before accepting
- cannot skip straight to arrived
- advance cannot complete
- cannot complete before arrived
- rider cannot upload proof to arbitrary folder
- proof path must belong to delivery
- no proof upload after completion
- status history has all 8 steps
- timestamps recorded
- customer received notifications
- trigger blocks invalid transition even for postgres
- cannot rate twice
- directory counts completed deliveries
- directory shows average rating
- customer can see their rider
- customer can see proof of their delivery
- cannot edit notification text
- customer can mark notifications read
- other customer cannot see proof
- other customer sees no foreign notifications
- SME-created delivery goes straight to dispatch queue
- SME cannot cancel after pickup
- admin sees all deliveries
- suspended user cannot create deliveries
- anon cannot read contact messages
- anon cannot read profiles
- anon cannot read deliveries
- anon cannot set message status

**`20_seed_path_tests.sql`**

- seed path: service role can walk a delivery to delivered
- seed path: creation + 7 status steps recorded in history
- seed path: notifications generated
- seed path: timestamps can be backdated
- seed path: transitions still enforced for service role

## 5. Problems found and fixed during testing

1. **The demo seed script could not have worked on Supabase.** The status-transition trigger calls functions in the `app` schema, but only `anon` and `authenticated` had access to that schema, so every status update run as `service_role` would have failed. Fixed by granting `service_role` access; the seed-path tests confirm it.
2. **Unverified riders could set themselves online** by writing to the database directly. The UI blocked it, but the database did not. Job assignment still required verification, so this was not exploitable, but the database now blocks it too (tested).
3. **The Terms and Privacy links on the register page** opened a new tab without `rel="noopener noreferrer"`. Fixed.
4. **Dependencies:**
   - React Router 6 had a moderate open-redirect advisory, so it was upgraded to 7.
   - Vite, esbuild and Vitest had dev-server advisories (one high, one critical), so they were upgraded to Vite 8 and Vitest 5.
   - Vite 8 rejected the old `manualChunks` setting. Instead of rewriting it, I removed it. Without it, the charts library now loads only on the Analytics page and Leaflet only on pages with a map.
5. **The "no business linked" screen** pointed to a settings tab that cannot create a business. It now points to Contact support.

## 6. Manual checklist after connecting Supabase

Run these checks in order.

1. Sign up as a customer. Receive the 6-digit code and verify. You should land on `/customer`.
2. Sign up as an SME owner (business name required). Sign up as a rider.
3. Run `bootstrap_admin.sql` for a fourth account. As admin, verify the rider.
4. As the rider, go online and allow location access.
5. As the customer, go to Find a Business → request a delivery. The SME should get a notification in real time.
6. As the SME:
   - Accept the request.
   - Assign it to the rider.
   - Confirm the rider receives a job offer.
7. As the rider:
   - Accept the job, then go through pickup → start trip → arrived.
   - Complete it with a photo.
   - The customer map should show the rider moving.
8. As the customer, rate the delivery. As the SME, confirm the proof photo is visible.
9. As admin, suspend the customer. The customer is signed out and their actions are blocked.
10. Send the contact form while signed out. As admin, the message appears in Messages.
