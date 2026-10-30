# Auth Phase 2 — Sign in with Google

## Overview

Add Google as a second way to sign in and sign up, alongside email and password.

## Before starting (the user does this)

- In Google Cloud Console, create an OAuth client (Web application):
  - Authorized JavaScript origin: `http://localhost:3000`
  - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
- Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

## Requirements

- Add `socialProviders.google` to `src/lib/auth.ts`.
- "Continue with Google" button at the top of `/sign-in` and `/sign-up`, with an "or" divider (as in the mockup). Use a neutral outlined button; a small Google "G" mark is fine.
- Pass the safe `callbackURL` through, defaulting to `/today`.
- **Account linking**: a Google sign-in with the same email as an existing email/password account links to it only if Google reports the email as verified (`accountLinking` with `trustedProviders: ["google"]`). Check the current Better Auth option names with Context7.
- Google users get `timezone` = null; spec 06 fills it in from the browser on first app load.
- Show a friendly error on `/sign-in` when Google sign-in fails or is cancelled (Better Auth's error query param).
- Add both variables to `.env.example`.

## Files to Create / Modify

1. `src/lib/auth.ts`
2. `src/components/auth/GoogleButton.tsx`
3. `src/app/(auth)/sign-in/page.tsx`, `sign-up/page.tsx`

## Testing

1. Sign in with Google → lands on `/today`; a `user` and an `account` row exist.
2. Sign in with Google using the email of an existing password account → same user, two accounts.
3. Cancel on Google's screen → back on `/sign-in` with a message.
4. `npm run build` passes.

## References

- https://www.better-auth.com/docs/authentication/google
- https://www.better-auth.com/docs/concepts/users-accounts#account-linking
