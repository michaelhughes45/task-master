import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSwitchLink } from "@/components/auth/AuthSwitchLink";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { OrDivider } from "@/components/auth/OrDivider";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { env } from "@/lib/env";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

export const metadata: Metadata = { title: "Create an account" };

// Reads callbackURL from the URL on the server; allowed to block.
export const instant = false;

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { callbackURL } = await searchParams;
  const safeUrl = safeCallbackUrl(typeof callbackURL === "string" ? callbackURL : null);

  return (
    <>
      <AuthCard title="Create an account" description="Plan your days and review your weeks.">
        <GoogleButton callbackURL={safeUrl} />
        <OrDivider />
        <SignUpForm callbackURL={safeUrl} verificationRequired={env.EMAIL_VERIFICATION_ENABLED} />
      </AuthCard>
      <AuthSwitchLink
        prompt="Already have an account?"
        label="Sign in"
        href="/sign-in"
        callbackURL={safeUrl}
      />
    </>
  );
}
