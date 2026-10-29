import { CircleAlert } from "lucide-react";

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
