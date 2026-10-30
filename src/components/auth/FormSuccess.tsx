import { CircleCheck } from "lucide-react";

export function FormSuccess({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-md bg-success-soft px-3 py-2.5 text-sm text-success-ink"
    >
      <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
