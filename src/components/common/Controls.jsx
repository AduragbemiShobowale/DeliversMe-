import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '', label = 'Search' }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
    </label>
  );
}

/** Underlined tabs as in the screenshots. items: [{value,label,count?}] */
export function Tabs({ items, value, onChange, className = '' }) {
  return (
    <div role="tablist" className={`flex gap-1 overflow-x-auto border-b border-slate-200 ${className}`}>
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button key={t.value} role="tab" type="button" aria-selected={active} onClick={() => onChange(t.value)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-navy-900'}`}>
            {t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm">
      <p className="text-slate-500">{from}–{to} of {total}</p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page"
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 disabled:opacity-40 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ChevronLeft className="h-4 w-4" /></button>
        <span className="px-2 tabular-nums text-slate-600">{page} / {pages}</span>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page"
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 disabled:opacity-40 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  );
}

export function Toggle({ checked, onChange, label, disabled, description }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-navy-900">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}
