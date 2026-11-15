GYM COMEBACK — V6 EXERCISE VISUAL GUIDE UPDATE

What changed
- The six-second celebration animation remains out of scope for this update; existing completion behaviour is unchanged.
- Holding an exercise card still opens the guide. The guide now shows a comic-style equipment reference plus the specific highlighted muscle-group panels for that exercise.
- Muscle panels use the supplied Gym Comeback artwork showing both male and female heroes, with the relevant highlighted group.
- The equipment artwork includes commercial gym examples and a home-gym reference. Choosing a Home equipment option in Comeback Coach switches the guide to the home-gym equipment panel.
- All guide assets are bundled locally and precached for offline/PWA use.

Install/update on GitHub Pages
1. Back up your current repository and do not delete the live site until the new files are ready.
2. Extract this ZIP.
3. Copy/replace index.html and sw.js at the same level as your current index.html.
4. Copy the included assets/ folder into the repository root.
5. Keep your existing manifest.webmanifest, cover-art.jpg, icons/ and celebration GIFs. They are included here too so the ZIP is a complete drop-in V5-based package.
6. Commit and push to the same GitHub Pages branch/folder you already use.
7. On your phone, close the installed app completely and reopen it while online once so the new service worker can install. If the old version remains, remove the home-screen shortcut, clear that site's storage/cache in the browser, visit the GitHub Pages URL, then install again.

Important
- Existing workout records are stored in browser localStorage and are not automatically synced. Back up/export records before changing installations or clearing site data.
- The artwork is a visual aid, not a guarantee that every gym machine matches the exact pictured model. Use the machine's own instructions and ask staff for help when needed.
- The current build's exercise guides cover the included two-day programme. This is a first pass, and more equipment tiles can be added as the library expands.
