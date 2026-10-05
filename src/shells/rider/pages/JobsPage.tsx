import { useState } from "react";
import { Card, Button, Badge, SkeletonBlock } from "../../../shared/components";
import { useAuth } from "../../../app/AuthProvider";
import {
  useMyActiveJob,
  useAcceptAssignment,
  useRejectAssignment,
  useStartDelivery,
  useCompleteDelivery,
  useFailDelivery,
  useRequestReassignment,
} from "../../../features/dispatch/hooks/useRiderJobs";
import { useGpsBroadcast } from "../../../features/tracking/hooks/useGpsBroadcast";
import { useGpsStaleness } from "../../../features/tracking/hooks/useGpsStaleness";
import { useDeliveryLocation } from "../../../features/tracking/hooks/useDeliveryLocation";
import { PhotoCapture } from "../../../features/proof-of-delivery/components/PhotoCapture";

export function JobsPage() {
  const { session, businessId } = useAuth();
  const { data: job, isLoading } = useMyActiveJob();
  const accept = useAcceptAssignment();
  const reject = useRejectAssignment();
  const start = useStartDelivery();
  const complete = useCompleteDelivery();
  const fail = useFailDelivery();
  const requestReassignment = useRequestReassignment();

  const [completing, setCompleting] = useState(false);
  const [podUrl, setPodUrl] = useState<string | null>(null);
  const [reassignReason, setReassignReason] = useState("");
  const [showReassignForm, setShowReassignForm] = useState(false);
  const [showFailForm, setShowFailForm] = useState(false);
  const [failReason, setFailReason] = useState("");

  const { permission } = useGpsBroadcast(job?.id, session?.user.id, job?.status === "in_transit");
  const location = useDeliveryLocation(job?.status === "in_transit" ? job.id : undefined);
  const { tier, minutesAgo } = useGpsStaleness(location?.recorded_at ?? null);

  if (isLoading) return <SkeletonBlock height="16rem" />;

  if (!job) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-text-secondary)]">No job assigned right now.</p>
      </Card>
    );
  }

  // ===== OFFER STATE =====
  if (job.status === "assigned") {
    return (
      <Card>
        <div className="mb-1 text-xs text-[var(--color-text-muted)]">New delivery request</div>
        <div className="mb-1 text-base font-medium text-[var(--color-text-primary)]">{job.customer_name}</div>
        <div className="mb-4 text-sm text-[var(--color-text-secondary)]">{job.address ?? "No address on file"}</div>
        <div className="flex gap-2">
          <Button variant="primary" disabled={accept.isPending} onClick={() => accept.mutate(job.id)}>
            Accept
          </Button>
          <Button variant="secondary" disabled={reject.isPending} onClick={() => reject.mutate(job.id)}>
            Reject
          </Button>
        </div>
      </Card>
    );
  }

  // ===== ACCEPTED STATE (not yet started -- GPS not active, per the explicit distinction) =====
  if (job.status === "accepted") {
    return (
      <Card>
        <Badge tone="accent">Accepted</Badge>
        <div className="mt-2 mb-1 text-base font-medium text-[var(--color-text-primary)]">{job.customer_name}</div>
        <div className="mb-4 text-sm text-[var(--color-text-secondary)]">{job.address ?? "No address on file"}</div>
        <Button variant="primary" disabled={start.isPending} onClick={() => start.mutate(job.id)}>
          {start.isPending ? "Starting…" : "Start delivery"}
        </Button>
      </Card>
    );
  }

  // ===== IN TRANSIT (GPS active) =====
  if (job.status === "in_transit") {
    if (completing) {
      return (
        <Card>
          <div className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">Complete delivery</div>
          <PhotoCapture
            businessId={businessId ?? ""}
            deliveryId={job.id}
            onUploaded={(url) => setPodUrl(url)}
          />
          <Button
            variant="primary"
            className="mt-2 w-full"
            disabled={!podUrl || complete.isPending}
            onClick={() => podUrl && complete.mutate({ deliveryId: job.id, photoUrl: podUrl })}
          >
            {complete.isPending ? "Submitting…" : "Submit"}
          </Button>
          <button
            className="mt-2 text-xs text-[var(--color-text-muted)]"
            onClick={() => setCompleting(false)}
          >
            Cancel
          </button>
        </Card>
      );
    }

    if (showFailForm) {
      return (
        <Card>
          <div className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Unable to deliver</div>
          <textarea
            value={failReason}
            onChange={(e) => setFailReason(e.target.value)}
            placeholder="What happened?"
            className="mb-2 w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] p-2 text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={!failReason.trim() || fail.isPending}
              onClick={() => fail.mutate({ deliveryId: job.id, reason: failReason })}
            >
              Confirm
            </Button>
            <Button variant="secondary" onClick={() => setShowFailForm(false)}>Cancel</Button>
          </div>
        </Card>
      );
    }

    if (showReassignForm) {
      return (
        <Card>
          <div className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Request reassignment</div>
          <textarea
            value={reassignReason}
            onChange={(e) => setReassignReason(e.target.value)}
            placeholder="Reason (required)"
            className="mb-2 w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] p-2 text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={!reassignReason.trim() || requestReassignment.isPending}
              onClick={() =>
                requestReassignment.mutate(
                  { deliveryId: job.id, reason: reassignReason },
                  { onSuccess: () => setShowReassignForm(false) }
                )
              }
            >
              Submit request
            </Button>
            <Button variant="secondary" onClick={() => setShowReassignForm(false)}>Cancel</Button>
          </div>
        </Card>
      );
    }

    if (job.reassignment_requested) {
      return (
        <Card>
          <Badge tone="warning">Reassignment requested</Badge>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Waiting on your business owner to review this request.
          </p>
        </Card>
      );
    }

    return (
      <Card>
        <div className="mb-2 flex items-center gap-2 text-xs">
          {permission === "denied" ? (
            <span className="text-[var(--color-warning-strong)]">Location unavailable — check permissions</span>
          ) : tier === "fresh" ? (
            <span className="text-[var(--color-accent-strong)]">● Location sharing active</span>
          ) : tier === "updating" ? (
            <span className="text-[var(--color-text-secondary)]">Location updating</span>
          ) : (
            <span className="text-[var(--color-warning-strong)]">
              {minutesAgo === null ? "Waiting for first location…" : `Last location ${minutesAgo}m ago`}
            </span>
          )}
        </div>
        <Badge tone="accent">In transit</Badge>
        <div className="mt-2 mb-1 text-base font-medium text-[var(--color-text-primary)]">{job.customer_name}</div>
        <div className="mb-4 text-sm text-[var(--color-text-secondary)]">{job.address ?? "No address on file"}</div>
        <Button variant="primary" className="mb-2 w-full" onClick={() => setCompleting(true)}>
          Complete delivery
        </Button>
        <div className="flex justify-between text-xs">
          <button className="text-[var(--color-text-muted)]" onClick={() => setShowReassignForm(true)}>
            Request reassignment
          </button>
          <button className="text-[var(--color-danger)]" onClick={() => setShowFailForm(true)}>
            Unable to deliver
          </button>
        </div>
      </Card>
    );
  }

  return null;
}
