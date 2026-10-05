import { Check } from 'lucide-react';
import { TIMELINE_STEPS, stepState } from '@/features/deliveries/status';
import { formatTime } from '@/utils/format';

export function StatusTimeline({ delivery }) {
  const at = (key) => {
    const h = [...(delivery.history || [])].reverse().find((x) => x.status === key);
    return h?.created_at;
  };
  if (delivery.status === 'cancelled' || delivery.status === 'rejected') {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        This delivery was {delivery.status === 'rejected' ? 'declined by the business' : 'cancelled'}
        {delivery.cancel_reason ? `: ${delivery.cancel_reason}` : '.'}
      </p>
    );
  }
  return (
    <ol className="relative space-y-4">
      {TIMELINE_STEPS.map((s, i) => {
        const st = stepState(delivery.status, s.key);
        return (
          <li key={s.key} className="relative flex items-start gap-3">
            {i < TIMELINE_STEPS.length - 1 && <span aria-hidden="true" className={`absolute left-[11px] top-6 h-[calc(100%+4px)] w-0.5 ${st === 'done' ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full ${st === 'done' ? 'bg-emerald-500 text-white' : st === 'current' ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'border-2 border-slate-300 bg-white'}`}>
              {st === 'done' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              {st === 'current' && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <div className="flex flex-1 items-baseline justify-between gap-3">
              <span className={`text-sm ${st === 'upcoming' ? 'text-slate-500' : 'font-medium text-navy-900'}`}>{s.label}</span>
              <span className="text-xs text-slate-500">{st === 'upcoming' ? 'Pending' : formatTime(at(s.key))}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function HistoryList({ history = [] }) {
  if (!history.length) return <p className="text-sm text-slate-500">No status changes yet.</p>;
  return (
    <ul className="space-y-3">
      {history.map((h) => (
        <li key={h.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
          <div>
            <p className="font-medium capitalize text-navy-900">{h.status.replace('_', ' ')}{h.note ? <span className="font-normal text-slate-500"> — {h.note}</span> : null}</p>
            <p className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString('en-NG')}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
