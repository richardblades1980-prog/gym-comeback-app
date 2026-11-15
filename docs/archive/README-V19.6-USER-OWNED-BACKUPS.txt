GYM COMEBACK V19.6 — USER-OWNED BACKUPS

WHAT'S NEW
- Save backup to a user-chosen location using the browser file save picker where supported.
- On browsers without the save picker, downloads a JSON backup; the user can move it into Google Drive, iCloud Drive, OneDrive, Dropbox or another chosen location.
- Choose backup to restore using the device file picker. Cloud files appear only when the browser/OS exposes them.
- Import preview and merge behaviour: missing workout records are added; for a matching week/day, an incoming later-dated session replaces the older one; otherwise the existing session is kept. Weigh-ins merge by date. Existing profile and equipment settings are not overwritten.
- RESET prompt now explicitly says to type RESET in CAPITAL LETTERS.
- Version badge, About and service-worker cache updated to V19.6.

IMPORTANT LIMITATIONS
- This is user-controlled file backup/restore, not automatic live sync. The user must save a backup on one device and select it on the other.
- Browser/OS file pickers differ. Google Drive, iCloud Drive, OneDrive and Dropbox may appear as locations only when the device/browser exposes them. If not, download the file and move it using the provider's own app/site.
- V19.6 backup JSON files are NOT encrypted. Keep them private. Password-encrypted backup is a later feature.
- Comeback does not receive cloud credentials or store backup files on its own servers.

INSTALL
1. Keep the V19.5 ZIP as your backup.
2. Extract this ZIP.
3. Upload the CONTENTS of the extracted folder to the same GitHub Pages root, replacing previous app files. Do not upload the ZIP itself or place everything inside an extra folder.
4. Commit/publish. Open the website in Chrome and refresh. If the installed PWA still shows an old version, close it and open the website in Chrome to allow the service worker to update.
5. Check the top-right badge says V19.6.

TEST CHECKLIST
- Confirm V19.6 badge appears.
- Settings → Backups & privacy → Save backup to a location. Confirm the file is created or downloaded.
- On another device, choose that file using Choose backup to restore. Confirm preview, import and progress.
- Import the same file again and check that it does not create duplicate week/day sessions.
- Check that the existing profile/equipment choices remain intact.
- Reset progress and confirm the prompt explains CAPITAL LETTERS.

This package has not been deployed to GitHub Pages or tested on a physical phone/PC.
