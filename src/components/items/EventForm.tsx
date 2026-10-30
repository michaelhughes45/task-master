"use client";

import { useId, useState } from "react";
import { createEvent, updateEvent } from "@/actions/events";
import { ITEM_INPUT_CLASS, ItemField, fieldA11y } from "@/components/items/ItemField";
import { ItemFormFooter } from "@/components/items/ItemFormFooter";
import { TitleField } from "@/components/items/TitleField";
import { Switch } from "@/components/ui/switch";
import { useItemForm } from "@/hooks/use-item-form";
import { cn } from "@/lib/utils";
import { eventSchema, type EventInput } from "@/lib/validations/events";
import type { EventColor, EventFormValues } from "@/types/events";

const COLORS = [
  { value: "BLUE", label: "Blue", swatch: "bg-primary", ring: "ring-primary" },
  {
    value: "GREEN",
    label: "Green",
    swatch: "bg-success",
    ring: "ring-success",
  },
] as const;

type Fields = Omit<EventFormValues, "title">;

interface EventFormProps {
  // The title lives in the dialog so it survives switching between Task and Event.
  title: string;
  onTitleChange: (title: string) => void;
  titleRef: React.Ref<HTMLInputElement>;
  initial: Fields;
  // Set when editing an existing event.
  eventId?: string;
  onCancel: () => void;
  onDone: () => void;
}

export function EventForm({ title, onTitleChange, titleRef, initial, eventId, onCancel, onDone }: EventFormProps) {
  const id = useId();
  const [fields, setFields] = useState<Fields>(initial);
  const { errors, isPending, submit, clearError } = useItemForm({
    schema: eventSchema,
    action: (values: EventInput) => (eventId ? updateEvent(eventId, values) : createEvent(values)),
    successMessage: eventId ? "Event saved" : "Event added",
    onSuccess: onDone,
  });

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    clearError(key);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { startTime, endTime, ...rest } = fields;
    submit({
      ...rest,
      ...(fields.allDay ? {} : { startTime, endTime }),
      title,
    });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <TitleField
          value={title}
          onChange={(value) => {
            onTitleChange(value);
            clearError("title");
          }}
          inputRef={titleRef}
          placeholder="e.g. Dentist"
          errors={errors.title}
        />
        <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-[170px_140px_140px]">
          <ItemField id={`${id}-date`} label="Date" errors={errors.date} className="col-span-2 md:col-span-1">
            <input
              type="date"
              required
              value={fields.date}
              onChange={(e) => set("date", e.target.value)}
              className={ITEM_INPUT_CLASS}
              {...fieldA11y(`${id}-date`, errors.date)}
            />
          </ItemField>
          {!fields.allDay && (
            <>
              <ItemField id={`${id}-start`} label="Starts" errors={errors.startTime}>
                <input
                  type="time"
                  required
                  value={fields.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                  className={ITEM_INPUT_CLASS}
                  {...fieldA11y(`${id}-start`, errors.startTime)}
                />
              </ItemField>
              <ItemField id={`${id}-end`} label="Ends" errors={errors.endTime}>
                <input
                  type="time"
                  required
                  value={fields.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                  className={ITEM_INPUT_CLASS}
                  {...fieldA11y(`${id}-end`, errors.endTime)}
                />
              </ItemField>
            </>
          )}
        </div>
        <label className="flex h-11 items-center self-start gap-2.5 text-[14.5px] md:h-10">
          <Switch size="lg" checked={fields.allDay} onCheckedChange={(checked) => set("allDay", checked)} />
          All day
        </label>
        <ItemField id={`${id}-location`} label="Location (optional)" errors={errors.location}>
          <input
            type="text"
            maxLength={200}
            value={fields.location}
            placeholder="Add a place"
            onChange={(e) => set("location", e.target.value)}
            className={ITEM_INPUT_CLASS}
            {...fieldA11y(`${id}-location`, errors.location)}
          />
        </ItemField>
        <ItemField id={`${id}-notes`} label="Notes (optional)" errors={errors.notes}>
          <textarea
            rows={3}
            maxLength={2000}
            value={fields.notes}
            onChange={(e) => set("notes", e.target.value)}
            className={cn(ITEM_INPUT_CLASS, "h-auto py-2 md:h-auto")}
            {...fieldA11y(`${id}-notes`, errors.notes)}
          />
        </ItemField>
        <ColorPicker value={fields.color} onChange={(color) => set("color", color)} />
      </div>
      <ItemFormFooter submitLabel="Save event" pending={isPending} onCancel={onCancel} />
    </form>
  );
}

function ColorPicker({ value, onChange }: { value: EventColor; onChange: (color: EventColor) => void }) {
  return (
    <div role="group" aria-label="Color" className="flex items-center gap-1">
      <span aria-hidden="true" className="mr-1.5 text-[13px] font-medium text-muted-foreground">
        Color
      </span>
      {COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          aria-label={color.label}
          aria-pressed={value === color.value}
          onClick={() => onChange(color.value)}
          className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            className={cn(
              "size-7 rounded-full",
              color.swatch,
              value === color.value && cn("ring-2 ring-offset-2 ring-offset-popover", color.ring),
            )}
          />
        </button>
      ))}
    </div>
  );
}
