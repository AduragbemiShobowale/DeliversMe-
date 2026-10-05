export function Spinner({ className = 'h-5 w-5', label = 'Loading' }) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-brand-600">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
