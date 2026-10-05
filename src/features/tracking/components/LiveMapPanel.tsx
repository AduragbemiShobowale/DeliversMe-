import { Card, Badge } from "../../../shared/components";
import { useDeliveryLocation } from "../hooks/useDeliveryLocation";
import { useGpsStaleness } from "../hooks/useGpsStaleness";

interface LiveMapPanelProps {
  deliveryId: string;
  status: string;
}

/**
 * The dominant focal element on Delivery Detail (Stage 13's corrected
 * hierarchy). No real map tiles wired yet -- Leaflet/OSRM integration
 * (Stage 15's Route Optimisation piece) is a deliberately deferred item,
 * flagged at the end of this pass rather than stubbed convincingly.
 */
export function LiveMapPanel({ deliveryId, status }: LiveMapPanelProps) {
  const location = useDeliveryLocation(deliveryId);
  const { tier, minutesAgo } = useGpsStaleness(location?.recorded_at ?? null);

  if (status !== "in_transit" && status !== "delivered") {
    return (
      <Card padding="lg">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Location tracking begins once the rider starts this delivery.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <div className="mb-3 flex h-48 items-center justify-center rounded-[var(--radius-control)] bg-slate-100 text-sm text-[var(--color-text-muted)]">
        {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "No location yet"}
      </div>
      {tier === "fresh" && (
        <div className="text-xs text-[var(--color-text-muted)]">
          Updated {minutesAgo}m ago
        </div>
      )}
      {tier === "updating" && (
        <div className="text-xs text-[var(--color-text-secondary)]">
          Location updating · last update {minutesAgo}m ago
        </div>
      )}
      {tier === "stale" && (
        <div className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[#FAEEDA] px-3 py-2 text-xs text-[var(--color-warning-strong)]">
          {minutesAgo === null
            ? "No location received yet."
            : `No location update for ${minutesAgo} min — consider contacting the rider if this delivery is time-sensitive.`}
        </div>
      )}
      {status === "delivered" && (
        <Badge tone="success">Delivered</Badge>
      )}
    </Card>
  );
}
