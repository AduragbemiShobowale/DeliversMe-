import { CheckCircle2, Circle } from 'lucide-react';
import { PASSWORD_RULES } from '@/features/authentication/validation';

export function PasswordRules({ value = '' }) {
  return (
    <ul className="mt-2 space-y-1" aria-label="Password requirements">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.key} className={`flex items-center gap-2 text-xs ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
            {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
            {r.label}<span className="sr-only">{ok ? ' (met)' : ' (not met)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
