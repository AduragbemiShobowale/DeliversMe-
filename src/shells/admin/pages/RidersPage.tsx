import { Card, Badge, SkeletonBlock } from "../../../shared/components";
import type { BadgeTone } from "../../../shared/components";
import { useAllRidersPlatformWide } from "../../../features/admin/hooks/useAdmin";

const tone: Record<string, BadgeTone> = { available: "success", busy: "warning", offline: "neutral" };

export function RidersPage() {
  const { data: riders, isLoading } = useAllRidersPlatformWide();
  if (isLoading) return <SkeletonBlock height="12rem" />;

  return (
    <div>
      <h1 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">Riders (platform-wide)</h1>
      <Card>
        <div className="flex flex-col divide-y divide-[var(--color-border)]">
          {(riders ?? []).map((r) => (
            <div key={r.profile_id} className="flex items-center justify-between py-3">
              <span className="text-sm text-[var(--color-text-primary)]">{r.full_name}</span>
              <Badge tone={tone[r.availability_status]}>{r.availability_status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
