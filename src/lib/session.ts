import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

// Cached per request, so layouts, pages and actions share one lookup.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function getCurrentUserId() {
  const session = await getSession();
  return session?.user.id ?? null;
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}
