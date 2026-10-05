import { AlertTriangle, Inbox } from 'lucide-react';
import { errorMessage } from '@/lib/errors';
import { Button } from './Button';

export function EmptyState({ icon: Icon = Inbox, title, message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon className="h-6 w-6" /></span>
      <h3 className="mt-3 font-semibold text-navy-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Could not load this data', message, error, onRetry, action }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600"><AlertTriangle className="h-6 w-6" /></span>
      <h3 className="mt-3 font-semibold text-navy-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message || errorMessage(error)}</p>
      {onRetry && <Button variant="outline" className="mt-4" onClick={() => onRetry()}>Try again</Button>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="space-y-3 p-5" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
    </div>
  );
}
