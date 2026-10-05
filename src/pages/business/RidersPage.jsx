import { useState } from 'react';
import { Phone, Truck } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { listRiders, riderStatus } from '@/services/riders';
import { Card, PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { SearchInput, Tabs } from '@/components/common/Controls';
import { RiderStatusBadge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/States';
import { Avatar } from '@/components/common/Avatar';
import { DataTable } from '@/components/tables/DataTable';
import { telHref, timeAgo } from '@/utils/format';
import { VEHICLE_TYPES } from '@/config/site';

export default function RidersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const q = useDebounce(search, 300);
  const { data, loading, error, reload } = useAsync(async () => (await listRiders(q)).map((r) => ({ ...r, status: riderStatus(r) })), [q]);
  const rows = (data || []).filter((r) => filter === 'all' || r.status === filter);
  const count = (s) => (data || []).filter((r) => r.status === s).length;

  const columns = [
    { key: 'full_name', header: 'Name', primary: true, render: (r) => <span className="flex items-center gap-2"><Avatar name={r.full_name} src={r.avatar_url} size="sm" /><span className="font-medium">{r.full_name}</span></span> },
    { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
    { key: 'vehicle', header: 'Vehicle', hideOnMobile: true, render: (r) => [VEHICLE_TYPES.find((v) => v.value === r.vehicle_type)?.label, r.plate_number].filter(Boolean).join(' · ') || '—' },
    { key: 'status', header: 'Status', render: (r) => <RiderStatusBadge status={r.status} /> },
    { key: 'seen', header: 'Last location', hideOnMobile: true, render: (r) => (r.last_location_at ? timeAgo(r.last_location_at) : '—') },
    { key: 'call', header: <span className="sr-only">Call</span>, className: 'text-right', render: (r) => r.phone && (
      <Button variant="ghost" size="sm" href={telHref(r.phone)} aria-label={`Call ${r.full_name}`}><Phone className="h-4 w-4" /></Button>) },
  ];

  return (
    <div>
      <PageHeader title="Riders" description="Verified DeliverSME riders you can offer jobs to. Availability updates when riders go online or offline." />
      <Card>
        <div className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <Tabs value={filter} onChange={setFilter} items={[
            { value: 'all', label: 'All', count: data?.length }, { value: 'available', label: 'Available', count: count('available') },
            { value: 'busy', label: 'Busy', count: count('busy') }, { value: 'offline', label: 'Offline', count: count('offline') }]} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search riders…" className="sm:w-64" label="Search riders" />
        </div>
        <div className="mt-2">
          <DataTable columns={columns} rows={rows} loading={loading} error={error} onRetry={reload}
            empty={<EmptyState icon={Truck} title="No riders to show" message={q || filter !== 'all' ? 'Try another filter.' : 'Riders appear once an administrator verifies them.'} />} />
        </div>
      </Card>
    </div>
  );
}
