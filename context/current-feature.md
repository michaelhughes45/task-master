# Current Feature: Project Setup

Scaffold the Next.js app with TypeScript, Tailwind CSS v4, shadcn/ui, the mockup's theme tokens and fonts, light/dark mode, Vitest and git. No database or auth yet.

## Status

In Progress

## Goals

- Scaffold with Create Next App (TypeScript, ESLint, Tailwind CSS, App Router, `src/`, `@/*` alias) without overwriting `CLAUDE.md`, `AGENTS.md`, `context/` or `.claude/` (merge any generated agent rules into ours)
- Remove the default boilerplate page, assets and styles
- `git init` on `main`; `.gitignore` covers `.env*` (except `.env.example`), `node_modules`, `.next`, `src/generated`
- Initialize shadcn/ui and add `button` only
- Theme tokens in `src/app/globals.css` from `context/mockup/README.md`: light on `:root`, dark on `.dark`, shadcn variable names, plus `--primary-text`, `--primary-soft`, `--primary-ink`, `--success`, `--success-foreground`, `--success-soft`, `--success-ink`, `--warning`, all exposed via `@theme inline`; `--radius: 0.625rem`
- Dark mode with `next-themes` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`), `suppressHydrationWarning` on `<html>`
- Fonts via `next/font/google`: IBM Plex Sans (400/500/600) as `--font-sans`, IBM Plex Mono (400/500) as `--font-mono`, wired into the theme
- Placeholder home page: "Task Master" heading, muted text, primary button, theme toggle
- Vitest: `vitest.config.mts` (Node env, `@/` alias, `include: ['src/**/*.test.ts']`, `restoreMocks`, `unstubEnvs`), scripts `test` / `test:watch`, a `cn()` test in `src/lib/utils.test.ts`
- `.env.example` with every variable from `context/project-overview.md`
- Update `context/coding-standards.md` if the scaffold differs from it

## Notes

- Files: `package.json`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/lib/utils.ts`, `src/lib/utils.test.ts`, `vitest.config.mts`, `.env.example`, `.gitignore`
- Check current Next.js / Tailwind v4 / shadcn docs (Context7 or `node_modules/next/dist/docs/`); never create `tailwind.config.*`
- shadcn's `--accent` is a hover color, not our blue: keep it as a subtle hover (sunken value). Our blue is `--primary`
- Theme toggle is a client component that renders nothing theme-specific until mounted
- Coding standards require `@custom-variant dark (&:where(.dark, .dark *));` in `globals.css`
- Vitest config should set `TZ=Pacific/Auckland` (per coding standards)
- Testing: `npm run dev` shows Plex Sans, a blue button and a working light/dark toggle with mockup colors; `npm run lint`, `npm test`, `npm run build` all pass

## History

<!-- Keep this updated.  Earliest to latest -->
