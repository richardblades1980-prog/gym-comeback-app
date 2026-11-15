GYM COMEBACK — REPOSITORY INSTALL NOTES

Current baseline: V21.1B.2.1
V21.2 development: use the V21.2-development branch; it is not the live release.

For the current published app, GitHub Pages serves index.html from the configured publishing branch/folder. Keep the runtime folder structure intact:
- index.html
- manifest.webmanifest
- sw.js
- cover-art.jpg
- icons/
- assets/
- celebration GIFs referenced by the app

Do not publish the V21.2 development branch as the live app until regression testing and the data migration safety checks have passed.

DATA SAFETY
Workout records and profile data in V21.1B.2.1 are stored in browser localStorage. They do not automatically synchronise between devices. Export a JSON backup before changing app versions.

V21.2A
The new IndexedDB foundation is being developed separately. It is not yet connected to the live V21.1 interface, and migration must not delete legacy localStorage data.
