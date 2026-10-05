import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserCheck } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { DeliveryList } from '@/components/deliveries/DeliveryList';
import { col } from '@/components/deliveries/columns';
import { NoBusiness } from './BusinessDashboard';

const TABS = ['all', 'requests', 'pending', 'active', 'completed', 'cancelled'];

export default function BusinessDeliveriesPage() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [selected, setSelected] = useState(null);
  if (!business) return <NoBusiness />;
  const initialTab = TABS.includes(params.get('tab')) ? params.get('tab') : 'all';

  // Only deliveries in the dispatch queue (pending) can be assigned; one at a time.
  const selectable = (r) => (r.status === 'pending' ? (
    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      aria-label={`Select delivery #${r.code} for rider assignment`} checked={selected === r.id}
      onChange={(e) => setSelected(e.target.checked ? r.id : null)} />
  ) : <span className="block h-4 w-4" />);

  return (
    <div>
      <PageHeader title="My Deliveries" description="Review requests, manage the dispatch queue and follow active deliveries."
        action={<>
          <Button variant="outline" disabled={!selected} onClick={() => navigate(`/business/deliveries/${selected}/assign`)}
            title={selected ? undefined : 'Select a pending delivery first'}><UserCheck className="h-4 w-4" />Assign Rider</Button>
          <Button to="/business/deliveries/new">Create Delivery</Button>
        </>} />
      <DeliveryList
        scope={{ business_id: business.id }}
        realtimeFilter={`business_id=eq.${business.id}`}
        tabs={TABS}
        initialTab={initialTab}
        columns={[col.code, col.recipient, col.dropoff, col.rider, col.status, col.priority, col.date]}
        rowPath={(id) => `/business/deliveries/${id}`}
        selectable={selectable}
        onRows={(rows) => { if (selected && !rows.some((r) => r.id === selected && r.status === 'pending')) setSelected(null); }}
        emptyMessage="Create a delivery or share your business with customers so they can request one."
        emptyAction={<Button to="/business/deliveries/new">Create Delivery</Button>}
      />
    </div>
  );
}
