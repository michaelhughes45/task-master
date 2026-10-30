import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export function useSignOut() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      const { error } = await authClient.signOut();
      if (error) {
        toast.error("Couldn't sign you out. Try again.");
        return;
      }
      router.replace("/sign-in");
      router.refresh();
    });
  }

  return { isPending, signOut };
}
