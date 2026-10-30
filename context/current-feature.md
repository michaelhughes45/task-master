# Current Feature: Date and Timezone Helpers (07)

Build `src/lib/dates.ts`, the single place for "today", week boundaries, date strings and display formatting in the user's timezone. Every later feature depends on it. No UI.

## Status

In Progress

## Goals

- Install `date-fns` and `@date-fns/tz`
- `DateStr` (`YYYY-MM-DD`) and `WallTime` (`HH:mm`) types in `src/types/dates.ts`
- `src/lib/dates.ts` with small, pure functions that take `tz` explicitly:
  - `resolveTimezone(user)` → IANA zone, or `'UTC'` when null
  - `todayIn(tz, now?)` → `DateStr`
  - `weekStartOf(day)` (Monday), `weekDays(weekStart)` (7 days), `addDays(day, n)`, `addWeeks(day, n)`
  - `isBefore(dayA, dayB)`, `isPastDay(day, tz, now?)`
  - `dayStartInstant(day, tz)`, `dayEndInstant(day, tz)` (exclusive, next day's start), `weekRange(weekStart, tz)`
  - `toDbDate(day)` / `fromDbDate(date)` for `@db.Date` (via UTC)
  - `wallTimeToInstant(day, 'HH:mm', tz)` / `instantToWallTime(instant, tz)`
  - `isDoneLate({ occurrenceDay, scope: 'DAILY' | 'WEEKLY', completedAt, tz })`
  - Formatters: `formatDayLong` ("Wednesday, October 28"), `formatDayShort` ("Wed, Oct 28"), `formatWeekRange` ("Oct 26 – Nov 1"; across years "Dec 28, 2026 – Jan 3, 2027"), `formatTime` ("9:00 AM"), `formatMinutes` ("25 min", "2h 10m", "1h")
  - `parseDateParam(value, fallback)` for `?date=` (invalid → fallback)
- `src/lib/dates.test.ts` covering at least:
  - `America/New_York` spring forward (Mar 8, 2026) and fall back (Nov 1, 2026): 23/25-hour day ranges, wall times correct
  - `Pacific/Auckland` and `America/Los_Angeles` late at night: "today" differs from UTC's
  - Week start for a Sunday, a Monday, across month and year boundaries (Dec 28, 2026 – Jan 3, 2027)
  - Leap day 2028-02-29
  - `isDoneLate` daily (ticked next morning) and weekly (ticked the Monday after)
  - `formatMinutes` edge cases (0, 59, 60, 61, 130)
- Clock pinned with `vi.setSystemTime` where "now" matters
- `npm test` passes; `date-logic-reviewer` agent run on `src/lib/dates.ts` and real findings fixed

## Notes

- Never move by days with milliseconds; use date-fns on `TZDate` or calendar math on `DateStr`.
- Tests must not depend on the machine's timezone; Vitest already runs with `TZ=Pacific/Auckland` (spec 01).
- Function names can change if clearer.
- Reference: https://github.com/date-fns/tz

## History

<!-- Keep this updated.  Earliest to latest -->

- **2026-10-29 — Project Setup (01):** Next.js 16.4 (App Router, TypeScript, `src/`, `@/*`), Tailwind v4 theme tokens from the mockup (light/dark, shadcn names plus primary/success/warning extras), shadcn/ui `base-nova` with `button`, IBM Plex Sans/Mono, `next-themes` toggle, placeholder home page, Vitest (`TZ=Pacific/Auckland`, `cn()` test), `.env.example`, git with GitHub remote.
- **2026-10-29 — Database Setup (02):** Prisma 7.10.1 (latest stable; npm `latest` was an 8.0 RC) with `prisma-client` generator to `src/generated/prisma`, `prisma.config.ts` (dotenv, CLI on `DIRECT_URL`), shared Neon-adapter client in `src/lib/prisma.ts` (`server-only`, `globalThis` reuse), `User` model mapped to `user`, `init` migration applied to Neon `development`, `npm run db:test`, Neon IDs in `CLAUDE.md`, approved install scripts for prisma/esbuild/unrs-resolver.
- **2026-10-29 — Auth Email/Password (03):** Better Auth 1.7.14 + Prisma adapter (email/password 8–128, `timezone`/`reviewNotify` additional fields, `nextCookies()`), CLI-generated `Session`/`Account`/`Verification` + `auth` migration (CLI needs `server-only` removed temporarily from `auth.ts`/`prisma.ts` while it runs), `/api/auth/[...all]`, `auth-client.ts` (`inferAdditionalFields`), `session.ts` (`getSession` cached, `getCurrentUserId`, `requireUser`), `proxy.ts` cookie check with `callbackURL`, `(auth)` sign-in/sign-up pages from the mockup via `useAuthForm` hook, `(app)` layout guard, temporary `/today` with sign out, `safeCallbackUrl` + Zod auth schemas with tests, shadcn `input`/`label`/`sonner`, `--brand-check` logo token. Cache Components requires `export const instant = false` on segments that read the session or `searchParams` outside Suspense. Test user `test-auth03@example.com` / `password123` kept on `development`.
- **2026-10-29 — Auth Google (04):** Better Auth Google provider (`socialProviders.google`, reads `process.env` since `env.ts` does not exist yet), `accountLinking: { enabled: true }` without `trustedProviders` (in 1.7.14 a trusted provider links even unverified emails) and default `requireLocalEmailVerified`, so linking to a password account waits for spec 05 verification. `GoogleButton` (outlined, `/google-g.svg`, `errorCallbackURL` back to `/sign-in` keeping `callbackURL`) and `OrDivider` on sign-in/sign-up, `oauthErrorMessage` for the `?error=` param (cancel, `account_not_linked`, fallback) with tests, `onAPIError.errorURL = "/sign-in"`. Verified: Google sign-in lands on `/today` with `timezone` null. Google user `mhughesy23@gmail.com` now on `development`.
- **2026-10-29 — Auth Email Verification and Password Reset (05):** Resend 6.35 (`src/lib/email.ts`: `onboarding@resend.dev`, text + HTML link emails, `isEmailVerificationEnabled()` on unless exactly `"false"`, client created per send so a missing key only fails sends). Better Auth: explicit `baseURL` from `BETTER_AUTH_URL`, `requireEmailVerification`/`sendOnSignUp` follow the toggle, `autoSignInAfterVerification`, `sendResetPassword` + `revokeSessionsOnPasswordReset`, `rateLimit: { enabled: true }` (in-memory, per instance), `advanced.backgroundTasks` via Next `after()` so email timing doesn't reveal accounts (the resend-verification endpoint still awaits the send). `/forgot-password` (same message always), `/reset-password` (`RequestNewLink` for `?error=INVALID_TOKEN` or an `INVALID_TOKEN` on submit, success → `/sign-in?reset=1`). `signInNotice` (reset/verified/verification-link errors, falls back to `oauthErrorMessage`) with tests; verification links land on `/sign-in?verified=1` (`VERIFY_EMAIL_CALLBACK_URL`), where the `(auth)` layout's streamed redirect sends signed-in users to `/today`. `useAuthForm` gained `callbackURL: null` (stay, `succeeded`), `errorCode` and `submitted`; `ResendVerificationButton` on `EMAIL_NOT_VERIFIED`; sign-up shows "check your email" when verification is on. Forgot/reset Zod schemas with tests. Verified with a production build: reset flow, session revocation, reused/bogus links, verification on (sign-up, blocked sign-in, valid/invalid links). Real Resend delivery untested until `RESEND_API_KEY` is set. Test user `test-verify05@example.com` / `password123` (verified) on `development`.
- **2026-10-30 — App Shell and Settings (06):** `(app)` layout (`requireUser()`) with `AppSidebar` (desktop, static, `NAV_ITEMS` + `isActivePath`, `UserMenu` dropdown with initials/Settings/Sign out; "This week" slot left for spec 18), `BottomTabs` (phone, 68px + `env(safe-area-inset-bottom)`, root `viewport.viewportFit = "cover"`), disabled `Fab` and header "New" (spec 12). `PageHeader` is rendered by each page (owns the `h1`) and reads the session for the phone avatar → `/settings`, so every app page sets `instant = false`. Placeholder `/today`, `/calendar`, `/todos`, `/review` (`ComingSoon`). `/settings`: Appearance (Light/Dark/System, shares next-themes with the header toggle), timezone `Combobox` (base-ui, `useOptimistic`), "Monday start", review reminder switch (added `lg` size to shadcn `switch`, green when on per mockup), `ChangePasswordDialog` only when `listUserAccounts` has a `credential` account (`revokeOtherSessions: true`, `INVALID_PASSWORD` → friendly message), Sign out. `src/actions/settings.ts` (`updateTimezone`, `updateReviewNotify`, `setTimezoneIfMissing` via `updateMany where timezone: null`) returning `ActionResult` (`src/types/actions.ts`), with tests. `isValidTimezone` accepts `Intl.supportedValuesOf` plus any name Intl accepts (Node's list lacks `UTC` and `Asia/Kolkata`), rejects offsets. `TimezoneSync` fills a null timezone once from the browser. New hooks `useSignOut`, `useMounted`; `useAuthForm` gained `onSuccess`; `changePasswordSchema`; `userInitials`. shadcn `avatar`, `combobox` (+ `input-group`, `textarea`), `dialog`, `dropdown-menu`, `separator`, `switch`. Verified on a production build (desktop and 375px, dark mode, timezone save, switch, change password, auto-fill). Google user's auto-fill and hidden Change password not browser-tested.
