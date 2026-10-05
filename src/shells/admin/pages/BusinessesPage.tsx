import { Card, Badge, Button, SkeletonBlock } from "../../../shared/components";
import type { BadgeTone } from "../../../shared/components";
import { useAllBusinesses, useSetBusinessVerification } from "../../../features/admin/hooks/useAdmin";

const statusTone: Record<string, BadgeTone> = { pending: "warning", verified: "success", suspended: "danger" };

export function BusinessesPage() {
  const { data: businesses, isLoading } = useAllBusinesses();
  const setVerification = useSetBusinessVerification();

  if (isLoading) return <SkeletonBlock height="12rem" />;

  return (
    <div>
      <h1 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">Businesses</h1>
      <Card>
        <div className="flex flex-col divide-y divide-[var(--color-border)]">
          {(businesses ?? []).map((b) => (
            <div key={b.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm text-[var(--color-text-primary)]">{b.name}</div>
                <Badge tone={statusTone[b.verification_status]}>{b.verification_status}</Badge>
              </div>
              <div className="flex gap-2">
                {b.verification_status !== "verified" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setVerification.mutate({ businessId: b.id, status: "verified" })}
                  >
                    Verify
                  </Button>
                )}
                {b.verification_status !== "suspended" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setVerification.mutate({ businessId: b.id, status: "suspended" })}
                  >
                    Suspend
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
