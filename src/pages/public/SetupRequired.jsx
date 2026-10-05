import { TruckMark } from '@/components/common/Logo';

/** Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. No fake data mode exists. */
export function SetupRequired() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-card">
        <TruckMark />
        <h1 className="mt-4 text-2xl font-bold text-navy-900">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          DeliverSME stores all data in Supabase. Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to{' '}
          <code className="rounded bg-slate-100 px-1">.env</code>, set <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code>, apply the SQL migrations, then restart <code className="rounded bg-slate-100 px-1">npm run dev</code>.
        </p>
        <p className="mt-3 text-sm text-slate-600">See README.md → “Supabase project setup”.</p>
      </div>
    </main>
  );
}
