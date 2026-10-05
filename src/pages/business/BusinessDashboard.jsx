import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, PackagePlus, Building2, Inbox } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { countDeliveries, listDeliveries } from '@/services/deliveries';
import { IN_PROGRESS } from '@/features/deliveries/status';
import { Card, CardHeader, StatCard } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState } from '@/components/common/States';
import { DataTable } from '@/components/tables/DataTable';
import { col } from '@/components/deliveries/columns';
import { firstName, greeting } from '@/utils/format';

export function NoBusiness() {
  return (
    <Card><EmptyState icon={Building2} title="No business linked to this account"
      message="A business profile is normally created automatically when an SME owner signs up. Contact DeliverSME support so an administrator can fix your account."
      action={<Button to="/contact">Contact support</Button>} /></Card>
  );
}

export default function BusinessDashboard() {
  const { profile, business } = useAuth();
  const navigate = useNavigate();
  const bid = business?.id;
  const scope = { business_id: bid };

  const stats = useAsync(async () => {
    const [total, active, completed, pending, requests] = await Promise.all([
      countDeliveries(scope), countDeliveries(scope, IN_PROGRESS), countDeliveries(scope, ['delivered']),
      countDeliveries(scope, ['pending']), countDeliveries(scope, ['requested']),
    ]);
    return { total, active, completed, pending, requests };
  }, [bid], { enabled: Boolean(bid) });
  const recent = useAsync(() => listDeliveries({ scope, pageSize: 6 }), [bid], { enabled: Boolean(bid) });
  useRealtime({
    table: 'deliveries', filter: `business_id=eq.${bid}`, enabled: Boolean(bid),
    onChange: () => { stats.reload({ silent: true }); recent.reload({ silent: true }); },
  });

  if (!bid) return <NoBusiness />;
  const s = stats.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{greeting()},</p>
          <h1 className="text-2xl font-bold text-navy-900">{firstName(profile?.full_name) || business.name} <span aria-hidden="true">👋</span></h1>
          <p className="mt-1 text-sm text-slate-500">Here&apos;s what&apos;s happening with {business.name} today.</p>
        </div>
        <Button to="/business/deliveries/new"><PackagePlus className="h-4 w-4" />Create Delivery</Button>
      </div>

      {stats.error ? <Card><ErrorState error={stats.error} onRetry={stats.reload} /></Card> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total Deliveries" value={s?.total} loading={stats.loading} tone="blue" />
          <StatCard label="In Progress" value={s?.active} loading={stats.loading} tone="violet" />
          <StatCard label="Completed" value={s?.completed} loading={stats.loading} tone="green" />
          <StatCard label="Awaiting rider" value={s?.pending} loading={stats.loading} tone="amber" />
        </div>
      )}

      {s?.requests > 0 && (
        <Link to="/business/deliveries?tab=requests" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
          <Inbox className="h-5 w-5" aria-hidden="true" />
          <span className="flex-1 text-sm font-medium">{s.requests} customer request{s.requests === 1 ? '' : 's'} waiting for your review</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}

      <Card>
        <CardHeader title="Recent Deliveries" action={<Link to="/business/deliveries" className="inline-flex items-center text-sm font-semibold text-brand-600 hover:underline">View All<ChevronRight className="h-4 w-4" /></Link>} />
        <DataTable columns={[col.code, col.recipient, col.status, col.date]} rows={recent.data?.rows} loading={recent.loading}
          error={recent.error} onRetry={recent.reload} onRowClick={(r) => navigate(`/business/deliveries/${r.id}`)}
          empty={<EmptyState icon={PackagePlus} title="No deliveries yet" message="Create your first delivery or wait for customer requests."
            action={<Button to="/business/deliveries/new">Create Delivery</Button>} />} />
      </Card>
    </div>
  );
}
