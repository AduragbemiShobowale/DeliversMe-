import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Star, Store, BadgeCheck } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { listBusinesses } from '@/services/businesses';
import { BUSINESS_CATEGORIES } from '@/config/site';
import { Card, PageHeader } from '@/components/common/Card';
import { SearchInput } from '@/components/common/Controls';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/States';
import { Avatar } from '@/components/common/Avatar';

const FILTERS = [{ value: '', label: 'All' }, ...BUSINESS_CATEGORIES];
const catLabel = (v) => BUSINESS_CATEGORIES.find((c) => c.value === v)?.label || v;

export function BusinessStats({ b }) {
  const done = Number(b.completed_deliveries || 0);
  return (
    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
      {b.avg_rating != null ? (
        <><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" /><span className="font-semibold text-navy-900">{Number(b.avg_rating).toFixed(1)}</span>
          <span>({b.rating_count} rating{Number(b.rating_count) === 1 ? '' : 's'} · {done} deliver{done === 1 ? 'y' : 'ies'})</span></>
      ) : <span>{done ? `${done} completed deliver${done === 1 ? 'y' : 'ies'} · no ratings yet` : 'New on DeliverSME'}</span>}
    </p>
  );
}

export default function FindBusinessPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const q = useDebounce(search, 300);
  const { data, loading, error, reload } = useAsync(() => listBusinesses(q, category), [q, category]);

  return (
    <div>
      <PageHeader title="Find a Business" description="Browse registered businesses offering delivery services." />
      <Card className="p-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search businesses…" label="Search businesses" />
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {FILTERS.map((f) => (
            <button key={f.value || 'all'} type="button" onClick={() => setCategory(f.value)} aria-pressed={category === f.value}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${category === f.value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {loading && !data ? <SkeletonRows /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
            <EmptyState icon={Store} title={q || category ? 'No businesses match' : 'No businesses yet'}
              message={q || category ? 'Try a different name or category.' : 'Businesses appear here once SME owners register.'} />
          ) : (
            <ul className={`grid gap-3 md:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
              {data.map((b) => (
                <li key={b.id}>
                  <Link to={`/customer/request/${b.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                    <Avatar name={b.name} src={b.logo_url} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate font-semibold text-navy-900">{b.name}
                        {b.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" aria-label="Verified business" />}</p>
                      <p className="truncate text-sm text-slate-500">{b.tagline || catLabel(b.category)}</p>
                      <BusinessStats b={b} />
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
