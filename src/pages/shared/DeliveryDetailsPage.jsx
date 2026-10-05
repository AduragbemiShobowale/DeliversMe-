import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, Star, UserCheck } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useDelivery } from '@/features/deliveries/useDelivery';
import { canCancel } from '@/features/deliveries/status';
import { cancelDelivery, getRating, rateDelivery, reviewRequest } from '@/services/deliveries';
import { getRiderLocation } from '@/services/riders';
import { Card, CardHeader, DetailRow } from '@/components/common/Card';
import { Badge, StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { ConfirmDialog } from '@/components/common/Modal';
import { ErrorState, EmptyState } from '@/components/common/States';
import { FullPageSpinner } from '@/components/common/Spinner';
import { Tabs } from '@/components/common/Controls';
import { Textarea } from '@/components/forms/Fields';
import { DeliveryMap } from '@/components/deliveries/DeliveryMap';
import { StatusTimeline, HistoryList } from '@/components/deliveries/StatusTimeline';
import { ProofImage } from '@/components/deliveries/ProofImage';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, telHref, timeAgo } from '@/utils/format';
import { PACKAGE_SIZES } from '@/features/deliveries/status';

const LIST_PATH = { customer: '/customer/deliveries', sme_owner: '/business/deliveries', admin: '/admin/deliveries' };

function RatingBox({ delivery }) {
  const [existing, setExisting] = useState(undefined);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getRating(delivery.id).then(setExisting).catch(() => setExisting(null)); }, [delivery.id]);
  if (existing === undefined) return null;
  if (existing) {
    return <p className="flex items-center gap-1 text-sm text-slate-600">You rated this delivery {existing.rating}/5 <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" /></p>;
  }
  const submit = async () => {
    if (!rating) { toast.error('Choose a rating from 1 to 5 stars'); return; }
    setBusy(true);
    try { setExisting(await rateDelivery(delivery.id, rating, comment)); toast.success('Thanks for rating this delivery'); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <p className="text-sm font-medium text-navy-900">How was this delivery?</p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}
            className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <Star className={`h-7 w-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
          </button>
        ))}
      </div>
      <Textarea className="mt-3" label="Comment (optional)" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button className="mt-3" onClick={submit} loading={busy}>Submit rating</Button>
    </div>
  );
}

export default function DeliveryDetailsPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const { data: d, loading, error, reload, refresh, setData } = useDelivery(id);
  const [dialog, setDialog] = useState(null); // 'cancel' | 'decline'
  const [accepting, setAccepting] = useState(false);
  const [tab, setTab] = useState('overview');

  // Initial rider position (subsequent updates arrive through Realtime)
  useEffect(() => {
    if (d?.rider_id && !d.riderLocation && !['delivered', 'cancelled', 'rejected'].includes(d.status)) {
      getRiderLocation(d.rider_id).then((r) => {
        if (r?.last_lat != null) setData({ ...d, riderLocation: { lat: r.last_lat, lng: r.last_lng, at: r.last_location_at } });
      }).catch(() => {});
    }
  }, [d, setData]);

  if (loading && !d) return <FullPageSpinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!d) return <EmptyState title="Delivery not found" message="It may have been removed, or you do not have access to it." action={<Button to={LIST_PATH[role]}>Back to deliveries</Button>} />;

  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); await refresh(); } catch (e) { toast.error(errorMessage(e)); throw e; }
  };
  const accept = async () => {
    setAccepting(true);
    try { await act(() => reviewRequest(d.id, true), 'Request accepted and added to your dispatch queue'); } catch { /* toasted */ } finally { setAccepting(false); }
  };

  const map = (
    <DeliveryMap className="h-72 sm:h-80"
      pickup={{ lat: d.pickup_lat, lng: d.pickup_lng, label: `Pickup: ${d.pickup_address}` }}
      dropoff={{ lat: d.dropoff_lat, lng: d.dropoff_lng, label: `Drop-off: ${d.dropoff_address}` }}
      rider={d.riderLocation ? { ...d.riderLocation, label: `Rider · updated ${timeAgo(d.riderLocation.at)}` } : null} />
  );

  return (
    <div>
      <Link to={LIST_PATH[role]} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-600"><ArrowLeft className="h-4 w-4" />All deliveries</Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Delivery #{d.code}</h1>
          <p className="mt-1 text-sm text-slate-500">Requested {formatDateTime(d.created_at)}{d.business ? ` · ${d.business.name}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {d.priority === 'express' && <Badge tone="red">Express</Badge>}
          <StatusBadge status={d.status} />
        </div>
      </div>

      {role === 'sme_owner' && (
        <Tabs className="mb-5" value={tab} onChange={setTab} items={[
          { value: 'overview', label: 'Overview' }, { value: 'timeline', label: 'Timeline' }, { value: 'proof', label: 'Proof of Delivery' },
        ]} />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {(role !== 'sme_owner' || tab === 'overview') && (
            <Card>
              <CardHeader title="Track delivery" description={d.riderLocation ? `Rider location updated ${timeAgo(d.riderLocation.at)}` : 'Live rider position shows once a rider is on the job and sharing location.'} />
              <div className="p-5">{map}</div>
              <div className="border-t border-slate-100 p-5"><StatusTimeline delivery={d} /></div>
            </Card>
          )}
          {(role !== 'sme_owner' || tab === 'timeline') && (
            <Card><CardHeader title="Status history" /><div className="p-5"><HistoryList history={d.history} /></div></Card>
          )}
          {(role === 'sme_owner' ? tab === 'proof' : d.status === 'delivered') && (
            <Card>
              <CardHeader title="Proof of delivery" description={d.delivered_at ? `Completed ${formatDateTime(d.delivered_at)} · Delivered to ${d.recipient_name}` : 'Available once the rider completes the delivery.'} />
              <div className="space-y-3 p-5">
                {d.status === 'delivered' ? <ProofImage path={d.proof_path} /> : <p className="text-sm text-slate-500">Not completed yet.</p>}
                {d.completion_notes && <p className="text-sm text-slate-600">Rider note: {d.completion_notes}</p>}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Delivery details" />
            <dl className="divide-y divide-slate-100 px-5 py-2">
              <DetailRow label="Business">{d.business?.name}</DetailRow>
              <DetailRow label="Pickup location">{d.pickup_address}</DetailRow>
              <DetailRow label="Drop-off location">{d.dropoff_address}</DetailRow>
              <DetailRow label="Item">{d.item_description}</DetailRow>
              <DetailRow label="Package">{PACKAGE_SIZES.find((p) => p.value === d.package_size)?.label}</DetailRow>
              <DetailRow label="Special instructions">{d.special_instructions}</DetailRow>
              <DetailRow label="Recipient">{d.recipient_name}</DetailRow>
              <DetailRow label="Phone">{d.recipient_phone}</DetailRow>
              {role !== 'customer' && <DetailRow label="Customer">{d.customer?.full_name || (d.customer_user_id ? 'Platform customer' : 'Business contact')}</DetailRow>}
            </dl>
          </Card>

          {d.rider && (
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold text-navy-900">Rider</p>
              <div className="flex items-center gap-3">
                <Avatar name={d.rider.full_name} src={d.rider.avatar_url} />
                <div className="flex-1">
                  <p className="font-medium text-navy-900">{d.rider.full_name}</p>
                  <p className="text-xs text-slate-500">{d.status === 'assigned' ? 'Waiting for rider to accept' : 'On this delivery'}</p>
                </div>
                {d.rider.phone && <Button variant="outline-brand" size="sm" href={telHref(d.rider.phone)}><Phone className="h-4 w-4" />Call</Button>}
              </div>
            </Card>
          )}

          <Card className="space-y-3 p-5">
            <p className="text-sm font-semibold text-navy-900">Actions</p>
            {role === 'sme_owner' && d.status === 'requested' && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={accept} loading={accepting}>Accept request</Button>
                <Button variant="outline-danger" onClick={() => setDialog('decline')}>Decline</Button>
              </div>
            )}
            {role === 'sme_owner' && d.status === 'pending' && (
              <Button to={`/business/deliveries/${d.id}/assign`} className="w-full"><UserCheck className="h-4 w-4" />Assign rider</Button>
            )}
            {role === 'sme_owner' && (
              <Button variant="outline" className="w-full" onClick={() => navigate('/business/deliveries/new', { state: { reorder: d } })}>Reorder delivery</Button>
            )}
            {role === 'sme_owner' && d.recipient_phone && <Button variant="outline" className="w-full" href={telHref(d.recipient_phone)}><Phone className="h-4 w-4" />Call recipient</Button>}
            {role === 'customer' && d.status === 'delivered' && <RatingBox delivery={d} />}
            {role === 'customer' && <Button variant="outline" className="w-full" to={`/customer/request/${d.business_id}`}>Request another delivery</Button>}
            {canCancel(role, d.status) && <Button variant="outline-danger" className="w-full" onClick={() => setDialog('cancel')}>Cancel delivery</Button>}
            {!canCancel(role, d.status) && d.status !== 'delivered' && !['cancelled', 'rejected'].includes(d.status) && role === 'customer' && (
              <p className="text-xs text-slate-500">A rider is already on this delivery, so it can no longer be cancelled here. Contact {d.business?.name || 'the business'}{d.business?.phone ? ` on ${d.business.phone}` : ''} if something is wrong.</p>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog open={dialog === 'cancel'} onClose={() => setDialog(null)} title={`Cancel delivery #${d.code}?`}
        message="Everyone involved will be notified. This cannot be undone." confirmLabel="Cancel delivery" withReason
        onConfirm={(reason) => act(() => cancelDelivery(d.id, reason), 'Delivery cancelled')} />
      <ConfirmDialog open={dialog === 'decline'} onClose={() => setDialog(null)} title="Decline this request?"
        message="The customer will be told you cannot take this delivery." confirmLabel="Decline request" withReason reasonLabel="Reason shown to the customer (optional)"
        onConfirm={(reason) => act(() => reviewRequest(d.id, false, reason), 'Request declined')} />
    </div>
  );
}
