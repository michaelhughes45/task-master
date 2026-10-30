# Complete Action

0. Stop every server started for this feature (`npm run dev`, `next start`, on any port). Stopping the background task isn't enough on Windows: it can leave the child `node ... next` process running and holding the port. Find what's listening (`netstat -ano | grep LISTENING` for 3000, 3001, ...), check its command line is this project's `next`, kill that PID, then confirm the ports are free
1. Stage all changes and commit with a descriptive conventional commit message (no Claude attribution)
2. Switch to main and merge the feature branch (no push yet)
3. Delete the local feature branch
4. Reset current-feature.md:
   - Change H1 back to `# Current Feature`
   - Clear Goals and Notes sections (keep placeholder comments)
   - Add feature summary to the END of History
5. Commit the reset: `chore: reset current-feature.md after completing [feature]`
6. Push main to origin ONCE (single push with all changes)
7. If feature branch was previously pushed, delete it from origin