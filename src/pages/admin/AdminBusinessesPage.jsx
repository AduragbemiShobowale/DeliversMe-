import { useState } from 'react';
import toast from 'react-hot-toast';
import { Building2 } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { listAllBusinesses, setBusinessStatus } from '@/services/admin';
import { PAGE_SIZE, BUSINESS_CATEGORIES } from '@/config/site';
import { Card, PageHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/Modal';
import { SearchInput, Pagination } from '@/components/common/Controls';
import { EmptyState } from '@/components/common/States';
import { DataTable } from '@/components/tables/DataTable';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/utils/format';

export default function AdminBusinessesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null); // {row, verified, active, label}
  const q = useDebounce(search, 300);
  const { data, loading, error, reload } = useAsync(() => listAllBusinesses({ search: q, page }), [q, page]);

  const apply = async () => {
    try {
      await setBusinessStatus(pending.row.id, pending.verified, pending.active);
      toast.success(`${pending.row.name} updated`);
      reload({ silent: true });
    } catch (e) { toast.error(errorMessage(e)); throw e; }
  };

  const columns = [
    { key: 'name', header: 'Business', primary: true, render: (r) => <span><span className="block font-medium">{r.name}</span><span className="text-xs text-slate-500">{BUSINESS_CATEGORIES.find((c) => c.value === r.category)?.label}</span></span> },
    { key: 'owner', header: 'Owner', render: (r) => <span><span className="block">{r.owner?.full_name}</span><span className="text-xs text-slate-500">{r.owner?.email}</span></span> },
    { key: 'phone', header: 'Phone', hideOnMobile: true, render: (r) => r.phone || '—' },
    { key: 'status', header: 'Status', render: (r) => (
      <span className="flex flex-wrap gap-1">{r.is_verified ? <Badge tone="blue">Verified</Badge> : <Badge>Unverified</Badge>}{!r.is_active && <Badge tone="red">Suspended</Badge>}</span>) },
    { key: 'created', header: 'Joined', hideOnMobile: true, render: (r) => formatDate(r.created_at) },
    { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', render: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="outline" onClick={() => setPending({ row: r, verified: !r.is_verified, active: r.is_active, label: r.is_verified ? 'Remove verification' : 'Verify' })}>{r.is_verified ? 'Unverify' : 'Verify'}</Button>
        <Button size="sm" variant={r.is_active ? 'outline-danger' : 'outline'} onClick={() => setPending({ row: r, verified: r.is_verified, active: !r.is_active, label: r.is_active ? 'Suspend' : 'Reactivate' })}>{r.is_active ? 'Suspend' : 'Reactivate'}</Button>
      </div>) },
  ];

  return (
    <div>
      <PageHeader title="Businesses" description="Verified businesses show a badge to customers. Suspended businesses are hidden and cannot create deliveries." />
      <Card>
        <div className="p-5 pb-2"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search businesses…" className="sm:max-w-xs" label="Search businesses" /></div>
        <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload} empty={<EmptyState icon={Building2} title="No businesses found" />} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data?.count || 0} onChange={setPage} />
      </Card>
      <ConfirmDialog open={Boolean(pending)} onClose={() => setPending(null)} title={pending ? `${pending.label}: ${pending.row.name}?` : ''}
        message="The owner is notified of the change." tone={pending && !pending.active ? 'danger' : 'primary'} confirmLabel={pending?.label} onConfirm={apply} />
    </div>
  );
}
