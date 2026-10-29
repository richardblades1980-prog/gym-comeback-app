GYM COMEBACK V10.1 — VERSION BADGE UPDATE

Built from the beta-tested V10 smart-progression package. V10 is retained unchanged as the passed backup.

What changed
- Added a persistent VERSION V10.1 badge fixed to the top-right corner, visible while moving through app sections and scrolling.
- Added an About Gym Comeback section identifying V10.1 and explaining this release.
- Updated the footer and metadata to identify V10.1.
- Updated the service-worker cache name so the new release can replace cached V10 assets after the service worker updates.

What did not change
- V10 smart progression rules, exercise logging, gear matching, profile, five workout days, exports, backups, and visual guides are retained.
- No deployment to GitHub Pages has been performed.

Beta test checklist
1. Open the app and confirm VERSION V10.1 is visible in the top-right corner.
2. Navigate through Workout, Coach, My Gear, and Settings; confirm the badge remains visible.
3. Scroll down and confirm it stays at the top-right.
4. Check the About Gym Comeback section near the bottom for V10.1.
5. Check on a narrow phone screen that the badge is legible and does not block controls.
6. Confirm V10 smart progression, existing logs, CSV export, and JSON backup/restore still work.
7. If installed as a PWA, reopen after the service-worker update; if the old version remains cached, fully close and reopen or refresh once.

Important: this ZIP is packaged for beta testing and has not been live-tested on your phone or deployed to GitHub Pages. Your saved data remains in the browser on the device where it was entered; download a JSON backup before changing versions or clearing browser data.
