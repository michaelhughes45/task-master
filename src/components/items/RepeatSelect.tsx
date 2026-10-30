"use client";

import { useId } from "react";
import { CustomRepeatPanel } from "@/components/items/CustomRepeatPanel";
import { ITEM_INPUT_CLASS, ItemField, fieldA11y } from "@/components/items/ItemField";
import {
  customFromRule,
  presetsFor,
  repeatRule,
  type RepeatPreset,
  type RepeatState,
} from "@/lib/rrule-builder";
import type { DateStr, TaskScope } from "@/types/dates";

interface RepeatSelectProps {
  // The form's date; the presets are named after it ("Weekly on Wednesday").
  day: DateStr;
  scope: TaskScope;
  value: RepeatState;
  onChange: (value: RepeatState) => void;
  errors?: string[];
}

export function RepeatSelect({ day, scope, value, onChange, errors }: RepeatSelectProps) {
  const id = useId();
  const custom = value.preset === "custom";

  function pick(preset: RepeatPreset) {
    // Custom… starts from the rule chosen so far, like Google Calendar.
    const next = preset === "custom" && !custom ? customFromRule(repeatRule(value, day, scope), day) : value.custom;
    onChange({ preset, custom: next });
  }

  return (
    <>
      <ItemField id={`${id}-repeat`} label="Repeat" errors={custom ? undefined : errors}>
        <select
          value={value.preset}
          onChange={(e) => pick(e.target.value as RepeatPreset)}
          className={ITEM_INPUT_CLASS}
          {...fieldA11y(`${id}-repeat`, custom ? undefined : errors)}
        >
          {presetsFor(day, scope).map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
      </ItemField>
      {custom && (
        <CustomRepeatPanel
          day={day}
          scope={scope}
          value={value.custom}
          onChange={(next) => onChange({ preset: "custom", custom: next })}
          error={errors?.[0]}
        />
      )}
    </>
  );
}
