import { z } from "zod";
import type { Failure } from "@/types/actions";

export const NOT_SIGNED_IN = "You're signed out. Sign in and try again.";

// A failed parse as an action result: the first message, plus every field's messages.
export function invalid(error: z.ZodError): Failure {
  const { fieldErrors } = z.flattenError(error);
  return {
    success: false,
    error: error.issues[0].message,
    fieldErrors: fieldErrors as Record<string, string[]>,
  };
}
