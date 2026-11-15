GYM COMEBACK V20.2 – OPTIONAL WARM-UP & COOL-DOWN

INSTALL / UPDATE
1. Keep V20.1.2 as your stable backup.
2. Extract this ZIP.
3. Upload the CONTENTS of the extracted folder to the root of your existing GitHub Pages repository, replacing the previous files.
4. Commit and publish.
5. Open the site in Chrome, refresh, and confirm V20.2 appears in the top-right badge. If the installed PWA shows an old version, close it and open the website in Chrome once to allow the service worker to update.

WHAT'S NEW
- Added an optional Warm-up section above the main workout.
- Added an optional Cool-down section below the main workout.
- Both are enabled by default for a new session and can be switched off independently for that session.
- Warm-up choices include brisk walk, walk to the gym, treadmill, elliptical, stationary bike, gentle mobility and other.
- Cool-down choices include easy walk, walk home from the gym, gentle cycling, gentle stretching, breathing/relaxation and other.
- Each section records activity, minutes and optional notes with the workout session.
- Existing sessions without these fields load with the sections enabled by default; no existing workout records are deleted.
- CSV exports include warm-up and cool-down details. JSON backup/restore retains them as part of each session record.

TEST
1. Open a workout and confirm Warm-up appears above the strength exercises and Cool-down below them.
2. Leave both enabled; select Walk to the gym and Walk home from the gym, enter durations and notes, then save.
3. Navigate away and return; confirm the choices and values remain.
4. Untick Warm-up only; confirm its fields hide and the skipped message appears, while Cool-down remains visible.
5. Untick Cool-down too; confirm both can be skipped independently.
6. Save a session, export a JSON backup and CSV, and check the warm-up/cool-down data is included.
7. Confirm set counts, progression preferences, readiness, exercise swaps and rest timer still work.

Warm-up/cool-down choices are user-controlled session notes, not medical or exercise prescriptions. Choose comfortable activities and stop if symptoms worsen.
