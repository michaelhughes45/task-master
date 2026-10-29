# Auth Phase 3 — Email Verification and Password Reset

## Overview

Send emails with Resend for email verification (behind an on/off switch) and for password reset. Add the forgot-password and reset-password pages.

## Requirements

- Install `resend`. `src/lib/email.ts` sends mail from `onboarding@resend.dev` for now (no custom domain yet).
- `EMAIL_VERIFICATION_ENABLED`: verification is **on unless the value is exactly `false`** (`isEmailVerificationEnabled()` in `src/lib/email.ts`, with tests). Set it to `false` in `.env` during development.
- Better Auth config:
  - `emailVerification.sendVerificationEmail`, `sendOnSignUp: true` when enabled, `autoSignInAfterVerification: true`
  - `emailAndPassword.requireEmailVerification: isEmailVerificationEnabled()`
  - `emailAndPassword.sendResetPassword`, `revokeSessionsOnPasswordReset: true`
  - links built from `BETTER_AUTH_URL`, never from request headers
  - built-in `rateLimit` enabled
- Plain, readable emails (text + simple HTML): subject, one sentence, the link, and the expiry.
- Pages in the `(auth)` group, styled like sign-in:
  - `/forgot-password`: email field; always shows "If an account exists for that email, we've sent a link." (no account enumeration).
  - `/reset-password?token=…`: new password + confirm; invalid or expired token shows an error and a "Request a new link" link; success redirects to `/sign-in?reset=1`.
- `/sign-in` messages for `?reset=1`, `?verified=1`, and the "email not verified" error (with a "Resend link" action).
- After sign-up with verification on, show "Check your email to verify your account."
- Add `RESEND_API_KEY` and `EMAIL_VERIFICATION_ENABLED` to `.env.example`.

## Files to Create / Modify

1. `src/lib/email.ts` (+ test for the toggle)
2. `src/lib/auth.ts`
3. `src/app/(auth)/forgot-password/page.tsx`, `reset-password/page.tsx` + components
4. `src/app/(auth)/sign-in/page.tsx`, `sign-up/page.tsx` (messages)

## Key Gotchas

- Resend's test sender can only deliver to the account owner's address or to `delivered@resend.dev`. Test with those.
- Check Better Auth's current option names (`sendResetPassword`, `revokeSessionsOnPasswordReset`) with Context7.

## Testing

1. Toggle unit test (`true`, missing, `TRUE`, `false`).
2. With verification off: sign up → straight in.
3. With it on: sign up → "check your email"; sign-in before verifying is blocked with a resend option; the link verifies and signs in.
4. Forgot password → reset link → new password works, old one doesn't, other sessions are signed out.
5. Expired or reused reset link shows the error.
6. `npm run build` passes.

## References

- https://www.better-auth.com/docs/concepts/email
- https://www.better-auth.com/docs/authentication/email-password#forget-password
