import { Link } from 'react-router-dom';
import { MapPin, Briefcase } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { listDeliveries } from '@/services/deliveries';
import { Card, PageHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/States';
import { distanceKm, formatKm, timeAgo } from '@/utils/format';

export function tripKm(d) {
  if (d.pickup_lat == null || d.dropoff_lat == null) return null;
  return distanceKm({ lat: d.pickup_lat, lng: d.pickup_lng }, { lat: d.dropoff_lat, lng: d.dropoff_lng });
}

export default function AvailableJobsPage() {
  const { user, rider } = useAuth();
  const { data, loading, error, reload } = useAsync(() => listDeliveries({ scope: { rider_id: user.id }, statuses: ['assigned'], pageSize: 50 }), [user.id]);
  useRealtime({ table: 'deliveries', filter: `rider_id=eq.${user.id}`, onChange: () => reload({ silent: true }) });

  return (
    <div>
      <PageHeader title="Available Jobs" description="Deliveries businesses have offered to you. Accept or decline each one." />
      <Card>
        {loading ? <SkeletonRows /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.rows.length ? (
          <EmptyState icon={Briefcase} title="No jobs offered right now"
            message={rider?.availability === 'available' ? 'Stay online — you will be notified as soon as a business offers you a job.' : 'You are offline. Go online from the top bar so businesses can offer you jobs.'} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.rows.map((d) => {
              const km = tripKm(d);
              return (
                <li key={d.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">#{d.code}{km != null && <span className="text-sm font-medium text-slate-500">{formatKm(km)}</span>}
                      {d.priority === 'express' ? <Badge tone="red">Express</Badge> : <Badge tone="blue">Standard</Badge>}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />Pickup: {d.pickup_address}</p>
                    <p className="flex items-start gap-1.5 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />Drop: {d.dropoff_address}</p>
                    <p className="mt-1 text-xs text-slate-500">From {d.business?.name} · offered {timeAgo(d.assigned_at || d.updated_at)}</p>
                  </div>
                  <Button size="sm" to={`/rider/jobs/${d.id}`}>View Details</Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">Looking for a job you already accepted? It&apos;s in <Link to="/rider/deliveries" className="font-medium text-brand-600 hover:underline">My Deliveries</Link>.</p>
    </div>
  );
}
