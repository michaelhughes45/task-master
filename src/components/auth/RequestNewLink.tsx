import Link from "next/link";
import { FormError } from "@/components/auth/FormError";

// Error for a reset link that is invalid, expired or already used.
export function RequestNewLink() {
  return (
    <div className="flex flex-col gap-1.5">
      <FormError message="This reset link is invalid or has expired." />
      <Link
        href="/forgot-password"
        className="self-start rounded-sm text-sm font-medium text-primary-text hover:text-primary-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        Request a new link
      </Link>
    </div>
  );
}
