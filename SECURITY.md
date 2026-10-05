# Security — DeliverSME Lagos

This document has three parts: what is enforced (and where), what is not, and what you must configure yourself. The rule throughout is **the browser is untrusted**. Every permission is enforced in Postgres. Hiding a button in the UI is only a convenience, never a control.

## 1. Implemented protections

### Authentication
- **Supabase Auth.** Email and password with a 6-digit email confirmation code. Password reset by email link. Optional Google and Microsoft sign-in.
- **Password rules (client side):** at least 8 characters with a letter, a number and a symbol. Also set the same minimum on the server under Supabase → Authentication → Providers → Email → *Password requirements* (see §3).
- **Account types at sign-up.** Only `customer`, `sme_owner` or `rider` can be chosen. The sign-up trigger `app.handle_new_user` ignores any other value, including `admin`, and makes the user a customer. This is tested.
- **The first admin** can only be created from the SQL Editor (`supabase/bootstrap_admin.sql`). After that, only admins can change roles, and an admin cannot change their own role or suspend themselves.

### Authorisation (database)
- **Grants.** Everything is first revoked from `anon` and `authenticated`. Then only the specific columns clients need are granted back.
  - Example: on `profiles`, users may update `full_name`, `phone`, `avatar_url` and `notification_prefs`, never `role` or `is_active`.
- **RLS on every table** (21 table policies plus storage policies):
  - **Profiles:** you see your own, plus people you share a delivery or business relationship with (`app.can_view_profile`). Admins see everyone.
  - **Deliveries:** read-only for clients. A delivery is visible to its customer, its business owner, its assigned rider and admins (`app.can_view_delivery`).
  - **Businesses:** active ones are visible to signed-in users. Only the owner can edit a limited set of fields. Verification and suspension are admin-only.
  - **Saved business customers:** only the owning business can read or write them.
  - **Notifications:** users see, mark read and delete only their own.
  - **Contact messages and newsletter:** the public can insert. Only admins can read. Only admins can change message status.
- **Column guard triggers.** Even with an update grant, direct client writes cannot change protected columns such as `role`, `is_active`, `is_verified` or `owner_id`. `last_location_at` is always set by the server, and an unverified rider cannot set themselves online.
- **Every delivery write goes through an RPC** (`SECURITY DEFINER`, fixed `search_path`). Each RPC:
  - works out the caller from `auth.uid()`, never from arguments;
  - checks the caller's role and that the account is active (`app.require_role`);
  - checks ownership, e.g. SMEs only touch their own business's deliveries and riders only jobs offered to them;
  - checks the current status;
  - cleans and length-limits text (`app.clean`).
- **State machine in the database.** The trigger `enforce_delivery_transition` rejects any status change not listed in `app.valid_transition`. This applies to the service role as well. The same trigger makes the delivery code, business, customer and creator unchangeable.
- **Riders:**
  - Must be verified by an admin before they can go online or be offered a job.
  - A rider can only move their own job forward one step at a time.
  - Completion requires the `arrived` status.
  - The proof photo path must sit inside that delivery's folder.
- **Suspension.** `app.require_role` and the RLS write policies check `is_active`, so a suspended user cannot perform any write or RPC immediately. The app also signs out an inactive user when their profile loads.
- **Ratings.** Only the delivery's customer can rate, only after delivery, and only once (primary key on `delivery_id`).

### Storage
- **`avatars`:** public read. Users write only inside their own `uid/` folder. Max 2 MB; JPEG, PNG or WebP only.
- **`proofs`:** private.
  - Upload: only the assigned rider, only while the job is `in_transit` or `arrived`, only inside `delivery_id/`.
  - Read: only the delivery's parties and admins, via one-hour signed URLs.
  - Max 5 MB; image types only.

### Realtime
- Only `notifications`, `deliveries`, `delivery_status_history` and `rider_profiles` are published. Supabase Realtime applies RLS, so each user only receives changes to rows they can already read.

### Frontend
- **No service key in the browser.** Only `VITE_SUPABASE_URL` and the anon key are bundled.
- **No sensitive data in localStorage** apart from Supabase's own session token.
- **Search input** is stripped of PostgREST filter characters (`, ( ) % _ *`) before building queries, so it cannot change the filter.
- **Error messages** shown to users are filtered, so database or SQL details are never displayed (`src/lib/errors.js`).
- **Links:** external links use `rel="noopener noreferrer"`. `tel:` and `mailto:` values are built from stored data.
- **No `dangerouslySetInnerHTML` anywhere.** React escapes all user content.

## 2. Known limitations / accepted risks
- **No server-side rate limiting** on the contact form, newsletter or sign-up beyond Supabase Auth's built-in limits. The contact and newsletter endpoints can be spammed. Mitigate with Supabase's CAPTCHA option (hCaptcha/Turnstile) or an Edge Function with a rate limiter.
- **Reads after suspension.** A suspended user's current access token can still *read* what they were already allowed to see until it expires (default 1 hour). Shorten the JWT lifetime if that matters.
- **Rider directory.** Riders' names and phone numbers are visible to every SME owner, which is necessary for offering them jobs. Emails and phone numbers of the people on a delivery are visible to the other parties on that delivery.
- **Rider location.** Locations are stored as a single "last known position". They are visible to parties on the rider's active deliveries and to admins. No location history is kept.
- **Third-party services.** Nominatim (address lookup) and OpenStreetMap tile requests go straight from the browser to those services, so they see the user's IP address and the coordinates being looked up. Mention this in your privacy policy, or use a proxy or paid provider.
- **No Content-Security-Policy or security headers** are shipped. Set them at your host (see §3).
- **Service-role seed script.** Anyone with the key has full database access. Treat it like a root password.
- **No penetration test or live-project security review has been done.** The tests in `docs/TEST_REPORT.md` ran on a local Postgres with a stand-in for Supabase's auth and storage.

## 3. Configuration you must do
1. **Keys.** Keep `service_role` out of `.env.local`, the repo and CI logs. Rotate it if it ever leaks.
2. **Supabase Auth:**
   - Enable *Confirm email*.
   - Set minimum password length to 8 and require letters, digits and symbols.
   - Set Site URL and Redirect URLs to your real domains only (no wildcards on other hosts).
   - Configure custom SMTP.
3. **OAuth.** Restrict redirect URIs at Google and Azure to your domain's `/login`.
4. **Hosting headers.** Add at least:
   - `Strict-Transport-Security`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: geolocation=(self), camera=(self)`
   - A CSP that allows `'self'`, your Supabase URL (`https` and `wss`), `*.tile.openstreetmap.org` and `nominatim.openstreetmap.org`.
5. **Bot protection.** Enable CAPTCHA protection in Supabase Auth before public launch.
6. **Admin accounts.** Create the first admin only via `bootstrap_admin.sql`, using an email with a strong password. Enable MFA for admin accounts if you add it later.
7. **Keep the database tests passing.** Re-run `npm run test:db` after changing any migration.

## Reporting
For this academic proof of concept, report issues to the project author.
