import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSwitchLink } from "@/components/auth/AuthSwitchLink";
import { RequestNewLink } from "@/components/auth/RequestNewLink";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { DEFAULT_CALLBACK_URL } from "@/lib/safe-callback-url";

export const metadata: Metadata = { title: "Reset password" };

// Reads the token from the URL on the server; allowed to block.
export const instant = false;

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error } = await searchParams;
  // Better Auth sends ?error=INVALID_TOKEN here when the emailed link is bad or expired.
  const validToken = typeof token === "string" && token.length > 0 && !error ? token : null;

  return (
    <>
      <AuthCard title="Reset password" description="Choose a new password for your account.">
        {validToken ? <ResetPasswordForm token={validToken} /> : <RequestNewLink />}
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
