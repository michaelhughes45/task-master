"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, NAV_ITEMS } from "@/components/layout/nav-items";

const TABS = NAV_ITEMS.filter((item) => item.inTabs);

// Phones only. Fixed to the bottom, with room for the home indicator on notched phones.
export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-[68px] grid-cols-4">
        {TABS.map(({ href, tabLabel, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-[3px] text-[11.5px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  active ? "font-semibold text-primary-text" : "font-medium text-muted-foreground",
                )}
              >
                <Icon className="size-[22px]" aria-hidden="true" />
                {tabLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
