GYM COMEBACK — INSTALLABLE PHONE APP

Files included
- index.html: the app
- manifest.webmanifest: install metadata and app name
- sw.js: offline cache
- cover-art.jpg and icons/: comic-inspired artwork and app icons

IMPORTANT
For Android Chrome to offer “Install app” / “Add to Home screen”, the files must be served from an HTTPS website. Opening index.html directly from Downloads is not enough for a full installable PWA.

EASIEST PUBLISH ROUTE (GitHub Pages)
1. On a computer, sign in to GitHub and create a new public repository, e.g. gym-comeback-app.
2. Upload all files and the icons folder from this ZIP (upload the contents, not the ZIP itself). Make sure index.html is at the repository root.
3. In the repository, open Settings → Pages. Choose “Deploy from a branch”, select the main branch and /(root), then Save.
4. Wait for GitHub Pages to publish the HTTPS site.
5. Open the published site URL on your Android phone in Chrome. Tap ⋮ → “Install app” or “Add to Home screen”.
6. The Gym Comeback icon will appear on your home screen. Open it from there like an app.

DATA AND BACKUPS
Workout entries are saved in local browser storage on that device. Use the app’s “Download backup (JSON)” and “Export all logs (CSV)” regularly. Browser/site data can be lost if storage is cleared. This version does not sync between devices.

DESIGN
Custom comic-inspired artwork, teal/orange/cream theme and home-screen icon are included. This is a progressive web app (PWA), not a Play Store APK.
