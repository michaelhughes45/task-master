# Current Feature: Auth Google (04)

Add Google as a second way to sign in and sign up, alongside email and password.

## Status

Complete

## Goals

- `socialProviders.google` configured in `src/lib/auth.ts` (`src/lib/env.ts` does not exist yet, so it reads `process.env` like `prisma.ts`)
- "Continue with Google" button (neutral outlined, small Google "G" mark) at the top of `/sign-in` and `/sign-up`, with an "or" divider as in the mockup
- Safe `callbackURL` passed through, defaulting to `/today`
- Account linking: Google sign-in with the same email as an existing password account links only if Google reports the email as verified (`accountLinking: { enabled: true }` without `trustedProviders`, since in 1.7.14 a trusted provider links even unverified emails; Better Auth's default `requireLocalEmailVerified` also stays on, so linking waits for spec 05)
- Google users get `timezone` = null (spec 06 fills it from the browser)
- Friendly error on `/sign-in` when Google sign-in fails or is cancelled (Better Auth's error query param)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.example`

## Notes

- **User prerequisite:** create a Google Cloud OAuth client (Web application) with JS origin `http://localhost:3000` and redirect URI `http://localhost:3000/api/auth/callback/google`, then put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`.
- Files: `src/lib/auth.ts`, `src/components/auth/GoogleButton.tsx` (spec says `google-button.tsx`; PascalCase matches the coding standards and the other auth components), `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx`.
- Testing: Google sign-in lands on `/today` with `user` + `account` rows; same email as an existing password account → one user, two accounts; cancelling on Google's screen → back on `/sign-in` with a message; `npm run build` passes.
- References: https://www.better-auth.com/docs/authentication/google, https://www.better-auth.com/docs/concepts/users-accounts#account-linking

## History

<!-- Keep this updated.  Earliest to latest -->

- **2026-10-29 — Project Setup (01):** Next.js 16.4 (App Router, TypeScript, `src/`, `@/*`), Tailwind v4 theme tokens from the mockup (light/dark, shadcn names plus primary/success/warning extras), shadcn/ui `base-nova` with `button`, IBM Plex Sans/Mono, `next-themes` toggle, placeholder home page, Vitest (`TZ=Pacific/Auckland`, `cn()` test), `.env.example`, git with GitHub remote.
- **2026-10-29 — Database Setup (02):** Prisma 7.10.1 (latest stable; npm `latest` was an 8.0 RC) with `prisma-client` generator to `src/generated/prisma`, `prisma.config.ts` (dotenv, CLI on `DIRECT_URL`), shared Neon-adapter client in `src/lib/prisma.ts` (`server-only`, `globalThis` reuse), `User` model mapped to `user`, `init` migration applied to Neon `development`, `npm run db:test`, Neon IDs in `CLAUDE.md`, approved install scripts for prisma/esbuild/unrs-resolver.
- **2026-10-29 — Auth Email/Password (03):** Better Auth 1.7.14 + Prisma adapter (email/password 8–128, `timezone`/`reviewNotify` additional fields, `nextCookies()`), CLI-generated `Session`/`Account`/`Verification` + `auth` migration (CLI needs `server-only` removed temporarily from `auth.ts`/`prisma.ts` while it runs), `/api/auth/[...all]`, `auth-client.ts` (`inferAdditionalFields`), `session.ts` (`getSession` cached, `getCurrentUserId`, `requireUser`), `proxy.ts` cookie check with `callbackURL`, `(auth)` sign-in/sign-up pages from the mockup via `useAuthForm` hook, `(app)` layout guard, temporary `/today` with sign out, `safeCallbackUrl` + Zod auth schemas with tests, shadcn `input`/`label`/`sonner`, `--brand-check` logo token. Cache Components requires `export const instant = false` on segments that read the session or `searchParams` outside Suspense. Test user `test-auth03@example.com` / `password123` kept on `development`.
