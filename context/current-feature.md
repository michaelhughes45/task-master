# Current Feature: Database Setup (Prisma + Neon)

Connect the app to Neon Postgres with Prisma (Neon driver adapter), add a first Better Auth-shaped `User` model and apply the `init` migration to the Neon `development` branch.

## Status

In Progress

## Goals

- Prisma (latest stable, not an RC), `@prisma/client`, `@prisma/adapter-neon`, `dotenv` and `tsx` installed
- `prisma-client` generator outputs to `src/generated/prisma` (gitignored); `postinstall: prisma generate` in `package.json`
- `prisma.config.ts` loads `.env` with dotenv; the CLI uses `DIRECT_URL`, the app uses the pooled `DATABASE_URL`
- `src/lib/prisma.ts`: one shared client with the Neon adapter, reused across hot reloads via `globalThis`, with `import 'server-only'`
- `User` model as in the spec (`timezone`, `reviewNotify`, `@@map("user")`)
- `init` migration applied with `prisma migrate dev` to the `development` branch
- `scripts/test-db.ts` (`npm run db:test`) connects, prints the database name and user count, exits non-zero on failure
- Neon project and branch IDs filled in `CLAUDE.md`
- `DATABASE_URL` and `DIRECT_URL` in `.env.example`
- `npx prisma migrate status` shows `init` applied, `npm run db:test` prints `0 users`, `npm run build` passes

## Notes

- **Before starting (user):** create the Neon project `task-master` with a `development` branch, put the development branch's pooled URL in `DATABASE_URL` and direct URL in `DIRECT_URL` in `.env`, and share the project and branch IDs.
- Check current Prisma + Neon adapter setup with Context7 (config and generator changed in recent versions).
- Confirm `@@map("user")` matches the table name Better Auth's Prisma adapter expects before migrating.
- Neon MCP only against the `development` branch; never `production`.
- Schema changes via `prisma migrate dev` only, never `db push`.
- References: https://www.prisma.io/docs/orm/overview/databases/neon, https://neon.tech/docs/guides/prisma

## History

<!-- Keep this updated.  Earliest to latest -->

- **2026-10-29 — Project Setup (01):** Next.js 16.4 (App Router, TypeScript, `src/`, `@/*`), Tailwind v4 theme tokens from the mockup (light/dark, shadcn names plus primary/success/warning extras), shadcn/ui `base-nova` with `button`, IBM Plex Sans/Mono, `next-themes` toggle, placeholder home page, Vitest (`TZ=Pacific/Auckland`, `cn()` test), `.env.example`, git with GitHub remote.
