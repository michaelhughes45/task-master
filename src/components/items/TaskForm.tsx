"use client";

import { useId, useState } from "react";
import { createTask } from "@/actions/tasks";
import { ITEM_INPUT_CLASS, ItemField, fieldA11y } from "@/components/items/ItemField";
import { ItemFormFooter } from "@/components/items/ItemFormFooter";
import { SegmentedControl } from "@/components/items/SegmentedControl";
import { TitleField } from "@/components/items/TitleField";
import { useItemForm } from "@/hooks/use-item-form";
import { createTaskSchema } from "@/lib/validations/tasks";
import type { DateStr, TaskScope } from "@/types/dates";
import type { Priority } from "@/types/tasks";

const SCOPES = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
] as const;

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
] as const;

interface TaskFormProps {
  // The title lives in the dialog so it survives switching between Task and Event.
  title: string;
  onTitleChange: (title: string) => void;
  titleRef: React.Ref<HTMLInputElement>;
  defaultDate: DateStr;
  onCancel: () => void;
  onDone: () => void;
}

// Weekly tasks may pick any day; the action files them under that week's Monday.
export function TaskForm({ title, onTitleChange, titleRef, defaultDate, onCancel, onDone }: TaskFormProps) {
  const id = useId();
  const [scope, setScope] = useState<TaskScope>("DAILY");
  const [date, setDate] = useState(defaultDate);
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const { errors, isPending, submit, clearError } = useItemForm({
    schema: createTaskSchema,
    action: createTask,
    successMessage: scope === "WEEKLY" ? "Weekly task added" : "Task added",
    onSuccess: onDone,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit({ title, scope, date, priority });
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
          placeholder="e.g. Pay electric bill"
          errors={errors.title}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted-foreground">List</span>
          <SegmentedControl label="List" options={SCOPES} value={scope} onChange={setScope} />
        </div>
        <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-[170px_140px]">
          <ItemField id={`${id}-date`} label={scope === "WEEKLY" ? "Week of" : "Date"} errors={errors.date}>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                clearError("date");
              }}
              className={ITEM_INPUT_CLASS}
              {...fieldA11y(`${id}-date`, errors.date)}
            />
          </ItemField>
          <ItemField id={`${id}-priority`} label="Priority" errors={errors.priority}>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className={ITEM_INPUT_CLASS}
              {...fieldA11y(`${id}-priority`, errors.priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </ItemField>
        </div>
      </div>
      <ItemFormFooter submitLabel="Add task" pending={isPending} onCancel={onCancel} />
    </form>
  );
}
