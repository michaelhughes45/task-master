# App Shell and Settings

## Overview

Build the signed-in layout from the mockup: sidebar on desktop, bottom tab bar on phones, page header with the theme toggle and a "New" button, placeholder pages for each section, and a working Settings page (appearance, timezone, account).

## Requirements

- `(app)` route group layout: calls `requireUser()`; renders the shell around every app page.
- **Desktop (≥ 768px) sidebar** (`context/mockup/app-desktop.html`, the `<nav>`):
  - Logo mark (blue square, green check) + "Task Master"
  - Nav: Today, Calendar, To-dos, Weekly review, Settings, with Lucide icons; the active item uses `bg-primary-soft text-primary-ink font-semibold` and `aria-current="page"`
  - Bottom: a "This week" progress slot (hidden until spec 18 provides data) and the user menu (avatar initials, name, Sign out)
- **Phone (< 768px)** (`context/mockup/today-phone.html`):
  - Bottom tab bar: Today, Calendar, To-dos, Review (68px tall, safe-area padding)
  - Settings reachable from the user avatar in the header
  - A floating "+" button above the tab bar, same action as "New"
- **Page header**: small muted kicker + title (each page sets its own), theme toggle (moon/sun), "New" primary button. "New" and "+" are disabled placeholders until spec 12.
- Placeholder pages: `/today`, `/calendar`, `/todos`, `/review` (title + "Coming soon" muted text).
- **Settings** `/settings` (mockup Settings screen):
  - Appearance: segmented Light / Dark / System (next-themes)
  - Timezone: searchable select of IANA zones (`Intl.supportedValuesOf('timeZone')`), saved with a server action
  - Week: "Weeks run Monday to Sunday" (display only)
  - Sunday review reminder: switch saved to `reviewNotify` (it only stores the setting; notifications come in spec 22)
  - Account: email, Change password (email/password users only; current + new password via Better Auth), Sign out
- **Timezone auto-fill**: if `user.timezone` is null, a small client component in the layout sends the browser's timezone to a server action once.
- `src/actions/settings.ts`: `updateTimezone`, `updateReviewNotify`, `setTimezoneIfMissing`. Zod-validate the timezone against the IANA list. Return `{ success, error }`.
- Add the shadcn components needed (`dropdown-menu`, `switch`, `select` or `command`/`popover` for the searchable timezone list, `avatar`, `separator`).

## Files to Create / Modify

1. `src/app/(app)/layout.tsx`
2. `src/components/layout/AppSidebar.tsx`, `BottomTabs.tsx`, `PageHeader.tsx`, `UserMenu.tsx`, `Fab.tsx`, `TimezoneSync.tsx`
3. `src/app/(app)/{today,calendar,todos,review,settings}/page.tsx`
4. `src/components/settings/*`
5. `src/actions/settings.ts` (+ tests)

## Key Gotchas

- Server actions take the user id from the session, never from the form.
- Keep the sidebar static (not sticky or `100vh`-locked) so pages scroll naturally.
- The header title must not be the only `h1` source in two places; each page owns its `h1`.

## Testing

1. Action tests: invalid timezone rejected; updates are scoped to the session user.
2. Desktop: sidebar nav highlights the current page; theme toggle and Appearance setting agree.
3. 375px: bottom tabs, FAB, avatar → Settings; no horizontal scroll.
4. A Google user's timezone is filled in after first load.
5. Change password works for a password user and is hidden for a Google-only user.
6. `npm run build` passes.

## References

- `context/mockup/app-desktop.html`, `context/mockup/today-phone.html`
