import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Card, Button, Input } from "../../../shared/components";
import { supabase } from "../../../shared/lib/supabase";

interface SetPasswordValues {
  password: string;
}

/**
 * A rider arrives here from the invite email's link. Supabase's client
 * SDK automatically parses the access token out of the URL fragment and
 * establishes a session (detectSessionInUrl, on by default) before this
 * component even renders -- so by the time the form appears, the person
 * is already authenticated as that invited user. This page's only job is
 * to collect their chosen password and set it.
 */
export function InviteAcceptPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPasswordValues>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionValid(!!data.session);
      setCheckingSession(false);
    });
  }, []);

  const onSubmit = async (values: SetPasswordValues) => {
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setSubmitting(false);
    if (error) {
      setSubmitError("Couldn't set your password. The invite link may have expired.");
      return;
    }
    // Session already exists (from the invite link) and role='rider' is
    // already set on their profile (the invite-rider Edge Function
    // provisioned it) -- RoleRedirect will send them to /rider/jobs.
    navigate("/", { replace: true });
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Loading…
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
        <Card className="w-full max-w-sm text-center">
          <h1 className="mb-2 text-lg font-medium text-[var(--color-text-primary)]">
            This link isn't valid
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            The invite link may have expired or already been used. Ask your business owner to resend it.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Set your password
        </h1>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <Input
            label="Password"
            type="password"
            error={errors.password?.message}
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "At least 8 characters" },
            })}
          />
          {submitError && (
            <p className="text-sm text-[var(--color-danger)]">{submitError}</p>
          )}
          <Button variant="primary" type="submit" className="mt-1" disabled={submitting}>
            {submitting ? "Activating…" : "Activate account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
