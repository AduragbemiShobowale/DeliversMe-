import { Bike, Building2, User } from 'lucide-react';
import { ACCOUNT_TYPES } from '@/features/authentication/validation';

const ICONS = { sme_owner: Building2, rider: Bike, customer: User };

export function AccountTypePicker({ value, onChange, error }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-navy-900">Account Type</legend>
      <div className="space-y-2" role="radiogroup">
        {ACCOUNT_TYPES.map((t) => {
          const Icon = ICONS[t.value];
          const active = value === t.value;
          return (
            <label key={t.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${active ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-300 hover:border-brand-300'}`}>
              <input type="radio" name="account_type" value={t.value} checked={active} onChange={() => onChange(t.value)} className="sr-only" />
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-navy-900'}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span className="flex-1"><span className="block text-sm font-semibold text-navy-900">{t.label}</span><span className="block text-xs text-slate-500">{t.hint}</span></span>
              <span className={`h-4 w-4 rounded-full border-2 ${active ? 'border-brand-600 bg-brand-600 shadow-[inset_0_0_0_2px_#fff]' : 'border-slate-300'}`} aria-hidden="true" />
            </label>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </fieldset>
  );
}
