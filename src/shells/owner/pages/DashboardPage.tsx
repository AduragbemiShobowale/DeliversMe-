import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, SkeletonBlock } from "../../../shared/components";
import { useDashboardMetrics } from "../../../features/performance/hooks/useDashboardMetrics";
import { useDispatchQueue } from "../../../features/deliveries/hooks/useDeliveries";
import { CreateDeliveryModal } from "../../../features/deliveries/components/CreateDeliveryModal";

export function DashboardPage() {
  const { data: metrics, isLoading } = useDashboardMetrics();
  const { data: queue } = useDispatchQueue();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-medium text-[var(--color-text-primary)]">Dashboard</h1>
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          + Create delivery
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {isLoading ? (
          <>
            <SkeletonBlock height="4.5rem" />
            <SkeletonBlock height="4.5rem" />
            <SkeletonBlock height="4.5rem" />
            <SkeletonBlock height="4.5rem" />
          </>
        ) : (
          <>
            <Card>
              <div className="text-xs text-[var(--color-text-secondary)]">Today's deliveries</div>
              <div className="text-2xl font-medium text-[var(--color-text-primary)]">{metrics?.todaysCount ?? "—"}</div>
            </Card>
            <Card>
              <div className="text-xs text-[var(--color-text-secondary)]">Completion rate</div>
              <div className="text-2xl font-medium text-[var(--color-text-primary)]">
                {metrics?.completionRate !== null && metrics?.completionRate !== undefined ? `${metrics.completionRate}%` : "—"}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-[var(--color-text-secondary)]">Avg delivery time</div>
              <div className="text-2xl font-medium text-[var(--color-text-primary)]">
                {metrics?.avgMinutes ?? "—"}{metrics?.avgMinutes ? " min" : ""}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-[var(--color-text-secondary)]">Avg rating</div>
              <div className="text-2xl font-medium text-[var(--color-text-primary)]">
                {metrics?.avgRating ?? "—"}{metrics?.avgRating ? "/5" : ""}
              </div>
              {metrics && metrics.completedCount > 0 && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  based on {metrics.ratedCount} of {metrics.completedCount} rated
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Ready for dispatch</span>
          <button onClick={() => navigate("/owner/deliveries")} className="text-xs text-primary">
            View all
          </button>
        </div>
        {(queue ?? []).slice(0, 5).map((d) => (
          <div key={d.id} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-[var(--color-text-primary)]">{d.customer_name}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{d.priority}</span>
          </div>
        ))}
        {queue?.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">Nothing waiting on dispatch.</p>
        )}
      </Card>

      <CreateDeliveryModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
