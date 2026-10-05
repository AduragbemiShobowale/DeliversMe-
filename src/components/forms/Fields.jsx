import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const base = 'block w-full rounded-lg border bg-white px-3.5 text-sm text-navy-900 placeholder:text-slate-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50 disabled:text-slate-500';
const border = (err) => (err ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-brand-500');

export function Field({ label, error, hint, children, id, required, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-navy-900">
          {label}{required && <span className="text-red-500" aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, required, className = '', id: idProp, ...rest }, ref) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <Field label={label} error={error} hint={hint} id={id} required={required} className={className}>
      <input ref={ref} id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        className={`${base} ${border(error)} h-11`} {...rest} />
    </Field>
  );
});

export const PasswordInput = forwardRef(function PasswordInput({ label, error, hint, required, className = '', id: idProp, ...rest }, ref) {
  const auto = useId();
  const id = idProp || auto;
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} id={id} required={required} className={className}>
      <div className="relative">
        <input ref={ref} id={id} type={show ? 'text' : 'password'} aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined} className={`${base} ${border(error)} h-11 pr-11`} {...rest} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-500 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, required, options = [], placeholder, className = '', id: idProp, ...rest }, ref) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <Field label={label} error={error} hint={hint} id={id} required={required} className={className}>
      <select ref={ref} id={id} aria-invalid={!!error} className={`${base} ${border(error)} h-11 pr-8`} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, required, className = '', rows = 3, id: idProp, ...rest }, ref) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <Field label={label} error={error} hint={hint} id={id} required={required} className={className}>
      <textarea ref={ref} id={id} rows={rows} aria-invalid={!!error} className={`${base} ${border(error)} py-2.5`} {...rest} />
    </Field>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, error, className = '', id: idProp, ...rest }, ref) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
        <input ref={ref} id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...rest} />
        <span>{label}</span>
      </label>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
});
