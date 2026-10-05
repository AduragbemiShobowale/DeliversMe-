interface AvatarProps {
  initials: string;
  size?: "sm" | "md";
}

const sizeClasses = {
  sm: "w-7 h-7 text-[11px]",
  md: "w-9 h-9 text-xs",
};

/** Tier 1 primitive (Stage 19) — used in nav headers and rider/customer list rows. */
export function Avatar({ initials, size = "md" }: AvatarProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-[#E6F1FB] font-medium text-[#0C447C] ${sizeClasses[size]}`}
    >
      {initials.slice(0, 2).toUpperCase()}
    </div>
  );
}
