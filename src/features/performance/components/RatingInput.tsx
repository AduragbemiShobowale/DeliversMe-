import { useState } from "react";
import { Card, Button } from "../../../shared/components";
import { useRecordRating } from "../../deliveries/hooks/useDeliveries";

interface RatingInputProps {
  deliveryId: string;
  existingRating: number | null;
  existingComment: string | null;
}

export function RatingInput({ deliveryId, existingRating, existingComment }: RatingInputProps) {
  const [rating, setRating] = useState(existingRating ?? 0);
  const [comment, setComment] = useState(existingComment ?? "");
  const recordRating = useRecordRating();

  return (
    <Card>
      <div className="mb-2 text-xs text-[var(--color-text-muted)]">Customer rating</div>
      <div className="mb-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`text-xl ${n <= rating ? "text-[var(--color-warning-strong)]" : "text-[var(--color-border-strong)]"}`}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment from the customer"
        className="mb-2 w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
        rows={2}
      />
      <Button
        variant="primary"
        size="sm"
        disabled={rating === 0 || recordRating.isPending}
        onClick={() => recordRating.mutate({ deliveryId, rating, comment: comment || undefined })}
      >
        {recordRating.isPending ? "Saving…" : "Save rating"}
      </Button>
      {recordRating.isSuccess && <p className="mt-2 text-xs text-[var(--color-accent-strong)]">Rating saved.</p>}
    </Card>
  );
}
