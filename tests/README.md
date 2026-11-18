# V21.2 test guide

Run tests from the repository root on `V21.2-development`. The project uses Node's built-in test runner; `package.json` currently has no `npm test` script. GitHub Actions is the authoritative CI configuration.

## Test families

- **Core/service tests:** Gym workout/progression, base programme, migration, IndexedDB, backup/restore, identity persistence, integrity, module registry, programme manager and workload summaries.
- **Contract tests:** canonical exercise identity, catalogue delivery, guide artwork/cache, review-only artwork samples and legacy exercise-name collisions.
- **Mirror check:** `tests/check-v21-2-bundle.js` verifies canonical source files match the browser bundles.
- **Browser integration:** `tests/browser-validation.js` launches Chromium and checks the real V21.2 app, migration, persistence, workout flow, offline shell, cache behavior and related UI. Its sequential integration flow is intentionally kept intact during this housekeeping audit.
- **Fixtures:** `tests/fixtures/` contains isolated migration and offline-shell fixtures; tests should not operate on real user data.

## Local commands

Install the same development dependencies used by CI:

```sh
npm install --no-package-lock
```

Run all Node test files:

```sh
node --test tests/*.test.js
```

Run the canonical/browser bundle check and app syntax check:

```sh
node tests/check-v21-2-bundle.js
node --check v21.2/app.js
```

Run Chromium validation after installing the browser:

```sh
npx playwright install chromium
node tests/browser-validation.js
```

## CI workflows

- [V21.2A browser validation](../.github/workflows/v21-2a-browser-validation.yml): service-worker failure tests, integrity tests, bundle parity, app syntax, design contracts, Gym service tests, artwork/guide contracts, persistence tests, then Chromium migration/offline/browser validation.
- [V21.2A backup validation](../.github/workflows/v21-2a-backup-validation.yml): backup, persistence, programme-manager, workload, migration, IndexedDB, integrity, identity/catalogue and Gym service suites.

Both workflows run on pushes and pull requests targeting `V21.2-development`. A result is a pass only when its completed run's `head_sha` matches the exact commit being validated. Earlier commits' results do not validate a later commit.


- **Exercise-guide cryptographic helpers:** `node --test tests/exercise-guide-crypto.test.js` tests canonicalisation, SHA-256 vectors, domain separation and fail-closed behavior. The helper source/offline mirror is included in the bundle parity check. This helper is not yet wired into production registry validation.


- **Exercise-guide digest contracts:** `node --test tests/exercise-guide-digests.test.js` validates the async guide-content, asset-set, assignment and review digest payload contracts, including tamper/cross-binding checks and fail-closed crypto behavior. These contracts are not yet wired to production registry validation.


- **Async guide registry validation:** `node --test tests/exercise-guide-registry.test.js` covers schema v2 and cryptographic verification using the digest contracts.
- **Async guide runtime:** `node --test tests/exercise-guide-runtime.test.js` covers source-snapshot binding, empty-registry resolution, request invalidation, registry fetch caching/retry and fail-closed behavior.


- **Async exercise-guide registry (schema v2):** `node --test tests/exercise-guide-registry.test.js` uses real Web Crypto SHA-256. Reviews bind exact guide, assignment, and asset-set targets; asset-set review targets include exact manifest release. Guide content digest binds its exact selected `assetIds`, and the validator requires those IDs to be members of the bound manifest and locally verified. Crypto unavailable/rejected, tampering, stale source snapshot, conflicts, or review mismatches fail closed.
