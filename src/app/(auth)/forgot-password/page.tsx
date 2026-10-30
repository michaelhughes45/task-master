import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSwitchLink } from "@/components/auth/AuthSwitchLink";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { DEFAULT_CALLBACK_URL } from "@/lib/safe-callback-url";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthCard
        title="Forgot password"
        description="Enter your email and we'll send you a link to reset your password."
      >
        <ForgotPasswordForm />
      </AuthCard>
      <AuthSwitchLink
        prompt="Remembered it?"
        label="Back to sign in"
        href="/sign-in"
        callbackURL={DEFAULT_CALLBACK_URL}
      />
    </>
  );
}
