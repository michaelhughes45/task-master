"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";

export function SignOutButton() {
  const { isPending, signOut } = useSignOut();

  return (
    <Button variant="outline" size="lg" className="h-11 px-4" disabled={isPending} onClick={signOut}>
      <LogOut aria-hidden="true" />
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
