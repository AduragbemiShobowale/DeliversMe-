import { useState } from 'react';
import toast from 'react-hot-toast';
import { Inbox, Mail } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { listMessages, setMessageStatus } from '@/services/admin';
import { PAGE_SIZE } from '@/config/site';
import { Card, PageHeader, DetailRow } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Pagination, Tabs } from '@/components/common/Controls';
import { EmptyState } from '@/components/common/States';
import { DataTable } from '@/components/tables/DataTable';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/utils/format';

const SUBJECT = { general: 'General enquiry', support: 'Support', partnership: 'Partnership', rider: 'Becoming a rider', billing: 'Billing', other: 'Other' };

export default function AdminMessagesPage() {
  const [status, setStatus] = useState('new');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(() => listMessages({ status, page }), [status, page]);

  const toggle = async (m) => {
    setBusy(true);
    const next = m.status === 'new' ? 'resolved' : 'new';
    try { await setMessageStatus(m.id, next); toast.success(next === 'resolved' ? 'Marked as resolved' : 'Reopened'); setOpen(null); reload({ silent: true }); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const columns = [
    { key: 'from', header: 'From', primary: true, render: (r) => <span><span className="block font-medium">{r.full_name}</span><span className="text-xs text-slate-500">{r.email}</span></span> },
    { key: 'subject', header: 'Subject', render: (r) => SUBJECT[r.subject] },
    { key: 'message', header: 'Message', hideOnMobile: true, render: (r) => <span className="line-clamp-1 max-w-xs text-slate-600">{r.message}</span> },
    { key: 'status', header: 'Status', render: (r) => (r.status === 'new' ? <Badge tone="amber">New</Badge> : <Badge tone="green">Resolved</Badge>) },
    { key: 'date', header: 'Received', render: (r) => formatDateTime(r.created_at) },
  ];

  return (
    <div>
      <PageHeader title="Contact messages" description="Messages sent from the public Contact page. Reply by email, then mark them resolved." />
      <Card>
        <div className="px-5 pt-4"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: 'new', label: 'New' }, { value: 'resolved', label: 'Resolved' }, { value: '', label: 'All' }]} /></div>
        <div className="mt-2">
          <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload} onRowClick={setOpen}
            empty={<EmptyState icon={Inbox} title={status === 'new' ? 'Inbox zero' : 'No messages'} />} />
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={data?.count || 0} onChange={setPage} />
      </Card>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? SUBJECT[open.subject] : ''} size="lg"
        footer={open && <>
          <Button variant="outline" href={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${SUBJECT[open.subject]} — DeliverSME`)}`}><Mail className="h-4 w-4" />Reply by email</Button>
          <Button onClick={() => toggle(open)} loading={busy}>{open.status === 'new' ? 'Mark resolved' : 'Reopen'}</Button>
        </>}>
        {open && (
          <>
            <dl className="divide-y divide-slate-100"><DetailRow label="From">{open.full_name}</DetailRow><DetailRow label="Email">{open.email}</DetailRow><DetailRow label="Received">{formatDateTime(open.created_at)}</DetailRow></dl>
            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-navy-900">{open.message}</p>
          </>
        )}
      </Modal>
    </div>
  );
}
