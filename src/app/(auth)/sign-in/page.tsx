import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSwitchLink } from "@/components/auth/AuthSwitchLink";
import { SignInForm } from "@/components/auth/SignInForm";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

export const metadata: Metadata = { title: "Sign in" };

// Reads callbackURL from the URL on the server; allowed to block.
export const instant = false;

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { callbackURL } = await searchParams;
  const safeUrl = safeCallbackUrl(typeof callbackURL === "string" ? callbackURL : null);

  return (
    <>
      <AuthCard title="Sign in" description="Pick up where you left off.">
        {/* "Continue with Google" and the "or" divider go here in spec 04 */}
        <SignInForm callbackURL={safeUrl} />
      </AuthCard>
      <AuthSwitchLink
        prompt="New here?"
        label="Create an account"
        href="/sign-up"
        callbackURL={safeUrl}
      />
    </>
  );
}
