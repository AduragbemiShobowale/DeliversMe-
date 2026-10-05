import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/common/Logo';

/** Split auth screen: photographic navy panel on the left (desktop), form on the right. */
export function AuthLayout({ headline, sub, children, backTo = '/', backLabel = 'Back to Home' }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(360px,42%)_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-900 lg:block">
        <img src="/images/hero-rider.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[65%_center] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-900/95 via-navy-900/70 to-navy-900/30" />
        <div className="relative flex h-full flex-col p-10">
          <Logo dark />
          <h1 className="mt-16 max-w-sm text-4xl font-bold leading-tight text-white">{headline}</h1>
          <p className="mt-4 max-w-xs text-base leading-relaxed text-slate-200">{sub}</p>
        </div>
      </aside>
      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="lg:hidden"><Logo compact /></span>
          <Link to={backTo} className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-600">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />{backLabel}
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
