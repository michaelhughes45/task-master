# Auth Phase 1 — Better Auth with Email and Password

## Overview

Add Better Auth with the Prisma adapter and email/password sign-up and sign-in. Build the sign-in and sign-up pages from the mockup, protect the app routes, and add sign-out. Google, email verification and password reset come in specs 04 and 05.

## Requirements

- Install `better-auth`. Generate `BETTER_AUTH_SECRET` and set `BETTER_AUTH_URL=http://localhost:3000` in `.env` (and `.env.example` without the secret).
- `src/lib/auth.ts`:
  - `prismaAdapter(prisma, { provider: "postgresql" })`
  - `emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 }`
  - `user.additionalFields`: `timezone` (string, optional, input allowed on sign-up), `reviewNotify` (boolean, default true, no input)
  - the `nextCookies()` plugin so server actions can set cookies
- Run the Better Auth CLI to generate the `Session`, `Account` and `Verification` models into `schema.prisma`, reconcile with the existing `User` model, and migrate (`prisma migrate dev --name auth`).
- `src/app/api/auth/[...all]/route.ts` with `toNextJsHandler(auth)`.
- `src/lib/auth-client.ts`: `createAuthClient()` for client components.
- `src/lib/session.ts`: `getSession()` (request-cached with React `cache`), `getCurrentUserId()` and `requireUser()` (redirects to `/sign-in` if there's no session).
- `src/proxy.ts`: optimistic check of the session cookie for app routes (`/today`, `/calendar`, `/todos`, `/review`, `/settings`); redirects to `/sign-in?callbackURL=<path>`. Pages still check the session server-side.
- `(auth)` route group with a centered layout (logo + "Task Master"), matching `context/mockup/sign-in.html`:
  - `/sign-in`: email, password, "Forgot password?" link (page comes in spec 05; link can 404 for now), Sign in button, "New here? Create an account". Leave a spot for the Google button (spec 04).
  - `/sign-up`: name, email, password, confirm password. Sends the browser's timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) as `timezone`.
  - Field errors under the field, a general error above the button, pending state on the button.
  - Signed-in users visiting either page are redirected to `/today`.
- `callbackURL` is only followed when it's a same-origin path (`src/lib/safe-callback-url.ts` with tests).
- Zod schemas in `src/lib/validations/auth.ts` shared by client and server.
- Temporary `/today` page: "Signed in as {name}" and a Sign out button (the real page comes in spec 18). `/` redirects to `/today` or `/sign-in`.
- Add shadcn `input`, `label`, and `sonner` for toasts.

## Files to Create / Modify

1. `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/session.ts`
2. `src/app/api/auth/[...all]/route.ts`
3. `src/proxy.ts`
4. `src/app/(auth)/layout.tsx`, `sign-in/page.tsx`, `sign-up/page.tsx` + form components in `src/components/auth/`
5. `src/lib/validations/auth.ts`, `src/lib/safe-callback-url.ts` (+ tests)
6. `src/app/(app)/today/page.tsx` (temporary), `src/app/page.tsx`
7. `prisma/schema.prisma` + migration

## Key Gotchas

- Use Context7 for Better Auth's current Next.js, Prisma adapter and CLI instructions. Don't rely on memory.
- Better Auth hashes passwords (scrypt) itself; don't add bcrypt.
- Better Auth uses database sessions; read them server-side with `auth.api.getSession({ headers: await headers() })`.
- The proxy can't call the database; use Better Auth's cookie helper there.

## Testing

1. Unit tests for `safeCallbackUrl` and the auth schemas; `npm test` passes.
2. Visiting `/today` signed out redirects to `/sign-in?callbackURL=%2Ftoday`.
3. Sign up → lands on `/today`; the user row has the browser's timezone.
4. Sign out → back to `/sign-in`. Wrong password shows an error. Duplicate email shows an error.
5. Pages match the mockup in light and dark mode, and at 375px.
6. `npm run build` passes.

## References

- https://www.better-auth.com/docs/integrations/next
- https://www.better-auth.com/docs/adapters/prisma
- `context/mockup/sign-in.html`
