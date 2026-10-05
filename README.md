# DeliverSME Lagos

A last-mile delivery management platform for Lagos SMEs. It is a proof of concept built to support the dissertation *"Developing an Integrated Last-Mile Delivery Management Framework for Improving Logistics Performance among Small and Medium-Sized Enterprises in Lagos State, Nigeria"*.

---

## 1. Overview

There are four roles. Each has its own dashboard, and the database enforces each role's permissions.

| Role | What they do |
|---|---|
| **Customer** | Finds a registered business, requests a delivery, tracks it live on a map, rates it when it is complete. |
| **SME owner** | Reviews customer requests, creates deliveries for saved customers, offers jobs to verified riders, follows progress, and views proof of delivery and analytics. |
| **Rider** | Goes online and shares location while online. Accepts or declines offered jobs, then moves each job through *picked up → in transit → arrived → delivered*, with an optional photo as proof. |
| **Admin** | Manages user roles and suspensions, verifies riders and businesses, oversees all deliveries, and handles contact-form messages. |

**Delivery lifecycle**

The database enforces this state machine. The frontend holds a copy, and a test fails if the two drift apart.

```
requested ──accept──▶ pending ──offer to rider──▶ assigned ──rider accepts──▶ accepted ─▶ picked_up ─▶ in_transit ─▶ arrived ─▶ delivered
    │                    ▲                            │
    └─decline─▶ rejected └──────rider declines────────┘         (cancel allowed from non-final states, by role)
```

- A customer can cancel a delivery up to the point a rider accepts it.
- An SME owner can cancel up to pickup.
- An admin can cancel at any non-final state.

## 2. Tech stack

- **Frontend:**
  - React 18, Vite 8 and JavaScript (no TypeScript), with React Router 7 (library mode) and Tailwind CSS 3.
  - Lucide icons, React Hook Form with Zod for forms, react-hot-toast for notifications, and Recharts (Analytics page only).
  - Leaflet with OpenStreetMap tiles for maps.
- **Backend:** Supabase.
  - Auth: email/password, 6-digit email code, optional Google and Microsoft sign-in.
  - Postgres with Row Level Security (RLS).
  - Storage for avatars and proof-of-delivery photos.
  - Realtime for live status updates, rider position and notifications.
- **Privileged operations:** Postgres `SECURITY DEFINER` functions (RPCs). Each one checks `auth.uid()` and the caller's role. There are no Edge Functions and no service key in the browser.
- **Tests:**
  - Vitest 5 with Testing Library for the frontend.
  - Plain SQL assertion scripts for the database, run against a local PostgreSQL 16 with a minimal stand-in for Supabase's `auth`/`storage`.

## 3. Prerequisites

- Node.js 20.19+ or 22.12+ (tested with Node 22.22 and npm 10.9). Vite 8 and React Router 7 need a recent Node.
- A Supabase project. The free tier is enough.
- *Optional,* to run the database tests locally: PostgreSQL 15 or 16 with `psql`, `createdb` and `dropdb` on your PATH.

## 4. Install

```bash
unzip deliversme-lagos.zip && cd deliversme-lagos
npm install
```

## 5. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | The **anon / publishable** key. Never the `service_role` key. |
| `VITE_SITE_URL` | recommended | The app's public URL. Used for email links and OAuth redirects. |
| `VITE_SUPPORT_PHONE`, `VITE_SUPPORT_EMAIL` | optional | Shown on the Contact and Help pages. |
| `VITE_SOCIAL_*` | optional | Social icons appear only when set. |

If the URL or key is missing, the app shows a setup screen instead of failing silently.

`SUPABASE_SERVICE_ROLE_KEY` is used **only** by `scripts/seed-demo.mjs`. Pass it on the command line. Never put it in `.env.local`, because Vite exposes every `VITE_*` variable, and anything left in a shared file tends to get committed.

## 6. Supabase setup

1. **Create a project** at <https://supabase.com>. Choose a region close to Lagos, such as `eu-west`.
2. **Set URLs.** Under **Authentication → URL Configuration**:
   - Site URL: `http://localhost:5173`. Change it to your production URL later.
   - Redirect URLs: add `http://localhost:5173/**` and `https://YOUR-DOMAIN/**`.
3. **Make the email template send a 6-digit code.** Under **Authentication → Email Templates → Confirm signup**, the body must contain `{{ .Token }}`. The verify screen asks for this code. Example:
   ```html
   <h2>Your DeliverSME code</h2><p>Enter this code to verify your email: <strong>{{ .Token }}</strong></p>
   ```
   Keep **Confirm email** enabled under Authentication → Providers → Email.
4. **Set up email sending (SMTP)** under **Authentication → SMTP Settings**, using Resend, Postmark, SES or similar. Supabase's built-in sender only delivers to your own team members and is heavily rate-limited, so real users will not get codes without this.
5. **Google / Microsoft sign-in (optional)** under **Authentication → Providers**. Enable Google and/or Azure and add the client ID and secret from each provider. Until you do, those buttons show a clear "not enabled" message. Users who sign up this way land on `/onboarding` to choose an account type.
6. **Storage and Realtime** are created by the migrations. You don't need to do anything in the dashboard.

## 7. Database migrations

Run the files in `supabase/migrations/` **in filename order**. There are two ways.

**Option A — Supabase CLI** (recommended):

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

**Option B — SQL Editor:** paste and run each file in order.

1. `20260929000001_schema.sql` — tables, enums, indexes
2. `20260929000002_functions_triggers.sql` — helpers, sign-up trigger, column guards, status machine, history and notifications
3. `20260929000003_rls.sql` — grants and RLS policies
4. `20260929000004_rpc.sql` — all privileged operations
5. `20260929000005_storage_realtime.sql` — storage buckets and policies, realtime publication

## 8. Seeding demo data (optional, demo only)

This creates accounts named `demo.*@example.com`: 2 customers, 2 SME owners with businesses, and 3 riders. Two riders are verified; one is left unverified so the admin verification queue has something in it. It also creates saved customers and 10 deliveries across every status, with history, notifications and ratings. Each delivery is walked through the real status trigger, so the data looks exactly as the app would produce it.

```bash
SUPABASE_URL=https://YOUR_REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
DEMO_PASSWORD='Choose-a-Demo-Pass1!' \
node scripts/seed-demo.mjs            # add --reset to delete and recreate demo data
```

**Never run this against a production project.**

To remove the demo data later without re-seeding, run `node scripts/seed-demo.mjs --reset`, then stop it after the "Removed…" line.

## 9. Securing the initial admin

No one can become admin from the app. Sign-up metadata cannot choose `admin`, and only an existing admin can change roles.

1. Sign up normally with the admin's email and verify it.
2. Edit the email in `supabase/bootstrap_admin.sql`, then run it in the **SQL Editor**.
3. Sign out and back in. You will land on `/admin`.

Once you have one admin, manage every other role from **Admin → Users**.

## 10. Development server

```bash
npm run dev          # http://localhost:5173
```

## 11. Production build

```bash
npm run build        # output in dist/
npm run preview      # serve the build locally
```

## 12. Tests

```bash
npm run lint
npm test                                   # Vitest: 81 tests
PGUSER=postgres npm run test:db            # needs local PostgreSQL; creates/drops database "deliversme_test"
```

What each suite covers is in `docs/TEST_REPORT.md`.

## 13. Deployment

**Vercel:** import the repo, framework preset *Vite*, and set the `VITE_*` variables. `vercel.json` already rewrites every path to `index.html`, so client-side routes work.

**Netlify:** build command `npm run build`, publish directory `dist`. `public/_redirects` handles SPA routes.

After deploying:

- Set `VITE_SITE_URL` to the live URL.
- Add that URL to Supabase's Site URL and Redirect URLs.
- Add it to your OAuth providers' allowed redirect URIs.

## 14. Known limitations

- **Not tested against a live Supabase project** in the build environment. Migrations, RLS and RPCs were tested on local PostgreSQL 16 with a stand-in for Supabase's `auth`/`storage`. Frontend-to-Supabase calls (Auth, PostgREST, Realtime, Storage) have not been exercised end to end. Run the checklist in `docs/TEST_REPORT.md` after setup.
- **No payments.** None appeared in the design screens.
- **No SMS/phone sign-in.** It needs an SMS provider such as Termii or Twilio.
- **Photo proof only**, no signature capture.
- **No "Clearing Agent" account type.** It appeared on the login screenshot but belongs to a different project (ClearTrack).
- **Maps:**
  - The map uses public OpenStreetMap tiles.
  - "Use my current location" address lookup uses Nominatim, whose usage policy allows at most about 1 request per second with no heavy use. For production, switch to a paid tile and geocoding provider.
  - Distances are straight-line and ETAs are rough estimates.
- **Rider location** is only shared while the rider is online and the app tab is open, updated roughly every 20 seconds. There is no background tracking.
- **Riders are platform-wide.** Any SME owner can see verified riders' names and phone numbers in order to offer them jobs. This is a deliberate privacy tradeoff.
- **No rate limiting on the contact and newsletter forms** at the database level. Add Supabase Edge rate limiting or a CAPTCHA before public launch.
- **Suspension timing:** a suspended user is blocked from every action immediately, but a still-valid session token can keep reading data the user was already allowed to see until it expires (1 hour by default).
- **Some deletions are blocked:**
  - Deleting an SME owner's account fails if their business has deliveries, because delivery records are kept.
  - Deleting a rider in the middle of an active job fails.
  - Suspend these accounts instead.
- **Placeholder images.** The images in `public/images/` were cropped from the design screenshots. Replace them with the original photos or licensed images.
- **Analytics** reads up to 5,000 deliveries per selected date range, in the browser.

## Dependency audit

`npm audit` reported **0 vulnerabilities** in both runtime and development dependencies on 30 Sep 2026. Getting there required three upgrades:

- React Router 6 → 7. An open-redirect advisory affected v6.
- Vite 5 → 8.
- Vitest 2 → 5.

Lint, tests and build were re-run after the upgrades.
