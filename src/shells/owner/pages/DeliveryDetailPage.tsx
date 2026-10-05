import { useParams, Link } from "react-router-dom";
import { Card, Badge, SkeletonBlock } from "../../../shared/components";
import type { BadgeTone } from "../../../shared/components";
import { useDelivery, useDeliveryEvents } from "../../../features/deliveries/hooks/useDeliveries";
import { usePendingReassignmentRequests } from "../../../features/dispatch/hooks/useDispatch";
import { LiveMapPanel } from "../../../features/tracking/components/LiveMapPanel";
import { RatingInput } from "../../../features/performance/components/RatingInput";
import { ReassignmentReviewCard } from "../../../features/dispatch/components/ReassignmentReviewCard";
import { useLatestPod, usePodSignedUrl } from "../../../features/proof-of-delivery/hooks/usePod";

const statusTone: Record<string, BadgeTone> = {
  ready_for_dispatch: "neutral",
  assigned: "accent",
  accepted: "accent",
  in_transit: "accent",
  delivered: "success",
  failed: "danger",
};

export function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: delivery, isLoading } = useDelivery(id);
  const { data: events } = useDeliveryEvents(id);
  const { data: pendingRequests } = usePendingReassignmentRequests();
  const { data: pod } = useLatestPod(id);
  const { data: podUrl } = usePodSignedUrl(pod?.photo_url);

  const pendingForThisDelivery = pendingRequests?.find((r) => r.delivery_id === id);

  if (isLoading || !delivery) {
    return <SkeletonBlock height="20rem" />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link to="/owner/deliveries" className="text-xs text-[var(--color-text-muted)]">
            ← Back to deliveries
          </Link>
          <h1 className="text-xl font-medium text-[var(--color-text-primary)]">Delivery #{delivery.id.slice(0, 8)}</h1>
        </div>
        <Badge tone={statusTone[delivery.status]}>{delivery.status.replace(/_/g, " ")}</Badge>
      </div>

      {pendingForThisDelivery && (
        <div className="mb-4">
          <ReassignmentReviewCard
            requestId={pendingForThisDelivery.id}
            reason={pendingForThisDelivery.reason}
            evidencePhotoUrl={pendingForThisDelivery.evidence_photo_url}
          />
        </div>
      )}

      <div className="mb-4">
        <LiveMapPanel deliveryId={delivery.id} status={delivery.status} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="mb-2 text-xs text-[var(--color-text-muted)]">Planning</div>
          <div className="text-sm text-[var(--color-text-primary)]">Priority: {delivery.priority}</div>
        </Card>
        <Card>
          <div className="mb-2 text-xs text-[var(--color-text-muted)]">Proof of delivery</div>
          {pod ? (
            <>
              <div className="text-sm text-[var(--color-text-primary)]">Recipient: {pod.recipient_name ?? "—"}</div>
              <a href={podUrl ?? "#"} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                View photo (v{pod.version})
              </a>
            </>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">Not yet delivered</p>
          )}
        </Card>
        {(delivery.status === "delivered" || delivery.status === "failed") && (
          <RatingInput deliveryId={delivery.id} existingRating={delivery.rating} existingComment={delivery.rating_comment} />
        )}
      </div>

      <Card>
        <div className="mb-2 text-xs text-[var(--color-text-muted)]">Event timeline</div>
        <div className="flex flex-col divide-y divide-[var(--color-border)]">
          {(events ?? []).map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-32 shrink-0 text-xs text-[var(--color-text-muted)]">
                {new Date(e.created_at).toLocaleTimeString()}
              </span>
              <span className="text-[var(--color-text-primary)]">{e.event_type.replace(/_/g, " ")}</span>
              <span className="text-xs text-[var(--color-text-muted)]">({e.actor_role})</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
