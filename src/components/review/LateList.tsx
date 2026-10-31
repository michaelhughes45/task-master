import { ReviewCard, ReviewEmptyLine } from "@/components/review/ReviewCard";
import type { LateItem } from "@/lib/review-view";

export function LateList({ items }: { items: LateItem[] }) {
  return (
    <ReviewCard id="review-late" title="Done late" aside="ticked after their day">
      {items.length === 0 ? (
        <ReviewEmptyLine>Nothing was ticked off late.</ReviewEmptyLine>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.key} className="flex justify-between gap-3 border-t px-4 py-2.5 text-sm">
              <span className="min-w-0 break-words">{item.title}</span>
              <span className="flex-none text-[13px] text-warning">{item.when}</span>
            </li>
          ))}
        </ul>
      )}
    </ReviewCard>
  );
}
