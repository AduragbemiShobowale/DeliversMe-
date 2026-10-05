import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, Briefcase, CheckCircle2, Info, PackagePlus, Store, Trash2, Truck, UserCheck, XCircle } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { deleteNotification, listNotifications, markAllRead, markRead } from '@/services/notifications';
import { Card } from '@/components/common/Card';
import { PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Pagination, Tabs } from '@/components/common/Controls';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/States';
import { DELIVERY_PATH } from '@/config/routes';
import { PAGE_SIZE } from '@/config/site';
import { errorMessage } from '@/lib/errors';
import { timeAgo } from '@/utils/format';

export const NOTIFICATION_ICON = {
  delivery_request: { icon: PackagePlus, tone: 'bg-amber-50 text-amber-600' },
  delivery_update: { icon: Truck, tone: 'bg-brand-50 text-brand-600' },
  job_offer: { icon: Briefcase, tone: 'bg-violet-50 text-violet-600' },
  rider_assigned: { icon: UserCheck, tone: 'bg-orange-50 text-orange-600' },
  delivery_completed: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  delivery_cancelled: { icon: XCircle, tone: 'bg-red-50 text-red-600' },
  business_update: { icon: Store, tone: 'bg-slate-100 text-slate-600' },
  system: { icon: Info, tone: 'bg-slate-100 text-slate-600' },
};

export default function NotificationsPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const q = useAsync(() => listNotifications(user.id, { unreadOnly: tab === 'unread', page }), [user.id, tab, page]);
  useRealtime({ table: 'notifications', filter: `user_id=eq.${user.id}`, channelKey: `notif-page:${user.id}`, onChange: () => q.reload({ silent: true }) });

  const open = async (n) => {
    if (!n.read_at) { try { await markRead(n.id); } catch { /* non-blocking */ } }
    if (n.delivery_id && DELIVERY_PATH[role]) navigate(DELIVERY_PATH[role](n.delivery_id));
    else q.reload({ silent: true });
  };
  const readAll = async () => {
    try { await markAllRead(user.id); toast.success('All notifications marked as read'); q.reload({ silent: true }); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async (n) => {
    try { await deleteNotification(n.id); q.reload({ silent: true }); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const rows = q.data?.rows || [];

  return (
    <div>
      <PageHeader title="Notifications" description="Stay updated in real-time." action={<Button variant="outline" onClick={readAll}>Mark all as read</Button>} />
      <Card>
        <div className="px-5 pt-3"><Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} items={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} /></div>
        {q.loading && !q.data ? <SkeletonRows /> : q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : rows.length === 0 ? (
          <EmptyState icon={Bell} title={tab === 'unread' ? 'You’re all caught up' : 'No notifications yet'} message="Updates about your deliveries will appear here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((n) => {
              const meta = NOTIFICATION_ICON[n.type] || NOTIFICATION_ICON.system;
              const Icon = meta.icon;
              return (
                <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.read_at ? '' : 'bg-brand-50/40'}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${meta.tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                    <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">{n.title}{!n.read_at && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}</p>
                    {n.body && <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>}
                    <p className="mt-1 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                  </button>
                  <button type="button" onClick={() => remove(n)} aria-label="Delete notification" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={q.data?.count || 0} onChange={setPage} />
      </Card>
    </div>
  );
}
