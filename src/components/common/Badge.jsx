import { STATUS_META } from '@/features/deliveries/status';

const TONES = {
  blue: 'bg-brand-50 text-brand-700 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function Badge({ tone = 'slate', children, className = '' }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: 'slate' };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const RIDER_TONE = { available: 'green', busy: 'amber', offline: 'slate' };
export function RiderStatusBadge({ status }) {
  return <Badge tone={RIDER_TONE[status] || 'slate'}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}
