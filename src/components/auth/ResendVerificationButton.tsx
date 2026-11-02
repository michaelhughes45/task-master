"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { TEXT_LINK_CLASS } from "@/components/auth/text-link";
import { authClient } from "@/lib/auth-client";
import { VERIFY_EMAIL_CALLBACK_URL } from "@/lib/sign-in-notice";
import { cn } from "@/lib/utils";

// Shown under the "email not verified" sign-in error.
export function ResendVerificationButton({ email }: { email: string }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  if (sent) {
    return <p className="text-sm text-muted-foreground">We&apos;ve sent a new link. Check your email.</p>;
  }

  function resend() {
    startTransition(async () => {
      try {
        const { error } = await authClient.sendVerificationEmail({
          email,
          callbackURL: VERIFY_EMAIL_CALLBACK_URL,
        });
        if (error) {
          toast.error(error.message ?? "Couldn't send the link. Try again.");
          return;
        }
        setSent(true);
      } catch (err) {
        console.error(err);
        toast.error("Something went wrong. Check your connection and try again.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={resend}
      disabled={isPending}
      className={cn(TEXT_LINK_CLASS, "self-start text-sm font-medium disabled:opacity-60")}
    >
      {isPending ? "Sending…" : "Resend link"}
    </button>
  );
}
