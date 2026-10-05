import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Card, Button, Input } from "../../../shared/components";
import { useSignUpOwner } from "../hooks/useAuthActions";

interface SignupFormValues {
  businessName: string;
  fullName: string;
  email: string;
  password: string;
}

/**
 * Owner signup only -- per Stage 6, riders never self-register, and the
 * customer signup flow (Phase 2's corrected architecture) is a separate
 * page, not this one.
 */
export function SignupPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>();
  const signUp = useSignUpOwner();
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const navigate = useNavigate();

  const onSubmit = (values: SignupFormValues) => {
    signUp.mutate(
      {
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        businessName: values.businessName,
      },
      {
        onSuccess: (data) => {
          // If email confirmation is required on this project, signUp()
          // returns a user but no session -- the person needs to click a
          // link before they can log in. Handle both outcomes honestly
          // rather than assuming immediate access (a real gap this
          // project ran into during manual testing).
          if (!data.session) {
            setAwaitingConfirmation(true);
          } else {
            // Same fix as LoginPage: if confirmation is disabled on this
            // project, signUp() returns a session immediately -- without
            // this, the page would just sit here the same way login did.
            navigate("/", { replace: true });
          }
          // If a session DID come back (confirmation disabled on this
          // project), AuthProvider + RoleRedirect take it from here.
        },
      }
    );
  };

  if (awaitingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
        <Card className="w-full max-w-sm text-center">
          <h1 className="mb-2 text-lg font-medium text-[var(--color-text-primary)]">
            Check your email
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            We sent a confirmation link. Click it to activate your account, then come back and log in.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Create your account
        </h1>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <Input
            label="Business name"
            placeholder="Bello Fashions"
            error={errors.businessName?.message}
            {...register("businessName", { required: "Business name is required" })}
          />
          <Input
            label="Your name"
            placeholder="Adaeze Nwosu"
            error={errors.fullName?.message}
            {...register("fullName", { required: "Your name is required" })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="name@business.com"
            error={errors.email?.message}
            {...register("email", { required: "Email is required" })}
          />
          <Input
            label="Password"
            type="password"
            error={errors.password?.message}
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "At least 8 characters" },
            })}
          />

          {signUp.isError && (
            <p className="text-sm text-[var(--color-danger)]">
              Couldn't create your account. Try again.
            </p>
          )}

          <Button variant="primary" type="submit" className="mt-1" disabled={signUp.isPending}>
            {signUp.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
