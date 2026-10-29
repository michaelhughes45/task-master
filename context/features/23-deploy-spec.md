# Deploy to Vercel

## Overview

Put Task Master on the internet: Vercel hosting, the Neon `production` branch, production sign-in settings, and the cron job. Then smoke-test it on a phone and a computer.

## Before starting (the user does this)

- Push the repo to GitHub and import it in Vercel.
- Decide the address (the `*.vercel.app` one, or a custom domain).

## Requirements

- Vercel environment variables (Production), from `.env.example`:
  - `DATABASE_URL` / `DIRECT_URL` for the Neon **production** branch
  - `BETTER_AUTH_SECRET` (new value, not the dev one), `BETTER_AUTH_URL` and `APP_URL` = the production address
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, with the production origin and `/api/auth/callback/google` redirect added to the Google OAuth client
  - `RESEND_API_KEY`; `EMAIL_VERIFICATION_ENABLED` stays `false` until a sending domain is verified in Resend (note this as a follow-up)
  - VAPID keys and `CRON_SECRET`
- Build runs `prisma migrate deploy` before `next build` (a `vercel-build` script), so production gets migrations only through Prisma.
- Better Auth `trustedOrigins` includes the production address.
- Confirm the cron job appears in Vercel's Cron Jobs tab.
- The seed never runs against production.
- Update `context/project-overview.md` with the live address and a short "Deploying" section.

## Testing (on the live site)

1. Sign up with email/password and with Google; sign out and in.
2. Create tasks and events, tick tasks, check the calendar and Today page.
3. Install on a phone, enable the Sunday reminder, send a test notification.
4. Trigger the cron route manually with the secret; check the logs.
5. Lighthouse on `/today` (signed in): no major accessibility or performance issues.

## References

- https://vercel.com/docs/frameworks/nextjs
- https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel
- https://www.better-auth.com/docs/reference/options#trustedorigins
