GYM COMEBACK V9.1 — BUG-FIX RELEASE

Changes from V9
- Selecting “No current injury / restriction” sets pain to 0 and clears injury details.
- Added dedicated Day 3 (Full Body), Day 4 (Upper Body), and Day 5 (Lower Body & Core) workout plans.
- Workout selector, local workout logs, CSV export, and JSON backup now support Days 1–5.
- Updated service-worker cache name so the browser can load the bug-fix release.

Testing suggestions
1. In Coach, set pain to a value above 0, then choose “No current injury / restriction”; confirm pain becomes 0.
2. Set Days per week to 3, 4, then 5 and confirm the matching Day 3/4/5 plans appear.
3. Save a test log on Day 3, reload the app, and confirm it remains separate from Days 1 and 2.
4. Export CSV and download JSON backup to check all day numbers are supported.

This ZIP is a local release package; it has not been deployed to GitHub Pages.
