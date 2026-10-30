import { z } from "zod";
import { isDateStr, isWallTime } from "@/lib/dates";

export const END_BEFORE_START = "End time must be after the start time";

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .optional();
}

const time = z.string().refine(isWallTime, "Choose a valid time");

export const eventIdSchema = z.string().min(1).max(64);

// Timed events need both times on `date`, ending later the same day. All-day events ignore them.
export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(200, "Use 200 characters or fewer"),
    date: z.string().refine(isDateStr, "Choose a valid date"),
    allDay: z.boolean(),
    startTime: time.optional(),
    endTime: time.optional(),
    location: optionalText(200),
    notes: optionalText(2000),
    color: z.enum(["BLUE", "GREEN"]),
  })
  .superRefine((event, ctx) => {
    if (event.allDay) return;
    if (!event.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Choose a start time" });
    if (!event.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Choose an end time" });
    if (event.startTime && event.endTime && event.endTime <= event.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: END_BEFORE_START });
    }
  });

export type EventInput = z.infer<typeof eventSchema>;
