GYM COMEBACK — VERSION 2 UPGRADE

WHAT'S NEW
- Progress dashboard with body-weight chart, session history and heaviest recorded lifts.
- 4, 8 or 12-week programme selector (keeps existing logs).
- Comeback Coach profile: goals, experience, equipment, session time, injury/pain area, pain rating and movement restrictions.
- Rules-based exercise modifications and safety prompts. This is not a medical diagnosis and does not call an external AI service.
- Hold an exercise heading for a quick guide with a stylised machine diagram and highlighted muscle group.
- Rest timer, CSV export, JSON backup and restore.
- Local auto-save and offline caching.

UPDATE YOUR LIVE GITHUB PAGES APP
1. Download and unzip this package on your computer.
2. Open your existing GitHub repository for Gym Comeback.
3. Upload/replace the files and icons from this ZIP, keeping index.html, manifest.webmanifest, sw.js, cover-art.jpg and the icons folder at the repository root.
4. Commit the changes and wait for GitHub Pages to finish publishing.
5. On your phone, open the app website while online and refresh. If it still shows the old version, fully close the installed app, reopen the website in Chrome, refresh, and wait a short moment for the new service worker to activate. If needed, remove the old home-screen app and install it again from the updated site.

IMPORTANT ABOUT INJURY / AI
The current coach uses transparent rules and the injury details remain on the device; it is not connected to a live AI service. Do not rely on it to diagnose an injury. Follow your clinician's advice and stop movements that cause sharp or worsening pain, swelling or limping. Seek urgent help for emergency symptoms.

DATA
Workout logs and profile are stored locally in the browser on this device. They are not automatically synced between devices. Download JSON backups regularly. CSV is available for spreadsheets.

PWA NOTE
This is an installable Progressive Web App served over HTTPS, not a Play Store APK.


V3 UPDATE — SIX-SECOND WORKOUT CELEBRATION
After you tap Save session, a six-second comic-style animation plays. The hero flexes and the muscle groups trained in the selected workout are highlighted. You can dismiss it early with the button. The app still saves your session locally as before.

To update an existing GitHub Pages deployment, replace the repository files with all files from this ZIP, commit the changes, and wait for Pages to publish. The service worker cache name has been bumped to gym-comeback-v3 so the updated app can replace the cached version. Export a backup before updating as a precaution.


V4 UPDATE — MUSCLE-GLOW CELEBRATION
This version adds two six-frame animated GIF celebrations. Day 1 highlights chest and quad areas; Day 2 highlights shoulders, arms and leg areas. The selected day's animation plays when Save Session succeeds, and the celebration closes automatically after six seconds. Upload all files in this package to your existing GitHub Pages repository, replacing old files. Keep the folder structure intact. Back up workout logs before testing any update.


V5 UPDATE — FEMALE HERO + HERO STYLE SETTING
- Added a Hero style selector to the Comeback Coach profile: Male hero or Female hero.
- The chosen hero is saved with the local profile and appears after a workout is saved.
- Male hero keeps separate Day 1 and Day 2 celebrations; female hero uses the new six-frame, six-second comic GIF.
- The female GIF is bundled in offline cache. Cache name bumped to gym-comeback-v5.
- In the app, open Coach, choose Hero style, and tap Save my profile. Then save a workout to preview the selected hero.
