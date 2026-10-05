import { initials } from '@/utils/format';

export function Avatar({ name = '', src, size = 'md', className = '' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-24 w-24 text-2xl' };
  if (src) return <img src={src} alt="" className={`${sizes[size]} shrink-0 rounded-full object-cover ${className}`} />;
  return (
    <span aria-hidden="true" className={`${sizes[size]} grid shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700 ${className}`}>
      {initials(name)}
    </span>
  );
}
