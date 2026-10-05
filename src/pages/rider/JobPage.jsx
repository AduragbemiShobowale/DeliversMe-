import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Camera, ExternalLink, Image as ImageIcon, MapPin, Package, Phone, X, Check } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useDelivery } from '@/features/deliveries/useDelivery';
import { nextRiderAction, ACTIVE_RIDER, PACKAGE_SIZES } from '@/features/deliveries/status';
import { advanceDelivery, completeDelivery, respondToJob, uploadProof, validateImage } from '@/services/deliveries';
import { Card, CardHeader, DetailRow } from '@/components/common/Card';
import { Badge, StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/Modal';
import { EmptyState, ErrorState } from '@/components/common/States';
import { FullPageSpinner } from '@/components/common/Spinner';
import { Checkbox, Textarea } from '@/components/forms/Fields';
import { DeliveryMap } from '@/components/deliveries/DeliveryMap';
import { ProofImage } from '@/components/deliveries/ProofImage';
import { errorMessage } from '@/lib/errors';
import { estimateMinutes, formatDateTime, formatKm, formatTime, mapsDirectionsUrl, telHref } from '@/utils/format';
import { tripKm } from './AvailableJobsPage';

function Done({ title, children, actions }) {
  return (
    <Card className="mx-auto mt-6 max-w-md p-8 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-10 w-10" strokeWidth={2.5} /></span>
      <h1 className="mt-5 text-xl font-bold text-navy-900">{title}</h1>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
      <div className="mt-6 flex flex-col gap-2">{actions}</div>
    </Card>
  );
}

const STEPS = [
  { key: 'picked_up', label: 'Pickup items', at: 'picked_up_at' },
  { key: 'in_transit', label: 'On the way' },
  { key: 'arrived', label: 'Arrived at destination' },
  { key: 'delivered', label: 'Completed', at: 'delivered_at' },
];
const ORDER = ['accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'];

function RiderSteps({ d }) {
  const cur = ORDER.indexOf(d.status);
  const at = (key) => d.history?.find((h) => h.status === key)?.created_at;
  return (
    <ol className="space-y-3">
      {STEPS.map((s, i) => {
        const idx = ORDER.indexOf(s.key);
        const state = cur >= idx ? 'done' : cur + 1 === idx ? 'current' : 'upcoming';
        return (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${state === 'done' ? 'bg-emerald-500 text-white' : state === 'current' ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {state === 'done' ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`flex-1 font-medium ${state === 'upcoming' ? 'text-slate-500' : 'text-navy-900'}`}>{s.label}</span>
            <span className={`text-xs ${state === 'current' ? 'font-semibold text-brand-600' : 'text-slate-500'}`}>
              {state === 'done' ? formatTime(at(s.key)) : state === 'current' ? 'Up next' : 'Pending'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CompleteForm({ d, onDone }) {
  const [confirmed, setConfirmed] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const problem = validateImage(f, 5);
    if (problem) { toast.error(problem); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const submit = async () => {
    if (!confirmed) { toast.error('Confirm that you delivered the item to the recipient'); return; }
    setBusy(true);
    try {
      const path = file ? await uploadProof(d.id, file) : null;
      await completeDelivery(d.id, path, notes.trim());
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="Complete Delivery" description={`#${d.code} · ${d.recipient_name}`} />
      <div className="space-y-5 p-5">
        <Checkbox label="I have delivered the item to the recipient" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <div>
          <p className="mb-2 text-sm font-medium text-navy-900">Add proof of delivery (optional)</p>
          {preview ? (
            <div className="relative inline-block">
              <img src={preview} alt="Proof of delivery preview" className="h-40 rounded-lg object-cover" />
              <button type="button" onClick={() => { setFile(null); setPreview(null); }} aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1 shadow hover:bg-white"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <Camera className="h-6 w-6 text-brand-600" aria-hidden="true" />Take a Photo</button>
              <button type="button" onClick={() => galleryRef.current?.click()} className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <ImageIcon className="h-6 w-6 text-brand-600" aria-hidden="true" />Upload from Gallery</button>
            </div>
          )}
          <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={pick} />
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
          <p className="mt-1 text-xs text-slate-500">JPG, PNG or WebP, up to 5 MB. Only the business, customer and admins can view it.</p>
        </div>
        <Textarea label="Additional notes (optional)" placeholder="E.g. Handed to security at reception" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="w-full" size="lg" onClick={submit} loading={busy}>Complete Delivery</Button>
      </div>
    </Card>
  );
}

export default function JobPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: d, loading, error, reload, refresh } = useDelivery(id);
  const [screen, setScreen] = useState(null); // 'accepted' | 'completed'
  const [busy, setBusy] = useState(null);
  const [declining, setDeclining] = useState(false);

  if (loading && !d) return <FullPageSpinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!d || d.rider_id !== user.id) {
    return <EmptyState title="Job not available" message="This job may have been reassigned, declined or cancelled."
      action={<Button to="/rider/jobs">Back to available jobs</Button>} />;
  }

  if (screen === 'accepted') {
    return <Done title="Job accepted" actions={<>
      <Button onClick={() => setScreen(null)}>Start Delivery</Button>
      <Button variant="outline-brand" to="/rider/deliveries">View in My Deliveries</Button>
      <Button variant="ghost" to="/rider">Go to Dashboard</Button></>}>
      You have successfully accepted delivery <strong>#{d.code}</strong>. Head to the pickup location.
    </Done>;
  }
  if (screen === 'completed') {
    return <Done title="Delivery Completed!" actions={<>
      <Button onClick={() => setScreen(null)}>View Details</Button>
      <Button variant="outline-brand" to="/rider">Back to Dashboard</Button></>}>
      <p>Great job! You have successfully completed delivery <strong>#{d.code}</strong>.</p>
      <dl className="mt-4 space-y-1 text-left">
        <DetailRow label="Delivered to">{d.recipient_name}</DetailRow>
        <DetailRow label="Location">{d.dropoff_address}</DetailRow>
        <DetailRow label="Completed at">{formatDateTime(d.delivered_at)}</DetailRow>
      </dl>
    </Done>;
  }

  const run = async (key, fn, msg) => {
    setBusy(key);
    try { await fn(); if (msg) toast.success(msg); await refresh(); return true; }
    catch (e) { toast.error(errorMessage(e)); await refresh(); return false; } finally { setBusy(null); }
  };
  const accept = async () => { if (await run('accept', () => respondToJob(d.id, true))) setScreen('accepted'); };
  const decline = async () => {
    try { await respondToJob(d.id, false); toast.success('Job declined'); navigate('/rider/jobs', { replace: true }); }
    catch (e) { toast.error(errorMessage(e)); throw e; }
  };

  const km = tripKm(d);
  const active = ACTIVE_RIDER.includes(d.status);
  const next = nextRiderAction(d.status);
  const target = ['accepted'].includes(d.status)
    ? { label: 'pickup', address: d.pickup_address, lat: d.pickup_lat, lng: d.pickup_lng }
    : { label: 'drop-off', address: d.dropoff_address, lat: d.dropoff_lat, lng: d.dropoff_lng };

  return (
    <div className="mx-auto max-w-4xl">
      <Link to={active || d.status === 'assigned' ? '/rider/jobs' : '/rider/deliveries'} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-600"><ArrowLeft className="h-4 w-4" />Back</Link>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{d.status === 'assigned' ? 'Job Details' : active ? 'Active Delivery' : 'Delivery'} #{d.code}</h1>
          <p className="text-sm text-slate-500">From {d.business?.name}</p>
        </div>
        <div className="flex gap-2">{d.priority === 'express' ? <Badge tone="red">Express</Badge> : <Badge tone="blue">Standard</Badge>}<StatusBadge status={d.status} /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              <div className="flex-1"><p className="text-sm font-semibold text-navy-900">Pickup location</p><p className="text-sm text-slate-600">{d.pickup_address}</p></div>
              {d.business?.phone && <Button variant="outline" size="sm" href={telHref(d.business.phone)} aria-label="Call sender"><Phone className="h-4 w-4" /></Button>}
            </div>
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
              <div className="flex-1"><p className="text-sm font-semibold text-navy-900">Drop-off location</p><p className="text-sm text-slate-600">{d.dropoff_address}</p></div>
            </div>
            <div className="flex gap-3">
              <Package className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
              <div><p className="text-sm font-semibold text-navy-900">Item details</p>
                <p className="text-sm text-slate-600">{d.item_description}</p>
                <p className="text-xs text-slate-500">{PACKAGE_SIZES.find((p) => p.value === d.package_size)?.label}</p>
                {d.special_instructions && <p className="mt-1 text-sm text-slate-600">Note: {d.special_instructions}</p>}</div>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
              <div><dt className="text-slate-500">Distance</dt><dd className="font-semibold text-navy-900">{km != null ? formatKm(km) : 'Not pinned'}</dd></div>
              <div><dt className="text-slate-500">Estimated time</dt><dd className="font-semibold text-navy-900">{km != null ? `${estimateMinutes(km)[0]}–${estimateMinutes(km)[1]} mins` : '—'}</dd></div>
            </dl>
            {d.status === 'assigned' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button variant="outline-brand" onClick={() => setDeclining(true)} disabled={Boolean(busy)}>Decline</Button>
                <Button onClick={accept} loading={busy === 'accept'}>Accept Job</Button>
              </div>
            )}
          </Card>

          {active && (
            <Card className="space-y-4 p-5">
              <RiderSteps d={d} />
              <div className="grid grid-cols-2 gap-2">
                {d.business?.phone ? <Button variant="outline" href={telHref(d.business.phone)}><Phone className="h-4 w-4" />Call Sender</Button> : <span />}
                {d.recipient_phone && <Button variant="outline" href={telHref(d.recipient_phone)}><Phone className="h-4 w-4" />Call Recipient</Button>}
              </div>
              {next && next.to !== 'delivered' && (
                <Button className="w-full" size="lg" loading={busy === 'advance'} onClick={() => run('advance', () => advanceDelivery(d.id, next.to), `Status updated: ${next.label.toLowerCase()}`)}>
                  {next.label}
                </Button>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={active ? `Navigate to ${target.label}` : 'Route'}
              action={active && <a href={mapsDirectionsUrl(target.address, target.lat, target.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">Open in Maps<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span></a>} />
            <div className="p-5">
              <DeliveryMap className="h-72"
                pickup={{ lat: d.pickup_lat, lng: d.pickup_lng, label: `Pickup: ${d.pickup_address}` }}
                dropoff={{ lat: d.dropoff_lat, lng: d.dropoff_lng, label: `Drop-off: ${d.dropoff_address}` }}
                rider={d.riderLocation ? { ...d.riderLocation, label: 'You' } : null} />
            </div>
          </Card>
          {d.status === 'arrived' && <CompleteForm d={d} onDone={async () => { await refresh(); setScreen('completed'); }} />}
          {d.status === 'delivered' && (
            <Card><CardHeader title="Proof of delivery" description={`Completed ${formatDateTime(d.delivered_at)}`} />
              <div className="space-y-2 p-5"><ProofImage path={d.proof_path} />{d.completion_notes && <p className="text-sm text-slate-600">Your note: {d.completion_notes}</p>}</div></Card>
          )}
          {d.status === 'cancelled' && (
            <Card className="p-5 text-sm text-slate-600">This delivery was cancelled{d.cancel_reason ? `: ${d.cancel_reason}` : '.'}</Card>
          )}
        </div>
      </div>

      <ConfirmDialog open={declining} onClose={() => setDeclining(false)} title={`Decline job #${d.code}?`}
        message="The business will be notified and can offer it to another rider." confirmLabel="Decline job" onConfirm={decline} />
    </div>
  );
}
