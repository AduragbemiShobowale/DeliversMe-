import type { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  headline: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

/**
 * Tier 1 primitive (Stage 19). Per CDS content conventions: an empty
 * state is an invitation, not an apology — headline names the space,
 * body explains it in one line, action is a verb. Never render "Nothing
 * here yet."
 */
export function EmptyState({
  headline,
  body,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon && (
        <div className="mb-1 text-[var(--color-text-muted)]">{icon}</div>
      )}
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        {headline}
      </p>
      <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
        {body}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
