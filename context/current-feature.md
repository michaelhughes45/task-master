# Current Feature: Auth Email Verification and Password Reset (05)

Send emails with Resend for email verification (behind an on/off switch) and for password reset. Add the forgot-password and reset-password pages.

## Status

In Progress

## Goals

- Install `resend`; `src/lib/email.ts` sends mail from `onboarding@resend.dev` (no custom domain yet)
- `isEmailVerificationEnabled()` in `src/lib/email.ts`: verification is on unless `EMAIL_VERIFICATION_ENABLED` is exactly `false`, with unit tests (`true`, missing, `TRUE`, `false`); set to `false` in `.env` for development
- Better Auth config in `src/lib/auth.ts`:
  - `emailVerification.sendVerificationEmail`, `sendOnSignUp: true` when enabled, `autoSignInAfterVerification: true`
  - `emailAndPassword.requireEmailVerification: isEmailVerificationEnabled()`
  - `emailAndPassword.sendResetPassword`, `revokeSessionsOnPasswordReset: true`
  - Links built from `BETTER_AUTH_URL`, never from request headers
  - Built-in `rateLimit` enabled
- Plain, readable emails (text + simple HTML): subject, one sentence, the link, and the expiry
- `(auth)` pages styled like sign-in:
  - `/forgot-password`: email field; always shows "If an account exists for that email, we've sent a link." (no account enumeration)
  - `/reset-password?token=…`: new password + confirm; invalid/expired token shows an error and a "Request a new link" link; success redirects to `/sign-in?reset=1`
- `/sign-in` messages for `?reset=1`, `?verified=1`, and the "email not verified" error with a "Resend link" action
- After sign-up with verification on, show "Check your email to verify your account."
- Add `RESEND_API_KEY` and `EMAIL_VERIFICATION_ENABLED` to `.env.example`
- `npm run build` and `npm test` pass

## Notes

- Files: `src/lib/email.ts` (+ test), `src/lib/auth.ts`, `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/reset-password/page.tsx` + components, `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx`
- Resend's test sender only delivers to the account owner's address or `delivered@resend.dev`; test with those
- Check Better Auth 1.7.14's current option names (`sendResetPassword`, `revokeSessionsOnPasswordReset`) with Context7 before writing config
- Spec 04 left account linking waiting on local email verification (`requireLocalEmailVerified` default), so this unlocks Google linking to verified password accounts
- `env.ts` does not exist yet; `auth.ts` reads `process.env` directly for now
- Manual tests: verification off → sign up goes straight in; on → "check your email", sign-in blocked with resend option, link verifies and signs in; forgot password → reset works, old password fails, other sessions signed out; expired/reused reset link shows the error
- References: https://www.better-auth.com/docs/concepts/email, https://www.better-auth.com/docs/authentication/email-password#forget-password

## History

<!-- Keep this updated.  Earliest to latest -->

- **2026-10-29 — Project Setup (01):** Next.js 16.4 (App Router, TypeScript, `src/`, `@/*`), Tailwind v4 theme tokens from the mockup (light/dark, shadcn names plus primary/success/warning extras), shadcn/ui `base-nova` with `button`, IBM Plex Sans/Mono, `next-themes` toggle, placeholder home page, Vitest (`TZ=Pacific/Auckland`, `cn()` test), `.env.example`, git with GitHub remote.
- **2026-10-29 — Database Setup (02):** Prisma 7.10.1 (latest stable; npm `latest` was an 8.0 RC) with `prisma-client` generator to `src/generated/prisma`, `prisma.config.ts` (dotenv, CLI on `DIRECT_URL`), shared Neon-adapter client in `src/lib/prisma.ts` (`server-only`, `globalThis` reuse), `User` model mapped to `user`, `init` migration applied to Neon `development`, `npm run db:test`, Neon IDs in `CLAUDE.md`, approved install scripts for prisma/esbuild/unrs-resolver.
- **2026-10-29 — Auth Email/Password (03):** Better Auth 1.7.14 + Prisma adapter (email/password 8–128, `timezone`/`reviewNotify` additional fields, `nextCookies()`), CLI-generated `Session`/`Account`/`Verification` + `auth` migration (CLI needs `server-only` removed temporarily from `auth.ts`/`prisma.ts` while it runs), `/api/auth/[...all]`, `auth-client.ts` (`inferAdditionalFields`), `session.ts` (`getSession` cached, `getCurrentUserId`, `requireUser`), `proxy.ts` cookie check with `callbackURL`, `(auth)` sign-in/sign-up pages from the mockup via `useAuthForm` hook, `(app)` layout guard, temporary `/today` with sign out, `safeCallbackUrl` + Zod auth schemas with tests, shadcn `input`/`label`/`sonner`, `--brand-check` logo token. Cache Components requires `export const instant = false` on segments that read the session or `searchParams` outside Suspense. Test user `test-auth03@example.com` / `password123` kept on `development`.
- **2026-10-29 — Auth Google (04):** Better Auth Google provider (`socialProviders.google`, reads `process.env` since `env.ts` does not exist yet), `accountLinking: { enabled: true }` without `trustedProviders` (in 1.7.14 a trusted provider links even unverified emails) and default `requireLocalEmailVerified`, so linking to a password account waits for spec 05 verification. `GoogleButton` (outlined, `/google-g.svg`, `errorCallbackURL` back to `/sign-in` keeping `callbackURL`) and `OrDivider` on sign-in/sign-up, `oauthErrorMessage` for the `?error=` param (cancel, `account_not_linked`, fallback) with tests, `onAPIError.errorURL = "/sign-in"`. Verified: Google sign-in lands on `/today` with `timezone` null. Google user `mhughesy23@gmail.com` now on `development`.
