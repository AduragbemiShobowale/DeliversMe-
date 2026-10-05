import { useState } from 'react';
import toast from 'react-hot-toast';
import { Users } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { listUsers, setUserActive, setUserRole } from '@/services/admin';
import { PAGE_SIZE, ROLE_LABEL } from '@/config/site';
import { Card, PageHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/Modal';
import { SearchInput, Pagination, Tabs } from '@/components/common/Controls';
import { EmptyState } from '@/components/common/States';
import { Avatar } from '@/components/common/Avatar';
import { DataTable } from '@/components/tables/DataTable';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/utils/format';

const ROLES = Object.keys(ROLE_LABEL);

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null); // {type:'role'|'active', row, value}
  const q = useDebounce(search, 300);
  const { data, loading, error, reload } = useAsync(() => listUsers({ search: q, role, page }), [q, role, page]);

  const apply = async () => {
    const { type, row, value } = pending;
    try {
      if (type === 'role') await setUserRole(row.id, value); else await setUserActive(row.id, value);
      toast.success(type === 'role' ? `${row.full_name} is now ${ROLE_LABEL[value]}` : `${row.full_name} ${value ? 'reactivated' : 'suspended'}`);
      reload({ silent: true });
    } catch (e) { toast.error(errorMessage(e)); throw e; }
  };

  const columns = [
    { key: 'name', header: 'User', primary: true, render: (r) => (
      <span className="flex items-center gap-2"><Avatar name={r.full_name} src={r.avatar_url} size="sm" />
        <span><span className="block font-medium">{r.full_name}{r.id === user.id && <span className="ml-1 text-xs text-slate-500">(you)</span>}</span><span className="text-xs text-slate-500">{r.email}</span></span></span>) },
    { key: 'phone', header: 'Phone', hideOnMobile: true, render: (r) => r.phone || '—' },
    { key: 'role', header: 'Role', render: (r) => (r.id === user.id ? ROLE_LABEL[r.role] : (
      <select aria-label={`Role for ${r.full_name}`} value={r.role} onChange={(e) => setPending({ type: 'role', row: r, value: e.target.value })}
        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
        {ROLES.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}
      </select>)) },
    { key: 'status', header: 'Status', render: (r) => (r.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Suspended</Badge>) },
    { key: 'joined', header: 'Joined', hideOnMobile: true, render: (r) => formatDate(r.created_at) },
    { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', render: (r) => r.id !== user.id && (
      <Button size="sm" variant={r.is_active ? 'outline-danger' : 'outline'} onClick={() => setPending({ type: 'active', row: r, value: !r.is_active })}>
        {r.is_active ? 'Suspend' : 'Reactivate'}</Button>) },
  ];

  const title = pending?.type === 'role'
    ? `Make ${pending.row.full_name} ${pending.value === 'admin' ? 'an' : 'a'} ${ROLE_LABEL[pending.value]}?`
    : pending ? `${pending.value ? 'Reactivate' : 'Suspend'} ${pending.row.full_name}?` : '';
  const message = pending?.type === 'role'
    ? (pending.value === 'admin' ? 'Admins can see all data and manage every account. Only do this for trusted staff.' : 'Their dashboard changes on next load. Existing deliveries are kept.')
    : pending?.value ? 'They will be able to sign in and use the platform again.' : 'They will be signed out on their next request and cannot create or act on deliveries.';

  return (
    <div>
      <PageHeader title="Users" description="Manage roles and account status. Role changes and suspensions are enforced in the database." />
      <Card>
        <div className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <Tabs value={role} onChange={(v) => { setRole(v); setPage(1); }} items={[{ value: '', label: 'All' }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]} />
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, email, phone…" className="sm:w-72" label="Search users" />
        </div>
        <div className="mt-2">
          <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload} empty={<EmptyState icon={Users} title="No users found" />} />
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={data?.count || 0} onChange={setPage} />
      </Card>
      <ConfirmDialog open={Boolean(pending)} onClose={() => setPending(null)} title={title} message={message}
        tone={pending?.type === 'active' && !pending.value ? 'danger' : 'primary'} confirmLabel="Confirm" onConfirm={apply} />
    </div>
  );
}
