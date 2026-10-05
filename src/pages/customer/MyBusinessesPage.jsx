import { Store, Phone } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { customerBusinesses } from '@/services/businesses';
import { Card, PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/States';
import { formatDate, telHref } from '@/utils/format';

export default function MyBusinessesPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => customerBusinesses(user.id), [user.id]);
  return (
    <div>
      <PageHeader title="My Businesses" description="Businesses you have requested deliveries from." action={<Button to="/customer/request">Find a Business</Button>} />
      <Card>
        {loading ? <SkeletonRows /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.length ? (
          <EmptyState icon={Store} title="No businesses yet" message="Once you request a delivery from a business, it appears here for quick reordering."
            action={<Button to="/customer/request">Find a Business</Button>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Avatar name={b.name} src={b.logo_url} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy-900">{b.name}</p>
                  <p className="text-xs text-slate-500">{b.deliveries} request{b.deliveries === 1 ? '' : 's'} · last on {formatDate(b.last)}</p>
                </div>
                <div className="flex gap-2">
                  {b.phone && <Button variant="outline" size="sm" href={telHref(b.phone)} aria-label={`Call ${b.name}`}><Phone className="h-4 w-4" />Call</Button>}
                  <Button size="sm" to={`/customer/request/${b.id}`}>Request delivery</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
