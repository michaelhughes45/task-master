"use client";

import { FormError } from "@/components/auth/FormError";
import { FormField } from "@/components/auth/FormField";
import { RequestNewLink } from "@/components/auth/RequestNewLink";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { useAuthForm } from "@/hooks/use-auth-form";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/validations/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const { isPending, fieldErrors, formError, errorCode, handleSubmit } = useAuthForm({
    schema: resetPasswordSchema,
    submit: ({ password }) => authClient.resetPassword({ newPassword: password, token }),
    callbackURL: "/sign-in?reset=1",
    fallbackError: "Couldn't reset your password. Try again.",
  });

  // The token can expire or be used up between opening the page and submitting.
  if (errorCode === "INVALID_TOKEN") return <RequestNewLink />;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      <FormField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        errors={fieldErrors.password}
      />
      <FormField
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        errors={fieldErrors.confirmPassword}
      />
      <FormError message={formError} />
      <SubmitButton pending={isPending} label="Set new password" pendingLabel="Saving…" />
    </form>
  );
}
