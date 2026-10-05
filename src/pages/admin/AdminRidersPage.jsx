import { useState } from 'react';
import toast from 'react-hot-toast';
import { Truck } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { listRiders, riderStatus } from '@/services/riders';
import { verifyRider } from '@/services/admin';
import { VEHICLE_TYPES } from '@/config/site';
import { Card, PageHeader } from '@/components/common/Card';
import { Badge, RiderStatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/Modal';
import { SearchInput, Tabs } from '@/components/common/Controls';
import { EmptyState } from '@/components/common/States';
import { DataTable } from '@/components/tables/DataTable';
import { errorMessage } from '@/lib/errors';

export default function AdminRidersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('unverified');
  const [pending, setPending] = useState(null);
  const q = useDebounce(search, 300);
  const { data, loading, error, reload } = useAsync(async () => (await listRiders(q)).map((r) => ({ ...r, status: riderStatus(r) })), [q]);
  const rows = (data || []).filter((r) => filter === 'all' || (filter === 'verified' ? r.is_verified : !r.is_verified));

  const apply = async () => {
    try {
      await verifyRider(pending.id, !pending.is_verified);
      toast.success(`${pending.full_name} ${pending.is_verified ? 'unverified' : 'verified'}`);
      reload({ silent: true });
    } catch (e) { toast.error(errorMessage(e)); throw e; }
  };

  const columns = [
    { key: 'name', header: 'Rider', primary: true, render: (r) => <span className="font-medium">{r.full_name}</span> },
    { key: 'phone', header: 'Phone', render: (r) => r.phone || <span className="text-amber-700">Missing</span> },
    { key: 'vehicle', header: 'Vehicle', render: (r) => (r.vehicle_type || r.plate_number
      ? [VEHICLE_TYPES.find((v) => v.value === r.vehicle_type)?.label, r.plate_number].filter(Boolean).join(' · ')
      : <span className="text-amber-700">Not provided</span>) },
    { key: 'verified', header: 'Verification', render: (r) => (r.is_verified ? <Badge tone="blue">Verified</Badge> : <Badge tone="amber">Pending</Badge>) },
    { key: 'status', header: 'Availability', hideOnMobile: true, render: (r) => <RiderStatusBadge status={r.status} /> },
    { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', render: (r) => (
      <Button size="sm" variant={r.is_verified ? 'outline-danger' : 'primary'} onClick={() => setPending(r)}>{r.is_verified ? 'Unverify' : 'Verify'}</Button>) },
  ];

  return (
    <div>
      <PageHeader title="Riders" description="Only verified riders can go online and be offered jobs. Check identity and vehicle details before verifying." />
      <Card>
        <div className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <Tabs value={filter} onChange={setFilter} items={[{ value: 'unverified', label: 'Awaiting verification' }, { value: 'verified', label: 'Verified' }, { value: 'all', label: 'All' }]} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search riders…" className="sm:w-64" label="Search riders" />
        </div>
        <div className="mt-2">
          <DataTable columns={columns} rows={rows} loading={loading} error={error} onRetry={reload}
            empty={<EmptyState icon={Truck} title={filter === 'unverified' ? 'No riders waiting' : 'No riders found'} />} />
        </div>
      </Card>
      <ConfirmDialog open={Boolean(pending)} onClose={() => setPending(null)}
        title={pending ? `${pending.is_verified ? 'Remove verification for' : 'Verify'} ${pending.full_name}?` : ''}
        message={pending?.is_verified ? 'They will be taken offline and cannot receive new jobs. Jobs already in progress are not affected.' : 'They will be able to go online and receive jobs from businesses.'}
        tone={pending?.is_verified ? 'danger' : 'primary'} confirmLabel={pending?.is_verified ? 'Unverify' : 'Verify rider'} onConfirm={apply} />
    </div>
  );
}
