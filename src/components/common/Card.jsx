export function Card({ className = '', children, as: As = 'div', ...rest }) {
  return <As className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`} {...rest}>{children}</As>;
}

export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 ${className}`}>
      <div>
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, action, back }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back}
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, tone = 'blue', icon: Icon, loading }) {
  const tones = {
    blue: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-3xl font-bold tabular-nums">{loading ? <span className="inline-block h-8 w-10 animate-pulse rounded bg-current opacity-10" /> : value}</p>
        {Icon && <Icon className="h-5 w-5 opacity-70" aria-hidden="true" />}
      </div>
      <p className="mt-1 text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

export function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[minmax(110px,40%)_1fr] gap-3 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words font-medium text-navy-900">{children || '—'}</dd>
    </div>
  );
}
