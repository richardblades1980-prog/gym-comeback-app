GYM COMEBACK V21.1B.1 — BETA TESTING & WORKOUT LOGGING FIXES

BASE CHECKPOINT
Built from the user-approved V21.1A.2 Objective-to-Plan Integration release.

WHAT CHANGED
1. Workout completion status
- Completion flags are now scoped to an individual workout session, not just the calendar date.
- Saving a workout starts a fresh completion checklist for the next session.
- Previous completion records remain available to the workout-day unlock logic.

2. Timed exercises
- Each timed set has its own stopwatch with Start, Stop and Reset controls.
- The target duration is displayed separately from the actual result.
- Actual elapsed time is saved per set.
- Manual entry and correction remain available if the stopwatch was not used or needs correction.
- The stopwatch does not stop automatically at the target; actual time can be shorter or longer.
- Actual duration continues to feed the existing progression review. It does not automatically change the next target or programme.

3. Exercise collapse
- Completing an exercise no longer collapses it automatically.
- The exercise remains open so the user can record notes, effort, symptoms and other results.
- The user can choose Collapse once the exercise is complete.

4. Factory reset
- Adds a separate “Factory reset — start as a new user” action.
- Requires two confirmations, including typing DELETE EVERYTHING.
- Deletes Gym Comeback local data, including profile, objectives, equipment, exercise settings, swaps, workout history, completion status, body-weight/readiness history and adaptive/coaching history.
- The reset is permanent. Download a backup first if any data may be needed.

WHAT IS PRESERVED
- Existing Reset all progress remains separate. It clears workout and progress history while retaining profile, equipment, exercise configurations, progression preferences and app preferences.
- Existing exercise progression choices and the objective-to-plan integration remain intact unless the user deliberately performs a factory reset.
- Local-first data storage and user-controlled backup/restore remain unchanged.

INSTALL
1. Unzip this package.
2. Upload the contents of the gc206 folder to the same location used for the current Gym Comeback deployment, replacing the previous release files.
3. Keep the folder structure intact, including assets, icons, manifest.webmanifest, index.html and sw.js.
4. Open or refresh the deployed app. The service worker cache name has changed to V21.1B.1.
5. Confirm the fixed version badge at the top-right reads VERSION V21.1B.1 and the About section reports V21.1B.1.
6. If the old version remains visible, close the installed app/browser tab completely and reopen it. If necessary, use the browser’s site-data controls to clear the old cached app, then reload.

BETA TEST CHECKLIST
A. Completion status
- Complete and save a workout.
- Start another workout session on the same date/day where possible.
- Confirm all set statuses begin NOT STARTED.
- Confirm the previous completed workout still unlocks the next planned workout day.

B. Timed sets
- Choose an exercise and set its progression preference to Duration first.
- Confirm the target duration is visible separately from Actual time.
- Start the stopwatch, wait a short period, then stop; confirm actual seconds are recorded.
- Test a time below target and a time above target. Confirm the stopwatch does not stop at the target.
- Reset the stopwatch and confirm the actual field clears.
- Enter an actual time manually without starting the stopwatch; save and confirm it is retained.
- Complete multiple timed sets and confirm each set has its own result.

C. Exercise collapse
- Complete all planned sets.
- Confirm the exercise remains expanded.
- Add or edit the exercise note, RIR and symptom response.
- Collapse it manually and expand it again.

D. Reset behaviour
- Test Reset all progress only after making a backup. Confirm profile, equipment, exercise configurations and progression preferences remain.
- Test Factory reset only with disposable beta data or after making a backup. Confirm the second confirmation is required and the app returns to first-use setup.

IMPORTANT VALIDATION NOTE
This package has passed source-level JavaScript syntax checking and archive-integrity checks. It has not been live-tested in a browser, on Android, or on the user’s deployed GitHub Pages site in this build session. Please run the beta checklist on the deployed app before relying on it.

Gym Comeback is a beta training journal. Recommendations are guidance, not medical clearance. Review exercise substitutions and comfort before training.
