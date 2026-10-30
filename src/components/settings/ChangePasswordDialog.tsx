"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/FormError";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuthForm } from "@/hooks/use-auth-form";
import { authClient } from "@/lib/auth-client";
import { changePasswordSchema } from "@/lib/validations/auth";

export function ChangePasswordDialog({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" className="h-11 px-4" />}>
        Change password
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Change password</DialogTitle>
          <DialogDescription>You&apos;ll stay signed in here; other devices are signed out.</DialogDescription>
        </DialogHeader>
        <ChangePasswordForm email={email} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Unmounts when the dialog closes, so each opening starts with an empty form.
function ChangePasswordForm({ email, onDone }: { email: string; onDone: () => void }) {
  const { isPending, fieldErrors, formError, handleSubmit } = useAuthForm({
    schema: changePasswordSchema,
    submit: async ({ currentPassword, password }) => {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword: password,
        revokeOtherSessions: true,
      });
      if (result.error?.code === "INVALID_PASSWORD") {
        return { error: { ...result.error, message: "Your current password is incorrect" } };
      }
      return result;
    },
    callbackURL: null,
    fallbackError: "Couldn't change your password. Try again.",
    onSuccess: () => {
      toast.success("Password changed");
      onDone();
    },
  });

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      {/* Tells password managers which account the new password belongs to */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <FormField
        name="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        errors={fieldErrors.currentPassword}
      />
      <FormField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        errors={fieldErrors.password}
      />
      <FormField
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        errors={fieldErrors.confirmPassword}
      />
      <FormError message={formError} />
      <SubmitButton pending={isPending} label="Change password" pendingLabel="Saving…" />
    </form>
  );
}
