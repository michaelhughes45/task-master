# Auth Security Review

**Last audit:** 2026-11-02
**Scope:** `src/lib/auth.ts`, `session.ts`, `email.ts`, `env.ts`, `cron-auth.ts`, `safe-callback-url.ts`, `src/proxy.ts`, `(app)` layout, `(auth)` pages/forms, settings page and `ChangePasswordDialog`, `src/actions/{tasks,events,settings,push}.ts`, `src/lib/db/*` queries, `src/lib/validations/push.ts`, `/api/cron/review`.

## Summary

| Severity | Count |
| --- | --- |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 2 |

No authentication bypass or data-ownership flaw found. Every action derives `userId` from the session and scopes by `{ id, userId }`. Two low-severity defence-in-depth gaps were found; both are fixed (2026-11-02, `fix/auth-audit`).

## Findings

### [LOW, FIXED] Push subscription endpoint accepts any https URL (blind SSRF)

- **Status:** Fixed. `isPushServiceEndpoint` in `src/lib/validations/push.ts` only accepts https endpoints on `fcm.googleapis.com` or a subdomain of `push.services.mozilla.com`, `notify.windows.com` or `push.apple.com` (no userinfo, no port). `saveSubscription` refuses anything else, and `sendPush` skips stored rows that fail the check. Removing a subscription still accepts any https endpoint.

- **Location:** `src/lib/validations/push.ts:4`, `src/actions/push.ts:16-39`, `src/actions/push.ts:63-88`, `src/app/api/cron/review/route.ts:38`
- **Issue:** `pushEndpointSchema = z.url({ protocol: /^https$/ }).max(2048)` only checks the scheme. The stored endpoint is later POSTed to by `web-push` (test notification and weekly cron).
- **Attack scenario:** A signed-in user calls `saveSubscription` with `endpoint: "https://internal-or-arbitrary-host/path"` and any p256dh/auth values, then clicks "Send a test notification". The server makes an HTTPS POST to that host. Only blind and limited: https, fixed method, encrypted body, and the result is visible only as sent/failed counts. On Vercel the reachable internal surface is small, so impact is low.
- **Fix:** Allowlist known push service hosts when saving.
  ```ts
  const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];
  export const pushEndpointSchema = z.url({ protocol: /^https$/ }).max(2048)
    .refine((u) => PUSH_HOSTS.some((r) => r.test(new URL(u).hostname)));
  ```
- **Reference:** https://owasp.org/www-community/attacks/Server_Side_Request_Forgery

### [LOW, FIXED] Rate limiting is per-instance memory on serverless

- **Status:** Fixed. `rateLimit: { enabled: true, storage: "database" }` with the CLI-generated `RateLimit` model (`rate_limit` migration). Verified on a production build: the 4th wrong sign-in within 10 s gets 429, and a freshly started server process still returns 429 for the same client.

- **Location:** `src/lib/auth.ts:30-31`
- **Issue:** `rateLimit: { enabled: true }` uses in-memory storage (the comment acknowledges it). On Vercel, instances do not share memory, so limits on sign-in, sign-up and forgot-password are applied per instance and reset on cold start.
- **Attack scenario:** An attacker brute-forces a known email's password or floods reset emails. The requests spread across instances and the effective limit is much higher than configured. Password hashing cost and the 8-character minimum are the only remaining brake.
- **Fix:** Use shared storage: `rateLimit: { enabled: true, storage: "database" }` (needs the `rateLimit` table) or `secondaryStorage` backed by Redis/Upstash. Optionally tighten `customRules` for `/sign-in/email` and `/request-password-reset`.
- **Reference:** https://www.better-auth.com/docs/concepts/rate-limit

## Passed Checks

- ✅ `BETTER_AUTH_SECRET` read via `env.ts` (Zod, min 32 chars), not hard-coded; `baseURL` fixed from `BETTER_AUTH_URL` so email links never come from request headers (`auth.ts:14-15`).
- ✅ Password length 8-128; `requireEmailVerification` and `sendOnSignUp` follow `EMAIL_VERIFICATION_ENABLED`, which stays on unless exactly `"false"` (`env.ts:19-22`).
- ✅ Account linking: `accountLinking: { enabled: true }` with no `trustedProviders` (`auth.ts:38-42`).
- ✅ `revokeSessionsOnPasswordReset: true`; change password passes `revokeOtherSessions` and requires the current password (`ChangePasswordDialog.tsx`).
- ✅ Emails sent by custom code (`email.ts`) with no token logging (only the Resend error message is thrown); emails sent in the background so timing doesn't leak account existence; forgot-password always shows the same message.
- ✅ `safeCallbackUrl` rejects absolute URLs, `//host`, backslashes and control characters and is used on sign-in and sign-up pages.
- ✅ `proxy.ts` is documented and used as an optimistic redirect only; the `(app)` layout calls `requireUser()` and each action re-checks the session (`session.ts`).
- ✅ Every action in `tasks.ts`, `events.ts`, `settings.ts`, `push.ts` takes `userId` from the session, validates input with Zod, and checks ownership in the query (`findFirst/deleteMany/updateMany {id, userId}`). Occurrence actions load the series with `{ id, userId }` before touching exceptions or completions.
- ✅ `removeSubscription` uses `deleteMany { endpoint, userId }`, so one user can't delete another's subscription. Reassigning via upsert requires knowing the victim's secret endpoint URL.
- ✅ `src/lib/db/*` queries include `userId` in every `where` on `Task`/`Event`. The `taskCompletion` lookup keyed by task ids comes from the user-scoped task query.
- ✅ Cron route: `isCronAuthorized` hashes both sides and uses `timingSafeEqual`; no configured secret rejects everything; `?now=` is ignored in production (`route.ts:11`).
- ✅ Session lookups go through the shared `getSession`/`getCurrentUserId`/`requireUser` helpers. Server-only modules import `server-only`.
- ✅ Settings page passes only name and email to client components; account list used only to decide whether to show Change password.

## Not Covered by This Audit

- Behaviour needing a running server: the actual rate-limit thresholds, Better Auth's linking behaviour for unverified email when `EMAIL_VERIFICATION_ENABLED=false`, and the real Resend delivery.
- Delete account is not built, so it was not assessed (not a finding).
- `.env` and deployed environment settings (e.g. that `BETTER_AUTH_URL` is the production URL, `CRON_SECRET` set on Vercel).
- Component-level rendering of `src/components/**` beyond the auth and settings forms.
