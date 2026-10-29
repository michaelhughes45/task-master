@AGENTS.md

# Task Master

A personal planner: calendar events at set times, daily and weekly to-do lists with completion tracking, and a Sunday review of the week. Runs in the browser on any device and is installable as a PWA.

## Context Files

Read the following to get the full context of the project:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Commands

- **Dev server**: `npm run dev` (runs on http://localhost:3000)
- **Build**: `npm run build`
- **Production server**: `npm run start`
- **Lint**: `npm run lint`
- **Unit tests**: `npm test` (Vitest, single run) or `npm run test:watch`

## Neon Database (MCP)

When using the Neon MCP tools, always target:

- **Project:** `task-master` (ID: _fill in after the Neon project is created_)
- **Branch:** `development` (ID: _fill in_)

Rules:

- Always pass `project_id` and `branch_id` explicitly on every Neon MCP call. Never rely on the default branch, because the default is `production`.
- **Never read from or write to the `production` branch** unless I explicitly say "production" in my request.
- Even with production approved, confirm before running any write or destructive SQL (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE) against it.
- Schema changes go through Prisma migrations (`prisma migrate dev`), not ad-hoc SQL or `db push`. Production only gets them via `prisma migrate deploy`.
- If a branch ID stops resolving (for example after a branch is recreated), look up the `development` branch by name with `list_branches` and stop to ask me. Don't fall back to the default branch.

**IMPORTANT:** Do not add Claude to any commit messages
