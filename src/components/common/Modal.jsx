import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { Textarea } from '@/components/forms/Fields';

export function Modal({ open, onClose, title, children, footer, size = 'md', hideClose = false }) {
  const titleId = useId();
  const panel = useRef(null);
  const lastFocus = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const first = panel.current?.querySelector('input, textarea, select, button:not([data-close]), a[href]');
    (first || panel.current)?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current?.();
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      lastFocus.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl ${widths[size]}`}>
        {!hideClose && (
          <button data-close type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <X className="h-5 w-5" />
          </button>
        )}
        {title && <h2 id={titleId} className="pr-8 text-lg font-bold text-navy-900">{title}</h2>}
        <div className={title ? 'mt-3' : ''}>{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmation for consequential actions, with an optional reason field. */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', withReason = false, reasonLabel = 'Reason (optional)' }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setReason(''); }, [open]);
  const go = async () => {
    setBusy(true);
    try { await onConfirm(reason.trim()); onClose(); } catch { /* caller shows toast */ } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={title} size="sm"
      footer={<>
        <Button variant="outline" onClick={onClose} disabled={busy}>Keep it</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={go} loading={busy}>{confirmLabel}</Button>
      </>}>
      <p className="text-sm text-slate-600">{message}</p>
      {withReason && <Textarea className="mt-4" label={reasonLabel} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />}
    </Modal>
  );
}

export function SuccessModal({ open, title, message, children, actions }) {
  return (
    <Modal open={open} hideClose size="sm">
      <div className="flex flex-col items-center text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <h2 className="mt-4 text-xl font-bold text-navy-900">{title}</h2>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        {children}
        <div className="mt-6 flex w-full flex-col gap-2">{actions}</div>
      </div>
    </Modal>
  );
}
