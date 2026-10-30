import { oauthErrorMessage } from "@/lib/oauth-error";

// Where the email verification link lands (signed in if autoSignInAfterVerification worked).
export const VERIFY_EMAIL_CALLBACK_URL = "/sign-in?verified=1";

export type SignInNotice = { tone: "success" | "error"; message: string } | null;

// Error codes Better Auth adds when an email verification link fails.
const VERIFICATION_ERRORS: Record<string, string> = {
  TOKEN_EXPIRED: "That verification link has expired. Sign in to get a new one.",
  INVALID_TOKEN: "That verification link isn't valid. Sign in to get a new one.",
  USER_NOT_FOUND: "That verification link isn't valid. Sign in to get a new one.",
  INVALID_USER: "That verification link isn't valid. Sign in to get a new one.",
};

interface SignInParams {
  error?: string | null;
  reset?: string | null;
  verified?: string | null;
}

// The message shown above the sign-in form for the page's query params. Errors win.
export function signInNotice({ error, reset, verified }: SignInParams): SignInNotice {
  if (error) {
    const message = VERIFICATION_ERRORS[error] ?? oauthErrorMessage(error);
    if (message) return { tone: "error", message };
  }
  if (reset === "1") return { tone: "success", message: "Password updated. Sign in with your new password." };
  if (verified === "1") return { tone: "success", message: "Email verified. Sign in to continue." };
  return null;
}
