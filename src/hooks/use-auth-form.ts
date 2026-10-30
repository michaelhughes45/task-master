import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

type AuthResult = { error: { message?: string; code?: string } | null };

interface UseAuthFormOptions<T> {
  schema: z.ZodType<T>;
  submit: (data: T) => Promise<AuthResult>;
  // Where to go after success; null stays on the page and sets `succeeded`.
  callbackURL: string | null;
  fallbackError: string;
  // Runs after success when callbackURL is null
  onSuccess?: () => void;
}

// Validates the form with the shared schema, calls Better Auth, then goes to callbackURL.
export function useAuthForm<T extends object>({
  schema,
  submit,
  callbackURL,
  fallbackError,
  onSuccess,
}: UseAuthFormOptions<T>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof T, string[]>>>({});
  const [formError, setFormError] = useState<{ message: string; code?: string } | null>(null);
  const [submitted, setSubmitted] = useState<T | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as Partial<Record<keyof T, string[]>>);
      return;
    }
    setFieldErrors({});
    setSubmitted(parsed.data);

    startTransition(async () => {
      try {
        const { error } = await submit(parsed.data);
        if (error) {
          setFormError({ message: error.message ?? fallbackError, code: error.code });
          return;
        }
        if (callbackURL === null) {
          setSucceeded(true);
          onSuccess?.();
          return;
        }
        router.replace(callbackURL);
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error("Something went wrong. Check your connection and try again.");
      }
    });
  }

  return {
    isPending,
    fieldErrors,
    formError: formError?.message ?? null,
    errorCode: formError?.code ?? null,
    submitted,
    succeeded,
    handleSubmit,
  };
}
