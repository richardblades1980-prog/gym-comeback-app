GYM COMEBACK V19.1 — WEEKLY WEIGHT & REP DEFAULTS

Built from the passed V19 Exercise Completion release.

WHAT CHANGED
- When a training week/day has no saved session yet, the app looks backwards for the most recent logged session for the same workout day.
- Matching exercises receive their previous recorded set weights and reps as starting values.
- These values are editable: users can increase, decrease, or clear them before or during the session.
- Existing saved sessions are loaded unchanged and are not overwritten by prefill.
- New week entries do not inherit the previous week’s date, bodyweight, cardio, notes, effort or symptom fields.
- The progression advice remains advisory; the app does not automatically increase loads.
- Week 1 starts fresh. Matching is by exercise name, so a different swapped exercise will start blank until it has its own history.

TESTING
- Static checks: JavaScript syntax, manifest JSON, duplicate IDs, service-worker cache reference and ZIP integrity.
- This package has not been uploaded to GitHub Pages or tested on the user's phone/PC. Beta testing is required.

BACKUP
Keep the passed V19 ZIP. Do not clear browser site data during testing; workout logs are stored locally on the device/browser.
