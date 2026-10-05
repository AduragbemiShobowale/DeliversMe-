import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useRealtime } from '@/hooks/useRealtime';
import { listDeliveries } from '@/services/deliveries';
import { STATUS_GROUPS } from '@/features/deliveries/status';
import { PAGE_SIZE } from '@/config/site';
import { Card } from '@/components/common/Card';
import { SearchInput, Tabs, Pagination } from '@/components/common/Controls';
import { EmptyState } from '@/components/common/States';
import { DataTable } from '@/components/tables/DataTable';

const LABELS = { all: 'All', requests: 'Requests', pending: 'Pending', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' };

/**
 * Paged, searchable, tabbed delivery list backed by Supabase (RLS-scoped).
 * Realtime changes to the scoped deliveries trigger a silent refresh.
 */
export function DeliveryList({
  scope, tabs = ['all', 'active', 'completed', 'cancelled'], columns, rowPath, emptyTitle = 'No deliveries yet',
  emptyMessage, emptyAction, selectable, toolbar, realtimeFilter, initialTab = 'all', onRows,
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search, 300);
  const scopeKey = JSON.stringify(scope);

  const { data, loading, error, reload } = useAsync(async () => {
    const res = await listDeliveries({ scope, statuses: STATUS_GROUPS[tab], search: q, page, pageSize: PAGE_SIZE });
    onRows?.(res.rows);
    return res;
  }, [scopeKey, tab, q, page]);

  useRealtime({ table: 'deliveries', filter: realtimeFilter, onChange: () => reload({ silent: true }), enabled: Boolean(realtimeFilter) });

  const changeTab = (t) => { setTab(t); setPage(1); };
  const filtered = Boolean(q) || tab !== 'all';

  return (
    <Card>
      <div className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <Tabs items={tabs.map((t) => ({ value: t, label: LABELS[t] }))} value={tab} onChange={changeTab} className="flex-1" />
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search ID, recipient, address…" className="sm:w-72" label="Search deliveries" />
      </div>
      {toolbar}
      <div className="mt-2">
        <DataTable
          columns={columns}
          rows={data?.rows}
          loading={loading}
          error={error}
          onRetry={reload}
          selectable={selectable}
          onRowClick={rowPath ? (r) => navigate(rowPath(r.id)) : undefined}
          empty={filtered
            ? <EmptyState icon={ClipboardList} title="No matching deliveries" message="Try another tab or search term." />
            : <EmptyState icon={ClipboardList} title={emptyTitle} message={emptyMessage} action={emptyAction} />}
        />
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.count || 0} onChange={setPage} />
    </Card>
  );
}
