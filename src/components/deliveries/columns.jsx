import { StatusBadge, Badge } from '@/components/common/Badge';
import { formatDateTime } from '@/utils/format';

export const col = {
  code: { key: 'code', header: 'ID', primary: true, render: (r) => <span className="font-semibold">#{r.code}</span> },
  business: { key: 'business', header: 'Business', render: (r) => r.business?.name || '—' },
  recipient: { key: 'recipient', header: 'Recipient', render: (r) => r.recipient_name },
  dropoff: { key: 'dropoff', header: 'Drop-off', render: (r) => <span className="line-clamp-1 max-w-[220px]">{r.dropoff_address}</span> },
  pickup: { key: 'pickup', header: 'Pickup', hideOnMobile: true, render: (r) => <span className="line-clamp-1 max-w-[200px]">{r.pickup_address}</span> },
  rider: { key: 'rider', header: 'Rider', hideOnMobile: true, render: (r) => r.rider?.full_name || '—' },
  status: { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  priority: { key: 'priority', header: 'Priority', hideOnMobile: true, render: (r) => (r.priority === 'express' ? <Badge tone="red">Express</Badge> : <Badge>Standard</Badge>) },
  date: { key: 'created_at', header: 'Date', render: (r) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(r.created_at)}</span> },
};
