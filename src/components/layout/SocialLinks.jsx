import { site } from '@/config/site';

const ICONS = {
  linkedin: <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9z" />,
  x: <path d="M17.8 3h3.3l-7.2 8.2L22.3 21h-6.6l-5.2-6.8L4.6 21H1.3l7.7-8.8L1 3h6.8l4.7 6.2zm-1.2 16h1.8L7.5 4.9H5.6z" />,
  instagram: <path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 3.6c2.7 0 3 0 4.1.1 2.7.1 4 1.4 4.1 4.1.1 1.1.1 1.4.1 4.2s0 3.1-.1 4.2c-.1 2.7-1.4 4-4.1 4.1-1.1.1-1.4.1-4.1.1s-3.1 0-4.2-.1c-2.7-.1-4-1.4-4.1-4.1C3.6 15.1 3.6 14.8 3.6 12s0-3.1.1-4.2c.1-2.7 1.4-4 4.1-4.1 1.1-.1 1.4-.1 4.2-.1z" />,
  facebook: <path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v8h4v-8H17l.5-4h-4V8.8c0-.5.3-.8.5-.8z" />,
};

/** Renders only the networks configured in VITE_SOCIAL_* so there are no dead links. */
export function SocialLinks({ className = '', dark = false }) {
  if (!site.social.length) return null;
  return (
    <ul className={`flex gap-3 ${className}`}>
      {site.social.map((s) => (
        <li key={s.key}>
          <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
            className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${dark ? 'bg-navy-900 text-white hover:bg-brand-600' : 'bg-white/10 text-white hover:bg-brand-600'}`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">{ICONS[s.key]}</svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
