"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { ActionResult } from "@/types/actions";

export type ItemFieldErrors = Record<string, string[] | undefined>;

interface UseItemFormOptions<S extends z.ZodType> {
  schema: S;
  action: (values: z.input<S>) => Promise<ActionResult<unknown>>;
  successMessage: string;
  onSuccess: () => void;
}

// Checks the shared Zod schema first so errors show without a round trip, then calls the
// action. Field errors from either side show inline; any other failure is a toast.
export function useItemForm<S extends z.ZodType>({ schema, action, successMessage, onSuccess }: UseItemFormOptions<S>) {
  const [errors, setErrors] = useState<ItemFieldErrors>({});
  const [isPending, startTransition] = useTransition();

  // Shows the schema's field errors; true when there are none.
  function check(values: z.input<S>) {
    const parsed = schema.safeParse(values);
    if (!parsed.success) setErrors(z.flattenError(parsed.error).fieldErrors as ItemFieldErrors);
    return parsed.success;
  }

  function submit(values: z.input<S>) {
    if (!check(values)) return;
    startTransition(async () => {
      const result = await action(values);
      if (result.success) {
        toast.success(successMessage);
        onSuccess();
      } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setErrors(result.fieldErrors);
      } else {
        toast.error(result.error);
      }
    });
  }

  function clearError(field: string) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  return { errors, isPending, submit, check, clearError };
}
