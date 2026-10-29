# Current Feature: Auth Phase 1 — Better Auth with Email and Password

Add Better Auth with the Prisma adapter and email/password sign-up and sign-in. Build the sign-in and sign-up pages from the mockup, protect the app routes, and add sign-out. Google, email verification and password reset come in specs 04 and 05.

## Status

In Progress

## Goals

- Install `better-auth`; generate `BETTER_AUTH_SECRET` and set `BETTER_AUTH_URL=http://localhost:3000` in `.env` (and `.env.example` without the secret)
- `src/lib/auth.ts`: `prismaAdapter(prisma, { provider: "postgresql" })`, `emailAndPassword` (enabled, min 8, max 128), `user.additionalFields` (`timezone` optional string with input on sign-up; `reviewNotify` boolean default true, no input), `nextCookies()` plugin
- Better Auth CLI generates `Session`, `Account`, `Verification` into `schema.prisma`, reconciled with the existing `User` model; migrate with `prisma migrate dev --name auth`
- `src/app/api/auth/[...all]/route.ts` with `toNextJsHandler(auth)`
- `src/lib/auth-client.ts` with `createAuthClient()`
- `src/lib/session.ts`: `getSession()` (React `cache`), `getCurrentUserId()`, `requireUser()` (redirects to `/sign-in`)
- `src/proxy.ts`: optimistic session-cookie check for `/today`, `/calendar`, `/todos`, `/review`, `/settings`; redirects to `/sign-in?callbackURL=<path>`
- `(auth)` route group with centered layout (logo + "Task Master") matching `context/mockup/sign-in.html`
  - `/sign-in`: email, password, "Forgot password?" link (may 404 for now), Sign in button, "New here? Create an account", spot for Google button
  - `/sign-up`: name, email, password, confirm password; sends browser timezone as `timezone`
  - Field errors under fields, general error above the button, pending state on the button
  - Signed-in users visiting either page are redirected to `/today`
- `callbackURL` only followed when it's a same-origin path (`src/lib/safe-callback-url.ts` + tests)
- Shared Zod schemas in `src/lib/validations/auth.ts`
- Temporary `/today` page ("Signed in as {name}" + Sign out); `/` redirects to `/today` or `/sign-in`
- Add shadcn `input`, `label`, `sonner`

## Notes

- Use Context7 for Better Auth's current Next.js, Prisma adapter and CLI docs; don't rely on memory
- Better Auth hashes passwords (scrypt) itself; no bcrypt
- Database sessions: read server-side with `auth.api.getSession({ headers: await headers() })`
- The proxy can't call the database; use Better Auth's cookie helper there
- Testing: unit tests for `safeCallbackUrl` and auth schemas; signed-out `/today` → `/sign-in?callbackURL=%2Ftoday`; sign-up lands on `/today` with browser timezone stored; sign-out → `/sign-in`; wrong password and duplicate email show errors; pages match mockup in light/dark and at 375px; `npm run build` passes
- References: https://www.better-auth.com/docs/integrations/next, https://www.better-auth.com/docs/adapters/prisma, `context/mockup/sign-in.html`

## History

<!-- Keep this updated.  Earliest to latest -->

- **2026-10-29 — Project Setup (01):** Next.js 16.4 (App Router, TypeScript, `src/`, `@/*`), Tailwind v4 theme tokens from the mockup (light/dark, shadcn names plus primary/success/warning extras), shadcn/ui `base-nova` with `button`, IBM Plex Sans/Mono, `next-themes` toggle, placeholder home page, Vitest (`TZ=Pacific/Auckland`, `cn()` test), `.env.example`, git with GitHub remote.
- **2026-10-29 — Database Setup (02):** Prisma 7.10.1 (latest stable; npm `latest` was an 8.0 RC) with `prisma-client` generator to `src/generated/prisma`, `prisma.config.ts` (dotenv, CLI on `DIRECT_URL`), shared Neon-adapter client in `src/lib/prisma.ts` (`server-only`, `globalThis` reuse), `User` model mapped to `user`, `init` migration applied to Neon `development`, `npm run db:test`, Neon IDs in `CLAUDE.md`, approved install scripts for prisma/esbuild/unrs-resolver.
