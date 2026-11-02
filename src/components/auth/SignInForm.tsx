"use client";

import Link from "next/link";
import { FormError } from "@/components/auth/FormError";
import { FormField } from "@/components/auth/FormField";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { TEXT_LINK_CLASS } from "@/components/auth/text-link";
import { useAuthForm } from "@/hooks/use-auth-form";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { signInSchema } from "@/lib/validations/auth";

export function SignInForm({ callbackURL }: { callbackURL: string }) {
  const { isPending, fieldErrors, formError, errorCode, submitted, handleSubmit } = useAuthForm({
    schema: signInSchema,
    submit: (data) => authClient.signIn.email(data),
    callbackURL,
    fallbackError: "Couldn't sign you in. Try again.",
  });
  const notVerified = errorCode === "EMAIL_NOT_VERIFIED" && submitted;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        errors={fieldErrors.email}
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        errors={fieldErrors.password}
        labelAction={
          <Link
            href="/forgot-password"
            className={cn(TEXT_LINK_CLASS, "text-[13px]")}
          >
            Forgot password?
          </Link>
        }
      />
      {notVerified ? (
        <div className="flex flex-col gap-1.5">
          <FormError message="Verify your email before signing in." />
          <ResendVerificationButton key={submitted.email} email={submitted.email} />
        </div>
      ) : (
        <FormError message={formError} />
      )}
      <SubmitButton pending={isPending} label="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}
