"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import { isActivePath, NAV_ITEMS } from "@/components/layout/nav-items";
import type { WeekProgress } from "@/lib/db/progress";

interface AppSidebarProps {
  name: string;
  email: string;
  weekProgress: WeekProgress;
}

// Desktop only. Static, not sticky, so it grows with the page and scrolls with it.
export function AppSidebar({ name, email, weekProgress }: AppSidebarProps) {
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
      <div className="mt-auto flex flex-col gap-4 pt-4">
        <WeekProgressBar {...weekProgress} />
        <UserMenu name={name} email={email} />
      </div>
    </nav>
  );
}

// Daily occurrences plus weekly tasks done this week.
function WeekProgressBar({ done, total }: WeekProgress) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="flex flex-col gap-2 px-2.5">
      <div className="flex justify-between text-[13px] text-muted-foreground">
        <span className="font-medium">This week</span>
        <span className="font-mono" aria-label={`${done} of ${total} done`}>
          {done}/{total}
        </span>
      </div>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-[3px] bg-muted">
        {/* Width is the share done, so it can't be a static class. */}
        <div className="h-full rounded-[3px] bg-success transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
