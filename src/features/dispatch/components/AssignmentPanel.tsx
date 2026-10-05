import { Card, Badge, Button, EmptyState } from "../../../shared/components";
import type { BadgeTone } from "../../../shared/components";
import { useSuggestedRiders, useAssignRider } from "../hooks/useDispatch";

interface AssignmentPanelProps {
  deliveryId: string;
  customerName: string;
  priority: string;
}

const availabilityTone: Record<string, BadgeTone> = {
  available: "success",
  busy: "warning",
  offline: "neutral",
};

/** Stage 13's dispatch workspace: assign directly from the suggested list, no navigation. */
export function AssignmentPanel({ deliveryId, customerName, priority }: AssignmentPanelProps) {
  const { data: riders, isLoading } = useSuggestedRiders();
  const assignRider = useAssignRider();

  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Assign — {customerName}</span>
        <Badge tone={priority === "urgent" ? "warning" : "neutral"}>{priority}</Badge>
      </div>
      <div className="mb-3 text-xs text-[var(--color-text-muted)]">Suggested assignment order</div>

      {isLoading && <p className="text-sm text-[var(--color-text-secondary)]">Loading riders…</p>}
      {!isLoading && (!riders || riders.length === 0) && (
        <EmptyState
          headline="No riders yet"
          body="Invite a rider from the Riders page before assigning deliveries."
        />
      )}
      {!isLoading && riders && riders.length > 0 && (
        <div className="flex flex-col gap-2">
          {riders.map((rider) => (
            <div
              key={rider.profile_id}
              className={`flex items-center justify-between rounded-[var(--radius-control)] border px-3 py-2 ${
                rider.availability_status === "offline" ? "opacity-50" : ""
              } border-[var(--color-border)]`}
            >
              <div>
                <div className="text-sm text-[var(--color-text-primary)]">{rider.full_name}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {rider.active_count} active {rider.active_count === 1 ? "delivery" : "deliveries"}
                </div>
              </div>
              {rider.availability_status === "offline" ? (
                <Badge tone={availabilityTone[rider.availability_status]}>Offline</Badge>
              ) : (
                <Button
                  variant={rider.availability_status === "available" ? "primary" : "secondary"}
                  size="sm"
                  disabled={assignRider.isPending}
                  onClick={() => assignRider.mutate({ deliveryId, riderId: rider.profile_id })}
                >
                  Assign
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {assignRider.isError && (
        <p className="mt-2 text-sm text-[var(--color-danger)]">Couldn't assign this rider. Try again.</p>
      )}
    </Card>
  );
}
