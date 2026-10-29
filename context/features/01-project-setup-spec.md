# Project Setup

## Overview

Scaffold the Next.js app with TypeScript, Tailwind CSS v4, shadcn/ui, the mockup's theme tokens and fonts, light/dark mode, Vitest and git. No database or auth yet.

## Requirements

- Scaffold with Create Next App: TypeScript, ESLint, Tailwind CSS, App Router, `src/` directory, `@/*` import alias.
  - The folder already has `CLAUDE.md`, `AGENTS.md`, `PLAN.md`, `.mcp.json`, `.claude/` and `context/`. Scaffold into a temporary folder and move the files in, or use whatever flag the installed version offers. **Never overwrite `CLAUDE.md`, `AGENTS.md` or anything in `context/` or `.claude/`.** If Next.js generates its own `AGENTS.md`/`CLAUDE.md` content, merge its block into ours.
- Remove the default boilerplate page, assets and styles.
- `git init` on `main`. `.gitignore` covers `.env*` (but not `.env.example`), `node_modules`, `.next`, `src/generated`.
- Initialize shadcn/ui and add `button` only for now.
- **Theme tokens** in `src/app/globals.css` from `context/mockup/README.md`:
  - Light values on `:root`, dark values on `.dark`, using the shadcn variable names in the table.
  - Add the extra tokens shadcn doesn't have: `--primary-text`, `--primary-soft`, `--primary-ink`, `--success`, `--success-foreground`, `--success-soft`, `--success-ink`, `--warning`.
  - Expose them all as Tailwind colors via `@theme inline` (e.g. `bg-primary-soft`, `text-success-ink`, `text-warning`).
  - Radius: `--radius: 0.625rem` (10px cards); buttons/inputs use 8px.
- **Dark mode** with `next-themes`: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Add `suppressHydrationWarning` on `<html>`.
- **Fonts** with `next/font/google`: IBM Plex Sans (400, 500, 600) as `--font-sans`, IBM Plex Mono (400, 500) as `--font-mono`, wired into the Tailwind theme.
- **Placeholder home page**: "Task Master" heading, a short line of muted text, a primary button and a theme toggle button (light/dark), so the tokens and fonts can be checked in both modes.
- **Vitest**: `vitest.config.mts` (Node environment, `@/` alias, `include: ['src/**/*.test.ts']`, `restoreMocks`, `unstubEnvs`). Scripts `test` (`vitest run`) and `test:watch`. One test for `cn()` in `src/lib/utils.test.ts` so the setup is proven.
- `.env.example` with every variable from `context/project-overview.md` (empty values, comments).
- Update `context/coding-standards.md` if anything in the scaffold differs from it (for example, the shadcn variable names).

## Files to Create / Modify

1. `package.json`: scripts `dev`, `build`, `start`, `lint`, `test`, `test:watch`
2. `src/app/layout.tsx`: fonts, `ThemeProvider`, metadata (title "Task Master")
3. `src/app/globals.css`: tokens for light and dark, `@theme inline`
4. `src/app/page.tsx`: placeholder page
5. `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`
6. `src/lib/utils.ts` (from shadcn) and `src/lib/utils.test.ts`
7. `vitest.config.mts`, `.env.example`, `.gitignore`

## Key Gotchas

- Use Context7 or `node_modules/next/dist/docs/` for the current Next.js and Tailwind v4 setup. Don't create `tailwind.config.*`.
- shadcn's own `--accent` is a hover color, **not** our blue. Our blue is `--primary`. Keep shadcn's `--accent` as a subtle hover (use the sunken value).
- `next-themes` toggles must be client components and render nothing theme-specific until mounted (avoid hydration mismatch).

## Testing

1. `npm run dev`: the placeholder page shows Plex Sans, a blue button, and the toggle switches light/dark with the mockup colors.
2. `npm run lint`, `npm test`, `npm run build` all pass.

## References

- `context/mockup/README.md` (tokens)
- https://ui.shadcn.com/docs/installation/next · https://ui.shadcn.com/docs/dark-mode/next
