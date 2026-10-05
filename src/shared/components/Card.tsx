import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
  children: ReactNode;
}

const paddingClasses = {
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

/** Tier 1 primitive (Stage 19) — the white/12px-radius container used across every screen. */
export function Card({
  padding = "md",
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`bg-surface rounded-[var(--radius-card)] shadow-[var(--shadow-sm)] ${paddingClasses[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
