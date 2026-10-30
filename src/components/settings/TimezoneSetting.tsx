"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { updateTimezone } from "@/actions/settings";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { timezoneLabel } from "@/lib/timezones";

interface TimezoneSettingProps {
  id: string;
  timezone: string | null;
  // From the server, so the list matches what the action accepts
  timezones: readonly string[];
}

export function TimezoneSetting({ id, timezone, timezones }: TimezoneSettingProps) {
  const [isPending, startTransition] = useTransition();
  const [value, setOptimisticValue] = useOptimistic(timezone);

  function handleChange(next: string | null) {
    if (!next || next === value) return;
    startTransition(async () => {
      setOptimisticValue(next);
      const result = await updateTimezone(next);
      if (result.success) toast.success(`Timezone set to ${timezoneLabel(next)}`);
      else toast.error(result.error);
    });
  }

  return (
    <Combobox
      items={timezones}
      value={value}
      onValueChange={handleChange}
      itemToStringLabel={timezoneLabel}
      disabled={isPending}
    >
      <ComboboxInput
        id={id}
        placeholder="Search timezones"
        className="h-10 w-full rounded-md bg-background sm:w-72 dark:bg-background"
      />
      <ComboboxContent>
        <ComboboxEmpty>No matching timezone</ComboboxEmpty>
        <ComboboxList>
          {(zone: string) => (
            <ComboboxItem key={zone} value={zone} className="h-9">
              {timezoneLabel(zone)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
