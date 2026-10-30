"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { updateReviewNotify } from "@/actions/settings";
import { Switch } from "@/components/ui/switch";

// Only stores the preference; the Sunday notification itself arrives with spec 22.
export function ReviewNotifySetting({ enabled }: { enabled: boolean }) {
  const [, startTransition] = useTransition();
  const [checked, setOptimisticChecked] = useOptimistic(enabled);

  function handleChange(next: boolean) {
    startTransition(async () => {
      setOptimisticChecked(next);
      const result = await updateReviewNotify(next);
      if (!result.success) toast.error(result.error);
    });
  }

  return (
    <Switch
      checked={checked}
      onCheckedChange={handleChange}
      size="lg"
      aria-label="Sunday review reminder"
      className="data-checked:bg-success"
    />
  );
}
