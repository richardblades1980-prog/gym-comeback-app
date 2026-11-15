GYM COMEBACK V8 — ADAPTIVE GEAR, CUSTOM EQUIPMENT & EXERCISE SWAPS

V8 builds on the tested V7 package. It keeps the original two-day comeback programme, logging, progress, muscle guides, celebration, injury notes and local backups.

NEW IN V8
- Build a gear-matched version of Day 1 or Day 2 for My Gym, My Home Setup, or combined equipment.
- The adaptive version keeps the original exercise if matching equipment is selected. Otherwise, it looks for a library exercise that shares target muscles and uses the selected equipment, favouring available options.
- Each exercise card has a Swap button. Choose a similar movement from the library; availability is shown in the choices.
- Exercise Library has location and availability filters: Gym, Home, combined, bodyweight-only; show all, available only, or missing-equipment exercises.
- Add custom equipment names separately to Gym and Home, and remove them later.
- Adds 15 individual comic-style SVG equipment illustrations for chest press, lat pulldown, cable row, leg press, leg extension/curl, shoulder press, dumbbells, bench, squat rack, treadmill, bike, rower, bands, bodyweight and home gym.
- JSON backup now includes custom equipment, adaptation toggles and exercise substitutions.
- Service worker cache is versioned V8 to avoid reusing the old V7 cache.

IMPORTANT BEHAVIOUR
- Adaptive workouts are opt-in, per workout day. The original programme remains available with “Use original workout”.
- The matching logic is a simple local rules-based suggestion, not an AI or medical assessment. Review every substitution before training; it cannot reliably understand every custom equipment name.
- Adding a custom equipment label stores it in the inventory, but it may not automatically match a specific exercise requirement. The standard gear checklist is more reliably matched by the app.
- Bodyweight exercises do not require equipment. Some are high-impact (e.g. burpees); choose low-impact options if appropriate.
- Stop if an exercise causes sharp/worsening pain, swelling or limping. This app is not medical advice.
- Logs and profile remain in browser local storage and do not sync between devices. Download a JSON backup before updating.

INSTALL / UPDATE ON GITHUB PAGES
1. In the current V7 app, go to Progress and download a JSON backup. Also back up the GitHub repository.
2. Extract this ZIP on your computer.
3. Replace the existing index.html and sw.js with the V8 versions.
4. Copy the included assets/ folder into the same root as index.html, allowing the new equipment SVGs to be added. Keep the existing icons/, cover-art.jpg, manifest.webmanifest and celebration GIFs from this package.
5. Commit and push to the same GitHub Pages branch/folder as before.
6. Open the site once while online. If an old version persists, fully close the installed app and reopen; if needed clear that site's cache only after confirming the backup.
7. Test custom equipment, gym/home filters, one exercise swap, and a gear-matched workout before using it for normal training.
