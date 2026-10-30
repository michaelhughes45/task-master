"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Below md, Tailwind's breakpoint.
const PHONE_QUERY = "(max-width: 767.98px)";

// Rendered only when the URL has no ?view=. Phones get the day view; the server can't see the
// screen, so this switches after load. The phone tab bar links to ?view=day directly, so this
// only runs for a bare /calendar typed or bookmarked on a phone.
export function PhoneDayRedirect({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    if (window.matchMedia(PHONE_QUERY).matches) router.replace(href);
  }, [router, href]);

  return null;
}
