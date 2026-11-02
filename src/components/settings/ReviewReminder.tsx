"use client";

import { BellRing } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { sendTestNotification } from "@/actions/push";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePushSubscription, type PushStatus } from "@/hooks/use-push-subscription";

interface ReviewReminderProps {
  // The user's setting; a device also needs its own subscription to get the notification.
  reviewNotify: boolean;
  // null when push isn't configured on the server
  vapidPublicKey: string | null;
}

const DESCRIPTIONS: Record<Exclude<PushStatus["kind"], "ready"> | "on" | "off", string> = {
  checking: "A notification on Sundays at 7:00 PM.",
  unsupported: "This browser can't show notifications.",
  "ios-not-installed":
    "On iPhone and iPad, add Task Master to your Home Screen first (Share, then Add to Home Screen), then turn this on from the app.",
  denied:
    "Notifications are blocked for Task Master. Allow them in your browser's site settings (on iPhone: Settings, Notifications, Task Master), then reload this page.",
  on: "On for this device. You'll get a notification on Sundays at 7:00 PM.",
  off: "Get a notification on this device on Sundays at 7:00 PM.",
};

function description(status: PushStatus, checked: boolean) {
  if (status.kind !== "ready") return DESCRIPTIONS[status.kind];
  return checked ? DESCRIPTIONS.on : DESCRIPTIONS.off;
}

export function ReviewReminder({ reviewNotify, vapidPublicKey }: ReviewReminderProps) {
  const { status, enable, disable } = usePushSubscription(vapidPublicKey);
  const [isPending, startTransition] = useTransition();
  const [isSending, startSending] = useTransition();
  const ready = status.kind === "ready";
  const [checked, setOptimisticChecked] = useOptimistic(ready && status.subscribed && reviewNotify);

  function handleChange(next: boolean) {
    startTransition(async () => {
      setOptimisticChecked(next);
      const outcome = next ? await enable() : await disable();
      if (!outcome.ok) toast.error(outcome.error);
    });
  }

  function handleTest() {
    startSending(async () => {
      const result = await sendTestNotification();
      if (result.success) toast.success("Test notification sent.");
      else toast.error(result.error);
    });
  }

  return (
    <SettingsRow label="Sunday review reminder" description={description(status, checked)}>
      <div className="flex items-center gap-3">
        {checked && !isPending && (
          <Button variant="outline" size="lg" className="h-11 px-4" disabled={isSending} onClick={handleTest}>
            <BellRing aria-hidden="true" />
            {isSending ? "Sending…" : "Send a test notification"}
          </Button>
        )}
        <Switch
          checked={checked}
          onCheckedChange={handleChange}
          disabled={!ready || isPending}
          size="lg"
          aria-label="Sunday review reminder"
          className="data-checked:bg-success"
        />
      </div>
    </SettingsRow>
  );
}
