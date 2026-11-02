import Link from "next/link";
import { TEXT_LINK_CLASS } from "@/components/auth/text-link";
import { DEFAULT_CALLBACK_URL } from "@/lib/safe-callback-url";
import { cn } from "@/lib/utils";

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
        className={cn(TEXT_LINK_CLASS, "font-medium")}
      >
        {label}
      </Link>
    </p>
  );
}
