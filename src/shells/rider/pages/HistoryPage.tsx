import { Card, Badge, SkeletonBlock, EmptyState } from "../../../shared/components";
import type { BadgeTone } from "../../../shared/components";
import { useRiderHistory } from "../../../features/dispatch/hooks/useRiderJobs";

const statusTone: Record<string, BadgeTone> = { delivered: "success", failed: "danger" };

export function HistoryPage() {
  const { data: history, isLoading } = useRiderHistory();

  return (
    <div>
      <h1 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">History</h1>
      {isLoading && <SkeletonBlock height="4rem" />}
      {!isLoading && history?.length === 0 && (
        <EmptyState headline="No completed deliveries yet" body="Your delivery history will show up here." />
      )}
      <div className="flex flex-col gap-2">
        {(history ?? []).map((d) => (
          <Card key={d.id} padding="sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-primary)]">{d.customer_name}</span>
              <Badge tone={statusTone[d.status]}>{d.status}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
