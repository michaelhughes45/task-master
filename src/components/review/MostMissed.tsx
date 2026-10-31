import { MeterRow } from "@/components/review/MeterRow";
import { ReviewCard, ReviewEmptyLine } from "@/components/review/ReviewCard";
import type { ReviewMissedTask } from "@/types/review";

export function MostMissed({ tasks }: { tasks: ReviewMissedTask[] }) {
  return (
    <ReviewCard id="review-most-missed" title="Most-missed repeating tasks" padded>
      {tasks.length === 0 ? (
        <ReviewEmptyLine padded>No repeating tasks were missed.</ReviewEmptyLine>
      ) : (
        <>
          <ul className="flex flex-col gap-3.5">
            {tasks.map((task) => (
              <MeterRow
                key={task.taskId}
                label={task.title}
                value={`missed ${task.missed} of ${task.planned}`}
                mono={false}
                percent={Math.round((task.missed / task.planned) * 100)}
                tone="warning"
              />
            ))}
          </ul>
          <p className="text-[13px] text-muted-foreground">If a task keeps slipping, try a smaller version or a different day.</p>
        </>
      )}
    </ReviewCard>
  );
}
