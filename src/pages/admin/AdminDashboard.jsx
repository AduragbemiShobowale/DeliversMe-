import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ShieldAlert, Inbox } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { platformStats } from '@/services/admin';
import { listDeliveries } from '@/services/deliveries';
import { Card, CardHeader, PageHeader, StatCard } from '@/components/common/Card';
import { ErrorState } from '@/components/common/States';
import { DataTable } from '@/components/tables/DataTable';
import { col } from '@/components/deliveries/columns';

function Alert({ to, icon: Icon, children }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
      <Icon className="h-5 w-5" aria-hidden="true" /><span className="flex-1">{children}</span><ChevronRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const stats = useAsync(platformStats, []);
  const recent = useAsync(() => listDeliveries({ pageSize: 8 }), []);
  const s = stats.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="Live counts from the database." />
      {stats.error ? <Card><ErrorState error={stats.error} onRetry={stats.reload} /></Card> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Customers" value={s?.customers} loading={stats.loading} />
          <StatCard label="SME owners" value={s?.smes} loading={stats.loading} tone="violet" />
          <StatCard label="Riders" value={s?.riders} loading={stats.loading} tone="amber" />
          <StatCard label="Businesses" value={s?.businesses} loading={stats.loading} tone="blue" />
          <StatCard label="All deliveries" value={s?.deliveries} loading={stats.loading} />
          <StatCard label="In progress" value={s?.active} loading={stats.loading} tone="violet" />
          <StatCard label="Completed" value={s?.delivered} loading={stats.loading} tone="green" />
          <StatCard label="New messages" value={s?.newMessages} loading={stats.loading} tone="red" />
        </div>
      )}
      {s?.unverifiedRiders > 0 && <Alert to="/admin/riders" icon={ShieldAlert}>{s.unverifiedRiders} rider{s.unverifiedRiders === 1 ? '' : 's'} awaiting verification</Alert>}
      {s?.newMessages > 0 && <Alert to="/admin/messages" icon={Inbox}>{s.newMessages} unresolved contact message{s.newMessages === 1 ? '' : 's'}</Alert>}
      <Card>
        <CardHeader title="Latest deliveries" action={<Link to="/admin/deliveries" className="inline-flex items-center text-sm font-semibold text-brand-600 hover:underline">View All<ChevronRight className="h-4 w-4" /></Link>} />
        <DataTable columns={[col.code, col.business, col.rider, col.status, col.date]} rows={recent.data?.rows} loading={recent.loading}
          error={recent.error} onRetry={recent.reload} onRowClick={(r) => navigate(`/admin/deliveries/${r.id}`)} />
      </Card>
    </div>
  );
}
