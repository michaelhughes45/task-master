import Link from "next/link";
import { DEFAULT_CALLBACK_URL } from "@/lib/safe-callback-url";

interface AuthSwitchLinkProps {
  prompt: string;
  label: string;
  href: "/sign-in" | "/sign-up";
  callbackURL: string;
}

// Link between sign-in and sign-up that keeps where the user was heading.
export function AuthSwitchLink({ prompt, label, href, callbackURL }: AuthSwitchLinkProps) {
  const target =
    callbackURL === DEFAULT_CALLBACK_URL
      ? href
      : `${href}?${new URLSearchParams({ callbackURL }).toString()}`;

  return (
    <p className="text-center text-sm text-muted-foreground">
      {prompt}{" "}
      <Link
        href={target}
        className="rounded-sm font-medium text-primary-text hover:text-primary-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {label}
      </Link>
    </p>
  );
}
