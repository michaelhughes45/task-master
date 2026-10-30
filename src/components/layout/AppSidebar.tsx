"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import { isActivePath, NAV_ITEMS } from "@/components/layout/nav-items";

interface AppSidebarProps {
  name: string;
  email: string;
}

// Desktop only. Static, not sticky, so it grows with the page and scrolls with it.
export function AppSidebar({ name, email }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="hidden w-56 shrink-0 flex-col gap-1 border-r bg-card px-3.5 py-5 md:flex"
    >
      <div className="px-2.5 pt-1 pb-5">
        <Logo />
      </div>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-2.5 rounded-md px-3 text-[14.5px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-primary-soft font-semibold text-primary-ink"
                    : "font-medium text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* The "This week" progress bar goes above the user menu once spec 18 provides the data. */}
      <div className="mt-auto pt-4">
        <UserMenu name={name} email={email} />
      </div>
    </nav>
  );
}
