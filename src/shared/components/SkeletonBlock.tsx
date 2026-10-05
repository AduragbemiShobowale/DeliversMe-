interface SkeletonBlockProps {
  width?: string;
  height?: string;
  className?: string;
}

/**
 * Tier 1 primitive (Stage 19) — used across every Stage 13 loading
 * state (dashboard metric cards, list rows, form fields). Same
 * dimensions as the populated content it precedes, so no layout shift
 * occurs when real data arrives — this is a stated requirement across
 * multiple Stage 13 state tables, not a nice-to-have.
 */
export function SkeletonBlock({
  width = "100%",
  height = "1rem",
  className = "",
}: SkeletonBlockProps) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-control)] bg-slate-200 ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
