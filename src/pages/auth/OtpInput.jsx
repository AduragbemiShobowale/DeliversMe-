import { useRef } from 'react';

/** Six single-digit boxes with paste support and arrow/backspace navigation. */
export function OtpInput({ value, onChange, length = 6, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');
  const setAt = (i, d) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').slice(0, length));
  };
  const onInput = (i, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setAt(i, ''); return; }
    if (raw.length > 1) { // paste or autofill
      const merged = (digits.slice(0, i).join('') + raw).slice(0, length);
      onChange(merged);
      refs.current[Math.min(merged.length, length - 1)]?.focus();
      return;
    }
    setAt(i, raw);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
  };
  return (
    <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} value={d} disabled={disabled} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length} aria-label={`Digit ${i + 1}`} onChange={(e) => onInput(i, e)} onKeyDown={(e) => onKey(i, e)} onFocus={(e) => e.target.select()}
          className="h-12 w-11 rounded-lg border border-slate-300 text-center text-lg font-semibold text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 sm:h-14 sm:w-12" />
      ))}
    </div>
  );
}
