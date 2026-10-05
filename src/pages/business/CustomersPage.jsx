import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Pencil, PackagePlus, Trash2, Users, Plus } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/services/customers';
import { businessCustomerSchema } from '@/features/deliveries/validation';
import { PAGE_SIZE } from '@/config/site';
import { Card, PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { SearchInput, Pagination } from '@/components/common/Controls';
import { EmptyState } from '@/components/common/States';
import { Input } from '@/components/forms/Fields';
import { DataTable } from '@/components/tables/DataTable';
import { errorMessage } from '@/lib/errors';
import { NoBusiness } from './BusinessDashboard';

function CustomerForm({ open, onClose, initial, onSave }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(businessCustomerSchema),
    values: { full_name: initial?.full_name || '', phone: initial?.phone || '', email: initial?.email || '', address: initial?.address || '' },
  });
  const submit = async (values) => {
    try { await onSave(values); onClose(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit customer' : 'Add customer'}>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        <Input label="Full name" required error={errors.full_name?.message} {...register('full_name')} />
        <Input label="Phone number" type="tel" required placeholder="+234 802 123 4567" error={errors.phone?.message} {...register('phone')} />
        <Input label="Email (optional)" type="email" error={errors.email?.message} {...register('email')} />
        <Input label="Address (optional)" error={errors.address?.message} {...register('address')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{initial ? 'Save changes' : 'Add customer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CustomersPage() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [removing, setRemoving] = useState(null);
  const q = useDebounce(search, 300);
  const bid = business?.id;
  const { data, loading, error, reload } = useAsync(() => listCustomers(bid, { search: q, page }), [bid, q, page], { enabled: Boolean(bid) });
  if (!bid) return <NoBusiness />;

  const save = async (values) => {
    if (editing === 'new') { await createCustomer(bid, values); toast.success('Customer added'); }
    else { await updateCustomer(editing.id, values); toast.success('Customer updated'); }
    reload({ silent: true });
  };
  const remove = async () => {
    try { await deleteCustomer(removing.id); toast.success('Customer removed'); reload({ silent: true }); }
    catch (e) { toast.error(errorMessage(e)); throw e; }
  };

  const columns = [
    { key: 'full_name', header: 'Name', primary: true, render: (r) => <span className="font-medium">{r.full_name}</span> },
    { key: 'phone', header: 'Phone' },
    { key: 'address', header: 'Location', render: (r) => r.address || '—' },
    { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', render: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" aria-label={`Create delivery for ${r.full_name}`} title="Create delivery"
          onClick={() => navigate('/business/deliveries/new', { state: { customerId: r.id } })}><PackagePlus className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" aria-label={`Edit ${r.full_name}`} title="Edit" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" aria-label={`Remove ${r.full_name}`} title="Remove" onClick={() => setRemoving(r)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Customers" description="People you deliver to. Past deliveries keep their details if a customer is removed."
        action={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Add Customer</Button>} />
      <Card>
        <div className="p-5 pb-2"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search customers…" className="sm:max-w-xs" label="Search customers" /></div>
        <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload}
          empty={<EmptyState icon={Users} title={q ? 'No customers match' : 'No customers yet'} message={q ? 'Try another name or phone.' : 'Add customers to create deliveries for them faster.'}
            action={!q && <Button onClick={() => setEditing('new')}>Add Customer</Button>} />} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data?.count || 0} onChange={setPage} />
      </Card>
      <CustomerForm open={Boolean(editing)} onClose={() => setEditing(null)} initial={editing === 'new' ? null : editing} onSave={save} />
      <ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} title={`Remove ${removing?.full_name}?`}
        message="They will no longer appear in your customer list. Existing deliveries are not affected." confirmLabel="Remove customer" onConfirm={remove} />
    </div>
  );
}
