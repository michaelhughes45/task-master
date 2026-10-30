import { z } from "zod";
import { isValidTimezone } from "@/lib/timezones";

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Choose a timezone")
  .max(64, "Choose a valid timezone")
  .refine(isValidTimezone, "Choose a valid timezone");

export const reviewNotifySchema = z.boolean();
