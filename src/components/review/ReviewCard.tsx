import { cn } from "@/lib/utils";

interface ReviewCardProps {
  id: string;
  title: string;
  // Muted text after the title, e.g. a count.
  aside?: string;
  // Padded body (charts) or edge-to-edge rows (lists).
  padded?: boolean;
  children: React.ReactNode;
}

export function ReviewCard({ id, title, aside, padded = false, children }: ReviewCardProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn("overflow-hidden rounded-lg border bg-card", padded && "flex flex-col gap-3.5 p-4")}
    >
      <h2 id={id} className={cn("text-[15px] font-semibold", !padded && "px-4 pt-3.5 pb-3")}>
        {title}
        {aside && <span className="ml-1.5 text-[13.5px] font-normal text-muted-foreground">{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

// A muted line for a card with nothing to show.
export function ReviewEmptyLine({ children, padded = false }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <p className={cn("text-sm text-muted-foreground", !padded && "border-t px-4 py-3.5")}>{children}</p>
  );
}
