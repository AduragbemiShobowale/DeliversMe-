import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ShieldAlert, Bike, Navigation } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { countDeliveries, listDeliveries } from '@/services/deliveries';
import { ACTIVE_RIDER } from '@/features/deliveries/status';
import { Card, CardHeader, StatCard } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/States';
import { firstName, greeting, timeAgo } from '@/utils/format';

export default function RiderDashboard() {
  const { user, profile, rider } = useAuth();
  const navigate = useNavigate();
  const scope = { rider_id: user.id };
  const stats = useAsync(async () => {
    const [offered, active, completed, current] = await Promise.all([
      countDeliveries(scope, ['assigned']), countDeliveries(scope, ACTIVE_RIDER), countDeliveries(scope, ['delivered']),
      listDeliveries({ scope, statuses: ACTIVE_RIDER, pageSize: 1 }),
    ]);
    return { offered, active, completed, current: current.rows[0] || null };
  }, [user.id]);
  const recent = useAsync(() => listDeliveries({ scope, pageSize: 5, order: 'updated_at' }), [user.id]);
  useRealtime({ table: 'deliveries', filter: `rider_id=eq.${user.id}`, onChange: () => { stats.reload({ silent: true }); recent.reload({ silent: true }); } });

  const s = stats.data;
  const online = rider?.availability === 'available';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{greeting()},</p>
        <h1 className="text-2xl font-bold text-navy-900">{firstName(profile?.full_name) || 'Rider'}! <span aria-hidden="true">👋</span></h1>
        <p className="mt-1 text-sm text-slate-500">{online ? 'You are online and ready for your next delivery.' : 'You are offline. Go online (top bar) to receive jobs.'}</p>
      </div>

      {rider && !rider.is_verified && (
        <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>Your rider profile is awaiting verification by a DeliverSME administrator. Make sure your <Link to="/rider/settings/vehicle" className="font-semibold underline">vehicle details</Link> are complete. You can go online once verified.</p>
        </div>
      )}

      {stats.error ? <Card><ErrorState error={stats.error} onRetry={stats.reload} /></Card> : (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Available Jobs" value={s?.offered} loading={stats.loading} tone="blue" />
          <StatCard label="Active" value={s?.active} loading={stats.loading} tone="amber" />
          <StatCard label="Completed" value={s?.completed} loading={stats.loading} tone="green" />
        </div>
      )}

      {s?.current && (
        <Link to={`/rider/jobs/${s.current.id}`} className="flex items-center gap-3 rounded-xl bg-brand-600 p-4 text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
          <Navigation className="h-6 w-6" aria-hidden="true" />
          <span className="flex-1"><span className="block font-semibold">Continue delivery #{s.current.code}</span><span className="text-sm opacity-90">{s.current.dropoff_address}</span></span>
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      )}

      <Card>
        <CardHeader title="Recent Activity" action={<Link to="/rider/deliveries" className="inline-flex items-center text-sm font-semibold text-brand-600 hover:underline">View All<ChevronRight className="h-4 w-4" /></Link>} />
        {recent.loading ? <SkeletonRows rows={3} /> : recent.error ? <ErrorState error={recent.error} onRetry={recent.reload} /> : !recent.data.rows.length ? (
          <EmptyState icon={Bike} title="No jobs yet" message="Jobs that businesses offer you will show up here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.data.rows.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => navigate(`/rider/jobs/${d.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-slate-50 focus-visible:bg-brand-50 focus-visible:outline-none">
                  <span className="font-semibold text-navy-900">#{d.code}</span>
                  <span className="flex-1 truncate text-slate-500">{d.dropoff_address}</span>
                  <StatusBadge status={d.status} />
                  <span className="hidden w-24 text-right text-xs text-slate-500 sm:block">{timeAgo(d.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!online && rider?.is_verified && (
        <Card className="flex items-center gap-3 bg-brand-50 p-4">
          <Bike className="h-8 w-8 text-brand-600" aria-hidden="true" />
          <div><p className="font-semibold text-navy-900">Stay Online</p><p className="text-sm text-slate-600">Businesses can only offer jobs to online riders. Use the Online switch in the top bar.</p></div>
        </Card>
      )}
    </div>
  );
}
