# Agent Rules

- Next.js, Prisma, Better Auth and Tailwind change often. Before writing code against them, check the installed version's docs (`node_modules/next/dist/docs/` for Next.js) or use Context7. Don't rely on memory for APIs or config.
- `next dev` may replace this file with its own agent rules block when the project is scaffolded. Keep the line above when that happens.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
