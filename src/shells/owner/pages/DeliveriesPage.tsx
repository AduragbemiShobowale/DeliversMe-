import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button, Badge, EmptyState, SkeletonBlock } from "../../../shared/components";
import type { BadgeTone } from "../../../shared/components";
import { useDispatchQueue, useActiveDeliveries } from "../../../features/deliveries/hooks/useDeliveries";
import { CreateDeliveryModal } from "../../../features/deliveries/components/CreateDeliveryModal";
import { AssignmentPanel } from "../../../features/dispatch/components/AssignmentPanel";

const statusTone: Record<string, BadgeTone> = {
  ready_for_dispatch: "neutral",
  assigned: "accent",
  accepted: "accent",
  in_transit: "accent",
  delivered: "success",
  failed: "danger",
};

export function DeliveriesPage() {
  const { data: queue, isLoading: queueLoading } = useDispatchQueue();
  const { data: active, isLoading: activeLoading } = useActiveDeliveries();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = queue?.find((d) => d.id === selectedId);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-medium text-[var(--color-text-primary)]">Deliveries</h1>
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          Create delivery
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">Ready for dispatch</div>
          {queueLoading && <SkeletonBlock height="2.5rem" />}
          {!queueLoading && queue?.length === 0 && (
            <EmptyState headline="Nothing waiting on dispatch" body="New deliveries will appear here." />
          )}
          {!queueLoading && queue && queue.length > 0 && (
            <div className="flex flex-col divide-y divide-[var(--color-border)]">
              {queue.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`flex items-center justify-between py-3 text-left ${
                    selectedId === d.id ? "opacity-100" : "opacity-90 hover:opacity-100"
                  }`}
                >
                  <div>
                    <div className="text-sm text-[var(--color-text-primary)]">{d.customer_name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      created {new Date(d.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Badge tone={d.priority === "urgent" ? "warning" : "neutral"}>{d.priority}</Badge>
                </button>
              ))}
            </div>
          )}
        </Card>

        {selected ? (
          <AssignmentPanel deliveryId={selected.id} customerName={selected.customer_name} priority={selected.priority} />
        ) : (
          <Card>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Select a delivery from the queue to assign a rider.
            </p>
          </Card>
        )}
      </div>

      <div className="mt-4">
        <Card>
          <div className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">Active &amp; recent deliveries</div>
          {activeLoading && <SkeletonBlock height="2.5rem" />}
          {!activeLoading && active?.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">No active deliveries yet.</p>
          )}
          {!activeLoading && active && active.length > 0 && (
            <div className="flex flex-col divide-y divide-[var(--color-border)]">
              {active.map((d) => (
                <Link
                  key={d.id}
                  to={`/owner/deliveries/${d.id}`}
                  className="flex items-center justify-between py-3 hover:opacity-80"
                >
                  <div className="text-sm text-[var(--color-text-primary)]">{d.customer_name}</div>
                  <Badge tone={statusTone[d.status]}>{d.status.replace(/_/g, " ")}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <CreateDeliveryModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
