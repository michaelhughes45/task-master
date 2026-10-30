import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSwitchLink } from "@/components/auth/AuthSwitchLink";
import { FormError } from "@/components/auth/FormError";
import { FormSuccess } from "@/components/auth/FormSuccess";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { OrDivider } from "@/components/auth/OrDivider";
import { SignInForm } from "@/components/auth/SignInForm";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { signInNotice } from "@/lib/sign-in-notice";

export const metadata: Metadata = { title: "Sign in" };

// Reads callbackURL from the URL on the server; allowed to block.
export const instant = false;

function param(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { callbackURL, error, reset, verified } = await searchParams;
  const safeUrl = safeCallbackUrl(param(callbackURL));
  const notice = signInNotice({ error: param(error), reset: param(reset), verified: param(verified) });

  return (
    <>
      <AuthCard title="Sign in" description="Pick up where you left off.">
        <FormSuccess message={notice?.tone === "success" ? notice.message : null} />
        <FormError message={notice?.tone === "error" ? notice.message : null} />
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
