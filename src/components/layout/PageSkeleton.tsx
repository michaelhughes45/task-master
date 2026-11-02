import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  kicker: string;
  // "cards" for the list pages, "grid" for the calendar's one tall card.
  variant?: "cards" | "grid";
}

// A loading page: the header's place with a placeholder title, then grey cards where the content
// goes. Sizes follow PageHeader so nothing jumps when the page arrives.
export function PageSkeleton({ kicker, variant = "cards" }: PageSkeletonProps) {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>
      <div className="px-4 pt-6 pb-2 md:border-b md:bg-card md:px-8 md:py-5">
        <p className="text-[13.5px] font-medium text-muted-foreground md:text-[13px]">{kicker}</p>
        <SkeletonBlock className="mt-1.5 h-8 w-64 max-w-full md:h-7" />
      </div>
      <div className="w-full max-w-[1240px] px-4 py-6 md:px-8">
        {variant === "grid" ? (
          <SkeletonBlock className="h-[calc(100dvh-14rem)] w-full" />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-6">
            <SkeletonBlock className="h-72" />
            <SkeletonBlock className="h-56" />
          </div>
        )}
      </div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}
