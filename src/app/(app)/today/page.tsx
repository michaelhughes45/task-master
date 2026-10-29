import type { Metadata } from "next";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Today" };

// Reads the session; allowed to block until the real page streams (spec 18).
export const instant = false;

// Temporary page until the real Today page (spec 18).
export default async function TodayPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="rounded-lg border bg-card p-6">
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="mt-2 text-muted-foreground">Signed in as {user.name}</p>
        <div className="mt-6 flex items-center gap-3">
          <SignOutButton />
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
}
