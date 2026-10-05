import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "warning" | "danger" | "success";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

/**
 * Tier 1 primitive (Stage 19) — generic, tone-based only. Deliberately
 * has NO knowledge of delivery status or priority; StatusBadge and
 * PriorityBadge (Tier 2, features/dispatch or shared/domain) wrap this
 * with the fixed status→tone / priority→tone mapping so that mapping
 * lives in exactly one place. This is the fix for the Urgent/danger
 * color mixup caught during Stage 13 — never hardcode a tone at a call
 * site for a status or priority value; always go through the Tier 2
 * wrapper.
 */
const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  accent: "bg-[#E6F1FB] text-[#0C447C]",
  warning: "bg-[#FAEEDA] text-[var(--color-warning-strong)]",
  danger: "bg-[#FCEBEB] text-[var(--color-danger)]",
  success: "bg-[#EAF3DE] text-[var(--color-accent-strong)]",
};

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
