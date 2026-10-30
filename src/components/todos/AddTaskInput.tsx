"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

interface AddTaskInputProps {
  label: string;
  onAdd: (title: string) => void;
}

// Enter adds the task and clears the field; focus stays so the next one can be typed.
export function AddTaskInput({ label, onAdd }: AddTaskInputProps) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center gap-3 border-t py-1.5 pr-4 pl-[18px] text-muted-foreground">
      <Plus className="size-4 flex-none" strokeWidth={2} aria-hidden="true" />
      <input
        type="text"
        value={value}
        maxLength={200}
        aria-label={label}
        placeholder={label}
        enterKeyHint="done"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          const title = value.trim();
          if (!title) return;
          onAdd(title);
          setValue("");
        }}
        className="h-11 min-w-0 flex-1 rounded-sm bg-transparent text-[14.5px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
      />
    </div>
  );
}
