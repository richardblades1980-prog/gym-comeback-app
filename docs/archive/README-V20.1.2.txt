GYM COMEBACK V20.1.2 – SET COUNT CORRECTION

INSTALL / UPDATE
1. Keep V20.1 and V20.1.1 ZIPs as backups.
2. Extract this ZIP.
3. Upload the CONTENTS of the extracted folder to the root of your existing GitHub Pages repository, replacing the old files.
4. Commit and publish.
5. Open the site in Chrome, refresh, and confirm V20.1.2 appears in the top-right badge. If the installed PWA still shows the old version, close it and open the website in Chrome once to allow the service worker to update.

FIXES
- Corrected the set-count control so it updates the saved setCount property used by the workout renderer, logger and completion tracker.
- Added migration for the earlier V20.1.1 bug, which could save the selected value under a separate `sets` property while leaving setCount at 3. Existing selections saved by that version are recovered automatically.
- Set-count changes rebuild the displayed set cards and clean up completion statuses for sets removed when reducing the count.
- Existing logged entries are saved before the exercise structure is rebuilt.

TEST
1. Set Plank to 2 sets and confirm only SET 1 and SET 2 appear.
2. Set Squats to 4 sets and confirm four set cards appear.
3. Navigate away and return; confirm both counts remain independent.
4. Enter values, change the count, and confirm retained sets keep their entries.
5. Complete all displayed sets and confirm the exercise completion status follows the selected count.

This is a beta correction. Keep your previous ZIP as a backup until tested.
