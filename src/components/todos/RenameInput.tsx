"use client";

import { useRef } from "react";

// Enter or leaving the field saves; Escape cancels.
export function RenameInput({ title, onDone }: { title: string; onDone: (title: string | null) => void }) {
  const finished = useRef(false);

  function finish(value: string | null) {
    if (finished.current) return;
    finished.current = true;
    onDone(value);
  }

  return (
    <input
      type="text"
      autoFocus
      defaultValue={title}
      maxLength={200}
      aria-label={`Rename ${title}`}
      onBlur={(e) => finish(e.currentTarget.value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(e.currentTarget.value.trim());
        } else if (e.key === "Escape") {
          finish(null);
        }
      }}
      className="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  );
}
