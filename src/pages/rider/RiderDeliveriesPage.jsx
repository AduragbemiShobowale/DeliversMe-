import { useAuth } from '@/app/providers/AuthProvider';
import { PageHeader } from '@/components/common/Card';
import { DeliveryList } from '@/components/deliveries/DeliveryList';
import { col } from '@/components/deliveries/columns';

export default function RiderDeliveriesPage() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="My Deliveries" description="Your delivery history and active jobs." />
      <DeliveryList
        scope={{ rider_id: user.id }}
        realtimeFilter={`rider_id=eq.${user.id}`}
        columns={[col.code, col.business, col.dropoff, col.status, col.date]}
        rowPath={(id) => `/rider/jobs/${id}`}
        emptyMessage="Jobs you accept will be listed here."
      />
    </div>
  );
}
