"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// Redirects to Google; failures and cancels come back to /sign-in with an `error` param.
export function GoogleButton({ callbackURL }: { callbackURL: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const { error } = await authClient.signIn.social({
          provider: "google",
          callbackURL,
          errorCallbackURL: `/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`,
        });
        if (error) toast.error(error.message ?? "Couldn't start Google sign-in. Try again.");
      } catch (err) {
        console.error(err);
        toast.error("Something went wrong. Check your connection and try again.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
      className="h-11 w-full gap-2.5 rounded-md bg-card text-[15px] font-medium"
    >
      {isPending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Image src="/google-g.svg" alt="" width={18} height={18} unoptimized />
      )}
      Continue with Google
    </Button>
  );
}
