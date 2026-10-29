import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSwitchLink } from "@/components/auth/AuthSwitchLink";
import { SignUpForm } from "@/components/auth/SignUpForm";
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
        <SignUpForm callbackURL={safeUrl} />
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
