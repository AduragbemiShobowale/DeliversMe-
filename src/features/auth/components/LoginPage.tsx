import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Card, Button, Input } from "../../../shared/components";
import { useSignIn } from "../hooks/useAuthActions";

interface LoginFormValues {
  email: string;
  password: string;
}

/**
 * Phase 3: real Supabase Auth wiring. On success, AuthProvider's
 * onAuthStateChange listener + RoleRedirect handle getting the person to
 * their correct shell -- this component only needs to trigger the sign-in
 * and surface an error if it fails, per the Stage 13 Auth spec's content
 * rule (plain, specific, no "Error:" prefix).
 */
export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>();
  const signIn = useSignIn();
  const navigate = useNavigate();

  const onSubmit = (values: LoginFormValues) => {
    signIn.mutate(values, {
      onSuccess: () => {
        // AuthProvider's onAuthStateChange updates session/role in the
        // background, but nothing was navigating away from /login once
        // that happened -- this was a real gap (login "succeeded" per
        // the network tab, but the page just sat there). RoleRedirect at
        // "/" picks the correct shell once role finishes loading.
        navigate("/", { replace: true });
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Log in
        </h1>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
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
            {...register("password", { required: "Password is required" })}
          />

          {signIn.isError && (
            <p className="text-sm text-[var(--color-danger)]">
              {signIn.error instanceof Error && signIn.error.message === "Invalid login credentials"
                ? "That email or password's wrong. Try again."
                : "Couldn't log in. Check your connection and try again."}
            </p>
          )}

          <Button variant="primary" type="submit" className="mt-1" disabled={signIn.isPending}>
            {signIn.isPending ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
          New business owner?{" "}
          <Link to="/signup" className="font-medium text-primary">
            Create an account
          </Link>
        </p>
        <p className="mt-1 text-center text-sm text-[var(--color-text-secondary)]">
          Customer?{" "}
          <Link to="/signup/customer" className="font-medium text-primary">
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  );
}
