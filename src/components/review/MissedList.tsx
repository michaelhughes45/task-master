import { ReviewCard, ReviewEmptyLine } from "@/components/review/ReviewCard";
import type { MissedGroup } from "@/lib/review-view";

export function MissedList({ groups, count }: { groups: MissedGroup[]; count: number }) {
  return (
    <ReviewCard id="review-missed" title="Missed" aside={`${count} ${count === 1 ? "task" : "tasks"}`}>
      {groups.length === 0 ? (
        <ReviewEmptyLine>Nothing was missed.</ReviewEmptyLine>
      ) : (
        <ul>
          {groups.map((group) => (
            <li key={group.key} className="flex justify-between gap-3 border-t px-4 py-2.5 text-sm">
              <span className="min-w-0 break-words">{group.title}</span>
              <span className="flex-none text-[13px] text-muted-foreground">{group.when}</span>
            </li>
          ))}
        </ul>
      )}
    </ReviewCard>
  );
}
