import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: it sees whether a session cookie exists, not whether it's valid.
// Pages, layouts and actions still verify the session server-side.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("callbackURL", `${pathname}${search}`);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/today/:path*",
    "/calendar/:path*",
    "/todos/:path*",
    "/review/:path*",
    "/settings/:path*",
  ],
};
