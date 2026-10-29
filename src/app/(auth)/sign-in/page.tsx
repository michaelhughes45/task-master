import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSwitchLink } from "@/components/auth/AuthSwitchLink";
import { FormError } from "@/components/auth/FormError";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { OrDivider } from "@/components/auth/OrDivider";
import { SignInForm } from "@/components/auth/SignInForm";
import { oauthErrorMessage } from "@/lib/oauth-error";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

export const metadata: Metadata = { title: "Sign in" };

// Reads callbackURL from the URL on the server; allowed to block.
export const instant = false;

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { callbackURL, error } = await searchParams;
  const safeUrl = safeCallbackUrl(typeof callbackURL === "string" ? callbackURL : null);
  const googleError = oauthErrorMessage(typeof error === "string" ? error : null);

  return (
    <>
      <AuthCard title="Sign in" description="Pick up where you left off.">
        <FormError message={googleError} />
        <GoogleButton callbackURL={safeUrl} />
        <OrDivider />
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
