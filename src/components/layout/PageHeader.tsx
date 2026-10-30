import Link from "next/link";
import { NewItemButton } from "@/components/items/NewItemButton";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/session";

interface PageHeaderProps {
  title: string;
  kicker?: string;
}

// Each page renders its own header, so the title here is that page's only h1.
export async function PageHeader({ title, kicker }: PageHeaderProps) {
  const user = await requireUser();

  return (
    <header className="flex items-start justify-between gap-3 px-4 pt-6 pb-2 md:flex-wrap md:items-center md:gap-4 md:border-b md:bg-card md:px-8 md:py-5">
      <div className="min-w-0">
        {kicker && <p className="text-[13.5px] font-medium text-muted-foreground md:text-[13px]">{kicker}</p>}
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] md:text-2xl md:tracking-[-0.015em]">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle className="size-11 rounded-lg text-muted-foreground md:size-10 md:rounded-md" />
        <NewItemButton />
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
        >
          <UserAvatar name={user.name} email={user.email} />
        </Link>
      </div>
    </header>
  );
}
