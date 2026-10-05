import { useForm } from "react-hook-form";
import { Modal, Button, Input } from "../../../shared/components";
import { useInviteRider } from "../hooks/useRiders";

interface InviteRiderModalProps {
  open: boolean;
  onClose: () => void;
}

interface InviteFormValues {
  email: string;
  fullName: string;
  phone: string;
}

export function InviteRiderModal({ open, onClose }: InviteRiderModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>();
  const inviteRider = useInviteRider();

  const onSubmit = (values: InviteFormValues) => {
    inviteRider.mutate(
      { email: values.email, fullName: values.fullName, phone: values.phone || undefined },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite a rider">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Input
          label="Full name"
          placeholder="Tunde Balogun"
          error={errors.fullName?.message}
          {...register("fullName", { required: "Name is required" })}
        />
        <Input
          label="Email"
          type="email"
          placeholder="tunde@example.com"
          error={errors.email?.message}
          {...register("email", { required: "Email is required" })}
        />
        <Input label="Phone" placeholder="+2348020000002" {...register("phone")} />

        {inviteRider.isError && (
          <p className="text-sm text-[var(--color-danger)]">
            {inviteRider.error instanceof Error ? inviteRider.error.message : "Couldn't send the invite."}
          </p>
        )}

        <div className="mt-1 flex gap-2">
          <Button variant="primary" type="submit" disabled={inviteRider.isPending}>
            {inviteRider.isPending ? "Sending…" : "Send invite"}
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
