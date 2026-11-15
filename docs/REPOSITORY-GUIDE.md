# Repository guide

## Active application
- `index.html`: current Gym Comeback app (V21.1B.2.1 baseline).
- `manifest.webmanifest`: installable app metadata.
- `sw.js`: offline application cache.
- `cover-art.jpg`, `icons/`, `assets/`, celebration GIFs: runtime assets.

## Development
- `src/data/`: V21.2 data layer under development.
- `docs/V21.2A-ARCHITECTURE.md`: approved architecture.
- `docs/archive/`: historical release notes retained for reference.
- `check.js`: existing project check artefact; review before changing or removing.

## Branch policy
- `main` remains the protected known-good line during V21.2 development.
- Build and test on `V21.2-development`.
- Merge only after migration, backup/restore, offline and regression tests pass.

## File-count note
GitHub's browser upload workflow limits the number of files in a single upload batch; it is not a 100-file repository-wide cap. The application itself legitimately needs its individual offline assets. Use GitHub's repository tools or GitHub Desktop for larger multi-file changes rather than deleting required runtime assets.

## Data safety
The service worker caches app files; it does not synchronise user data. User data migration must retain legacy localStorage until the new database has been verified. No cloud sync is implemented by this architecture phase.
