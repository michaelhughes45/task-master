import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

type AuthResult = { error: { message?: string } | null };

interface UseAuthFormOptions<T> {
  schema: z.ZodType<T>;
  submit: (data: T) => Promise<AuthResult>;
  callbackURL: string;
  fallbackError: string;
}

// Validates the form with the shared schema, calls Better Auth, then goes to callbackURL.
export function useAuthForm<T extends object>({
  schema,
  submit,
  callbackURL,
  fallbackError,
}: UseAuthFormOptions<T>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof T, string[]>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as Partial<Record<keyof T, string[]>>);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      try {
        const { error } = await submit(parsed.data);
        if (error) {
          setFormError(error.message ?? fallbackError);
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

  return { isPending, fieldErrors, formError, handleSubmit };
}
