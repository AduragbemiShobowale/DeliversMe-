import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PackagePlus, MapPinned, ClipboardList, Store, ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { listDeliveries } from '@/services/deliveries';
import { IN_PROGRESS } from '@/features/deliveries/status';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable } from '@/components/tables/DataTable';
import { EmptyState } from '@/components/common/States';
import { Button } from '@/components/common/Button';
import { col } from '@/components/deliveries/columns';
import { firstName, greeting } from '@/utils/format';

const ACTIONS = [
  { key: 'request', label: 'Request Delivery', icon: PackagePlus, tone: 'bg-brand-50 text-brand-700 hover:bg-brand-100' },
  { key: 'track', label: 'Track Delivery', icon: MapPinned, tone: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { key: 'deliveries', label: 'My Deliveries', icon: ClipboardList, tone: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { key: 'find', label: 'Find a Business', icon: Store, tone: 'bg-sky-50 text-sky-700 hover:bg-sky-100' },
];

export default function CustomerDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const scope = { customer_user_id: user.id };

  const recent = useAsync(() => listDeliveries({ scope, pageSize: 5 }), [user.id]);
  const active = useAsync(() => listDeliveries({ scope, statuses: IN_PROGRESS, pageSize: 1 }), [user.id]);
  useRealtime({
    table: 'deliveries', filter: `customer_user_id=eq.${user.id}`,
    onChange: () => { recent.reload({ silent: true }); active.reload({ silent: true }); },
  });

  const go = (key) => {
    if (key === 'request' || key === 'find') return navigate('/customer/request');
    if (key === 'deliveries') return navigate('/customer/deliveries');
    const current = active.data?.rows?.[0];
    if (current) return navigate(`/customer/deliveries/${current.id}`);
    toast('You have no delivery in progress right now.');
    return navigate('/customer/deliveries');
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{greeting()},</p>
        <h1 className="text-2xl font-bold text-navy-900">{firstName(profile?.full_name) || 'there'} <span aria-hidden="true">👋</span></h1>
        <p className="mt-1 text-sm text-slate-500">What would you like to do today?</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACTIONS.map(({ key, label, icon: Icon, tone }) => (
          <button key={key} type="button" onClick={() => go(key)}
            className={`flex flex-col items-center gap-2 rounded-xl p-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${tone}`}>
            <Icon className="h-6 w-6" aria-hidden="true" />{label}
            {key === 'track' && active.data?.count > 0 && <span className="text-xs font-medium opacity-80">{active.data.count} in progress</span>}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title="Your Recent Deliveries" action={<Link to="/customer/deliveries" className="inline-flex items-center text-sm font-semibold text-brand-600 hover:underline">View All<ChevronRight className="h-4 w-4" /></Link>} />
        <DataTable
          columns={[col.code, col.business, col.status, col.date]}
          rows={recent.data?.rows}
          loading={recent.loading}
          error={recent.error}
          onRetry={recent.reload}
          onRowClick={(r) => navigate(`/customer/deliveries/${r.id}`)}
          empty={<EmptyState icon={PackagePlus} title="No deliveries yet" message="Choose a business and request your first delivery."
            action={<Button to="/customer/request">Request a delivery</Button>} />}
        />
      </Card>
    </div>
  );
}
