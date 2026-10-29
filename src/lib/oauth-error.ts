// Friendly text for the `error` query param Better Auth adds when a Google sign-in fails.
const MESSAGES: Record<string, string> = {
  access_denied: "Google sign-in was cancelled.",
  account_not_linked:
    "An account with this email already exists. Sign in with your email and password.",
};

const FALLBACK = "Couldn't sign you in with Google. Try again.";

export function oauthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? FALLBACK;
}
