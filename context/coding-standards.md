# Coding Standards

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown` (enforced by ESLint `@typescript-eslint/no-explicit-any`)
- Define interfaces for component props and for shapes that have no other source
- Derive types instead of duplicating them: `z.infer<typeof schema>` for form/action input, Prisma's generated types for rows
- Use type inference where obvious, explicit types where helpful

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks
- Don't use `useEffect` to fetch data or to compute values derivable from props/state
- Call Server Actions with `useTransition`, and use `useOptimistic` for instant feedback (e.g. ticking a task)

## Next.js

- Server components by default
- Only use `'use client'` when needed (interactivity, hooks, browser APIs), and push it as far down the tree as possible (a leaf like `TaskCheckbox`, not the whole page)
- Use Server Actions for form submissions and simple mutations
- Use API routes when you need:
  - The Better Auth handler
  - Cron jobs (`/api/cron/*`, protected by `CRON_SECRET`)
  - Webhooks or third-party callbacks
  - Specific HTTP status codes or headers
- Otherwise, fetch data directly in server components
- Use search params for the selected date and view (`?date=2026-11-02&view=week`) so pages are linkable and the back button works
- `params` and `searchParams` are Promises; `await` them and validate them (`parseDateParam`, a Zod enum for `view`). Bad input falls back to a default, it never throws.
- After a mutation, call `revalidatePath` for every route that shows the changed data (e.g. `/today`, `/todos`, `/review`)

## Tailwind CSS v4

**CRITICAL**: We are using Tailwind CSS v4, which uses CSS-based configuration.

- **DO NOT** create `tailwind.config.ts` or `tailwind.config.js` files (those are for v3)
- All theme configuration must be done in CSS using the `@theme` directive in `src/app/globals.css`
- Use CSS custom properties for colors, spacing, etc.
- No JavaScript-based config allowed
- Dark mode is class-based (next-themes), so `globals.css` must declare `@custom-variant dark (&:where(.dark, .dark *));`. Without it, `dark:` follows the OS setting instead of the toggle.
- Theme colors use the shadcn variable names (`--primary`, `--muted`, `--card`, ...) plus our extras (`--primary-text`, `--primary-soft`, `--primary-ink`, `--success*`, `--warning`); the mapping is in `context/mockup/README.md`. Blue is `primary`, never `accent` (shadcn's `accent` is the subtle hover color). `destructive` uses the orange warning value.
- Fonts are loaded in `layout.tsx` as `--font-plex-sans` / `--font-plex-mono` and exposed as Tailwind's `font-sans` / `font-mono`.
- Radii: `rounded-md` (8px) buttons/inputs, `rounded-lg` (10px) cards, `rounded-xl` (12px) dialogs.

## Dates, Times and Recurrence

These are the easiest places to introduce bugs in this app. Follow them strictly.

- **A day is a `YYYY-MM-DD` string** (`DateStr`) everywhere in app code. **An instant is a UTC `Date`.**
- **Store instants in UTC** (`DateTime`): event start/end, `completedAt`, `createdAt`.
- **Store calendar days as dates** (`@db.Date`): task dates, occurrence dates, week starts. Never store a "day" as a UTC midnight instant derived from local time.
- **Prisma returns `@db.Date` as a `Date` at UTC midnight.** Convert at the database boundary with `toDbDate` / `fromDbDate` only. Never `format()` such a value in a local or user timezone; anywhere behind UTC it shows the previous day.
- **All-day events are the one exception:** `Event.startAt` / `endAt` hold the date at 00:00 UTC. Read them back as UTC dates (`fromDbDate`), never in the user's timezone.
- **Every "today", "this week" or day boundary is computed in the user's timezone** (`user.timezone`, via `resolveTimezone`), never the server's. Vercel runs in UTC.
- **Weeks run Monday–Sunday.** Use the shared helpers in `src/lib/dates.ts` (`todayIn`, `weekStartOf`, `weekRange`, `dayStartInstant`, etc.); don't call `startOfWeek` with ad-hoc options elsewhere.
- Use `date-fns` and `@date-fns/tz` for date math. Never add `24 * 60 * 60 * 1000` to move a day (breaks across daylight saving changes).
- Never use `new Date('YYYY-MM-DD')` (parses as UTC midnight) or `toLocaleString()` / `format()` without the user's timezone. Use `parseDateParam` and the formatters in `dates.ts`.
- Format dates and times on the server in the user's timezone and pass strings to client components. Formatting a `Date` in the browser uses the device timezone and can cause hydration mismatches.
- Date strings in URLs and forms are `YYYY-MM-DD`.
- **Repeating items are stored once with an RRULE.** Expand occurrences only through `src/lib/recurrence.ts`; never write one row per occurrence.
- Recurrence, date and review logic must have unit tests, including daylight saving changes, month ends, leap years and week boundaries.

## Security and Data Ownership

- **Server Actions are public HTTP endpoints.** Anyone can call them with any arguments. Every action must:
  1. Get the user with `requireUser()` / `getCurrentUserId()` from `src/lib/session.ts`
  2. Validate all input with Zod
  3. Check ownership of any id it receives
- Every query and mutation is scoped to the signed-in user: `where: { userId }`, with `userId` taken from the server-side session, never from form data or the URL.
- Updating or deleting by id must check ownership in the same query (`where: { id, userId }`) or verify it first.
- `src/proxy.ts` is only an early redirect, not an auth boundary. The real checks live in the `(app)` layout (`requireUser()`), every action, and every query.
- Add `import 'server-only'` to `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/env.ts`, `src/lib/db/*` and anything that reads secrets.
- Zod schemas set limits: `.trim().min(1).max(...)` on titles, `.max(...)` on notes, location and `workNote`, `.int().min(0).max(...)` on `minutesSpent`.

## Environment Variables

- Read env vars through `src/lib/env.ts`, which validates them once with Zod. Don't read `process.env` elsewhere.
- Only `NEXT_PUBLIC_*` variables may reach the client. Never prefix a secret with `NEXT_PUBLIC_`.

## File Organization

- Components: `src/components/[feature]/ComponentName.tsx`
- `src/components/ui/` is generated by shadcn (`base-nova` style, built on Base UI, not Radix). Add or update components with the shadcn CLI; keep hand edits minimal. `cn()` comes from the `cn` package, re-exported by `src/lib/utils.ts`.
- App-wide providers and controls with no feature folder live in `src/components/` (`theme-provider.tsx`, `theme-toggle.tsx`).
- Pages: `src/app/(app)/[route]/page.tsx` (signed-in) and `src/app/(auth)/[route]/page.tsx` (auth screens)
- Server Actions: `src/actions/[feature].ts`
- Queries: `src/lib/db/[feature].ts`
- Hooks: `src/hooks/use-[name].ts`
- Types: `src/types/[feature].ts`
- Lib/Utils: `src/lib/[utility].ts`
- Zod schemas: `src/lib/validations/[feature].ts`

## Naming

- Components: PascalCase (`TaskItem.tsx`)
- All other files: kebab-case (`task-utils.ts`, `use-week-strip.ts`), except Next.js reserved names (`page.tsx`, `layout.tsx`, `route.ts`)
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

- Tailwind CSS for all styling
- Use shadcn/ui components where applicable
- No inline styles
- Light and dark mode via `next-themes` (follows the system by default); always use the theme tokens from `context/mockup/README.md`, never raw hex values in components
- Mobile first: design for 375px, then scale up. Tap targets at least 44px.

## Accessibility

- Every input has a label (visible, or `aria-label` for icon-only controls such as checkboxes and the "+" button)
- Everything works with the keyboard, with a visible focus ring
- Color is never the only signal: done, missed and late also show an icon or text, not just green / orange
- Use semantic elements (`button`, `nav`, `main`, lists for task lists) before ARIA

## Database

- Use Prisma ORM for all database operations
- Always use `prisma migrate dev` for schema changes (not `db push`)
- Run `prisma migrate status` before committing to verify migrations are in sync
- Production deployments must run `prisma migrate deploy` before the app starts
- Better Auth tables are generated with the Better Auth CLI into `schema.prisma`, then migrated like everything else
- `src/lib/prisma.ts` creates one client and reuses it in development via `globalThis` (hot reload would otherwise open new connections)
- Writes that change more than one row go in `prisma.$transaction` (e.g. "This and following" ends the old rule and creates the new item)
- `select` only the fields you need; avoid N+1 queries by loading exceptions and completions for a whole date range in one query

## Data Fetching

- Server components fetch directly with Prisma (through `src/lib/db/*`)
- Client components use Server Actions
- Validate all inputs with Zod

## Error Handling

- Use try/catch in Server Actions, but call `redirect()` and `notFound()` outside the `try` (they work by throwing, so a catch swallows them)
- Return the shared `ActionResult<T>` type from `src/types/actions.ts`:

  ```ts
  type ActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; fieldErrors?: Record<string, string[]> };
  ```

- Log the real error on the server; return a friendly message. Never send raw Prisma or internal error text to the client.
- Show field validation errors inline next to the field; use a toast for action-level failures

## Testing

- Unit tests use [Vitest](https://vitest.dev/) (`vitest.config.mts`, Node environment)
- Only test server actions (`src/actions`) and utilities (`src/lib`) — not components; UI is covered by browser testing
- Co-locate tests next to the file they test as `name.test.ts` (only `src/**/*.test.ts` is picked up)
- Mock the boundaries with `vi.mock` (`@/lib/auth`, `@/lib/session`, `@/lib/prisma`, `next/headers`, email, web-push) — unit tests never hit the database or external services
- Pin the clock with `vi.setSystemTime` in any test that depends on "now"
- Tests run with the process timezone set to a non-UTC zone (`TZ=Pacific/Auckland` in the Vitest config) so code that accidentally uses local time fails instead of passing by luck
- `npm test` runs once; `npm run test:watch` watches

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible
- `npm run lint`, `npm test` and `npm run build` must pass before committing
