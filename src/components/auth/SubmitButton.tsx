import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  pending: boolean;
  label: string;
  pendingLabel: string;
}

export function SubmitButton({ pending, label, pendingLabel }: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-md text-[15px] font-semibold"
    >
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </Button>
  );
}
