GYM COMEBACK V19.4 — ADAPTIVE TRAINING REVIEW

Built from the user-confirmed stable V19.3 recovery release. V19.3 remains preserved as the stable backup.

WHAT'S NEW
- Adds an Adaptive Training Review to the Progress page.
- Review the selected workout day exercise-by-exercise using up to the three most recent saved sessions for that same exercise and day.
- Considers recorded reps, total reps, load, reps in reserve (RIR), and symptom/body-response feedback.
- Identifies when to build consistency, maintain load, review a lower-performance session, or consider progression after repeated strong sessions.
- Worsening symptom feedback overrides progression and recommends holding/reviewing the movement.
- Recommendations are explanatory and advisory only: no workout, exercise, weight, or repetition values are changed automatically.
- Preserves existing V19.3 workout recovery, five-day plans, weekly weighted and non-weighted carry-forward, exercise swaps, set completion, rest timer, progress dashboard, and backup/restore.
- Updates the service-worker cache key for V19.4.

HOW TO TEST
1. Confirm VERSION V19.4 appears at the top-right throughout the app and in About.
2. Open Progress and find Adaptive Training Review. Select each workout day.
3. With no saved history, confirm exercises show a clear needs-data message rather than invented advice.
4. Save sessions with different rep totals, RIR values, and symptom responses. Confirm the review reflects the latest and previous saved sessions for the same exercise and day only.
5. Confirm worsening symptom feedback always blocks progression advice.
6. Confirm a progression suggestion appears only after two qualifying logged sessions (3 sets of 12+ reps, 2+ RIR, stable/better response).
7. Confirm recommendations do not alter workout entries or exercise selection.
8. Recheck V19.3 features: workout list, weighted/non-weighted weekly carry-forward, rest timer, set status, progress charts, and JSON backup/restore.
9. Test on phone and PC after deploying to GitHub Pages.

INSTALL
1. Keep V19.3 ZIP as a backup.
2. Extract this ZIP. Upload the CONTENTS to the same GitHub Pages root as the existing app (not the ZIP and not a nested folder).
3. Commit/publish, then open the website and refresh. If an installed PWA still shows an old version, close it fully and open the website in Chrome once to allow the new service worker to install.

STATUS
V19.4 is a beta package. It has not been deployed to GitHub Pages or user-tested yet. The adaptive review is rules-based coaching support, not medical advice or medical clearance.
