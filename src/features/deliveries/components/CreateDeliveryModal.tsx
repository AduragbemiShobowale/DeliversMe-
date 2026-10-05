import { useForm } from "react-hook-form";
import { Modal, Button, Select } from "../../../shared/components";
import { useCreateDelivery } from "../hooks/useDeliveries";
import { useBusinessCustomers } from "../../customers/hooks/useCustomers";

interface CreateDeliveryModalProps {
  open: boolean;
  onClose: () => void;
}

interface CreateDeliveryFormValues {
  businessCustomerId: string;
  priority: "normal" | "urgent";
}

export function CreateDeliveryModal({ open, onClose }: CreateDeliveryModalProps) {
  const { data: customers } = useBusinessCustomers();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDeliveryFormValues>({ defaultValues: { priority: "normal" } });
  const createDelivery = useCreateDelivery();

  const onSubmit = (values: CreateDeliveryFormValues) => {
    createDelivery.mutate(
      { businessCustomerId: values.businessCustomerId, priority: values.priority },
      { onSuccess: () => { reset(); onClose(); } }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Create delivery">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Select
          label="Customer"
          error={errors.businessCustomerId?.message}
          {...register("businessCustomerId", { required: "Select a customer" })}
        >
          <option value="">Select a customer…</option>
          {(customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </Select>
        <Select label="Priority" {...register("priority")}>
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
        </Select>

        {(!customers || customers.length === 0) && (
          <p className="text-xs text-[var(--color-text-muted)]">
            No customers yet — add one from the Customers page first.
          </p>
        )}
        {createDelivery.isError && (
          <p className="text-sm text-[var(--color-danger)]">Couldn't create this delivery. Try again.</p>
        )}

        <div className="mt-1 flex gap-2">
          <Button variant="primary" type="submit" disabled={createDelivery.isPending || !customers?.length}>
            {createDelivery.isPending ? "Creating…" : "Create delivery"}
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
