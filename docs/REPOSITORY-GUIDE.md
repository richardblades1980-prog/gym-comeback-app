# Repository guide

## Application versions and entry points

- `index.html`: protected legacy Gym Comeback V21.1B.2.1 baseline; do not change during V21.2 development.
- `v21.2/index.html`: active V21.2 development application entry point.
- `manifest.webmanifest` and `sw.js`: legacy root app install/offline files.
- `v21.2/manifest.webmanifest` and `v21.2/sw.js`: V21.2 install/offline files. Keep their cache scope and release namespaces separate.
- `README-INSTALL.txt`: legacy install and data-safety notes.

## Source and browser bundles

- `src/data/`, `src/modules/`, `src/programme-manager/`, `src/progress/` and `src/shared/`: canonical V21.2 source.
- `v21.2/assets/`: browser-loaded mirrors of canonical services. The mirrors are intentionally retained; `tests/check-v21-2-bundle.js` verifies the canonical pairs remain byte-identical.
- `v21.2/app.js` and `v21.2/app.css`: application presentation and wiring.
- `tests/`: Node test suites, bundle checks, browser integration validation and isolated fixtures. See [test guide](../tests/README.md).

## Legacy `check.js` artefact

`check.js` is a retained legacy workout-script snapshot, not a test/checker utility. Its history shows an initial upload on 9 November 2026. It is not loaded by the root `index.html` or root `sw.js`, and it is not invoked by the inspected package or CI workflow commands. The current V21.2 app uses `v21.2/app.js` and its listed assets instead.

Keep `check.js` for now. The available reference search was not exhaustive, so do not delete, rename or relocate it until a complete reference/history review and an explicit decision establish that it is unnecessary.

## Asset duplication

Root legacy assets and matching V21.2 versioned guide assets are separate packaged copies. The audit confirmed identical Git blob hashes for 38 matching files. The copies are kept because each app has its own paths, service-worker scope and offline cache/version lifecycle. Other root assets that have no matching V21.2 guide copy are not assumed redundant.

Do not delete or consolidate assets based only on matching names, file counts or hashes. Confirm all runtime, manifest, cache, test and historical references first.

## Documentation navigation

- [Strategic Project Comeback roadmap](../README.md)
- [V21.2 Gym functional roadmap](V21.2-GYM-WORKOUT-FUNCTIONAL-ROADMAP.md)
- [Adaptive Brain historical rules audit](V21.2-ADAPTIVE-BRAIN-HISTORICAL-AUDIT.md) (design evidence; not implementation approval)
- [V21.2A architecture](V21.2A-ARCHITECTURE.md)
- [Continuation handover](../PROJECT_COMEBACK_CHATGPT_HANDOVER.md)
- [Test guide](../tests/README.md)
- [Install notes](../README-INSTALL.txt)
- [Historical release notes](archive/README-V10-SMART-PROGRESSION.txt) (archive is reference material, not current instructions)

## Branch policy

- `main` remains the protected known-good line during V21.2 development.
- Build and test on `V21.2-development` only.
- Merge only after migration, backup/restore, offline and regression tests pass and the user explicitly approves release.
- No deployment is part of development housekeeping.

## File-count note

GitHub's browser upload workflow limits the number of files in a single upload batch; it is not a 100-file repository-wide cap. The application legitimately needs individual offline assets. Use GitHub's repository tools or GitHub Desktop for larger multi-file changes rather than deleting required runtime assets.

## Data safety

The service worker caches app files; it does not synchronise user data. User data migration must retain legacy localStorage until the new database has been verified. No cloud sync is implemented by this architecture phase.
