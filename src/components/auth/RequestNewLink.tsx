import Link from "next/link";
import { FormError } from "@/components/auth/FormError";
import { TEXT_LINK_CLASS } from "@/components/auth/text-link";
import { cn } from "@/lib/utils";

// Error for a reset link that is invalid, expired or already used.
export function RequestNewLink() {
  return (
    <div className="flex flex-col gap-1.5">
      <FormError message="This reset link is invalid or has expired." />
      <Link
        href="/forgot-password"
        className={cn(TEXT_LINK_CLASS, "self-start text-sm font-medium")}
      >
        Request a new link
      </Link>
    </div>
  );
}
