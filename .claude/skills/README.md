# Skills

Custom Claude Code skills (slash commands) for Task Master. Each skill has its own subfolder with a `SKILL.md` file.

- `feature/` - Main workflow command for loading, starting, reviewing, testing and completing features
- `research/` - Generates documentation from research spec files into the `docs/` folder
- `cleanup/` - Runs housekeeping tasks like finding unused imports, stale TODOs and orphaned files
- `list-components/` - Simple utility to list React component files with descriptions

## Agents

Defined in `.claude/agents/`:

- `code-scanner` - Security, performance and code quality scan of the whole codebase
- `ui-reviewer` - Reviews app screens with Playwright for layout, mobile usability and accessibility
- `auth-auditor` - Security audit of the Better Auth setup and the code around it
- `date-logic-reviewer` - Checks timezone, daylight saving, week boundary and recurrence logic
