# Installable App (PWA)

## Overview

Make Task Master installable on phones and computers: a web app manifest, icons, a minimal service worker, and install guidance. Push notifications come in spec 22.

## Requirements

- `src/app/manifest.ts`: name "Task Master", short name "Task Master", `start_url: "/today"`, `display: "standalone"`, `background_color` and `theme_color` from the tokens (light background `#F4F6F9`, theme `#1D5BD6`), icons.
- Icons from the logo mark (blue rounded square, green check): 192, 512, a 512 maskable version with padding, and `apple-touch-icon` 180. Generate them from one SVG with a small script (`scripts/generate-icons.ts`, using `sharp`) and commit the PNGs.
- Metadata: `appleWebApp` (capable, title, status bar style), `themeColor` for light and dark.
- `public/sw.js`: minimal service worker (install/activate, network-first passthrough). No offline caching of app data. Register it from a small client component in the root layout, in production only.
- Settings → new "Install app" row: explains how to install (Chrome/Edge install button; iPhone: Share → Add to Home Screen). Hide it when already running standalone (`display-mode: standalone`).
- Respect safe-area insets in the bottom tab bar and FAB when running standalone.

## Files to Create / Modify

1. `src/app/manifest.ts`, `public/icons/*`, `public/sw.js`
2. `scripts/generate-icons.ts`
3. `src/app/layout.tsx`, `src/components/pwa/register-sw.tsx`, `src/components/settings/install-app.tsx`

## Testing

1. `npm run build && npm run start`: Chrome DevTools → Application shows a valid manifest and an active service worker; the install prompt is available.
2. Lighthouse PWA/installability checks pass.
3. Installed on a phone (needs the deployed site or a tunnel): opens to `/today` without browser UI; tab bar clears the home indicator.

## References

- https://nextjs.org/docs/app/guides/progressive-web-apps
