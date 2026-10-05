import { useAuth } from '@/app/providers/AuthProvider';
import { PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { DeliveryList } from '@/components/deliveries/DeliveryList';
import { col } from '@/components/deliveries/columns';

export default function CustomerDeliveriesPage() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="My Deliveries" description="All the delivery requests you have made." action={<Button to="/customer/request">Request Delivery</Button>} />
      <DeliveryList
        scope={{ customer_user_id: user.id }}
        realtimeFilter={`customer_user_id=eq.${user.id}`}
        tabs={['all', 'requests', 'active', 'completed', 'cancelled']}
        columns={[col.code, col.business, col.dropoff, col.status, col.date]}
        rowPath={(id) => `/customer/deliveries/${id}`}
        emptyMessage="Requests you send to businesses will appear here."
        emptyAction={<Button to="/customer/request">Request a delivery</Button>}
      />
    </div>
  );
}
