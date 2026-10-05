import { useState } from "react";
import { Card, Button, Badge, EmptyState, SkeletonBlock, Avatar } from "../../../shared/components";
import type { BadgeTone } from "../../../shared/components";
import { useRiders } from "../../../features/riders/hooks/useRiders";
import { InviteRiderModal } from "../../../features/riders/components/InviteRiderModal";

const availabilityTone: Record<string, BadgeTone> = {
  available: "success",
  busy: "warning",
  offline: "neutral",
};

export function RidersPage() {
  const { data: riders, isLoading, isError } = useRiders();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-medium text-[var(--color-text-primary)]">Riders</h1>
        <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
          Invite rider
        </Button>
      </div>

      <Card>
        {isLoading && (
          <div className="flex flex-col gap-3">
            <SkeletonBlock height="2.5rem" />
            <SkeletonBlock height="2.5rem" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-[var(--color-danger)]">
            Couldn't load your riders. Try refreshing.
          </p>
        )}

        {!isLoading && !isError && riders?.length === 0 && (
          <EmptyState
            headline="No riders yet"
            body="Invite a rider to start assigning deliveries."
            actionLabel="Invite rider"
            onAction={() => setInviteOpen(true)}
          />
        )}

        {!isLoading && riders && riders.length > 0 && (
          <div className="flex flex-col divide-y divide-[var(--color-border)]">
            {riders.map((rider) => (
              <div key={rider.profile_id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Avatar initials={rider.full_name} size="sm" />
                  <div>
                    <div className="text-sm text-[var(--color-text-primary)]">{rider.full_name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{rider.phone ?? "No phone"}</div>
                  </div>
                </div>
                <Badge tone={availabilityTone[rider.availability_status]}>
                  {rider.availability_status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <InviteRiderModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
