import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Truck } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { getDelivery, assignRider } from '@/services/deliveries';
import { listRiders, riderStatus } from '@/services/riders';
import { Card, CardHeader, PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { RiderStatusBadge, StatusBadge } from '@/components/common/Badge';
import { ConfirmDialog } from '@/components/common/Modal';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/States';
import { FullPageSpinner } from '@/components/common/Spinner';
import { errorMessage } from '@/lib/errors';
import { distanceKm, formatKm, timeAgo } from '@/utils/format';

export default function AssignRiderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [choice, setChoice] = useState(null);
  const delivery = useAsync(() => getDelivery(id), [id]);
  const riders = useAsync(async () => {
    const d = await getDelivery(id);
    const rows = await listRiders();
    const from = d?.pickup_lat != null ? { lat: d.pickup_lat, lng: d.pickup_lng } : null;
    return rows
      .map((r) => ({ ...r, status: riderStatus(r), km: from && r.last_lat != null ? distanceKm(from, { lat: r.last_lat, lng: r.last_lng }) : null }))
      .sort((a, b) => (a.status === 'available') !== (b.status === 'available') ? (a.status === 'available' ? -1 : 1)
        : (a.km ?? Infinity) - (b.km ?? Infinity));
  }, [id]);

  if (delivery.loading) return <FullPageSpinner />;
  if (delivery.error) return <ErrorState error={delivery.error} onRetry={delivery.reload} />;
  const d = delivery.data;
  if (!d) return <EmptyState title="Delivery not found" action={<Button to="/business/deliveries">Back to deliveries</Button>} />;

  const confirm = async () => {
    try {
      await assignRider(d.id, choice.id);
      toast.success(`Offered to ${choice.full_name}. You'll be notified when they respond.`);
      navigate(`/business/deliveries/${d.id}`, { replace: true });
    } catch (e) { toast.error(errorMessage(e)); riders.reload({ silent: true }); throw e; }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Assign Rider"
        back={<Link to={`/business/deliveries/${d.id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900"><ArrowLeft className="h-4 w-4" />Back to delivery</Link>} />
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="font-semibold text-navy-900">Delivery #{d.code}</p>
          <p className="text-sm text-slate-500">{d.pickup_address} → {d.dropoff_address}</p>
        </div>
        <StatusBadge status={d.status} />
      </Card>

      {d.status !== 'pending' ? (
        <Card><EmptyState icon={Truck} title="This delivery can't be assigned right now"
          message={d.status === 'requested' ? 'Accept the customer request first.' : 'Only deliveries waiting in the dispatch queue can be offered to a rider.'}
          action={<Button to={`/business/deliveries/${d.id}`}>Open delivery</Button>} /></Card>
      ) : (
        <Card>
          <CardHeader title="Available Riders" description="Verified riders on DeliverSME. Only online riders can be offered a job."
            action={<Button variant="ghost" size="sm" onClick={() => riders.reload()} aria-label="Refresh riders"><RefreshCw className={`h-4 w-4 ${riders.loading ? 'animate-spin' : ''}`} />Refresh</Button>} />
          {riders.loading && !riders.data ? <SkeletonRows /> : riders.error ? <ErrorState error={riders.error} onRetry={riders.reload} /> : !riders.data.length ? (
            <EmptyState icon={Truck} title="No verified riders yet" message="Riders appear here once an administrator verifies them." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {riders.data.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Avatar name={r.full_name} src={r.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-navy-900">{r.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {r.km != null ? `${formatKm(r.km)} from pickup` : 'Distance unknown'}
                      {r.vehicle_type ? ` · ${r.vehicle_type}` : ''}
                      {r.last_location_at ? ` · seen ${timeAgo(r.last_location_at)}` : ''}
                    </p>
                  </div>
                  <RiderStatusBadge status={r.status} />
                  <Button size="sm" disabled={r.status === 'offline'} onClick={() => setChoice(r)}
                    title={r.status === 'offline' ? 'Rider is offline' : undefined}>Select</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <ConfirmDialog open={Boolean(choice)} onClose={() => setChoice(null)} tone="primary" confirmLabel="Offer job"
        title={`Offer #${d.code} to ${choice?.full_name}?`}
        message={choice?.status === 'busy' ? 'This rider already has an active job, so they may take longer to respond.' : 'The rider will be notified and can accept or decline.'}
        onConfirm={confirm} />
    </div>
  );
}
