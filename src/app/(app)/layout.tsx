import { requireUser } from "@/lib/session";

// Blocks on the session read so signed-out users are redirected before anything renders.
export const instant = false;

// The real auth boundary for signed-in pages; the proxy only redirects early.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
