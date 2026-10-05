import { SkeletonRows, EmptyState, ErrorState } from '@/components/common/States';

/**
 * Responsive table: a real <table> from md up, stacked cards on phones.
 * columns: [{ key, header, render?(row), className?, hideOnMobile? , primary? }]
 */
export function DataTable({ columns, rows, loading, error, onRetry, empty, rowKey = 'id', onRowClick, selectable }) {
  if (loading && !rows?.length) return <SkeletonRows />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!rows?.length) return empty || <EmptyState title="Nothing here yet" />;

  const cell = (c, r) => (c.render ? c.render(r) : r[c.key]);
  const clickProps = (r) => (onRowClick ? {
    onClick: () => onRowClick(r),
    onKeyDown: (e) => { if (e.key === 'Enter') onRowClick(r); },
    tabIndex: 0,
    className: 'cursor-pointer hover:bg-slate-50 focus-visible:bg-brand-50 focus-visible:outline-none',
  } : {});

  return (
    <div className={loading ? 'opacity-60 transition-opacity' : ''}>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              {selectable && <th className="w-10 px-5 py-3"><span className="sr-only">Select</span></th>}
              {columns.map((c) => <th key={c.key} scope="col" className={`px-5 py-3 ${c.className || ''}`}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const p = clickProps(r);
              return (
                <tr key={r[rowKey]} {...p} className={p.className}>
                  {selectable && <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>{selectable(r)}</td>}
                  {columns.map((c) => <td key={c.key} className={`px-5 py-3 align-middle text-navy-900 ${c.className || ''}`}>{cell(c, r)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((r) => {
          const p = clickProps(r);
          return (
            <li key={r[rowKey]} {...p} className={`flex gap-3 px-4 py-3 ${p.className || ''}`}>
              {selectable && <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>{selectable(r)}</div>}
              <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {columns.filter((c) => !c.hideOnMobile).map((c) => (
                  <div key={c.key} className={c.primary ? 'col-span-2' : ''}>
                    {!c.primary && <dt className="text-xs text-slate-500">{c.header}</dt>}
                    <dd className={c.primary ? 'font-semibold text-navy-900' : 'text-navy-900'}>{cell(c, r)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
