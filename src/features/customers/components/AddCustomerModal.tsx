import { useForm } from "react-hook-form";
import { Modal, Button, Input } from "../../../shared/components";
import { useAddCustomer } from "../hooks/useCustomers";

interface AddCustomerModalProps {
  open: boolean;
  onClose: () => void;
}

interface AddCustomerFormValues {
  name: string;
  phone: string;
  address: string;
}

/**
 * Deduplication happens server-side inside find_or_create_business_customer
 * (Phase 2 §C) -- this form never knows or cares whether it matched an
 * existing global customer or created a pending one. Both outcomes look
 * identical from here.
 */
export function AddCustomerModal({ open, onClose }: AddCustomerModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddCustomerFormValues>();
  const addCustomer = useAddCustomer();

  const onSubmit = (values: AddCustomerFormValues) => {
    addCustomer.mutate(
      { name: values.name, phone: values.phone, defaultAddress: values.address || undefined },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a customer">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Input
          label="Name"
          placeholder="Chidinma Okafor"
          error={errors.name?.message}
          {...register("name", { required: "Name is required" })}
        />
        <Input
          label="Phone"
          placeholder="+2348030000009"
          error={errors.phone?.message}
          {...register("phone", { required: "Phone is required" })}
        />
        <Input label="Address" placeholder="14 Allen Ave, Ikeja" {...register("address")} />

        {addCustomer.isError && (
          <p className="text-sm text-[var(--color-danger)]">Couldn't add this customer. Try again.</p>
        )}

        <div className="mt-1 flex gap-2">
          <Button variant="primary" type="submit" disabled={addCustomer.isPending}>
            {addCustomer.isPending ? "Adding…" : "Add customer"}
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
