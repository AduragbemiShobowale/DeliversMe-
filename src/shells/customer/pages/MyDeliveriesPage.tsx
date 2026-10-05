import { Card, Badge, SkeletonBlock, EmptyState } from "../../../shared/components";
import type { BadgeTone } from "../../../shared/components";
import { useMyDeliveriesAsCustomer } from "../../../features/deliveries/hooks/useDeliveries";

const statusTone: Record<string, BadgeTone> = {
  ready_for_dispatch: "neutral",
  assigned: "accent",
  accepted: "accent",
  in_transit: "accent",
  delivered: "success",
  failed: "danger",
};

/**
 * Deliberately read-only. Nothing in Phase 2's corrected model gives a
 * customer any write action -- they observe their own delivery history
 * across every SME relationship; SME Owners remain the only party who
 * plans, dispatches, or records outcomes (Stage 4's rating design, Phase
 * 2 §1's role definitions).
 */
export function MyDeliveriesPage() {
  const { data: deliveries, isLoading } = useMyDeliveriesAsCustomer();

  return (
    <div>
      <h1 className="mb-4 text-xl font-medium text-[var(--color-text-primary)]">My deliveries</h1>
      {isLoading && <SkeletonBlock height="8rem" />}
      {!isLoading && deliveries?.length === 0 && (
        <EmptyState headline="No deliveries yet" body="Deliveries from businesses you order from will appear here." />
      )}
      <div className="flex flex-col gap-2">
        {(deliveries ?? []).map((d) => (
          <Card key={d.id} padding="sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-[var(--color-text-primary)]">{d.business_name}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
              <Badge tone={statusTone[d.status]}>{d.status.replace(/_/g, " ")}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
