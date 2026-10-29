# Review Action

1. Read current-feature.md to understand the goals
2. Review all code changes made for this feature
3. Check for:
   - ✅ Goals met
   - ❌ Goals missing or incomplete
   - ⚠️ Code quality issues or bugs
   - 🔒 Every query and mutation scoped to the session user
   - 🕒 Dates computed in the user's timezone, weeks Monday–Sunday, recurrence through `src/lib/recurrence.ts`
   - 🧪 Adequate test coverage for new server actions and utilities
   - 🚫 Scope creep (code beyond goals)
4. Final verdict: Ready to complete or needs changes
