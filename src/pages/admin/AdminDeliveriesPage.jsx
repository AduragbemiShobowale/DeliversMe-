import { PageHeader } from '@/components/common/Card';
import { DeliveryList } from '@/components/deliveries/DeliveryList';
import { col } from '@/components/deliveries/columns';

export default function AdminDeliveriesPage() {
  return (
    <div>
      <PageHeader title="Deliveries" description="Every delivery on the platform. Open one to view its history or cancel it." />
      <DeliveryList scope={{}} tabs={['all', 'requests', 'pending', 'active', 'completed', 'cancelled']}
        columns={[col.code, col.business, col.recipient, col.rider, col.status, col.date]} rowPath={(id) => `/admin/deliveries/${id}`} />
    </div>
  );
}
