import { Link } from 'react-router-dom';

export function TruckMark({ className = 'h-9 w-12' }) {
  return (
    <svg viewBox="0 0 56 40" className={className} aria-hidden="true">
      <path d="M2 12h9M0 18h11M4 24h7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-brand-500" />
      <rect x="14" y="6" width="24" height="22" rx="3" className="fill-brand-600" />
      <path d="M38 13h7.5l6.5 8v7H38z" className="fill-navy-900" />
      <path d="M41 16h4l3.5 4.5H41z" fill="#fff" opacity=".85" />
      <circle cx="21" cy="31" r="4.5" className="fill-navy-900" stroke="#fff" strokeWidth="2" />
      <circle cx="44" cy="31" r="4.5" className="fill-navy-900" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export function Logo({ dark = false, to = '/', compact = false }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label="DeliverSME home">
      <TruckMark className={compact ? 'h-7 w-10' : 'h-9 w-12'} />
      <span className="leading-none">
        <span className={`block font-extrabold tracking-tight ${compact ? 'text-base' : 'text-xl'} ${dark ? 'text-white' : 'text-navy-900'}`}>
          DELIVERS<span className="text-brand-500">ME</span>
        </span>
        {!compact && <span className={`mt-1 block text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Delivering Possibilities</span>}
      </span>
    </Link>
  );
}
