import { Card, Button, Badge } from "../../../shared/components";
import { useResolveReassignment } from "../hooks/useDispatch";

interface ReassignmentReviewCardProps {
  requestId: string;
  reason: string;
  evidencePhotoUrl: string | null;
}

/** Owner's approve/deny UI for a pending reassignment request (Stage 9's flow, Phase 2 §6). */
export function ReassignmentReviewCard({ requestId, reason, evidencePhotoUrl }: ReassignmentReviewCardProps) {
  const resolve = useResolveReassignment();

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Reassignment requested</span>
        <Badge tone="warning">Pending</Badge>
      </div>
      <p className="mb-2 text-sm text-[var(--color-text-secondary)]">{reason}</p>
      {evidencePhotoUrl && (
        <a href={evidencePhotoUrl} target="_blank" rel="noreferrer" className="mb-2 block text-xs text-primary underline">
          View evidence photo
        </a>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={resolve.isPending}
          onClick={() => resolve.mutate({ requestId, decision: "approved" })}
        >
          Approve
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={resolve.isPending}
          onClick={() => resolve.mutate({ requestId, decision: "denied" })}
        >
          Deny
        </Button>
      </div>
      {resolve.isError && <p className="mt-2 text-sm text-[var(--color-danger)]">Couldn't resolve this request.</p>}
    </Card>
  );
}
