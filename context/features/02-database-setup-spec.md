# Database Setup — Prisma + Neon

## Overview

Connect the app to Neon Postgres with Prisma, using the Neon driver adapter. Create a first `User` model shaped for Better Auth (added in the next spec) and apply the first migration to the Neon `development` branch.

## Before starting (the user does this)

- Create a Neon project named `task-master` with a `development` branch (the default `production` branch stays untouched).
- Paste the `development` branch's **pooled** connection string as `DATABASE_URL` and the **direct** one as `DIRECT_URL` in `.env`.
- Tell Claude the project and branch IDs so they can be filled into `CLAUDE.md`.

## Requirements

- Install Prisma (latest stable, not a release candidate), `@prisma/client`, `@prisma/adapter-neon`, `dotenv`, `tsx`.
- Use the `prisma-client` generator with output `src/generated/prisma` (gitignored) and `postinstall: prisma generate`.
- `prisma.config.ts` loads `.env` with dotenv. The CLI uses `DIRECT_URL`; the app uses the pooled `DATABASE_URL`.
- `src/lib/prisma.ts`: one shared client with the Neon adapter, safe across hot reloads.
- First `User` model (Better Auth will extend this in spec 03):

  ```prisma
  model User {
    id            String   @id
    name          String
    email         String   @unique
    emailVerified Boolean  @default(false)
    image         String?
    timezone      String?  // IANA name; null until set from the browser
    reviewNotify  Boolean  @default(true)
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
    @@map("user")
  }
  ```

- Apply the `init` migration with `prisma migrate dev` to the `development` branch.
- `scripts/test-db.ts` (`npm run db:test`): connects, prints the database name and the user count, exits non-zero on failure.
- Fill in the Neon project and branch IDs in `CLAUDE.md`.
- Add `DATABASE_URL` and `DIRECT_URL` to `.env.example`.

## Files to Create / Modify

1. `prisma/schema.prisma`
2. `prisma.config.ts`
3. `src/lib/prisma.ts`
4. `scripts/test-db.ts`
5. `package.json` (scripts `postinstall`, `db:test`)
6. `CLAUDE.md` (Neon IDs)

## Key Gotchas

- Use Context7 for the current Prisma + Neon adapter setup; Prisma's config and generator changed in recent versions.
- `@@map("user")` matches the table name Better Auth expects. Check this against Better Auth's Prisma docs before migrating.
- Use the Neon MCP only against the `development` branch, as `CLAUDE.md` says.

## Testing

1. `npx prisma migrate status` shows the `init` migration applied.
2. `npm run db:test` prints the database and `0 users`.
3. `npm run build` passes.

## References

- https://www.prisma.io/docs/orm/overview/databases/neon
- https://neon.tech/docs/guides/prisma
