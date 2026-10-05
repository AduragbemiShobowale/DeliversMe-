import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Tier 1 primitive (Stage 19). Per CDS content conventions: placeholders
 * are real examples of valid input, not "e.g." prefixes or restated
 * labels. Error text is set by the consuming form (react-hook-form
 * validation, per Stage 18), not generated here.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--color-text-primary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-9 rounded-[var(--radius-control)] border px-3 text-sm outline-none transition focus:ring-2 focus:ring-offset-0 ${
            error
              ? "border-[var(--color-danger)] focus:ring-[var(--color-danger)]/30"
              : "border-[var(--color-border-strong)] focus:ring-[var(--color-primary)]/20"
          } ${className}`}
          {...rest}
        />
        {error && (
          <span className="text-xs text-[var(--color-danger)]">{error}</span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
