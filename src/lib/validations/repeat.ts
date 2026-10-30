import { z } from "zod";
import { weekStartOf } from "@/lib/dates";
import { repeatProblem } from "@/lib/rrule-builder";
import type { DateStr, TaskScope } from "@/types/dates";

// An RRULE from the Repeat select; null or missing means "Does not repeat".
export const rruleField = z.string().max(200).nullable().optional();

// Adds the rule's problem (if any) under `rrule`. `day` is the date picked in the form; a
// weekly task's series starts on that week's Monday.
export function checkRepeat(ctx: z.RefinementCtx, rrule: string | null | undefined, scope: TaskScope, day: DateStr) {
  if (!rrule) return;
  const problem = repeatProblem(rrule, scope, scope === "WEEKLY" ? weekStartOf(day) : day);
  if (problem) ctx.addIssue({ code: "custom", path: ["rrule"], message: problem });
}
