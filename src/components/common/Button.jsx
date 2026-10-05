import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/60',
  outline: 'border border-slate-300 bg-white text-navy-900 hover:bg-slate-50',
  'outline-brand': 'border border-brand-600 bg-white text-brand-600 hover:bg-brand-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  'outline-danger': 'border border-red-300 bg-white text-red-600 hover:bg-red-50',
  white: 'bg-white text-brand-700 hover:bg-brand-50',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
};
const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, className = '', to, href, children, disabled, type = 'button', ...rest },
  ref,
) {
  const cls = `inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (to) return <Link ref={ref} to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a ref={ref} href={href} className={cls} {...rest}>{children}</a>;
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});
