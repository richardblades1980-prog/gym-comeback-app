GYM COMEBACK V19.3 BETA

This release starts from the confirmed V19.1 baseline and redoes the intended V19.2 weekly defaults change with a workout-list recovery and update-delivery fix.

WHAT CHANGED
- One-time cleanup removes only saved per-day exercise-library additions, exercise swaps, and gear-matched/adapted workout flags that may have caused the workout list to inflate. It preserves workout history, saved weights/reps, profile, equipment, and progress data.
- Reps now carry forward for bodyweight/non-weighted exercises as well as weighted exercises; recorded weights carry forward where present. Values are editable and existing values in the current week are not overwritten.
- Exercise names are matched more robustly.
- The visible version is V19.3 throughout the app.
- Service-worker cache is versioned anew, HTML is network-first, and the app asks the service worker to check for updates.

INSTALL ON GITHUB PAGES
1. Keep your previous ZIP as a backup.
2. Unzip this package on your computer.
3. Upload the CONTENTS of the extracted folder to the root of the GitHub Pages repository, replacing the old files. Do not upload the ZIP itself or put the extracted folder inside another folder. In particular, index.html, sw.js, and manifest.webmanifest must sit at the same level as before.
4. Commit the changes and wait for GitHub Pages to finish publishing.
5. Open the app page and refresh it. The app should display VERSION V19.3 in the top-right. If an already-installed PWA still shows the old version, close it fully and open the website in Chrome once to allow the service worker to update.

No deployment has been performed by ChatGPT. Please beta-test the workout list and weekly rep carry-forward before treating this as passed.
