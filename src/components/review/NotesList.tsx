import { ReviewCard, ReviewEmptyLine } from "@/components/review/ReviewCard";
import { formatMinutes, formatWeekday } from "@/lib/dates";
import type { ReviewNote } from "@/types/review";

// "What I worked on" notes from the week, in order.
export function NotesList({ notes }: { notes: ReviewNote[] }) {
  return (
    <ReviewCard id="review-notes" title="What you worked on">
      {notes.length === 0 ? (
        <ReviewEmptyLine>No notes this week.</ReviewEmptyLine>
      ) : (
        <ul>
          {notes.map((note) => (
            <li key={`${note.taskId}@${note.day}`} className="border-t px-4 py-3">
              <div className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium break-words">{note.title}</span>
                <span className="flex-none font-mono text-[12.5px] text-muted-foreground">
                  {formatWeekday(note.day)}
                  {note.minutesSpent ? ` · ${formatMinutes(note.minutesSpent)}` : ""}
                </span>
              </div>
              <p className="mt-0.5 text-[13.5px] break-words text-muted-foreground">{note.note}</p>
            </li>
          ))}
        </ul>
      )}
    </ReviewCard>
  );
}
