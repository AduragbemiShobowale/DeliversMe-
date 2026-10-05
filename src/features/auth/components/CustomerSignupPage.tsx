import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Card, Button, Input } from "../../../shared/components";
import { useSignUpCustomer } from "../hooks/useAuthActions";

interface CustomerSignupFormValues {
  fullName: string;
  phone: string;
  email: string;
  password: string;
}

/**
 * Customer self-registration (Phase 2's corrected role model). Phone is
 * required and not just optional metadata -- it's the dedup/claim key
 * (Phase 2 §3, 0024) that ties this account to any deliveries an SME
 * Owner already created for them before they signed up.
 */
export function CustomerSignupPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerSignupFormValues>();
  const signUp = useSignUpCustomer();
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const navigate = useNavigate();

  const onSubmit = (values: CustomerSignupFormValues) => {
    signUp.mutate(values, {
      onSuccess: (data) => {
        if (!data.session) {
          setAwaitingConfirmation(true);
        } else {
          navigate("/", { replace: true });
        }
      },
    });
  };

  if (awaitingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
        <Card className="w-full max-w-sm text-center">
          <h1 className="mb-2 text-lg font-medium text-[var(--color-text-primary)]">Check your email</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Click the confirmation link, then come back and log in.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">Create your account</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <Input label="Your name" error={errors.fullName?.message} {...register("fullName", { required: "Name is required" })} />
          <Input
            label="Phone"
            placeholder="+2348030000009"
            error={errors.phone?.message}
            {...register("phone", { required: "Phone is required" })}
          />
          <Input label="Email" type="email" error={errors.email?.message} {...register("email", { required: "Email is required" })} />
          <Input
            label="Password"
            type="password"
            error={errors.password?.message}
            {...register("password", { required: "Password is required", minLength: { value: 8, message: "At least 8 characters" } })}
          />
          {signUp.isError && <p className="text-sm text-[var(--color-danger)]">Couldn't create your account. Try again.</p>}
          <Button variant="primary" type="submit" className="mt-1" disabled={signUp.isPending}>
            {signUp.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
          Already have an account? <Link to="/login" className="font-medium text-primary">Log in</Link>
        </p>
      </Card>
    </div>
  );
}
