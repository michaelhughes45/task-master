import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { getSession } from "@/lib/session";

// Blocks on the session read so signed-in users are redirected before the form renders.
export const instant = false;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/today");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8 sm:p-8">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <Logo />
        {children}
      </div>
    </main>
  );
}
