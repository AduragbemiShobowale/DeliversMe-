import { useState } from "react";
import { Card, Button, Badge, EmptyState, SkeletonBlock } from "../../../shared/components";
import { useBusinessCustomers } from "../../../features/customers/hooks/useCustomers";
import { AddCustomerModal } from "../../../features/customers/components/AddCustomerModal";

export function CustomersPage() {
  const { data: customers, isLoading, isError } = useBusinessCustomers();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-medium text-[var(--color-text-primary)]">Customers</h1>
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          Add customer
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
          <p className="text-sm text-[var(--color-danger)]">Couldn't load your customers. Try refreshing.</p>
        )}
        {!isLoading && !isError && customers?.length === 0 && (
          <EmptyState
            headline="No customers yet"
            body="Add your first customer to start planning deliveries."
            actionLabel="Add customer"
            onAction={() => setAddOpen(true)}
          />
        )}
        {!isLoading && customers && customers.length > 0 && (
          <div className="flex flex-col divide-y divide-[var(--color-border)]">
            {customers.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm text-[var(--color-text-primary)]">{c.full_name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {c.phone ?? "No phone"} {c.default_address ? `· ${c.default_address}` : ""}
                  </div>
                </div>
                <Badge tone={c.status === "active" ? "success" : "neutral"}>
                  {c.status === "active" ? "Active" : "Pending"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
