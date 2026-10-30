"use client";

import { FormError } from "@/components/auth/FormError";
import { FormField } from "@/components/auth/FormField";
import { FormSuccess } from "@/components/auth/FormSuccess";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { useAuthForm } from "@/hooks/use-auth-form";
import { authClient } from "@/lib/auth-client";
import { VERIFY_EMAIL_CALLBACK_URL } from "@/lib/sign-in-notice";
import { signUpSchema } from "@/lib/validations/auth";

interface SignUpFormProps {
  callbackURL: string;
  // When on, sign-up creates no session; the user verifies by email first.
  verificationRequired: boolean;
}

export function SignUpForm({ callbackURL, verificationRequired }: SignUpFormProps) {
  const { isPending, fieldErrors, formError, succeeded, handleSubmit } = useAuthForm({
    schema: signUpSchema,
    submit: ({ name, email, password }) =>
      authClient.signUp.email({
        name,
        email,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        callbackURL: VERIFY_EMAIL_CALLBACK_URL,
      }),
    callbackURL: verificationRequired ? null : callbackURL,
    fallbackError: "Couldn't create your account. Try again.",
  });

  if (succeeded) {
    return <FormSuccess message="Check your email to verify your account." />;
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      <FormField name="name" label="Name" autoComplete="name" errors={fieldErrors.name} />
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
        autoComplete="new-password"
        errors={fieldErrors.password}
      />
      <FormField
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        errors={fieldErrors.confirmPassword}
      />
      <FormError message={formError} />
      <SubmitButton pending={isPending} label="Create account" pendingLabel="Creating account…" />
    </form>
  );
}
