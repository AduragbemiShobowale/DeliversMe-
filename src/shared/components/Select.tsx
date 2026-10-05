import { forwardRef, type SelectHTMLAttributes, type ReactNode } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className = "", children, ...rest }, ref) => {
    const selectId = id ?? rest.name;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-[var(--color-text-primary)]"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`h-9 rounded-[var(--radius-control)] border px-3 text-sm outline-none transition focus:ring-2 ${
            error
              ? "border-[var(--color-danger)] focus:ring-[var(--color-danger)]/30"
              : "border-[var(--color-border-strong)] focus:ring-[var(--color-primary)]/20"
          } ${className}`}
          {...rest}
        >
          {children}
        </select>
        {error && (
          <span className="text-xs text-[var(--color-danger)]">{error}</span>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
