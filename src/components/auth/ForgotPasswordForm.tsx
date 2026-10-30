"use client";

import { FormError } from "@/components/auth/FormError";
import { FormField } from "@/components/auth/FormField";
import { FormSuccess } from "@/components/auth/FormSuccess";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { useAuthForm } from "@/hooks/use-auth-form";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const { isPending, fieldErrors, formError, succeeded, handleSubmit } = useAuthForm({
    schema: forgotPasswordSchema,
    submit: ({ email }) => authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }),
    callbackURL: null,
    fallbackError: "Couldn't send the link. Try again.",
  });

  // Same message whether or not the account exists, so the form can't be used to find accounts.
  if (succeeded) {
    return <FormSuccess message="If an account exists for that email, we've sent a link." />;
  }

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
      <FormError message={formError} />
      <SubmitButton pending={isPending} label="Send reset link" pendingLabel="Sending…" />
    </form>
  );
}
