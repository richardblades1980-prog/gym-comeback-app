GYM COMEBACK V14 — PROGRESS DASHBOARD

WHAT’S NEW
- Standalone weigh-in entry (date + kg), so body weight can be tracked without saving a workout.
- Body-weight chart combines standalone weigh-ins with body weight recorded in workouts; if both exist for the same date, the standalone weigh-in takes precedence for that date.
- Clear first-to-latest body-weight change and dates; no estimates or invented values.
- Dashboard stats for saved workout records, sessions dated within the last 28 days, logged cardio minutes, recorded lifting volume (weight × reps where both exist), and exercises with recorded loads.
- Exercise selector and strength-trend chart using the heaviest recorded set per date. This is recorded load history, not a one-rep-max estimate.
- Recent sessions sorted by date.
- JSON backup/restore now includes standalone weigh-ins. Existing V13.1 workout logs, exercise swap data, equipment settings, progression, and profile are preserved.
- Version badge, About section, footer, metadata and service worker identify V14.

TEST CHECKLIST
1. Open Progress and confirm the page loads with no logged data.
2. Add two weigh-ins on different dates; confirm the chart, first/latest values and change update. Edit a date by saving a new weight on the same date; confirm there is one entry for that date.
3. Save a workout with a dated weighted exercise, then select it in Strength trend and confirm the load chart appears. Add another dated session to compare.
4. Confirm sessions in the last 28 days, cardio minutes and lifting volume reflect recorded logs only.
5. Download a JSON backup, then restore it and confirm standalone weigh-ins return.
6. Re-test repeated exercise swaps, personalised week builder, injury-aware alternatives, equipment settings, bodyweight weight-field setting, progression, CSV export and all five workout days.

PRIVACY & SAFETY
Data remains in this browser on this device unless exported. Body-weight changes and lifting volume are descriptive records, not medical guidance or guaranteed indicators of health. The app does not infer missing workouts or body weights.

BUILD STATUS
Technical checks performed before beta release; not deployed to GitHub Pages or tested on the user’s phone/PC browser.
