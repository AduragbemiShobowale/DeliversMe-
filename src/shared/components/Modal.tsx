import type { ReactNode } from "react";
import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Tier 1 primitive (Stage 19) — base for Customer/Rider add forms and
 * the Dispatch Queue's assignment panel (Stage 13). Closes on Escape
 * and backdrop click; consumers own their own form state (react-hook-form,
 * per Stage 18 — this component holds no form logic itself).
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-md)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && (
          <h2 className="mb-4 text-base font-medium text-[var(--color-text-primary)]">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
