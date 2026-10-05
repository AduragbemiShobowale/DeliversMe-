import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card, Button, Input, Select, SkeletonBlock } from "../../../shared/components";
import { useMyBusiness, useUpdateBusinessSettings } from "../../../features/admin/hooks/useBusinessSettings";

interface SettingsFormValues {
  name: string;
  assignment_timeout_minutes: number;
}

export function SettingsPage() {
  const { data: business, isLoading } = useMyBusiness();
  const update = useUpdateBusinessSettings();
  const { register, handleSubmit, reset } = useForm<SettingsFormValues>();

  useEffect(() => {
    if (business) reset({ name: business.name, assignment_timeout_minutes: business.assignment_timeout_minutes });
  }, [business, reset]);

  if (isLoading) return <SkeletonBlock height="12rem" />;

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-xl font-medium text-[var(--color-text-primary)]">Settings</h1>
      <Card>
        <form
          onSubmit={handleSubmit((values) =>
            update.mutate({ name: values.name, assignment_timeout_minutes: Number(values.assignment_timeout_minutes) })
          )}
          className="flex flex-col gap-3"
        >
          <Input label="Business name" {...register("name", { required: true })} />
          <Select label="Assignment response window" {...register("assignment_timeout_minutes", { valueAsNumber: true })}>
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={20}>20 minutes</option>
          </Select>
          <Button variant="primary" type="submit" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          {update.isSuccess && <p className="text-xs text-[var(--color-accent-strong)]">Settings saved.</p>}
        </form>
      </Card>
    </div>
  );
}
