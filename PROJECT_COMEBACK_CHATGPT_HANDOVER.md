# Current handover — branch-based GitHub Pages release candidate (2026-11-19)

- User confirmed GitHub Pages source mode: **Deploy from a branch**. The selected source branch and folder remain to be confirmed from Settings → Pages.
- Dedicated candidate branch: V21.2-pages-release-candidate, created from protected main SHA 0d0527a6463c3cfd0fbb54d69123316c9a384b42.
- Exact candidate head: a721d7eab7fd0fa57a9f19a094cbc6c2ac24b4dd.
- Candidate contains unchanged V21.1 root site, reviewed root dual-app service-worker fix, and all 77 V21.2 files. Root index.html SHA remains e3eb0093648cc6c5d706bb5b1008b58ec01a5576.
- Candidate-only hidden validation workflow [#44413382202 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44413382202), exact candidate SHA. Full Chromium log confirms V21.1/V21.2 same-origin worker/cache isolation, V21.1 root update cleanup, byte-for-byte V21.1 localStorage preservation, empty V21.2 user stores, both offline cold starts, V21.2 Gym/Hiking/schedule, backup/restore and IndexedDB process-restart persistence.
- PWA icon/manifest contract also passed in the candidate workflow. This is validation against an assembled artifact served by the local GitHub Pages-style path simulation; it is not a live-host acceptance test.
- Candidate is **not** selected as Pages source, not published, and has no Pages deploy workflow. Hidden validation support is in dot-prefixed paths, separate from the V21.2 app directory.
- main remains 0d0527a6463c3cfd0fbb54d69123316c9a384b42; no Pages setting, live root site or user data has changed.

## Next required input

Check the exact selected branch and folder in repository Settings → Pages and report them. Then review whether the candidate root is the right source. Do not switch Pages settings or publish until separately approved.

---

# Current handover — V21.2 PWA assets and Pages trial planning (2026-11-19)

- Active branch: `V21.2-development`.
- PWA icon/manifest implementation and test commit: `c2ac43b6d23219b67396daf7cfa89578127f34eb`.
- Exact-SHA Browser [#44408582101 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44408582101); Backup [#44408581904 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44408581904).
- Added 192×192 and 512×512 PNG app icons, 512×512 maskable PNG, 180×180 Apple touch icon; retained the existing SVG. Manifest now has `id`, `start_url` and `scope` of `./`. V21.2 worker shell cache is v28 and precaches every app icon.
- New `tests/pwa-installability-contract.test.js` checks PNG signature/dimensions, manifest icon metadata, iOS touch-icon declaration and offline shell inclusion. The Chromium suite fetches PNGs and verifies `image/png` response delivery.
- This is development-side PWA metadata and asset verification. The actual GitHub Pages host has not served the V21.2 route; live MIME checks, install prompt, Home Screen install and standalone launch are outstanding.

## Pages publishing source audit

- Repository API metadata confirms Pages enabled and default branch `main`; it does not establish which branch/folder is configured for publication.
- The GitHub Pages source endpoint was unavailable through the current repository connection. Inspect repository Settings → Pages before any release method is chosen.
- `V21.2-development` currently contains only browser/backup validation workflows, not a Pages deployment workflow. Do not assume pushing the development branch publishes it.
- Future release artifact must contain exact V21.1 root files from `main`, the reviewed dual-app root `sw.js` from development, and the complete `v21.2/` directory. Re-run the full dual-app browser scenario against that exact assembled artifact.
- Branch-source publishing would require a separately approved release to its configured branch/folder. Actions-based publishing requires a separately approved Pages source-setting change to GitHub Actions and a controlled manual deploy workflow. Do not alter settings or publish without explicit approval.
- After publication, verify HTTPS/manifest/icon content types, exact V21.2 worker scope, clean IndexedDB, absent migration marker, unchanged V21.1 localStorage, actual iOS/Android install behaviour, backup, reload and offline cold start. Keep V21.1 as fallback and record the deployment rollback commit.

The prior clean-start decision remains in force: no V21.1 migration or record deletion. No Pages setting, main branch, live site or actual browser data has been changed.

---

# Current handover — clean-start V21.2 trial decision (2026-11-19)

- Active branch: `V21.2-development`.
- Implementation/test checkpoint: `8193af338450d424271372b62b316358bf4df6bd`.
- User approved a clean start for their own V21.2 trial. Do not import their V21.1 progress records for this trial; most are test records and they are content to begin again.
- Safety rule: keep the V21.1 root app and every existing `gym-comeback-*` localStorage value untouched. Do not delete or overwrite them. V21.1 remains available as fallback.
- Migration remains optional and explicit in V21.2 for other users. This choice is not a blanket waiver of a controlled migration rehearsal before offering a data-preserving upgrade to existing V21.1 users.
- Added a clean-profile Chromium first-run test: empty user-data stores, only default Gym/Hiking module records, no migration marker, controls remain inactive, and reload remains clean.
- Added a same-origin test with seeded V21.1 profile/workout/set-status values: V21.2 starts with empty user-data stores and no migration marker; original key/value pairs are byte-for-byte unchanged.
- Browser [#44405002324 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44405002324) and backup [#44405002284 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44405002284) both passed on exact test SHA `8193af338450d424271372b62b316358bf4df6bd`.
- This verifies local GitHub Pages-style automation only. V21.2 is not published to the selected host; no live V21.1 records were read, migrated or deleted, and no host settings/main branch changed.
- Next: commit this decision into release-readiness/roadmap/phone-preview/handover docs, then run browser and backup workflows against the exact documentation commit. Thereafter the next release task is clean-start final-host planning, still requiring explicit publication/hosting approval.

---

## G3.6b validation correction — browser assertion alignment (2026-11-18)

- Implementation SHA `1ac54be10aa9e4b00f1061e33e6002561e8712f5`: backup validation [#44255446595 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44255446595). Browser [#44255446714 — FAIL] (https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44255446714) at the existing Gym Journey assertion, which expected pre-change wording rather than the new approved summary labels. The browser run reached Gym Journey and showed the updated summary, recorded sets, and trends; failure was the test's string contract.
- Updated browser assertions for the G3.6b labels and “recorded change” wording, retaining the same data assertions and edge-case checks.
- Corrected final SHA must pass both workflows before milestone closure. No main merge or deployment.

---

# G3.6b — Progression summaries implementation checkpoint (2026-11-18)

- Implemented descriptive Gym exercise summaries in `ProjectComebackGymProgression.summariseExerciseHistory()` and mirrored the progression service byte-for-byte into `v21.2/assets/gym-progression.js`.
- Gym Journey now reports completed session/exercise/set totals and retains its total recorded-repetition metric. Per-source exercise history includes completed original-exercise sessions, set count, valid whole-number reps, valid durations and dated positive-load trend points.
- Manual substitutions are clearly listed with the performed label and saved values, but are excluded from original exercise trend calculations. No source label aliasing or fuzzy merging.
- Load trend points use positive numeric loads from original exercises only; records on the same date collapse to the heaviest load for that date. Invalid, zero/negative and undated loads are excluded. Trend text says “recorded change” and does not imply improvement.
- Added regression coverage for incomplete session filtering, exact source-name grouping, substitution separation, same-date aggregation, invalid/undated loads, valid reps/durations and bad input types.
- No schema/store/index, backup format, migration, exercise identity/catalogue, service-worker cache or runtime deployment change.
- Exact final commit requires browser and backup workflow PASS. Main remains untouched.

---

# Project Comeback — G3.7.7 repository housekeeping audit (2026-11-18)

- Active branch: `V21.2-development`; audit base `7b1b401bc3ac6648d2c050375f6f43ae3f0305f6`. Protected `main` was verified at `0d0527a6463c3cfd0fbb54d69123316c9a384b42` and remains untouched.
- Repository guide alignment: documented the legacy root app, V21.2 entry point, canonical `src/` and browser mirrors, separate service-worker/cache ownership, data-safety boundaries and navigation.
- `check.js`: 409-line / 109,733-character legacy workout-script snapshot; history shows an initial upload on 9 November 2026. It is not loaded by the inspected root `index.html` or `sw.js`, nor invoked by package/workflow commands. The reference search was not exhaustive; retained it without deletion, rename or relocation.
- Asset comparison: 38 matching root/V21.2 guide asset pairs have identical Git blob SHAs. These copies are intentionally retained in separate app/package paths and cache scopes. Canonical source/browser mirrors remain protected by the parity check; no asset or bundle was changed.
- Test organisation: retained the flat, purpose-named test files and the existing browser integration script. Added `tests/README.md` with test families, local commands and workflow navigation.
- Navigation: added development-document links to root README; clarified the repository guide; added a handover navigation index and this checkpoint; recorded G3.7.7 in the functional roadmap.
- No runtime code, data, tests, assets, service-worker cache version, main branch or deployment changed.
- Exact-SHA browser and backup validation is required for this documentation commit. On resume, read the live Actions runs and match `head_sha`; never infer validation from a previous commit.

## Quick navigation

- [Operating rules](#1-non-negotiable-operating-rules)
- [Approved product scope](#2-product-scope-and-approved-decisions)
- [Architecture and key files](#3-current-architecture-and-key-files)
- [Data safety and assessment rules](#4-data-safety-and-assessment-rules)
- [Implemented functionality](#5-existing-functionality-already-implemented)
- [GitHub workflow and tool use](#6-github-workflow-and-tool-use)
- [Testing expectations](#7-testing-expectations)
- [Living project record and update protocol](#10-living-project-record--update-this-continuously)
- [Functional roadmap](docs/V21.2-GYM-WORKOUT-FUNCTIONAL-ROADMAP.md)
- [Repository guide](docs/REPOSITORY-GUIDE.md)
- [Test guide](tests/README.md)

---

# Project Comeback — G3.7.6 service-worker cache reliability checkpoint (2026-11-18)

- Active development branch: `V21.2-development`; `main` unchanged, no deployment.
- Source audit found unhandled background CacheStorage write promises in root and V21.2 service workers. Added best-effort helper `cacheResponseBestEffort()` to explicitly catch cache open/put failures while preserving network response.
- Added 8 tests (root and V21.2 workers × asset/navigation × CacheStorage open/put failure); all pass. Updated catalogue-delivery contract for helper.
- `check.js` and duplicated root/V21.2 assets retained pending source/history confirmation; no deletion or cleanup by assumption.
- Implementation SHA `88678a7143b07b6f777ba5dc442acdef10fe6b54`: backup [#44253049985 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44253049985), browser [#44253050110 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44253050110). Exact final documentation SHA validation pending.
- Do not merge to main or deploy.

# Project Comeback — G3.7.5 failure-path validation checkpoint (2026-11-18)

- Live branch: `V21.2-development`. `main` remains unchanged; no deployment.
- Added tests for malformed JSON, incomplete backup envelopes and duplicate record IDs rejected before writes.
- Added V2 restore rollback test where duplicate alias unique-index values fail after replace writes are queued. Existing data is preserved, incoming writes and safety snapshot are absent; corrected backup retry succeeds.
- Added migration structured-clone failure test. It uncovered a real atomicity defect: a synchronous write exception could reject migration while earlier queued writes committed. `commitLegacyMigration` now aborts and awaits the transaction on any transaction-body exception. Canonical and offline database service mirrors match.
- Implementation exact SHA `59a0353f4a33d80c015e7c298140f0c48e0cd9eb`: backup [#44251671946 PASS — 140 tests, 0 failed](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44251671946); browser [#44251672108 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44251672108).
- Documentation checkpoint validation pending. Do not merge to main or deploy.

# Project Comeback — G3.7.4 cross-store integrity diagnostics checkpoint (2026-11-18)

- Active branch: `V21.2-development`; `main` remains untouched. No merge or deployment.
- Added a read-only cross-store diagnostic service with stable finding codes, severity, source store/record, related reference and explanation. It never auto-repairs or mutates records.
- Coverage: session/exercise/set graph and module consistency; exercise definition/variation, alias and configuration references; identity-review release/reversal/supersession references; programme version/day/slot relationships; catalogue active pointer and optional release references.
- Optional references are not automatically errors; warnings and errors are distinguished. Incoming backup and live database reports are separate in restore preview.
- Added `ProjectComebackIntegrity.diagnoseData`, `diagnoseLiveDatabase`, and `ProjectComebackBackup.validateBackupIntegrity`. Restore preview exposes `integrityDiagnostics.incoming` and `.live`.
- Added integrity test suite, offline mirror, bundle parity, script loading, shell cache v25 and validation workflow coverage.
- Implementation exact SHA `36b60b491ff4ed469e5511a079e8a65120272bb5` passed browser [#44249644375](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44249644375) and backup [#44249644637](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44249644637). The documentation checkpoint is separately validated on its exact final branch head. Do not merge to main or deploy.


# Project Comeback — G3.5 programme progression and Gym history checkpoint (2026-11-18)

- **Active branch:** `V21.2-development`; `main` remains untouched. No merge or deployment.
- **Latest code milestone:** G3.5 programme week/day progression and Gym history implemented. Code SHA `4944be8e9c6a5bf37fd228bcde9337e21648a216`; browser [#44236214382 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44236214382), backup [#44236214450 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44236214450).
- Legacy plan choices restored: 4/8/12 weeks, 2–5 planned days/week, defaults 4 weeks and 2 days. Sequential unlock rules are preserved: Week1 Day1, then prior planned day, then previous week's final planned day to unlock next-week Day1. Manual unlock/relock stored in preferences and cannot bypass days-per-week limits.
- Added `src/modules/gym-progression.js` with offline mirror. Preferences and sessions use existing stores; no schema/store/index/backup-format changes. Session `week` is saved, and resume matching includes week/day/date.
- Gym history shows completed and in-progress sessions with Week/Day, date, status, progress/duration, exercise/set details and Resume action. Browser test verifies in-progress and completed history.
- Browser/backup validation on the code SHA passed; source/offline bundle parity, syntax, engine tests, progression tests, workout/rest/celebration regressions, offline reload and cold-process persistence all passed.
- Service-worker shell cache v23. Artwork unchanged and deferred.
- **Legacy editable weight/reps carry-forward (V19.1) is not included in G3.5.** Consider it separately after core flow; any port must prefill only editable empty fields and never overwrite existing session values.
- Roadmap/handover docs are being updated. Final validation is required on the exact documentation commit SHA before milestone closure. Do not merge/deploy.
- **Next milestone:** G3.6 equipment/manual swaps and progression summaries, source-grounded and design-first.

# Project Comeback — G3.4b save-first workout celebration checkpoint (2026-11-18)

- **Active branch:** `V21.2-development`; `main` remains unchanged at `0d0527a6463c3cfd0fbb54d69123316c9a384b42`. No merge or deployment.
- **Completed immediately before this milestone:** G3.4a Smart Rest Timer. Exact final documentation SHA `2ebb00f1173f5a3ab2e9f404b0728406d0e24f23`; browser #44225800555 and backup #44225800665 both passed.
- **Current milestone:** G3.4b Save-first workout celebration.
- **Save-before-show:** `finishSession()` constructs a completed-session copy, persists it through the existing atomic workout transaction, and mutates the in-memory workout only after that write succeeds. A failed write leaves the session in progress and retryable. The UI opens the celebration only after the save promise resolves. A celebration presentation error cannot reverse the saved workout.
- **Presentation:** accessible native modal dialog with the saved-session confirmation, selected existing GIF, six-second progress indicator and auto-close, Skip celebration and Dismiss controls. Escape/native dialog dismissal closes the overlay; the close action does not write to or mutate session records.
- **Artwork selection:** reused only the three existing verified assets under `v21.2/assets/celebrations/v1/`. Explicit saved profile gender `female` selects `female-celebration.gif`; otherwise Day 1 selects `celebration-day1.gif`, and all other days select `celebration-day2.gif`. No new artwork was generated or added.
- **Persistence safety:** no DB schema/store/index or backup-format change. Service-worker shell cache advanced from v21 to v22 for the UI markup/style/script changes. The celebration GIFs are already covered by the verified 41-asset dedicated offline cache.
- **Regression coverage:** unit test injects a failed finish write and verifies the live session remains in progress with rest context intact, then retries and verifies completed state persistence. Chromium coverage injects a failed write in the real app, verifies no dialog and retry availability, then proves saved-first behaviour, Day 1/Day 2/female GIF choice, Skip, Dismiss, six-second auto-close and unchanged completedAt/updatedAt values after closing.
- **Test fixture integrity:** celebration sessions use dedicated dates three to five days ahead. The browser test waits for date refresh, starts the exact day/date session and verifies it exists in IndexedDB before preparing completed sets. It snapshots and restores the original profile and deletes only its dedicated session/exercise/set fixtures. The earlier in-progress workout is not reused or deleted; the full cold-browser process persistence check passes.
- **CI reliability:** browser workflow now restores/saves Playwright browser binaries with separate cache actions and installs Chromium without repeating OS dependency installation. Cached browser restore and install completed in seconds on the validated run.

**Code validation on exact implementation SHA `9d72d43b5b263221b2d5879648c9ffa65e897420`:**
- Browser/Chromium [#44234292910 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44234292910).
- Backup validation [#44234292767 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44234292767).

**Documentation checkpoint:** the roadmap and this handover are being updated together. The resulting exact branch-head commit must pass both required workflows before G3.4b is closed. Do not amend either document after those final checks; record any next work in a new milestone checkpoint.

**Next milestone:** G3.5 — day/week flow and history. Keep work functional, test-driven and source-grounded. Do not expand artwork or deferred launch scope.


# Project Comeback — catalogue delivery implementation checkpoint (2026-11-17)

- **Active branch:** V21.2-development
- **Implementation decision:** G2 PASS explicitly given by the user on 17 November 2026.
- **Implementation base:** ad4e72d054a009d6500c7cd01f384440068fc4d9 (the exact live branch head inspected before implementation).
- **Latest implementation/gate-correction commit before this handover update:** 9d97bf765b669a165fe8ad81cb1fd6ee800d0cb0 (includes the canonical identity browser-bundle sync and clarifies the historical HOLD versus approved PASS).
- **Delivery service:** src/data/catalogue-delivery.js; identical app bundle: v21.2/assets/catalogue-delivery.js.
- **App wiring:** v21.2/index.html loads the service; v21.2/sw.js shell cache is v16 and precaches the service. Catalogue asset requests bypass generic shell caching; verified release bytes use a dedicated CacheStorage namespace.
- **Atomic activation:** existing V6 IndexedDB stores only: catalogueReleases, exerciseDefinitions, exerciseVariations and metadata. Manifest, system definitions/variations and active pointer commit in one transaction. No database version/index change.
- **Integrity:** exact UTF-8 byte length and SHA-256 before parse; manifest/payload identity, schema, counts, unique IDs and variation parent checks; cache read-back verification.
- **Offline lookup:** ProjectComebackCatalogueDelivery.getStatus() and lookup() require a matching active manifest and complete local materialisation. Unseeded devices report unavailable, not an empty valid catalogue.
- **Verified-only activation:** only the delivery loader writes assetVerificationStatus=verified after byte/payload/cache read-back verification. Legacy metadata-only release records remain unverified and cannot be promoted under the same release ID.
- **Browser regression:** tests/browser-validation.js seeds a clearly test-only synthetic release, verifies materialisation and lookup, reloads the app offline, then verifies lookup and release cache persistence.
- **Release references:** src/data/exercise-identity.js now includes direct programmeSlots pins alongside published programme versions, non-terminal sessions and identity-review events. No garbage collection.
- **Data boundary:** backup format and historical display snapshots unchanged. No automatic history rebinding or legacy migration.
- **Production dataset limitation:** no approved production exercise catalogue dataset was present in the inspected repository. No production asset/manifest was invented or committed. The app remains unseeded until a real catalogue is curated, reviewed and packaged.
- **Out of scope:** lookup UI, remote/CDN distribution, signing/authenticity architecture, schema/index changes, backup-format changes, release GC, merge and deployment.
- **Validation on exact pre-handover SHA `9d97bf765b669a165fe8ad81cb1fd6ee800d0cb0`:** browser #44071011906 **PASS** (bundle parity, identity/catalogue contract tests, IndexedDB tests, Chromium migration and real offline catalogue lookup); backup #44071011865 **PASS**. Earlier browser #44069996933 failed at bundle parity because `src/data/exercise-identity.js` included direct `programmeSlots` references while `v21.2/assets/exercise-identity.js` was stale. The app bundle was synced; gate wording was clarified. Both workflows must still run on this new handover-documentation commit's exact SHA before final closeout.
- **Protected baseline:** main must remain 0d0527a6463c3cfd0fbb54d69123316c9a384b42; V21.1 unchanged. No merge/deployment.
- **Next:** validate both V21.2 browser and backup workflows on the exact final handover SHA, then curate/approve the real catalogue release asset before exposing lookup to users.

---
# Project Comeback — catalogue delivery audit checkpoint (2026-11-17)

- **Active branch:** `V21.2-development`
- **Latest validated design/test commit:** `3db53e95fe2641ec76dc5843a56797383a66913b`
- **Final handover checkpoint commit:** `73176b18be322c4fc085ae5dfe94bc181254524d`
- **Final handover browser #44066737582:** **PASS**, exact SHA matches: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44066737582
- **Final handover backup #44066737544:** **PASS**, exact SHA matches: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44066737544
- **Browser validation #44066426367:** **PASS**, exact SHA matches: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44066426367
- **Backup validation #44066426518:** **PASS**, exact SHA matches: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44066426518
- **Audited base:** `117cb5d98a0e5c16b6fb000d4ba80a4c28e4435e`
- **Design audit:** `docs/V21.2-CATALOGUE-DELIVERY-OFFLINE-AUDIT.md`
- **New G2 gate:** `docs/V21.2-G2-CATALOGUE-DELIVERY-GATE.md` — **HOLD pending explicit user decision**.
- **Regression suite:** `tests/catalogue-delivery-contract.test.js`; added to both workflows. Tests characterize current source and model the proposed release contract; they do not implement catalogue delivery.
- **Recommendation:** immutable versioned JSON + exact-byte SHA-256 manifest; isolated release CacheStorage namespace; verify/stage before one IndexedDB materialisation/active-pointer transaction; preserve the prior release on failure; render history from snapshots without substituting a missing pinned release.
- **Important gaps:** current release registration does not verify asset bytes; generic same-origin GETs share the shell cache that activation later purges; current offline browser test covers the identity service only; release reference scan omits programme-slot pins.
- **Scope boundary:** no catalogue asset, loader, lookup UI, service-worker implementation, schema or backup-format change; no release GC. V21.1 untouched; `main` remains `0d0527a6463c3cfd0fbb54d69123316c9a384b42`; main root `index.html` blob remains `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`. No merge/deployment.
- **Next:** user decision on G2 gate: PASS / HOLD / REVISE / REJECT.

---

# Project Comeback — latest verified checkpoint (2026-11-17)

- **Active branch:** `V21.2-development`
- **Final handover commit:** `464cf0b096879fa749abf923bea858679ecad272`
- **Browser validation #44063585782:** **PASS**, completed; exact `head_sha` matches final handover commit: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44063585782
- **Backup validation #44063585905:** **PASS**, completed; exact `head_sha` matches final handover commit: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44063585905
- **Chromium validation job:** completed successfully.
- **Latest implementation commit:** `505656805288d00a631eff8b1012a3503d8519f5`; browser #44061074418 and backup #44061074385 both passed on that exact SHA.
- **G2 gate:** PASS — bounded canonical identity persistence implementation and final handover validation complete.
- **Protected production `main`:** `0d0527a6463c3cfd0fbb54d69123316c9a384b42`; unchanged.
- **V21.1:** unchanged. No merge or deployment.
- **Data-safety boundary:** no automatic fuzzy legacy identity mapping or promotion of day-scoped settings; no catalogue release garbage collection; no bundled catalogue asset/offline catalogue lookup or catalogue editor is claimed.

## Next source-grounded task

Perform a design-first audit of **exercise catalogue delivery and offline lookup** on the live `V21.2-development` branch. Inspect the actual identity service, app shell, service-worker cache, backup/restore behavior, release-manifest references and tests. Establish how immutable catalogue release assets are packaged, checksummed, selected, retained and made available after offline cold start; distinguish bundled system catalogue data from profile-owned review/configuration data. Identify missing failure/recovery cases (missing or corrupt asset, stale cache, interrupted catalogue update, referenced historical release unavailable, restore on a device without the old asset). Add focused design/contract tests and recommend a bounded delivery model. **Do not implement catalogue assets, lookup UI, schema changes or release garbage collection in this audit.** Prepare a G2 gate before any consequential implementation. Preserve V21.1 and `main`; validate every resulting commit SHA with both browser and backup workflows.

---

# Project Comeback — latest checkpoint (2026-11-17)

- **Active branch:** `V21.2-development`
- **Latest validated implementation commit:** `16ba51225dc255961b7e18718fdb71a041431a9c`.
- **G2 decision:** PASS — user authorised the bounded canonical identity persistence implementation on 17 November 2026.
- **Browser validation:** [#44060658483 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44060658483) — exact SHA `16ba51225dc255961b7e18718fdb71a041431a9c`.
- **Backup validation:** [#44060658543 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44060658543) — exact same SHA.
- **Persistence implementation:** IndexedDB schema v6 is additive and explicit; V1 safety backup is required before upgrade; V2 backup/restore round trip verifies before the safety snapshot is marked complete.
- **Tests:** 26 design-contract tests plus 11 new real IndexedDB persistence/backup tests. Both workflows include the new persistence suite.
- **Offline scope:** the identity service is included in the V21.2 service-worker shell and cold-starts offline. No bundled exercise catalogue asset or offline catalogue lookup is claimed.
- **Historical data:** no automatic identity mapping or legacy preference promotion; exact V21.1 names, keys and raw values remain preserved/unresolved.
- **Protected V21.1:** root `index.html` blob remains `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`.
- **Production `main`:** remains `0d0527a6463c3cfd0fbb54d69123316c9a384b42`; no merge or deployment.
- This handover update must itself receive fresh browser and backup validation on its exact commit SHA before the branch head is called fully validated.

---

# Project Comeback — live handover status

> **Checked against GitHub:** 17 November 2026. This summary is a navigation aid; the live branch, source files and workflow runs remain authoritative.

## Current state

- **Active development branch:** `V21.2-development`
- **Latest design/test checkpoint:** `e6bd0fd969bd2127e4d71bad9174933c5d0ed09d`
- **Design checkpoint browser validation:** [run #44052088969 — success](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44052088969)
- **Design checkpoint backup validation:** [run #44052088959 — success](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44052088959)
- **Previous handover checkpoint:** `86b21f15a89c60a793dbd424f4568296d74f5569`
- **Previous handover browser validation:** [run #44052262475 — success](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44052262475)
- **Previous handover backup validation:** [run #44052262537 — success](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44052262537)
- **Design proposal:** [V21.2 canonical exercise identity model](docs/V21.2-CANONICAL-EXERCISE-IDENTITY-DESIGN.md)
- **Design acceptance tests:** `tests/exercise-identity-contract.test.js` (9 tests; included in both workflows).
- Every new code or documentation commit must receive fresh browser and backup validation on its exact SHA before closeout.
- **Protected V21.1 source:** root `index.html` remains at inspected baseline blob `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`.
- **Production boundary:** `main` remains at `0d0527a6463c3cfd0fbb54d69123316c9a384b42`; no merge or deployment is authorised.

## Immediate work in progress

1. Source inspection confirmed V21.2 has session-scoped exercise records, but no canonical exercise catalogue or reusable exercise IDs.
2. Added a design-only model separating exercise definitions, variations, performed records, equipment definitions, programme versions, version-scoped slots, aliases and reusable configuration.
3. Added nine design acceptance tests covering opaque IDs, variations, equipment references, programme-version/slot lineage, exact verified aliases, unresolved collisions, historical preservation, configuration scope and performed-record identity.
4. Both workflows run the design acceptance tests. Browser workflow also retains bundle-parity and Chromium migration/offline tests; backup workflow retains the existing backup/migration/programme test suite.
5. **No application implementation, IndexedDB schema, V21.1 source, or historical user data was changed in this checkpoint.**
6. Next: review open model decisions, then implement the catalogue/service and schema incrementally with tests first. Do not treat the design fixtures as evidence that the application already supports these entities.

## Current design direction

- Immutable opaque IDs are separate for exercise definitions, exercise variations, performed records, equipment definitions, programme versions and version-specific slots.
- Exact verified aliases may resolve source names. Normalised matching is suggestion-only.
- Name-derived legacy configuration preferences that have lost distinguishing information remain unresolved.
- Unresolved performed records retain exact names, raw JSON and set values; no fuzzy cross-session history grouping.
- Published programme versions are immutable. New versions get new slot records; logical slot lineage can continue across versions.
- Reusable configuration is keyed by profile + canonical definition + optional variation/equipment context. Programme prescriptions and actual performance remain separate.
- The full proposal and test boundaries are in the linked design document.

## Live audit checklist

- [x] Inspect live branch, database schema, Gym migration, Programme Manager, existing tests and workflows before editing.
- [x] Inspect V21.1 exercise/programme definitions read-only.
- [x] Add source-grounded characterization tests for legacy name collisions and session-scoped exercise records (previous checkpoint).
- [x] Write canonical exercise identity design proposal without implementing it.
- [x] Add nine design-level acceptance tests before application implementation.
- [x] Add the acceptance tests to both browser and backup workflows.
- [x] Browser and backup workflows passed on design/test commit `e6bd0fd969bd2127e4d71bad9174933c5d0ed09d`.
- [x] Previous handover commit `86b21f15a89c60a793dbd424f4568296d74f5569` passed both workflows on its exact SHA.
- [ ] Validate the current handover-documentation commit on its exact SHA before closeout.
- [ ] Review open decisions (variation taxonomy, catalogue delivery, programme day/slot lineage, config boundaries).
- [ ] Only then implement the data model and services on `V21.2-development`.

---

# Project Comeback — ChatGPT Continuation & Development Manual

**Purpose:** This is the handover guide for continuing Project Comeback in a new ChatGPT conversation. Attach or paste this file at the start of a new chat and say: “Continue Project Comeback using this handover manual. First inspect the live GitHub branch and verify the current state before making changes.”

**Repository:** `richardblades1980-prog/gym-comeback-app`  
**Active development branch:** `V21.2-development`  
**Protected baseline:** `V21.1B.2.1` / V21.1  
**Production branch:** `main`  
**Current workstream:** V21.2A

---

## 1. Non-negotiable operating rules

1. Work only on `V21.2-development` unless the user explicitly authorizes a different branch.
2. Never modify V21.1, `V21.1B.2.1`, or production `main` during V21.2A development.
3. Never merge, deploy, or promote to production without explicit user authorization and successful validation.
4. Before editing, fetch the current branch head and the exact files being changed. Do not rely only on this manual or old chat summaries.
5. Make small, focused commits. After each meaningful change, inspect the diff/commit and wait for relevant GitHub Actions to finish.
6. Do not report tests as passed until the corresponding run is completed with conclusion `success`. A running check is not a pass.
7. If a check fails, inspect its job logs, identify the actual failing assertion or behavior, fix the cause, commit on the development branch, and rerun.
8. Preserve existing user data. Do not clear, overwrite, migrate, or reset real user records as a shortcut to testing.
9. Never invent data, recovery scores, progress, test results, or capabilities. Missing measurements remain missing.
10. Keep the product's initial-release scope separate from future enhancements and commercial opportunities.
11. The user prefers careful, unhurried development and clear progress updates. Do useful work directly when repository tools are available; do not ask the user to repeat decisions already in this guide.
12. User shorthand in stepwise workflows: **D = DONE**, **N = NO**.

## 2. Product scope and approved decisions

### Initial release
- Core Gym and Hiking functionality.
- Shared exercise library.
- Adaptive progression and recovery.
- Offline operation.
- Profiles and user data ownership.
- Manual hiking recording.

### Explicitly deferred
- GPS and route mapping.
- Video demonstrations.
- Additional languages.
- Advanced integrations and analytics.

Sponsorship, premium features and equipment partnerships are commercial opportunities, not launch dependencies.

### Progress journey (approved direction)
The dashboard should eventually show how far a person has come, not only today's performance.

Gym examples: personal bests, strength improvements, repetitions/resistance progression, training volume and consistency.

Hiking examples: longest walk, total distance, elevation gained/lost, longest continuous duration, backpack-load progression, completed trails/multi-day hikes, pace and endurance.

Overall: monthly/yearly/lifetime progress, starting point versus current ability, milestones, recovery/mobility trends and periods of improvement or maintenance.

Use actual recorded data only. Any demo data must be clearly labelled illustrative. A visual timeline should help the user look back at where they started.

### Before and Now (approved)
- Record an original baseline assessment.
- Compare it with the latest assessment and with any selected historical assessment.
- Initial measures: comfortable walking duration (minutes), step-ups (whole repetitions), and single-leg balance (seconds).
- Preserve the original baseline permanently; a break or reduced activity must never reset achievements.
- Missing values are not zero and must not produce an invented difference.
- Follow-up assessments are unavailable until the original baseline is saved.
- Follow-up dates may be the same as the original baseline date or later, but never earlier. Both UI and service-layer validation enforce this sequence.

### Personal progress photos (approved subject to security)
Optional, private by default, visible only to the account owner; not publicly accessible by shared image URL; encrypted at rest and in transit; authentication and server-side access controls; excluded from public profiles/search/community. Never promise absolute protection from hackers. These requirements are approved but are not implemented yet.

## 3. Current architecture and key files

The application is a local-first browser app with IndexedDB and a service-worker offline shell.

- `v21.2/index.html` — application structure and script loading order.
- `v21.2/app.js` — application behavior, view navigation, forms and rendering.
- `v21.2/app.css` — dark interface styling.
- `v21.2/sw.js` — service-worker shell cache; increment cache version when changing offline-shell assets.
- `src/data/database.js` — canonical IndexedDB implementation.
- `v21.2/assets/database.js` — browser-delivered database bundle.
- `src/data/backup.js` and `v21.2/assets/backup.js` — backup/restore logic.
- `src/progress/assessment-manager.js` — canonical assessment history service.
- `v21.2/assets/assessment-manager.js` — browser-delivered assessment service.
- `tests/browser-validation.js` — end-to-end browser validation.
- `tests/check-v21-2-bundle.js` — source/bundle parity checks.
- Other modules include module registry, programme manager, workload summary and migration services.

When changing canonical source and a browser bundle, keep them synchronized and run bundle-parity validation. Check the HTML script load order before introducing dependencies.

## 4. Data safety and assessment rules

IndexedDB database name: `ProjectComebackDB`. Current schema version: **5**. The `assessments` store has date and kind indexes.

Assessment service API:
- `ProjectComebackAssessments.metrics`
- `ProjectComebackAssessments.baselineId` (stable value: `original-baseline`)
- `getBaseline()`
- `createBaseline(input)` — write-once; duplicate baseline must be rejected.
- `addFollowUp(input)` — immutable dated snapshot; duplicate IDs rejected.
- `listHistory()`
- `compare(first, second)`
- `compareBaselineToLatest()`

Metric keys:
- `comfortableWalkMinutes`
- `stepUpsReps`
- `singleLegBalanceSeconds`

Validation requirements:
- Date must be a real ISO date `YYYY-MM-DD`.
- Values must be finite and non-negative.
- Step-up repetitions must be whole numbers.
- At least one measurement is required.
- Unknown metric keys are rejected.
- Notes are optional and limited to 1,000 characters.
- Comparison difference is `null` if either assessment lacks that measure. Never coerce absence to zero.
- `addFollowUp(input)` must reject when no original baseline exists and reject any follow-up date earlier than the baseline. Same-day follow-ups are valid.

Backups/restores must include assessment records. Browser cold-start persistence must be tested. Do not modify the protected baseline in a test to make a test pass.

## 5. Existing functionality already implemented

- Seven-day overview of upcoming Gym and Hiking activities, grouped by date.
- Separate completed Gym and Hiking summaries for the last 30 days.
- Weekly completed session counts and actual recorded minutes, kept separate by module.
- Missing durations clearly identified; no guessed duration.
- Thirty-day planning outlook with Gym and Hiking totals and planned durations kept separate.
- Readiness is only acknowledged as an entry; no invented score or automatic programme change.
- Module pause/re-enable preserves existing records.
- Full backup and explicit-preview/confirmation restore.
- Optional V21.1 Gym-data migration with a downloadable safety snapshot; original source keys retained.
- Offline shell and browser cold-start persistence validation.

## 6. GitHub workflow and tool use

Use the GitHub connector tools through `functions.exec` (Code Mode). Discover current schemas in `ALL_TOOLS` rather than guessing.

Useful tools:
- `mcp__GitHub__fetch` — GitHub REST endpoints, including Actions runs/jobs and branch head.
- `mcp__GitHub__fetch_file` — retrieve a file at an explicit ref.
- `mcp__GitHub__update_file` — update an existing file; use the current blob SHA and explicit branch.
- `mcp__GitHub__create_file` — create a new file on an existing branch.
- `mcp__GitHub__compare_commits` — compare branch refs and inspect changed files.
- `mcp__GitHub__fetch_commit` — inspect commit metadata/diff.
- `mcp__GitHub__fetch_workflow_job_logs` — inspect failed or completed job logs.

To inspect push-triggered Actions runs (the convenience workflow-runs wrapper may only return PR-triggered runs), call the REST endpoint:
`https://api.github.com/repos/richardblades1980-prog/gym-comeback-app/actions/runs?branch=V21.2-development&per_page=20`

Then inspect jobs:
`https://api.github.com/repos/richardblades1980-prog/gym-comeback-app/actions/runs/RUN_ID/jobs`

For each run, check `status`, `conclusion`, `head_sha`, URL and job conclusions. Inspect logs for any failure. Confirm the run's SHA matches the current branch head before describing the branch as fully validated.

Example Code Mode pattern:
```js
const r = await tools.mcp__GitHub__fetch({
  url: "https://api.github.com/repos/richardblades1980-prog/gym-comeback-app/actions/runs?branch=V21.2-development&per_page=20"
});
const data = JSON.parse(r.result.content);
text(data.workflow_runs.slice(0, 10).map(run => ({
  id: run.id,
  name: run.name,
  status: run.status,
  conclusion: run.conclusion,
  head_sha: run.head_sha,
  html_url: run.html_url
})));
```

When updating files, always fetch the file first and pass its current `sha`. For multiple edits to the same file, do them sequentially, never concurrently. Include `branch: "V21.2-development"` explicitly.

## 7. Testing expectations

At minimum, before calling an assessment UI change complete:
- Browser UI creates an original baseline and locks it after save.
- Follow-up assessments can be added repeatedly.
- History lists all snapshots in date order.
- Any two different saved assessments can be selected for comparison.
- Missing values display as “Not recorded” / “Not comparable”, never zero.
- Positive/negative differences and units are clear.
- Duplicate baseline and duplicate follow-up IDs are rejected.
- Backup/restore includes assessments.
- Records survive reload and a full browser-process restart.
- Offline shell serves the updated UI.
- Source/bundle parity passes.
- Existing migration, schedule, workload and backup tests still pass.

After changing `index.html`, `app.js`, `app.css`, or scripts required offline, bump the service-worker cache name in `v21.2/sw.js`.

## 8. Assessment UI implementation history

The original assessment data foundation and UI were implemented on `V21.2-development`:
- Immutable original baseline with stable ID `original-baseline`.
- Dated follow-up snapshots with history list and selectable Before & Now comparisons.
- Missing measures remain absent and display as not recorded/not comparable.
- Baseline and follow-up form submission guards prevent rapid duplicate records.
- The UI is included in the browser bundle and service-worker shell; the service-worker cache was previously bumped to v8.
- Full implementation and current validation status are maintained in section 10 below.

Earlier implementation and validation corrections remain in the change log. Do not treat older failed intermediate CI runs as the current state; use run links matching the exact live branch head.

## 9. How the user wants collaboration to work

- Give concise, meaningful progress updates when a milestone is reached or a problem is found.
- Do not flood the user with routine internal steps.
- Explain what changed, why it matters and whether validation passed.
- Be honest about what is implemented versus merely designed/approved.
- If the repository or tools are unavailable in a new chat, explain that clearly and ask the user to reconnect or provide the relevant files; do not pretend to have committed code.
- Never ask the user to repeat context already contained in this guide.


---

## 10. Living project record — update this continuously

**This manual is the single source of continuity for future chats.** Do not create a separate disconnected summary unless the user asks for one. Keep the stable rules/decisions above and maintain this living record below.

### Update protocol (required)

At the start of every new chat or resumed work:
1. Read this manual from the live GitHub development branch.
2. Check the live branch head SHA and recent GitHub Actions runs.
3. Compare the live repository state with the “Current status” and “Recent change log” below. The repository is authoritative for code; this manual is authoritative for recorded decisions and working method.
4. If a conflict exists, do not guess. Inspect commits/files and record the resolved fact.
5. Continue from the listed next action without asking the user to repeat known information.

During development:
1. When the user makes a product decision, add it to the approved decisions section with date/context; distinguish **approved**, **proposed**, **deferred**, and **rejected**.
2. When a development method proves useful, add it to the operating method section so it is reused.
3. After each meaningful implementation milestone, update the recent change log with date, commit SHA, files/features, and test status.
4. When CI starts, record run IDs/links and mark them **running**. When finished, replace that status with the exact conclusion and commit SHA. Never leave a running test described as passed.
5. Before ending a work session or chat, update Current status and Next actions. Commit the manual update on `V21.2-development`.
6. Do not overwrite earlier log entries. Append new entries so the development history remains traceable.
7. Keep this file concise enough to use, but detailed enough that another ChatGPT session can resume without reconstructing decisions from old chats.

### Proven working method (retain and improve)

**Repository editing**
- Use GitHub connector Code Mode directly; inspect `ALL_TOOLS` for current tool names/schemas if necessary.
- Fetch the live file and current blob SHA before each update.
- Always specify the development branch explicitly.
- Never run simultaneous writes to the same path.
- Prefer small commits, each with a single purpose.
- Fetch the resulting branch head/commit and verify that the write landed where expected.

**CI discovery**
- Use GitHub REST via `mcp__GitHub__fetch` to list Actions runs by branch. The wrapper `fetch_commit_workflow_runs` can miss push-triggered runs.
- Match each run's `head_sha` to the commit under test.
- Poll the run details/jobs until `status=completed`; inspect logs on failure.
- A later commit can trigger new runs while older runs are still running. The latest branch head's checks are the ones that determine current validation status.
- Browser validation includes source/bundle parity, Chromium, migration and offline/browser checks; backup validation covers backup/restore data behavior.

**Test discipline**
- Test actual user-facing UI as well as service-level behavior.
- Include persistence/reload/cold-start/offline coverage for local-first functionality.
- Do not let test-only records leak into production or user data. Use isolated browser profiles and clean up seeded records where appropriate.
- Validate backup/restore and data migration whenever changing stored record structures.
- Check browser console/page errors and meaningful empty/error states, not only happy paths.
- If a UI test is brittle because it assumes localized date text, prefer stable IDs/data attributes or exact ISO values in test assertions rather than locale-dependent fragments.

**User collaboration**
- Give short milestone updates when useful, not constant play-by-play.
- Explain failures plainly and report the fix and rerun outcome.
- Keep the user involved in product decisions; do not silently expand scope.
- Do not ask the user to restate decisions captured here.
- Treat the user’s “D” and “N” shorthand as above.

### Current status — last checked 17 November 2026

- Active development branch: `V21.2-development`.
- Gym recorded-load progression implementation is on the active branch; latest feature commit before this manual update is `ef951f508f08c389fbd10e37188ef95b63e9bca9`.
- Browser validation for that exact feature commit: **success**, run [#44036619049](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44036619049).
- Backup validation for that exact feature commit: **success**, run [#44036619300](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44036619300).
- Source audit: the production `main` app identifies itself as V21.1B.2.1 (main commit `0d0527a6463c3cfd0fbb54d69123316c9a384b42`; `index.html` blob `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`). The release notes `README-V21.1B.2.txt` and `VERSION-V21.1B.2.txt` were also inspected.
- Original Gym UI labels exercise-set weight as `Weight (kg)`, numeric input `min=0`, `step=0.5`. Bodyweight/mobility weight fields are hidden by default but can be shown to record added resistance. The UI records normal reps, timed holds, and timed reps separately; timed reps store weight where applicable, actual time and reps.
- Original progress logic groups weighted sets by exact exercise name, uses positive recorded weights and displays kg; its strength chart selects the heaviest recorded set per workout date. It does not label the trend as a one-rep maximum. The new V21.2A summary follows the same evidence boundary but uses completed sessions only.
- Gym exercise history now calculates each exercise's heaviest positive recorded set per dated completed session, compares the first and latest dated load, and states the change in kg. Missing/zero/invalid loads do not enter the comparison; undated sessions remain visible in the raw history but are not used in the dated comparison. Same-day entries are consolidated to the highest recorded load for that date.
- The comparison explicitly says these are recorded loads, not a one-rep maximum. It does not claim strength improvement or infer technique, effort or physiological adaptation.
- Browser regression uses the same exercise over two completed dates (15 kg then 20 kg) and verifies the displayed comparison is +5 kg. The incomplete session is excluded; missing reps remain explicit. Browser run #44036619049 and backup run #44036619300 both passed for the exact feature commit.
- Offline shell cache is v14 for the updated app assets.
- No merge or deployment has been performed. `main` and the protected V21.1 baseline remain untouched.

### Recent change log

| Date (UTC) | Commit | Change | Validation |
|---|---|---|---|
| 2026-11-17 | `71ac15a` | Corrected IndexedDB integration test for schema version 5 | Browser #134 and backup #226 passed |
| 2026-11-17 | `68799a7` | Added assessment navigation and screen structure | Follow-up checks triggered |
| 2026-11-17 | `00a7253` | Wired original baseline and follow-up assessment forms and comparisons | Browser #136 and backup #228 passed |
| 2026-11-17 | `5eb83f5` | Added assessment screen styling | Backup #229 passed; browser run later superseded |
| 2026-11-17 | `c182d60` | Bumped offline shell cache to v8 during assessment UI implementation | Browser #138 and backup #230 passed |
| 2026-11-17 | `c200531` | Added browser regression test for assessment UI | Later browser checks exposed test sequencing issues; backup #231 passed |
| 2026-11-17 | `ac327d6` | Reloaded seeded assessment records before UI assertions | Later browser checks continued |
| 2026-11-17 | `87f566c` | Added this handover manual to the repository | Browser and backup checks were running at the time |
| 2026-11-17 | `34533cf` | Moved first-keyboard-focus skip-link test to immediately after app load | Backup #44007617283 passed; browser run superseded |
| 2026-11-17 | `8f86c2d` | Added persistent browser-context cleanup on browser-test failure paths | Backup #44008583130 passed; browser #44008583074 exposed stale initial-navigation assertion |
| 2026-11-17 | `94028b8` | Corrected navigation accessibility test sequencing while preserving first-load and tab-change checks | Browser #44008882136 and backup #44008882122 passed |
| 2026-11-17 | `fc17d64` | Added in-flight guards to prevent duplicate baseline/follow-up submissions | Browser #44010024786 and backup #44010024901 passed |
| 2026-11-17 | `7e652de` | Added rapid repeated-submit browser regression test | Rapid double-submit assertion passed; restore count expectation then updated |
| 2026-11-17 | `a68cd16` | Aligned restore and cold-start assessment count assertions with dynamic test setup | Browser #44010251181 and backup #44010251174 passed |
| 2026-11-17 | `886c90f` | Added service-layer requirement for baseline before follow-ups and date ordering | Intermediate browser run detected unsynced canonical/browser bundle |
| 2026-11-17 | `47d12e4` | Added UI baseline gate, follow-up status guidance, and minimum date | Intermediate checks detected stale browser service bundle |
| 2026-11-17 | `adb0ef2` | Added follow-up lock explanation and disabled initial form controls in HTML | Intermediate checks detected stale browser service bundle |
| 2026-11-17 | `429154a` | Added browser tests for no-baseline rejection, earlier-date rejection, same-day allowance and UI unlock/date minimum | Intermediate parity run failed because browser bundle had not yet been synchronized |
| 2026-11-17 | `e0241d2` | Synchronized browser assessment service with canonical baseline sequencing rules | Browser #44011654605 and backup #44011654603 passed |
| 2026-11-17 | `fb74a54` | Refresh assessment history and baseline gate after restoring backup data | Browser #44012152284 and backup #44012152325 passed |
| 2026-11-17 | `b3249f6` | Added specific comparison guidance for no assessments, one baseline and selectable pairs | Browser #44012776836 and backup #44012756773 passed |
| 2026-11-17 | `5c54dbb` | Updated initial HTML fallback guidance for the no-assessment comparison state | Backup #44012776733 passed; browser run for a later commit superseded |
| 2026-11-17 | `01ac4dc` | Added browser coverage for zero-assessment and single-baseline comparison messages | Browser #44012916881 and backup #44012916874 passed on subsequent cache-bumped head |
| 2026-11-17 | `dc2ff16` | Bumped offline shell cache to v8 for stage-specific assessment comparison guidance | Browser #44012916881 and backup #44012916874 passed |
| 2026-11-17 | `09c4541` | Added the Overview progress-journey section | Included in later validation |
| 2026-11-17 | `49dfc41` | Rendered chronological assessment milestones with changes from original baseline | Included in later validation |
| 2026-11-17 | `eb44f65` | Added responsive visual timeline styling | Browser #44013395826 and backup #44013395782 passed |
| 2026-11-17 | `8793f8a` | Added browser checks for the baseline and follow-up journey milestones | Included in final validation |
| 2026-11-17 | `f57be83` | Bumped offline shell cache to v9 for the assessment journey timeline | Browser #44013474634 and backup #44013474727 passed |
| 2026-11-17 | `77305c5` | Updated handover with the assessment comparison empty-state and first Visual Progress Journey milestone timeline | Browser #44013768316 and backup #44013768250 passed |
| 2026-11-17 | `13d8787` | Added Hiking progress milestones to Overview; updated browser regression and offline shell cache to v10 | Browser #44034519659 and backup #44034519611 passed |
| 2026-11-17 | `7a7a6b5` | Added Gym journey milestones and regression coverage for completed sessions, exercises, sets, recorded repetitions and missing reps; bumped cache to v11 | Backup #44035006110 passed; browser #44035005995 failed on an over-escaped digit regex |
| 2026-11-17 | `8e203be` | Corrected numeric repetition validation in the Gym journey | Backup #44035130664 passed; browser run #44035130679 superseded by final cache-bumped head |
| 2026-11-17 | `1e64cd9` | Bumped offline shell cache to v12 after the Gym repetition fix | Browser #44035146696 and backup #44035146473 passed |
| 2026-11-17 | `a77c279` | Added dated Gym exercise history grouped by exercise, with saved set values and explicit no-unit/no-improvement wording; bumped shell cache to v13 | Backup #44035610739 passed; browser #44035610941 failed on an outdated summary test expectation |
| 2026-11-17 | `4769bc6` | Updated browser regression expectations for two completed sessions and four sets in the Gym history fixture | Backup #44035745360 passed; browser #44035745340 exposed a downstream workload count assertion that also needed updating |
| 2026-11-17 | `50bb56e` | Updated the existing workload test to expect two completed Gym records after adding the dated history fixture | Browser #44035968465 and backup #44035968444 passed |
| 2026-11-17 | `9b50c20` | Added per-exercise dated heaviest recorded-load comparison in kg, based on completed sessions; raw history remains visible | Browser and backup checks completed on subsequent cache/style head |
| 2026-11-17 | `ef951f5` | Finalized Gym load-trend styling and bumped offline shell cache to v14 | Browser #44036619049 and backup #44036619300 passed |

| 2026-11-17 | `f3b2863` | Added browser regression coverage for same-day load consolidation, single-point trends, missing/undated/invalid loads and explicitly saved bodyweight resistance | Backup #44037390136 passed; browser #44037389938 was running when this handover update was prepared |


### Cold-start persistence validation and startup readiness
- Investigated browser validation failure on commit `18af847109fa2c1615fc6d844eab289195e8e999`: cold-start test reopened the same Chromium profile and read Overview counters immediately after the UI announced "Local database ready". The three counters still showed their initial em-dash placeholders while assessment count was available. This was a UI readiness race; the original assertion did not independently check the underlying Gym/Hiking/schedule stores, so no data-loss claim was made.
- Updated `v21.2/app.js` so startup waits for `refresh()`, `refreshAssessments()` and `inspectMigration()` before announcing "Local database ready". Commit `ce3289be254c4791f8da0a5e109ddf76b0f34fdc`.
- Strengthened `tests/browser-validation.js` cold-start assertion to check both visible Overview counts and direct IndexedDB counts for `sessions`, `hikingRecords`, `schedules` and `assessments`. Commit `54285d281832a9c8ee0f2d3e190091f20eacca53`.
- Latest branch head verified as `54285d281832a9c8ee0f2d3e190091f20eacca53` on `V21.2-development`; no production branch changes.
- Browser validation #44040162794 passed on the exact latest head: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44040162794
- Backup validation #44040162938 passed on the exact latest head: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44040162938
- Earlier startup-readiness commit browser validation #44040134709 also passed: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44040134709
- Note for later review: the successful browser log still contains a non-fatal `IndexedDB transaction failed.` page error during assessment UI testing; assessment tests and full browser validation nevertheless passed. Investigate its originating operation before treating it as harmless.

### Working-session interaction protocol additions (2026-11-17)
- When work is complete and user input is needed to continue, clearly say ready and provide a functioning **Next** button.
- When GitHub Actions or another asynchronous process is still running, give an estimated check-back time and check the result directly when possible; do not imply completion while it is pending.
- At the end of a chat/page, prepare a compact, current handover with project/task, branch/head, completed work, remaining work, validation links/status, decisions and exact next action. Provide a **Copy handover** button so the user can paste it into the next chat. Keep the repository handover manual as the durable source of truth.

### Next actions (resume here)
1. Investigate the non-fatal IndexedDB transaction page error seen during assessment UI testing; identify its originating operation and determine whether it is an expected rejected test operation or an actual application defect.
2. Inspect migrated Gym data semantics for historical exercise-name consistency, date completeness and optional bodyweight-load records; preserve exact names and do not fuzzy-match different movements.
3. Consider additional Gym progress measures only where source fields and units are explicit. Keep Hiking separate and do not infer personal bests, one-rep maximums, technique or physiological strength gains.
4. Keep all work on `V21.2-development`; inspect live head and exact run SHAs after each change. Do not merge or deploy without explicit approval.
5. Keep this handover manual updated with decisions, implementation commits, validation links and next actions.


### IndexedDB duplicate-key rejection fix (2026-11-17)
- Root cause confirmed from the browser run: the assessment regression deliberately calls `addFollowUp` with an existing ID. The IndexedDB request rejection was caught by the test, but `withStore` also created a transaction-completion promise that rejected on the same aborted transaction and was left unobserved.
- Updated `withStore` in `src/data/database.js` and the matching `v21.2/assets/database.js` bundle to await the work promise and transaction-completion promise together via `Promise.all`, ensuring both rejection paths are observed while preserving the original failure.
- Added a browser assertion that fails if the expected duplicate-ID rejection emits any application `pageerror`.
- Final code/test head: `7467f5e514e7e674f12e0f92334c4eaa425e4d97`.
- Browser validation #44043893868 passed on that exact SHA: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44043893868
- Backup validation #44043893795 passed on that exact SHA: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44043893795
- The browser log explicitly reports: `PASS assessment UI ... duplicate ID protection without unhandled page errors`.
- An intermediate browser run on the canonical-source-only commit failed the source/bundle parity gate as expected before the matching browser bundle was updated. The final head has parity and both checks pass.

### Migrated Gym data semantics audit (2026-11-17)
- The V21.1 source stores each workout under one `gym-comeback-w{week}-d{day}` key. A saved workout contains its own date, body weight, session/cardio fields and exercise array; each exercise stores its displayed name, set count, progression/recording preferences, set entries, notes, RIR and response.
- Legacy set-completion state is stored separately under keys containing week, day, workout date (or `undated`) and an active-session token. Each set-state key is the exact exercise name plus `::` plus set number. The migration's exact-name lookup is therefore correct; do not normalize, fuzzy-match, merge or rename exercise names during migration.
- The legacy UI permits 1–8 sets. The migration's 1–8 clamp matches the historical UI control, but the original raw workout JSON is retained alongside the typed session and exercise projection.
- Workout date can be absent; current migration correctly represents an absent/non-regex date as `null`, so it is not eligible for dated progress trends. Follow-up review noted that the current regex accepts impossible calendar dates such as `2026-02-30`; consider tightening validation and adding a regression before treating all non-null migrated dates as calendar-valid.
- The legacy weight field is labelled `Weight (kg)`, has minimum 0 and step 0.5. It is hidden by default for bodyweight/mobility exercises but can be shown to record added resistance. Set weight is migrated as its original string (or empty string) and raw set data is retained; no extra bodyweight category is inferable from the saved exercise object alone, so do not reinterpret missing values or infer body mass / added load.
- The migrated exercise record retains the source exercise name verbatim when present. Current fallback text `Exercise N` for a missing/non-string name is a possible invented label; consider retaining an empty/unknown name with a warning instead. No actual user legacy dataset was available in this audit, so no claim is made about the user's personal records, missing dates or exercise-name consistency.
- Next: decide and test the two migration hardening items (strict calendar-date validation and no fabricated fallback exercise name), then continue the data semantics audit only from actual source evidence. Preserve all raw legacy values and keep the V21.2 development branch isolated.

### Current validated state
- `V21.2-development` latest verified feature/test commit: `7467f5e514e7e674f12e0f92334c4eaa425e4d97`.
- Production `main` remains untouched. No merge or deployment has been performed.
- Next actions: (1) harden Gym migration date/name edge cases with focused tests if confirmed appropriate; (2) verify the branch head and both Actions checks for every resulting commit; (3) continue only source-grounded Gym progress semantics; (4) update this handover after each meaningful increment.


### Gym migration date/name hardening implemented (2026-11-17)
- Updated `src/data/gym-migration.js` and the byte-identical `v21.2/assets/gym-migration.js` browser bundle.
- Added strict calendar-date validation: value must be a `YYYY-MM-DD` string and round-trip as the same UTC calendar date. Impossible dates (e.g. `2026-02-30`) now become `null`/undated and emit a warning. Truly absent dates remain undated without a warning. Valid leap days remain accepted.
- Removed fabricated `Exercise N` fallback labels. Missing, whitespace-only, non-string or malformed exercise entries now produce an empty name plus a warning; exact supplied names, including whitespace and punctuation, are retained verbatim.
- Completion inference remains `incomplete` whenever any exercise has no usable name, because there is no reliable exact legacy set-status key to verify for that exercise.
- The original workout JSON remains in `session.legacyRawValue`; individual exercise source objects remain in exercise `legacyRawValue`.
- Added four focused regression tests covering impossible dates and raw preservation, valid leap day and absent date, exact exercise-name preservation plus missing name, and malformed exercise entry.
- One initial regression fixture failed because its status-snapshot key still contained the old date after the fixture changed to leap day. This was a test-fixture mismatch, not a migration defect; the fixture now moves the status key to the new date. Final checks below are on the corrected test commit.
- Final code/test commit: `30ad98f2e1deeb982f3a8ab0e42a088b777f3338`.
- Browser validation #44045271489 PASS on exact SHA `30ad98f2e1deeb982f3a8ab0e42a088b777f3338`: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44045271489
- Backup validation #44045271410 PASS on exact SHA `30ad98f2e1deeb982f3a8ab0e42a088b777f3338`: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44045271410
- Bundle parity step passed on the browser run.

### Current next actions
- Continue the source-grounded Gym progress data audit; do not infer 1RM, physiological strength gain, technique, effort or bodyweight load from missing fields.
- Preserve Hiking as a separate activity. Use only explicit recorded hiking fields.
- Keep all work on `V21.2-development`; production `main` remains untouched and no merge/deployment is authorised.
- Read the live branch head and current file blob SHA before edits; verify both Actions checks against the exact final SHA after each meaningful increment.

### Gym historical data audit — same-date evidence and optional resistance (2026-11-17)
- Rechecked the live V21.2 migration, browser bundle, regression tests and the protected V21.1 source. Production main remains read-only and unchanged.
- Legacy completion state is stored in separate localStorage keys containing week, day, workout date (or undated) and an active-session token. The saved workout JSON does not contain that token. If more than one status snapshot exists for the same week/day/date, the migration cannot prove which snapshot belongs to the saved workout record.
- Updated src/data/gym-migration.js and the byte-identical v21.2/assets/gym-migration.js: when multiple same-date status snapshots exist, keep all evidence keys and original workout JSON, emit an ambiguity warning, and leave the migrated session incomplete. Do not select the first/last snapshot or infer completion from one of them.
- Added regression coverage with two same-date snapshots that disagree on set completion. Code/test commit: c233d1c848f9930686aa075dd579dbcdffe82ba6. Browser #44047273553 PASS and backup #44047273605 PASS on that exact SHA.
- Further audit of V21.1 index.html (blob e3eb0093648cc6c5d706bb5b1008b58ec01a5576): the workout collect() stores each set's weight input as its entered string, defaulting to an empty string. Bodyweight/mobility weight fields are hidden by default but may be shown to record added resistance. There is no separate persisted exercise-type flag in each saved exercise object that would justify reconstructing a blank load.
- Migration already preserves each set weight as a string (or empty string) and preserves the full raw set and workout values. Added a focused regression proving a blank optional resistance stays blank and an explicitly entered 2.5 stays 2.5, with raw values preserved. No bodyweight, zero-load or added-resistance inference is made.
- The original V21.1 app uses exact exercise-name matching for completion-status keys and exact matching when applying a saved workout to the active exercise list. Some other legacy functions (cross-week prefill and historical exercise display) use a normalized name comparison. This is a separate legacy behavior and a potential collision risk for punctuation/spacing variants; the migration continues to preserve names verbatim and does not adopt normalized/fuzzy matching. No actual user legacy dataset was available, so no claim is made about the user's own name consistency or missing records.
- Optional resistance regression commit: 3a37114bf115bcdb433b1895f1bde97498a50efa. Backup validation #44047763668 PASS and browser validation #44047763627 PASS on the exact SHA. Browser run completed successfully, including bundle parity and Chromium migration/offline tests.
- Current audit principle: keep exact exercise names; keep absent dates undated and invalid dates warned/undated; retain raw source values; keep blank weights blank; use only explicitly saved resistance values. Do not infer exercise classification, body mass, added load, completion, or physiological improvement from missing fields.

### Current next actions after same-date/optional-load audit
1. Confirm browser validation #44047763627 for commit 3a37114bf115bcdb433b1895f1bde97498a50efa; it must finish successfully before the optional-load test is called passed.
2. Update this manual with the final result and commit it on V21.2-development; then validate browser and backup workflows on the exact handover commit.
3. Continue reviewing source-grounded historical Gym name matching. Specifically assess the legacy normalized-name prefill/history behavior for collisions without silently changing historical records or introducing fuzzy matching into migration.
4. Keep all work on V21.2-development; production main remains untouched. No merge or deployment without explicit approval.

### Validation update — optional resistance regression (2026-11-17)
- Browser validation #44047763627 completed with conclusion success on exact code/test SHA 3a37114bf115bcdb433b1895f1bde97498a50efa: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44047763627
- Backup validation #44047763668 completed with conclusion success on the same exact SHA: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44047763668
- The handover update is now being finalized; validate the resulting handover commit separately before describing the branch head as fully validated.



### Gym historical data audit — same-date completion validation confirmed (2026-11-17)
- Browser validation run #44047273553 completed with conclusion `success` on the exact code/test commit `c233d1c848f9930686aa075dd579dbcdffe82ba6`: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44047273553
- Its `chromium-validation` job passed every step, including canonical-source/browser-bundle parity and Chromium migration/offline tests.
- Backup validation run #44047273605 also completed with conclusion `success` on that exact SHA: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44047273605
- Both runs were push-triggered and their `head_sha` exactly matches the tested commit. The multiple-same-date-snapshot ambiguity safeguard is therefore validated by both browser and backup workflows.
- The later optional-resistance test commit `3a37114bf115bcdb433b1895f1bde97498a50efa` also has browser #44047763627 and backup #44047763668 passing on its exact SHA (links recorded above).
- Before this handover update, branch head was `f8662a644fcbd6386579efec73b6988b197617aa`; browser #44048053467 and backup #44048053544 both completed successfully on that exact SHA:
  - https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44048053467
  - https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44048053544
- This section supersedes the earlier pending instruction to confirm browser run #44047763627 and the earlier statement that the same-date browser result was not yet confirmed.
- Next audit action: inspect the V21.1 normalized-name prefill/history code paths and their exact normalization rules for collisions between punctuation/spacing variants. Keep migration names verbatim and do not change historical records without a focused source-backed regression and explicit evidence.
- Current branch remains `V21.2-development`. Production `main` and the protected V21.1 baseline remain untouched; no merge or deployment has been performed.
- The handover documentation commit created by this update must receive fresh browser and backup validation. Do not call the final branch head validated until both runs match that exact handover commit SHA and complete successfully.


### Gym historical exercise-name audit — validation chronology (2026-11-17)

- The focused legacy characterization tests were added on `V21.2-development` only. They execute extracted V21.1 function bodies from the branch's unchanged root `index.html`; they do not modify the protected source.
- Intermediate backup runs on `a7dcfd11f71a6dec20f2c83ea5c8d956b43c2d18`, `bbbf21e56db73e308bcf2fd6165492e8d7dc919b`, `5ab52ee745a621403191055e999b437250be33ea` and `bf3aa3007784fc4464cec4436b9aaeb483c40167` failed in the newly added migration test. The failing assertion compared arrays created inside a VM context directly with host-realm arrays; the repeated test append also briefly duplicated that test. These were test-harness defects, not evidence of a migration data-loss or name-rewrite defect.
- Corrected the assertions by materialising VM arrays with host `Array.from`, removed the duplicate test, and added the legacy collision test file to the backup workflow's explicit test command.
- Corrected code/test commit `0757d7b498afe32516c959d0919ade9ff1b3ed5b`: browser #44050251512 and backup #44050251570 both passed on the exact SHA.
- Latest code/test commit `97ea94cb87e8d718f02e57eeb8acd6ec636f7c87`: browser #44050325690 and backup #44050325734 both passed on the exact SHA. This includes the additional test that an ambiguous legacy configuration key is retained as one raw preference without an invented exercise assignment.
- Handover commit `89372035eb5e81e6d23d233920d66760b65a31c6`: browser #44050552740 and backup #44050552753 both passed on that exact SHA.
- The branch head and current Actions runs must still be checked live at the start of the next session. Production `main` remains untouched; the root `index.html` blob on `main` remains `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`.



### Gym canonical exercise identity audit — V21.2 library and programme inspection (2026-11-17)

- Started from live `V21.2-development` head `40b229c8d2891833d297611d51003bea690f1c23`; inspected current source and tests before editing. No application implementation was changed.
- V21.2 database schema in `src/data/database.js` has `exerciseRecords` keyed by `id` and indexed only by `sessionId` and `moduleId`. There is no `exerciseLibrary` store or canonical-exercise index. The generic record API only requires a non-empty record ID; it does not validate a canonical exercise identity.
- V21.2 `src/data/gym-migration.js` generates each migrated exercise-record ID as `<sessionId>-exercise-<position>`. It preserves the exact exercise name and raw source object, but does not create a cross-session exercise identity. This ID identifies a performed exercise instance within a particular migrated session.
- V21.2 `src/programme-manager/programme-manager.js` is a shared calendar scheduler. It creates schedule IDs and validates module/date/title/status/duration; it does not define an exercise catalogue or programme exercise slots. The `programmes` store currently has only module/status indexes. Session `programmeId` is an optional relationship field, not a catalogue identity.
- The V21.2 app's Gym Journey groups completed records by exact stored name. The browser test already verifies two same-name `Test squat` exercise records across separate sessions are grouped as a name-level history display. That grouping does not establish canonical identity.
- Inspected protected V21.1 root `index.html` read-only (blob `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`). Its `workouts`, `baseWorkoutExercises` and `bodyExerciseLibrary` are name-led arrays of descriptions, types, muscle groups and equipment references; no stable exercise IDs were found. The legacy exercise configuration key is generated from normalised name text and is collision-prone. The active V21.2 tree contains no equivalent reusable exercise-library module; archive README notes are not a live catalogue.
- Added a migration regression showing that the same exact `Bench Press` name in two different legacy sessions produces distinct session-scoped record IDs, preserves each raw exercise value and receives no invented `canonicalExerciseId`.
- Added an IndexedDB schema regression confirming there is no `exerciseLibrary` store and that current `exerciseRecords` indexes are only `by_module` and `by_session`; `programmes` currently indexes only `by_module` and `by_status`.
- Code/test commit: `62891c15c1c5cb19359b4083948dc36c5e72a6e5`.
- Browser validation #44051299865 PASS on exact SHA: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44051299865
- Backup validation #44051299425 PASS on exact SHA: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44051299425
- Design conclusion: current V21.2 records and legacy V21.1 name arrays cannot safely serve as canonical exercise IDs for cross-session history or reusable settings. Create a curated catalogue with immutable IDs; keep session exercise IDs and programme-slot IDs separate; link history only through verified canonical IDs; preserve unresolved legacy names/settings verbatim.
- Next step: agree the canonical exercise definition, variation, programme-version/slot and alias model before adding any identity implementation. Do not rewrite V21.1, merge names, assign guessed IDs or change historical values.



### Canonical exercise identity data model — design and test contract (2026-11-17)

- Started by inspecting live `V21.2-development` at `49606d38a886d475c640d1b3f2501147a99aa8ed`; reviewed `src/data/database.js`, `src/data/gym-migration.js`, `src/programme-manager/programme-manager.js`, migration/schema tests, legacy collision characterization tests and both Actions workflows.
- Confirmed current database schema is version 5. It has session-scoped `exerciseRecords`, user/module equipment records and a programme-level store; no canonical exercise definition, variation, equipment taxonomy, alias, programme-version/slot or reusable exercise-configuration stores.
- Confirmed Programme Manager currently handles calendar schedules and day/range summaries, not programme versions or exercise slots. The current `equipment` store is not a master catalogue.
- Added `docs/V21.2-CANONICAL-EXERCISE-IDENTITY-DESIGN.md` as a proposal only. It defines opaque immutable exercise-definition IDs, separate variation IDs, equipment catalogue references, optional verified canonical links on performed exercise records, source-scoped exact aliases, unresolved legacy records, immutable programme versions, version-scoped slots with lineage, and profile/definition/variation/equipment-scoped reusable configuration.
- Design rules: no IDs derived from names; normalisation is suggestion-only; exact verified aliases require source/provenance; collision-prone name-derived settings remain unresolved; raw historical names and values are never overwritten; history uses verified canonical IDs and variation IDs; programme prescriptions, reusable defaults and performed sets are separate.
- Added `tests/exercise-identity-contract.test.js` with nine design-level acceptance tests. These are explicitly fixture/contract tests, not tests of a production identity service (none exists yet). They must be moved onto actual service and IndexedDB APIs when implementation begins.
- Added the new contract test command to both `.github/workflows/v21-2a-browser-validation.yml` and `.github/workflows/v21-2a-backup-validation.yml`.
- Design/test commit: `e6bd0fd969bd2127e4d71bad9174933c5d0ed09d`.
- Browser validation #44052088969 PASS on exact SHA: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44052088969
- Backup validation #44052088959 PASS on exact SHA: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44052088959
- No application source, IndexedDB schema, V21.1 source, or historical user data changed in this checkpoint.
- Open design decisions: variation taxonomy; controlled movement/equipment vocabularies; static vs persisted system catalogue; programme day/slot lineage; identity-review audit event storage; reusable configuration vs programme prescription boundaries.
- Next: review these decisions with the user, then implement incrementally with real service-level tests before schema/UI changes. Keep `main` and V21.1 untouched.



### Exact-SHA validation of previous handover checkpoint (2026-11-17)

- Handover commit `86b21f15a89c60a793dbd424f4568296d74f5569` was checked against its own branch head.
- Browser validation #44052262475 PASS, exact SHA `86b21f15a89c60a793dbd424f4568296d74f5569`: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44052262475
- Backup validation #44052262537 PASS, exact SHA `86b21f15a89c60a793dbd424f4568296d74f5569`: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44052262537
- Current handover update must also be checked on its own exact commit SHA before closeout.



### Canonical identity design decisions — variation taxonomy, catalogue storage and programme lineage (2026-11-17)

- Re-inspected the live branch at `7c1797e02732a602f45ba28c3e4d641e959d54a0` before changes: design document, `src/data/database.js`, `src/programme-manager/programme-manager.js`, `src/data/backup.js`, identity/programme/IndexedDB tests and both Actions workflows.
- Confirmed DB schema v5; current Programme Manager is a calendar scheduler only. Backup format is v1 and backup store names are an explicit fixed list. Current V21.2 app does not yet have a production catalogue asset/service-worker caching path; the existing offline test uses a scoped fixture service worker only.
- Decision 1 — variations: use a curated variation catalogue for implement/equipment, grip, stance, laterality and range-of-motion differences where execution or comparability materially changes. Load, sets, reps, rest, tempo and effort remain prescription/performance values. A materially different movement gets a separate exercise definition. Do not auto-generate Cartesian combinations; each supported variation is explicitly curated. Unknown legacy combinations remain unresolved.
- Decision 2 — catalogue: hybrid. A versioned local bundled release is the authority for system exercise/equipment definitions; IndexedDB materialises a cache for local/offline lookup. User-created definitions, personal aliases and identity-review data remain separate user-owned IndexedDB records. Catalogue refresh is idempotent; missing system entries retire rather than delete; IDs are never reused; refresh must not overwrite custom records, aliases, performed history or programme snapshots. Cache release ID/checksum in metadata. Add real app-shell/service-worker caching and offline catalogue tests during implementation; do not claim they exist now. Custom catalogue/user identity data must be backed up; bundled system catalogue need not be copied into each personal backup.
- Decision 3 — programme lineage: published versions are immutable snapshots. Day/section and slot records receive new version-scoped IDs; separate `dayLineageId`/`slotLineageId` continue only while the same logical role persists. Reordering does not break lineage; an exercise swap can preserve lineage if the slot's role remains. Split/merge/repurpose creates new lineage IDs with explicit predecessor/successor references. A performed session pins exact version, slot, definition, variation and display/prescription snapshots.
- Added seven decision-level tests to `tests/exercise-identity-contract.test.js` (16 total): curated variation dimensions vs prescription attributes; separate identity for materially different mechanics; versioned bundled release plus IndexedDB materialisation; catalogue refresh preserves custom records and aliases while retiring removed system entries; version-scoped day/slot IDs with stable lineage under reorder/swap; split/merge predecessor lineage; performed session pinning.
- Updated `docs/V21.2-CANONICAL-EXERCISE-IDENTITY-DESIGN.md` with recommendations, rationale, constraints and implementation boundaries. No app source, IndexedDB schema, backup format, V21.1 file or historical data was modified.
- Decision/test commit: `149ca48f27b77974731cf8a62a879d896273c478`.
- Browser validation #44053125812 PASS on exact SHA: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44053125812
- Backup validation #44053125864 PASS on exact SHA: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44053125864
- Next: review remaining boundaries (identity-review audit record, catalogue release retention/display snapshots and exact configuration fields), then implement only after tests target actual services and IndexedDB upgrades from v5, backup v1 compatibility and production offline asset caching. Keep V21.1 and main untouched.

### Evolution and Data Integrity Standard adopted (2026-11-17)

- Re-inspected live `V21.2-development` at `96641b3d6eaed3dc5186638f8b718e713731efe5`; confirmed the latest canonical exercise identity design and 16-test design contract before editing. Production `main` was checked read-only at `0d0527a6463c3cfd0fbb54d69123316c9a384b42`; its root `index.html` blob remains `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`.
- Added `docs/V21.2-EVOLUTION-STAGE-GATE.md`, a permanent governance standard for V21.2 design and implementation. It defines G0 routine work, G1 focused evolution, G2 foundation evolution and G3 release/production gates; lists mandatory triggers, required impact/evidence records, compatibility and historical-data rules, approval states (pass/hold/revise/reject), and stop/reopen conditions.
- Adopted the governing principle: **evolution must preserve the past while making room for the future**. The assistant should recommend a gate proactively before a consequential or hard-to-reverse decision. The user retains authority to pass, hold, revise or reject it. Routine cosmetic/contained changes do not trigger unnecessary formal gates; hidden risk escalates the level.
- Classified canonical exercise identity, durable IDs, catalogue, programme lineage, audit, migrations, backups and offline architecture as G2 foundation-evolution candidates. Release, production-data operations and deployment are G3. A passing workflow is evidence, not user approval.
- Linked the standard from `docs/V21.2-CANONICAL-EXERCISE-IDENTITY-DESIGN.md` in a new Evolution and Data Integrity section.
- Standard/design commit: `04b5edcc6b447746cb903c7081b6e2e8f4590787`.
- Browser validation #44054666013 PASS on exact SHA `04b5edcc6b447746cb903c7081b6e2e8f4590787`: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44054666013
- Backup validation #44054666239 PASS on exact SHA `04b5edcc6b447746cb903c7081b6e2e8f4590787`: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44054666239
- This was documentation/governance only. No app source, IndexedDB schema v5, backup format v1, V21.1 file, historical user data, production `main`, merge or deployment was changed.
- Next: continue the remaining canonical identity design boundaries (append-only review/audit events, catalogue release retention/display snapshots and reusable configuration fields). Raise a G2 gate before implementing identity stores or migrations; first convert design contracts into real service/IndexedDB/backup/offline tests. Keep V21.1 and `main` untouched.

### Canonical identity audit events, release snapshots and reusable configuration — G2 proposal (2026-11-17)

- Re-inspected the live branch at `c40309bb20551459b67ee77d2d321417bbdcf054` before editing. Inspected the Evolution Stage Gate Standard, canonical identity design, IndexedDB schema, backup service, Gym migration, Programme Manager, identity/IndexedDB/backup/programme/migration tests and both Actions workflows.
- Confirmed current IndexedDB schema v5 and backup format v1. The database has no canonical identity/audit/catalogue/configuration stores. Backup uses an explicit fixed store list and rejects missing or unknown stores. Programme Manager remains a calendar scheduler. No application source or schema was changed.
- Read protected V21.1 root `index.html` read-only (blob `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`). Its legacy exercise config key is day-scoped and uses a normalised exercise name. Persisted values include set count, progression focus and recording mode; reads can materialise defaults. This cannot safely be promoted to a global profile preference or a programme-slot mapping based on name alone.
- Resolved the design recommendations:
  1. **Review audit:** dedicated profile-owned append-only `identityReviewEvents`; `add()` only, mandatory profile-scoped idempotency key, exact source evidence, previous/proposed mapping, provenance and catalogue release; corrections append reversal/superseding events. Current alias mappings are rebuildable projections, not the audit source.
  2. **Catalogue durability:** immutable release IDs/manifests/checksums; retain releases while referenced by published programme versions, active/performed sessions or review events; tombstone retired definitions; snapshot canonical/variation/equipment display labels and locale at publication/performance. Backups carry IDs and snapshots, not duplicated system catalogue assets; historical display must work without old release files. No automatic release garbage collection in first implementation.
  3. **Reusable configuration:** typed allow-list initially contains `preferredProgressionFocus` and supported `recordingModeOverride`, keyed by profile + definition + optional variation + optional equipment context. Set count, rep/time targets, rest, tempo, effort targets and cues belong to programme prescriptions; actual measurements/symptoms/notes belong to performed records; global rest is profile preference. Legacy day-scoped name-derived settings remain exact and unresolved until both identity and intended scope are independently established.
- Updated `docs/V21.2-CANONICAL-EXERCISE-IDENTITY-DESIGN.md` and added `docs/V21.2-G2-CANONICAL-IDENTITY-PERSISTENCE-GATE.md`. The G2 gate is explicitly **HOLD** pending user decision; it does not authorise schema or application implementation.
- Added 10 focused design-level regression contracts to `tests/exercise-identity-contract.test.js`, increasing it from 16 to 26 tests. Coverage includes append-only corrections, idempotent retries/profile isolation, exact evidence provenance, catalogue release references, historical snapshots, backup display without old release asset, typed configuration, prescription/performance separation, configuration scope isolation and preserving day-scoped legacy settings.
- Design/test commit: `6606467e3897649aff7bc42b746b9350b0c48a5a`.
- Browser validation #44055599490 PASS on exact SHA `6606467e3897649aff7bc42b746b9350b0c48a5a`: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44055599490
- Backup validation #44055599359 PASS on exact SHA `6606467e3897649aff7bc42b746b9350b0c48a5a`: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44055599359
- These are fixture-level design contracts. They do not prove append-only IndexedDB enforcement, v5-to-next-schema migration, v1-to-v2 backup compatibility or production offline catalogue behavior.
- **G2 decision required before implementation:** PASS / HOLD / REVISE / REJECT. If passed, implementation must include additive/restart-safe schema upgrade, backup v2 writer with v1 reader adapter, populated-v5 preservation, event append-only enforcement, snapshot/release retention tests, profile isolation, backup/restore round trips and production-path offline tests.
- Protected V21.1 and production `main` remain untouched; no app source, schema, backup format, historical user data, merge or deployment changed.


---

# G2 PASS — canonical identity persistence implementation checkpoint

**Implementation commit:** `16ba51225dc255961b7e18718fdb71a041431a9c`

**Exact-SHA validation:**
- Browser workflow #44060658483 PASS: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44060658483
- Backup workflow #44060658543 PASS: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44060658543

## Implemented

- Database v5 remains the normal startup schema. The V21.2 UI now offers an explicit v5→v6 additive upgrade only after a validated V1 full safety backup has been downloaded and the user confirms it is saved.
- The v6 transaction adds nine identity/programme stores and indexes without rewriting existing v5 records. A pre-upgrade V1 snapshot is retained in metadata until a V2 backup/restore round trip verifies.
- New stores: `exerciseDefinitions`, `exerciseVariations`, `exerciseAliases`, `identityReviewEvents`, `catalogueReleases`, `exerciseConfigurations`, `programmeVersions`, `programmeDays`, `programmeSlots`.
- Review events require actor/evidence provenance, preserve exact source values, use a unique profile-scoped idempotency index and append corrections/reversals rather than overwriting prior decisions.
- Catalogue releases are immutable, versioned monotonically per catalogue and retained while referenced by published programme versions, non-cancelled sessions or review events. No release garbage collection is enabled.
- Exercise definition/variation IDs cannot be deleted; retire them by status. Published programme versions and their days/slots are protected from edits.
- Historical display snapshots are self-contained. V2 backup validation checks catalogue references, release versions, configuration scope/provenance and programme lineage.
- Reusable configuration is limited to `preferredProgressionFocus` and a supported `recordingModeOverride`, scoped by profile, exercise definition, variation and equipment. Prescription/performance fields are rejected.
- V2 restore merges review/release history, retained definition/variation IDs and programme lineage. V1 restore on v6 preserves all newer identity stores; V1 restore is blocked while the pre-upgrade safety snapshot is still pending verification.
- The V21.2 identity service is mirrored from `src/data/exercise-identity.js` to `v21.2/assets/exercise-identity.js`, included in the app shell and service-worker cache, and verified by a real offline cold start.
- No production catalogue asset, catalogue editor, catalogue refresh flow or offline catalogue lookup has been implemented. Those remain a later stage.

## Data and release boundaries

- No existing legacy exercise name or day-scoped setting is automatically mapped or promoted.
- No V21.1 source, production `main`, production data, merge or deployment was changed.
- The implementation tests cover populated v5 preservation, failed-upgrade rollback/retry, append-only/idempotent review events, release retention/versioning, historical snapshots, typed configuration, profile/scope isolation, programme lineage immutability and V1/V2 backup compatibility.
- The browser workflow also validates the V21.2 service-worker cache, offline cold start, explicit safety backup download, v5→v6 upgrade and V2 restore verification.

**Next checkpoint:** validate this handover commit on both workflows against its exact resulting SHA, recheck protected production references, then continue the source-grounded V21.2 audit within the approved G2 scope.


---

# G2 implementation validation — latest exact SHA

**Latest implementation/test commit:** `505656805288d00a631eff8b1012a3503d8519f5`

The initial implementation CI runs identified fixture defects; these were corrected in follow-up commits. The current implementation head has both workflows passing against the exact same SHA:
- Browser validation #44061074418 PASS: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44061074418
- Backup validation #44061074385 PASS: https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44061074385

The first failed runs were superseded by the corrected, passing exact-SHA runs above. The final handover commit still requires both workflows to pass against its own exact SHA.

---

# Gym exercise catalogue — source inventory and curation design (2026-11-17)

**Audit base:** `V21.2-development` at `409484e9d2089b6e06c1ed931db5a677e2ecf155`  
**Scope:** read-only source inventory and design; no catalogue data or application implementation added.

## Source inventory

Protected legacy root `index.html` was inspected read-only (blob `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`). It contains:

- Five base workout days with 32 exercise slots: Day 1 (7), Day 2 (7), Day 3 (6), Day 4 (6), Day 5 (6).
- An optional exercise library of 42 entries, categorised as 18 bodyweight, 5 free-weight, 3 band, 4 cardio, 2 mobility and 10 machine entries.
- 25 explicit exercise instruction / muscle-description entries in `machineDescriptions`; other library entries use a generic fallback guide and need review before being presented as fully documented.
- Equipment mapping, gear matching, exercise substitutions, user-added extras, day-scoped swaps and configurable exercise/set behaviour.
- Exercise guide uses equipment illustration and muscle tiles; 16 muscle-group JPGs are present in root `assets/`.
- Root asset inventory contains 15 equipment SVGs, 10 machine-reference JPGs and 16 muscle-group JPGs. The three legacy celebration GIFs (`celebration-day1.gif`, `celebration-day2.gif`, `female-celebration.gif`) are present at repository root.
- The legacy guide uses a 450 ms press-and-hold gesture, with keyboard activation support. The guide includes equipment, instructions, highlighted muscle panels and safety text.
- SAVE SESSION saves before opening the six-second celebration; male artwork varies by day, female artwork uses its own GIF, and the celebration can be skipped/dismissed.
- Set completion drives the smart rest timer and sequence lock; rest controls include +15 seconds, skip and dismiss. Exercise completion is derived from set states and applies the subtle green card/label treatment.

Relevant historical behaviour notes: `docs/archive/README-V6-GUIDES.txt` and `docs/archive/README-V19-EXERCISE-COMPLETION.txt`. The source itself remains the stronger reference where archived notes are older or narrower.

## Important integration finding

The current V21.2 app shell is not yet the complete legacy workout UI. Its `v21.2/sw.js` shell cache v16 does not currently precache the legacy equipment/muscle guide artwork or celebration GIFs. When the workout experience is ported, these assets must be copied into a versioned V21.2 asset location, referenced locally, and included in the shell/offline test. Do not rely on root legacy paths or network-only images.

## Catalogue curation rules proposed

1. Do not assign one permanent definition ID to every one of the 42 library rows. First distinguish canonical movements, equipment-specific implementations, variations, aliases and optional activity types.
2. Preserve exact source names and provenance. Keep original programme slot labels separately from canonical definition labels so old records and published plans remain interpretable.
3. Model exercise definition, variation, equipment requirement, primary/secondary muscle groups, instructions, cautions, illustration references and aliases as separate, validated fields/references. Do not infer missing instructions or muscle targets.
4. Separate strength exercises from cardio and mobility entries; retain their original category and programme role.
5. Keep the five-day programme slots and gear/adaptation/swap behaviour as programme data, not as exercise identity. Never let an adaptive substitution silently rewrite the base programme or historical session.
6. Review the 16 muscle illustration files against the 14 distinct muscle keys used by the optional library; all 14 current keys resolve. Missing or ambiguous mapping is a curation issue, not a reason to invent artwork.
7. Mark incomplete guides explicitly. A generic fallback must not be represented as an exercise-specific instruction.
8. The catalogue release remains immutable/checksummed and must pass the existing verified delivery path. Production data must be reviewed and approved before a release is packaged.

## Next bounded work

- Build a row-by-row source register for all 42 library entries and 32 base programme slots, including source label, category, equipment/art reference, muscle keys, instruction coverage, possible alias/variation relationship and review status.
- Verify every referenced artwork file and create a V21.2-local offline asset manifest.
- Design acceptance tests for the exercise guide, 450 ms hold/keyboard interaction, set-state sequence, smart-rest controls/persistence, exercise completion, SAVE SESSION and celebration skip/dismiss.
- Only after review, assign stable IDs and prepare a real catalogue release. No synthetic test fixture may be described as production content.

## Scope and safety

This was a source-grounded design/inventory update only. No production catalogue payload, permanent exercise IDs, V21.2 workout UI, asset copy, database change, backup change, legacy root edit, historical data rewrite, merge or deployment was made. The 409484e9 checkpoint's browser and backup validations were previously confirmed PASS; this handover update itself still requires both workflows to pass on its exact resulting commit SHA.

---

# Gym exercise source register — 2026-11-18

- Added `docs/V21.2-GYM-EXERCISE-SOURCE-REGISTER.md` from a fresh read-only inspection of the protected legacy root `index.html` at blob `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`.
- Register inventories 42 optional-library rows, 32 slots across all five base programme days, 17 distinct base-programme labels, 25 explicit guide-description entries overall; 15 cover optional-library rows and 27 of 42 optional-library rows use generic fallback. Ten other descriptions cover programme-only labels.
- All 42 machine-reference JPG paths and all 14 muscle keys used by the optional library resolve to existing files. Root asset inventory contains 15 equipment SVGs, 10 machine-reference JPGs and 16 muscle JPGs; three legacy celebration GIFs are also present.
- Important source correction: the optional library's sixth array field is gear-match text used by `exerciseReady()`, not exercise aliases. Base-programme equipment matching is separately implemented in `baseExerciseReady()`. Do not turn gear terms into canonical identity aliases.
- Ten base-programme labels do not directly match an optional-library row. The register lists them as review candidates and preserves source labels; no merges or IDs are approved.
- 25 entries have explicit guide copy; 27 optional-library entries currently fall back to generic guide wording. Existing guide copy still needs content/safety review before production.
- The source register is documentary only. No production catalogue payload, canonical IDs, app/UI, service-worker, schema, backup or legacy root changes were made.
- Next: review identity/variation candidates and complete the 27 guide gaps, then design the V21.2-local artwork package and offline tests. Keep the exercise guide, press-and-hold, set/rest controls, completion treatment and save/celebration buttons in the acceptance suite.
- Commit adding source register: `3bc43868c21b2f30c286579a0d869a16dc67fa8b`. This handover update is a separate documentation commit and requires exact-SHA browser and backup validation.


---

# Exercise identity curation review — 2026-11-18

- Added `docs/V21.2-EXERCISE-IDENTITY-CURATION-REVIEW.md` as a source-grounded draft review of the ten programme labels that do not exactly match an optional-library row.
- Draft recommendation only: four proposed exact, source-scoped aliases (Chest Press Machine, Leg Press, Seated Leg Extension, Shoulder Press Machine); two position-specific leg-curl variation candidates (seated and prone/lying); three keep-separate/unresolved cases (Abdominal Crunch, Incline Chest Press, and Dumbbell Biceps Curl relative to Cable Biceps Curl); and one distinct catalogue-addition candidate (Dumbbell Lateral Raise).
- No mapping is verified or approved. No canonical IDs, aliases, variation records, production catalogue content or workout UI changes were created.
- Key source evidence: `baseExerciseReady()` treats Abdominal Crunch as machine-or-mat and Incline Chest Press as compatible with several equipment paths; `machineDescriptions` has distinct seated and prone/lying leg-curl guides; dumbbell and cable biceps curls have separate source labels/equipment mappings.
- The draft explicitly preserves exact programme labels and requires human approval before identity review events or production IDs are authored. Equipment matching and illustration selection are not treated as identity evidence.
- Protected root `index.html` remains read-only. No database, backup, service-worker, historical data, production `main`, merge or deployment changes were made.
- Curation review commit: `48c049bd3b2ace5ffa7c0e69f6a3e8a904f3c9f9`. This handover update must be validated by browser and backup workflows against its exact resulting commit SHA.


---

# Exercise machine nomenclature clarification — 2026-11-18

- Updated `docs/V21.2-EXERCISE-IDENTITY-CURATION-REVIEW.md` with user-supplied machine nomenclature for chest press, leg press, seated leg extension and shoulder press.
- Revised the earlier alias proposal: Chest Press Machine, Leg Press and Shoulder Press Machine remain broad machine-family candidates on HOLD until the intended machine geometry/operation is known. Converging handles and iso-lateral independent arms are variation attributes, not generic synonyms.
- Leg Press must not default to a 45-degree sled: horizontal seated and vertical machines are distinct configurations; “sled press” is informal angled-sled terminology.
- Seated Leg Extension ↔ Leg Extension Machine remains a strong but conditional alias candidate; Quad Extension Machine, Knee Extension Machine and Leg Extension are possible naming alternatives, subject to confirming the optional-library row means a seated machine.
- Shoulder press naming alternatives include Overhead Press Machine, Machine Military Press and Deltoid Press; converging handle path remains a variation attribute where relevant.
- No gym brand/model or pin-selected/plate-loaded configuration has been confirmed. No aliases, variations, canonical IDs or production catalogue records were approved or created.
- All programme source labels remain preserved and unresolved pending explicit review. No legacy root, application, database, backup, history, production main, merge or deployment changes.
- Curation document refinement commit: `3ea6d364759b15c420c6fa92cd228262f887c49d`. This handover update requires exact-SHA browser and backup validation.


---

# Gym machine loading-system clarification — 2026-11-18

- User confirmed their gym has a mixture of pin-selected and plate-loaded machines, as is common in gyms.
- Catalogue design must support both loading systems. Record pin-selected/weight-stack versus plate-loaded as equipment/configuration metadata when known; do not treat loading system as a distinct exercise identity or infer it from an exercise name.
- Keep loading system separate from movement configuration: chest-press converging handle path and iso-lateral independent arms; leg-press 45-degree sled, horizontal seated or vertical orientation; shoulder-press converging handle path.
- The gym-wide mixture does not establish which specific loading system or geometry applies to any particular machine. Chest Press Machine, Leg Press and Shoulder Press Machine remain broad candidates on HOLD. Seated Leg Extension ↔ Leg Extension Machine remains conditional on confirming the optional-library row means a seated machine.
- Updated curation review: `docs/V21.2-EXERCISE-IDENTITY-CURATION-REVIEW.md`.
- No aliases, variations, canonical IDs, production catalogue records or UI changes were approved or created. Protected legacy root, database, backup/history contracts and production `main` remain unchanged.


---

# Exercise guide content drafting — 2026-11-18

- Added `docs/V21.2-EXERCISE-GUIDE-CONTENT-DRAFT.md` with proposed setup, movement, coaching cues and review notes for all 27 optional-library exercises currently using generic fallback.
- This is review copy only; no production guide content or `machineDescriptions` changes were made. Generic fallback remains incomplete and must not be presented as exercise-specific instruction.
- The draft includes a separate review pass for the 25 existing source descriptions; all 52 entries require qualified human review before production.
- HOLD decisions: Hip / Ankle Mobility is not a single defined drill; Superman / Back Extension combines related patterns; machine press/leg press setup needs configuration-aware instructions; Leg Curl Machine needs seated and prone/lying variations; Abdominal Crunch Machine must not be assigned to the unqualified programme Abdominal Crunch without identity approval; Dumbbell Shoulder Press posture remains unspecified.
- Machine loading system (pin-selected/weight stack versus plate-loaded) is separate from movement geometry and exercise identity. Leg press orientation and press handle path/independent-arm mechanics remain separate attributes.
- No canonical IDs, aliases, variations, production catalogue records, workout UI, service-worker asset list, database/backup/history contract, protected root source, production `main`, merge or deployment changes.
- The curation review, source register and guide draft remain documentation/review artifacts. Exact-SHA browser and backup validation is required for the final handover commit before treating this checkpoint as validated.


---

# V21.2 exercise-guide interface and offline asset design — 2026-11-18

- Added `docs/V21.2-GUIDE-INTERFACE-OFFLINE-ASSET-DESIGN.md`. This is a design specification only; no app code, artwork, catalogue, DB, backup or service-worker behaviour changed.
- Important source boundary: current V21.2 has Gym history, not the legacy five-day workout UI or exercise-guide modal. The guide is designed as a future Gym-workout component, not a feature to bolt onto the history screen.
- Preserve legacy 450 ms hold-to-open and Enter/Space keyboard activation. Improve V21.2 with a labelled accessible dialog, visible Close button, Escape handling, focus trap/restoration, touch-scroll cancellation and protection for nested set/swap/collapse controls.
- Keep guide artwork in a V21.2-local package, separate from both shell and verified catalogue release caches. Proposed versioned manifest records stable asset IDs, relative paths, MIME, exact bytes, SHA-256 and source provenance. Service-worker installation must verify every required asset before cache publication; failed staging must not replace the active cache.
- Corrected the artwork inventory against the live GitHub directory: root `assets/` has 15 equipment SVGs, 10 machine-reference JPGs and **16** muscle JPGs (not 17). The optional library uses 14 distinct muscle keys and all 14 resolve. `machine-benches.jpg` and `machine-dumbbells.jpg` are the same Git blob/bytes. Three celebration GIFs total 2,118,831 bytes.
- The legacy equipment mapping directly references 13 of the 15 equipment SVGs; `equipment-bench.svg` and `equipment-squat-rack.svg` are not referenced in protected root `index.html` and need separate usage justification before inclusion.
- Proposed acceptance tests cover SHA-256/byte length/MIME, asset paths/provenance, offline cold start, all guide images, touch/keyboard/modal accessibility, no interference with workout buttons, celebration selection and cache isolation.
- The 27 new guide drafts and 25 existing descriptions remain human-review drafts. No generic fallback may be presented as specific guidance. No IDs, aliases, variations, production guide records, UI, asset copies, service-worker changes, DB/backup/history changes, merge or deployment.
- Prior guide draft checkpoint `19acfef3b942342551fee34628e703c91f097f55` has browser and backup validation PASS. The new documentation commits will each trigger the same exact-SHA workflows; this handover is not validated until both pass on its final commit.


---

# V21.2-local guide artwork package — 2026-11-18

- Added inert asset package commit `740af8bd68ed6a1d424fa0ee3097a60c98492531`.
- Manifest: `v21.2/assets/guides/manifest.v1.json`.
- 41 packaged files, 2,984,584 bytes total: 13 equipment SVGs, 9 unique machine-reference JPGs, 16 muscle JPGs and 3 celebration GIFs.
- Every manifest entry records asset ID, V21.2-relative path, MIME, byte length, SHA-256, source path and source Git blob SHA. The two identical source JPG paths `machine-benches.jpg` and `machine-dumbbells.jpg` are represented by one stored image and an explicit alias.
- Binary files were copied by reusing their exact original Git blob objects; no re-encoding/recompression. Post-commit verification found 41 listed files, exact aggregate byte count 2,984,584 and zero destination/source blob-SHA or byte-length mismatches.
- Two unused legacy SVGs (`equipment-bench.svg`, `equipment-squat-rack.svg`) were excluded because protected root `index.html` does not reference them.
- Package is inert: no script imports the manifest, no guide/celebration assets are added to the service worker, and the current shell/cache behaviour is unchanged. Next task is the build-time manifest/hash/path contract test, then separately implement verified guide-asset caching.
- Current branch head when this note was drafted: package commit `740af8bd68ed6a1d424fa0ee3097a60c98492531`; design-doc update follows. Verify final branch head and both browser/backup workflows before calling the final documentation checkpoint validated.


## Guide asset integrity test — 2026-11-18

- Added `tests/guide-assets-contract.test.js` and wired it into `.github/workflows/v21-2a-browser-validation.yml`.
- The test verifies the 41-entry manifest, package byte total, local path containment, MIME, exact SHA-256, Git blob SHA-1 provenance, byte-for-byte equality with source assets, 13 SVG mappings, all 14 optional-library muscle keys, the deduplicated machine-reference JPG alias and all three celebration GIFs.
- This is build-time integrity coverage only. The manifest is not yet loaded by the app, and the new guide/celebration assets are not yet cached by the service worker. Runtime offline cache work and browser guide interaction tests remain separate steps.
- Test/workflow commit: `89a2c4f221f83bae897d3295a6344df2da6bf4ce`; subsequent documentation commit follows. Recheck branch head and both exact-SHA workflows before calling the current checkpoint validated.

- CI first caught a test-only regex that rejected underscores in source-derived muscle asset IDs such as `muscle.inner_thighs`; widened the allowed ID characters in `7d3c6b2ca56318f05f3ee7b559380f11504809bb`. The manifest and binary assets were unchanged. Corrected final-SHA browser validation is pending.


---

# V21.2 guide artwork offline cache implementation — 2026-11-18

- Added dedicated versioned service-worker cache `project-comeback-v21-2a-guides-v1`, isolated from shell cache v16 and verified catalogue release caches.
- Service-worker installation validates manifest identity/schema/version, 41 unique entries, local paths and allowed roots, MIME, exact byte length, SHA-256 and total 2,984,584 bytes. It fetches/verifies every asset before staging, reads staged bytes back, then publishes and re-verifies the dedicated cache. Install fails closed on any error; the staging cache is cleaned and the prior active worker is not replaced.
- Guide and celebration requests bypass generic shell caching and use the dedicated guide cache; catalogue routing remains unchanged. Activation cleans old shell/guide versions only after successful installation and leaves catalogue cache namespace alone.
- Browser validation checks all 41 assets plus the manifest are cached separately and confirms the shell cache contains no guide/celebration paths. It also fetches representative SVG and GIF assets after going offline. Added a dedicated service-worker cache contract test to the browser workflow.
- Manifest status updated to `verified-offline-cache-v1`. The cache is infrastructure only: no guide modal/content is connected to the current history-only UI. No DB, backup, historical data, protected root source, production `main`, merge or deployment changes.
- Previous exact-SHA baseline browser validation #44169076076 PASS and backup validation #44169076160 PASS on `5374d75d633c669018f4f74aa92aea90082711e3`. The new cache implementation commit requires both workflows to pass on its own exact SHA.


- First cache-integration browser CI run #44170579614 caught a test assertion that incorrectly expected the service worker itself to declare the catalogue cache prefix. The architecture intentionally leaves catalogue cache ownership in the verified catalogue loader; the service worker only bypasses generic caching for catalogue assets. Four of five new cache-contract checks passed. Corrected the test to assert that the guide service worker does not manage the catalogue namespace. This is a test-only correction; service-worker/cache implementation unchanged. Re-run both workflows on the corrected exact SHA.

- The first correction commit itself exposed a literal newline-escape typo in the edited test source; no application code was affected. This follow-up fixes the test file syntax. The browser workflow is rerun against the resulting exact commit.

- The next CI run showed the cache namespace assertion expected a single literal string, while the implementation deliberately composes the versioned name from a prefix and version constant. The service-worker design was unchanged; the contract now checks the exact composition. Other four cache-contract tests passed. This is another test-only refinement before browser runtime validation.


- Follow-up source review identified two issues before accepting the first real browser run: the Playwright test server lacked explicit SVG/JPG/GIF MIME mappings despite the service worker's strict MIME validation, and the first cache publisher deleted the destination cache before copying staged content. Fixed both on the development branch. Browser fixture now sends correct artwork MIME types. Guide cache versions are immutable: existing published caches are verified read-only, never overwritten/deleted during installation; new version caches are populated from fully verified staging and deleted only if that newly-created cache's publication fails. Activation alone removes obsolete guide versions after success. Any content/manifest change requires a cache-version bump. Exact-SHA browser and backup validation must pass again.

- Follow-up test-source inspection found the first cache-safety contract edit had introduced escaped newline text into the JavaScript test file and retained an obsolete catch-block assertion. Replaced the test file cleanly with six focused assertions for cache immutability, MIME mappings, strict checksum verification, cache isolation and offline browser coverage. Application/service-worker code is unchanged by this test-only correction. Exact-SHA workflows will run on the corrected branch head.

- Final review tightened the cache immutability assertion to distinguish an unconditional destination-cache deletion from cleanup guarded by proof that the cache was newly created during the failed install. This is a test-only precision correction.

- CI exposed that the previous generated cache-contract test still contained literal escaped newline sequences and therefore failed to parse. Replaced it with a clean source string using real line breaks. This is test-only; service-worker and app source are unchanged. The next exact-SHA workflow is the authority for validation.


- Added a real Playwright failed-update scenario: the test server temporarily serves a modified service worker using guide cache v2 and intentionally returns HTTP 503 for one guide asset. The browser must observe the installing worker become redundant, retain the original active worker/controller, retain all 42 entries in guide cache v1, publish no v2 cache, and fetch the previous SVG successfully while offline. This proves that a failed new release does not damage the previous offline guide cache.


---

# V21.2 artwork production standard and dimension audit — 2026-11-18

- Added `docs/V21.2-ARTWORK-PRODUCTION-STANDARD.md` with master canvas sizes, aspect ratios, preferred formats, safe margins, responsive display rules, naming conventions, stable asset-ID rules and future manifest validation requirements.
- Artwork filenames for new releases use lowercase ASCII kebab-case, clear role prefixes, zero-padded sequence numbers and lowercase extensions. File paths are not runtime IDs; the manifest `assetId` remains the stable reference. Existing v1 filenames/IDs remain immutable, including legacy underscores.
- Standards were reconciled against measured source artwork:
  - Equipment SVG masters: 3:2, proposed `viewBox="0 0 1200 800"`, matching the existing 13 packaged SVGs and 2 excluded legacy SVGs (all current `480 × 320`).
  - Equipment reference photos: 1600 × 1200 (4:3) proposed new master.
  - Muscle illustrations: 1200 × 1600 (3:4) common high-resolution portrait master.
  - Static hero characters: 1200 × 1600 (3:4), transparent background.
  - Celebration animations: 720 × 1080 (2:3) new master, preserving the current six-second, six-frame (1,000 ms/frame) timing and existing male/female/day selection logic.
- Added `docs/V21.2-ARTWORK-INVENTORY-AUDIT.md` by reading actual committed image headers and SVG viewBoxes. It measures all 41 immutable guide/celebration package files plus the two excluded SVGs.
- Audit findings:
  - 9 unique equipment reference JPEGs; 8 are only 292–304 px wide. One `machine-home-gym.jpg` is an extreme 1,528 × 176 panorama requiring visual review rather than automatic crop/stretch.
  - 16 muscle JPEGs are only 248–300 × 324–326 px and have two visibly different portrait width/crop groups. Recreate on a common 3:4 canvas rather than upscaling.
  - All three celebration GIFs are 420 × 650, 6 frames, 6,000 ms total, six 1,000 ms frame delays, infinite GIF loop metadata.
  - Three muscle filenames use underscores; equipment-reference names use legacy `machine-` prefix; celebration names do not fully encode profile/day in the new naming form. Preserve all v1 names/paths/IDs.
  - `machine-dumbbells.jpg` is byte-identical to `machine-benches.jpg` and remains a source alias, not a distinct packaged image.
- Replacement priority: equipment photos and muscle illustrations first; separately review the panorama; then static hero artwork if needed and celebration remakes. Retain current vector equipment artwork unless visual review finds a style or accuracy issue.
- Exact-SHA validation on artwork-standard naming revision `6e5db781a35a13fa2f486514c4d50e842dc5e184`: browser #44175788542 PASS and backup #44175788488 PASS.
- Exact-SHA validation on inventory audit commit `7edf13fe96a5ce3a325d5d42c27ae75027e49c9e`: browser #44176041931 PASS and backup #44176041951 PASS.
- Browser run evidence: all source/contract checks, migration/IndexedDB tests, offline reload, dedicated 41-asset guide cache, failed v2 install preservation, catalogue materialisation/offline lookup, backup/restore and accessibility contrast checks passed.
- Scope boundary: documentation only. No binary artwork, v1 manifest, service-worker logic, catalogue data, IndexedDB schema, backup payloads, workout/history records, root `index.html`, or `main` was changed. No merge or deployment.
- Next artwork step: visual review of the existing image content against the metadata audit, then approve sample direction for replacement equipment photos and muscle illustrations before generating a batch. Do not replace all artwork before visual approval and a new immutable manifest/cache release is ready.



---

# V21.2 first review-only artwork samples — 2026-11-18

- Added a generic chest-press equipment illustration sample:
  - `v21.2/assets/artwork-samples/v1/equipment/equipment-chest-press.svg`
  - SVG viewBox 1200 × 800 (3:2), dark metallic/navy frame, blue pads and restrained lime details.
- Added a simplified chest muscle anatomy sample:
  - `v21.2/assets/artwork-samples/v1/muscles/muscle-chest.svg`
  - SVG viewBox 1200 × 1600 (3:4), portrait anatomy canvas with pectoral area highlighted in lime.
- Added a review-only sample manifest: `v21.2/assets/artwork-samples/v1/manifest.json`. Uses distinct sample IDs and status `review-only-not-for-production`; no production asset IDs are allocated.
- Added review brief: `docs/V21.2-ARTWORK-SAMPLE-REVIEW.md`. It records the visual direction based on V21.2 dark navy surfaces, blue highlights and lime accent, plus the equipment/anatomy accuracy limits and human review gates.
- Added `tests/artwork-samples-contract.test.js` and browser-workflow step. Test verifies sample names/paths/IDs, exact viewBoxes and aspect ratios, SVG accessibility title/description, unique/resolved local IDs, no scripts/embedded text/external resources, transparent backgrounds and separation from production guide manifest.
- Review samples deliberately live outside `v21.2/assets/guides/`; they are not imported by the app, catalogue or service worker, and are not included in the verified 41-file v1 guide release. Do not publish or treat either sample as guide-ready without visual and accuracy review.
- The chest press is intentionally generic; it does not prove or map a pin-selected/plate-loaded machine variation. The chest muscle image is a simplified educational visual, not a medical reference.
- Exact-SHA browser validation on `b9006204062a0e666c836f552c2617f243f4b528`: #44180770603 PASS. This included the new sample contract, full Chromium migration/offline suite, 41-asset guide cache, failed-update preservation, catalogue offline lookup, backup/restore and cold-start persistence checks.
- Exact-SHA backup validation on `b9006204062a0e666c836f552c2617f243f4b528`: #44180770470 PASS.
- Repository boundary remains unchanged: production `main` still `0d0527a6463c3cfd0fbb54d69123316c9a384b42`; protected root `index.html` blob remains `e3eb0093648cc6c5d706bb5b1008b58ec01a5576`. No merge, deployment, production artwork replacement, catalogue or DB/backup/history changes.
- Next action: review the two SVG sample images for visual style and anatomy/geometry quality. Only after sample direction is accepted should full equipment-photo and muscle-illustration batches be commissioned. Preserve current unresolved machine-style decisions until the equipment configuration is known.



---

# Shift to functional-first Gym development — 2026-11-18

The user has explicitly decided that the existing artwork is good enough to get the app working. Defer new artwork concepts, aesthetic revisions and broad image replacement until the core application workflow works end to end. The user has visual ideas to explore later. Treat current artwork as temporary functional artwork; replace only if an asset is broken, misleading or blocks a required interaction.

- Added `docs/V21.2-GYM-WORKOUT-FUNCTIONAL-ROADMAP.md` to prioritise the real Gym workout experience over visual polish.
- Source audit reconfirmed that V21.2 currently has a Gym history view but no way to start or run a workout. The existing programme manager is a shared calendar scheduler, not a workout runner.
- Added source-preserved five-day programme data:
  - `src/data/gym-base-programme.js`
  - `v21.2/assets/gym-base-programme.js`
  - `tests/gym-base-programme.test.js`
- The programme data preserves the exact 5-day / 32-slot plan: 7, 7, 6, 6 and 6 slots, using the exact source exercise labels, descriptions, group keys, muscle keys and legacy slot order.
- Slot IDs are source programme-position identifiers only. All are marked `identityLinkStatus: unreviewed`. No canonical exercise definition IDs, variation IDs or inferred aliases are assigned. Repeated exercise names on different days remain separate programme slots.
- Legacy defaults captured in the source data: three sets; Plank defaults to timed-hold/duration focus; remaining base slots default to reps. Per-user changes will be configurable in the runtime rather than altering the source programme.
- Loaded the programme module in `v21.2/index.html`, added exact source/bundle parity coverage, added a browser check for availability from the shell cache, and advanced the app-shell cache from v16 to v17 so the new data module is available offline. The dedicated immutable artwork cache v1 and catalogue cache remain separate and unchanged.
- Next functional milestone: implement the persisted workout session engine and minimal Gym UI using existing stores `sessions`, `exerciseRecords`, `setRecords` and `progression`. Session/exercise/set creation must be atomic; inputs autosave and survive reload; no DB schema addition is planned unless a test-supported gap is found.
- Restore the legacy set sequence, completion/undo, configurable set count and recording mode, timed-set stopwatch/manual correction, smart rest (+15/skip/cancel and end-time persistence), session save-before-celebration, skip/dismiss, and day/week progression.
- Do not block the first working workout on canonical identity curation. Preserve source labels and slot IDs without inventing links; unresolved equipment/movement mappings remain unresolved. Do not publish the 27 guide drafts or generic guide fallback as approved instruction.
- Equipment adaptation/swaps and progression summaries follow once the unadapted five-day workflow works end to end. Exercise guide interaction follows with an honest incomplete/unavailable state until copy is reviewed.
- Artwork sample assets remain isolated under `v21.2/assets/artwork-samples/` and are not connected to the runtime guide or production cache. No more aesthetic sample batches are planned for the immediate development path.
- This is a functional-first scope decision and source-data foundation, not yet a working workout UI. Exact-SHA CI validation on the final commit containing this note is required before the programme module/cache change is considered validated.



---

# Functional-first Gym workout implementation — 2026-11-18

The user explicitly prioritised a working app over visual aesthetics. Keep existing artwork as temporary functional assets; do not spend further development cycles on new artwork concepts, hero styles or decorative polish until the core workout flow works end to end.

Implemented first G3.2 slice:
- Source-preserved five-day programme already exists in `src/data/gym-base-programme.js` and `v21.2/assets/gym-base-programme.js` (32 slots, 7/7/6/6/6). Each slot remains unreviewed for canonical exercise identity.
- New persisted workout service: `src/modules/gym-workout.js`, mirrored to `v21.2/assets/gym-workout.js`.
- New minimal Gym UI in `v21.2/index.html`, `v21.2/app.js`, `v21.2/app.css`: select programme day/date; start/resume; enter weight/reps or timed-hold seconds; start/complete/undo sets; finish only after all sets complete.
- Session/exercise/set graph writes use existing atomic DB helpers in `src/data/database.js`: `createGymWorkoutBundle` and `updateGymWorkoutBundle`. Existing stores only; no DB schema/version/store/index change. Database source and browser bundle were synchronised.
- Session start creates three sets per slot; first set is available, later sets locked. Completion unlocks the next set. Undo resets later sets to locked while retaining entered values. Same day/date in-progress session is resumed. Values save on field change. Session completion timestamp and elapsed minutes are saved only after all sets are complete.
- Shell cache advanced from v17 to v18 and includes workout service. Existing dedicated immutable guide cache v1 and catalogue release cache remain unchanged.
- Added `tests/gym-workout.test.js`; included in both backup and browser workflows. Chromium test now exercises actual app day-1 start, 7 exercise/21 set graph, value entry, completion, reload and resume, and checks correct next-set unlock / later-set lock.
- Current code/documentation head at time of this handover note: `80a25b1a652b1caaeb1eaeb9fd0899e3e8b7c42e`. Exact-SHA CI for the final documentation commit is pending; do not declare the milestone fully validated until both browser and backup workflows pass on the final head.
- Recent test debugging: first browser assertion incorrectly expected set 2 to remain locked after set 1 completion. Correct behaviour is set 2 unlocked and set 3 still locked. The latest browser assertion was corrected accordingly. The browser workflow at `cc6c89f...` had this incorrect assertion; do not treat it as an application defect.
- Latest known earlier backup run on `ef6950a...` passed; browser run on that SHA was still in progress/failed due the incorrect next-set assertion. Current exact SHA is `80a25b1...`; check latest workflows before proceeding.
- Superseded by later milestones: rest timer, timed-set stopwatch/manual corrections, save-before-six-second celebration and week/day progression/history are now implemented and validated. Still deferred: equipment/manual swaps, progression summaries/carry-forward review, and the accessible 450ms/keyboard exercise guide. Keep these in the roadmap and do not imply deferred items are implemented.
- Historical next-step note superseded: G3.3/G3.4/G3.5 are complete; continue with G3.6 after exact-SHA validation. Keep functional scope ahead of aesthetics.
- No merge/deployment. Production `main` remains protected and root legacy `index.html` unchanged. Do not alter either without explicit authorisation.

---

## G3.4b celebration milestone checkpoint — 2026-11-18

- **Latest validated code/test SHA:** `bfaf9d877e16c2890b0ed99dbf7016b09bab970a`.
- Save-first celebration, existing GIF selection, accessible Skip/Dismiss, six-second auto-close and persisted-completion preservation are implemented and browser validated.
- Completion writes use a completed-session copy and commit before mutating the in-memory workout. A deliberately failed completion write remains in-progress and retryable; no celebration is shown.
- Test uses isolated future dates and verifies cleanup does not change the pre-test Gym session count. The same persistent browser profile cold-reopens and retains IndexedDB data.
- Browser validation [#44234071650 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44234071650); backup validation [#44234071733 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44234071733).
- Service-worker shell cache is v22. Existing celebration GIFs remain unchanged; no database schema or backup format changes.
- Roadmap/handover documentation is being updated. Final validation must run on the exact documentation commit SHA before milestone closure. Do not merge/deploy.
- Next: G3.5 day/week flow and history.

### Final browser-fixture correction and validation — 2026-11-18

The follow-up run found and corrected test-fixture isolation: celebration sessions use dates 20–22 days ahead, the setup waits for the workout panel to clear before starting a new fixture, and cleanup asserts that the pre-existing Gym session count is unchanged. The browser test preserves the original profile record and removes only its dedicated fixtures. The complete browser suite and backup check passed on exact SHA `9d72d43b5b263221b2d5879648c9ffa65e897420`:
- Browser [#44234292910 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44234292910)
- Backup [#44234292767 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44234292767)

### Final refresh-race correction and validation — 2026-11-18

A browser regression exposed a race when a stale asynchronous workout lookup completed after the user changed the selected week/day/date. Refresh now invalidates older requests, hides the previous workout immediately while the new selection loads, and only applies the newest lookup/progression result. This protects the visible session and controls from stale results.

Final code validation is on exact SHA `4944be8e9c6a5bf37fd228bcde9337e21648a216`:
- Browser/Chromium [#44236590997 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44236590997).
- Backup validation [#44236591011 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44236591011).


## G3.6a handover — manual exercise substitutions (2026-11-18)

**Current implementation:** G3.6a manual exercise substitution foundation is implemented on `V21.2-development`. The live development branch must be inspected before continuing; no work should be assumed beyond its actual head.

- Manual free-text performed exercise label saved in `performedExerciseName`; substitution metadata stores source label, performed label, equipment status (`unknown` / `available` / `unavailable`), selection timestamp and `selectionMode: "manual"`.
- Immutable source identity: database `name`, `sourceExerciseLabel`, `sourceDescription`, `programmeSlotId` and programme lineage remain original. Do not mutate source `name`; DB integrity validation rejected the first attempt that did.
- Repeated swaps update the same exercise record. Restore the original by selecting its source label, which clears substitution metadata. No chained substitutions or new exercise records.
- Changes are blocked after a set has started/completed or contains recorded values. Sets, set IDs, values, statuses, recording mode, progression focus, targets and rest are retained; nothing auto-adjusts.
- Equipment availability is only a manual advisory, not catalogue matching or proof of exercise equivalence. UI warns that substitution details are unverified and targets remain unchanged. History shows performed label; progression history still groups on original source identity until G3.6b design.
- No DB migration/store/index or backup schema changes. Canonical service and offline bundle must stay identical. Added unit and browser tests.
- First validation attempt failed due to the DB source-name guard; this was corrected. Validation passed on exact code checkpoint `d125620592b49bc04d47351cd60885481c561617`: Browser [#44241216450](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44241216450) and Backup [#44241216719](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44241216719), both PASS. Follow-up UI clarity and handover/roadmap commits require final exact-SHA re-validation.

**Next step:** inspect the live branch head, verify canonical/offline bundle parity, and check both validation workflows for the final documentation checkpoint. Only close G3.6a after both pass on the exact final SHA. Then proceed to G3.6b progression summaries, design-first. `main` and deployment remain untouched.


**Final implementation checkpoint validation:** exact checkpoint `3457832d5ddf79ba77192d7bc0ee8abb6b7d937e` passed after the UI clarification and handover/roadmap update:
- Browser/Chromium [#44241412680 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44241412680).
- Backup [#44241412714 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44241412714).


## G3.7.1 — Completed Gym workout immutability (2026-11-18)

- Completed workout records are read-only through the Gym workout service. All mutation operations require an in-progress session, including set entry/start/complete/undo, stopwatch stop/reset, substitution, rest settings and rest controls.
- The IndexedDB updateGymWorkoutBundle boundary independently checks the stored session lifecycle within the same transaction and aborts any attempt to update a session that is already completed. This prevents stale in-memory objects and direct service/database calls from modifying completed history.
- Completion remains the one allowed lifecycle transition from in-progress to completed, and remains transactionally saved before in-memory state changes.
- Added service/API regression coverage that completes a workout, attempts the mutation surface, attempts a direct bundle update, and confirms stored session/exercise/set records remain unchanged.
- No schema/store/index or backup-format changes. Canonical service/database and offline mirrors remain identical. Shell cache advanced to v24.
- Exact-SHA browser and backup validation are required before closure; main and deployment remain untouched.


## G3.7.2 — Restore preview transparency (2026-11-18)

- Restore preview now reports actual per-store behaviour: replace, merge/preserve, or (for V1 backups in a V6 database) preserved untouched identity stores.
- Replace stores show actual removals, incoming additions/changes, and projected record count. Metadata projection includes the pre-restore safety snapshot written by restore.
- Merge/preserve stores report zero removals, append additions, identical records skipped, immutable conflicts, and projected count. Identity-review idempotency-key matches are separately identified as skips or conflicts.
- The preview UI lists every incoming store's action and counts, plus every V1 identity store that remains untouched. Confirmation copy requires review of replace/merge/preserve/conflict behaviour.
- Restore transaction behaviour is unchanged; this increment is preview/reporting only. Added regression tests for V1 replacement counts, V2 merge/conflict semantics, V1 identity preservation, and V1 preview on pre-V6 schema.
- Validation is required on the exact final commit with browser and backup workflows. Do not touch main or deploy.


## G3.7.3 — Restore safety snapshot retention (2026-11-18)

- Restore safety snapshots are bounded to the three newest records in metadata. Snapshot history is carried forward across restores and pruned transactionally.
- New safety snapshots exclude earlier restore-safety snapshot records from their own metadata payload, preventing recursive nesting and unbounded backup/restore payload growth.
- The pre-identity-upgrade safety snapshot is preserved when an incoming restore omits it; its verification safeguard remains unchanged.
- Snapshot creation, retention and restore writes remain in the same IndexedDB transaction. Transaction/quota failures abort without committing a partial restore or safety snapshot.
- Added repeated-restore tests for bounded retention, non-recursive payloads and identity-upgrade snapshot preservation, plus transaction-failure recovery coverage.
- Exact final-SHA browser and backup validation required. Do not touch main or deploy.


### G3.7.3 implementation checkpoint — validation (2026-11-18)

- Implementation checkpoint: `448baab267b2b73bfd3f01e5d88ff1484bdd1bd2`.
- Backup validation [#44245394837 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44245394837): 132 tests passed, 0 failed, including bounded retention, non-recursive snapshots, identity-upgrade snapshot preservation and rollback after invalid IndexedDB key failure.
- Browser validation [#44245394988 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44245394988): bundle parity, syntax, full Chromium/browser/offline suite, IndexedDB persistence and upgrade/backup round-trip passed.
- Validation exposed a synchronous IndexedDB write failure path that was not explicitly aborting the restore transaction. The implementation now aborts on any transaction-body exception and confirms original data and snapshot state remain unchanged.
- A further retention edge case was corrected: restore-snapshot records supplied by an incoming backup are skipped during the metadata replace loop, then the union of existing/incoming/new safety history is capped at three. The current pre-identity-upgrade snapshot takes precedence and is preserved.
- Documentation checkpoint validation on the exact final SHA is pending; do not touch main or deploy.


### G3.6b browser assertion copy correction

- Corrected the browser assertion from “performed label” to the actual approved interface wording “performed exercise”. The prior run again stopped at this assertion before the remaining Gym-history checks. The backup validation passed on the preceding SHA.
- Validation is pending on the corrected commit. Continue until both workflows pass on the exact final SHA; do not touch main or deploy.


## G3.6b — final validation checkpoint (2026-11-18)

- Implementation: descriptive Gym progression summary service and UI, substitution separation, test coverage and source/offline parity. The browser assertions were corrected to reflect the new descriptive labels and substitution-transparency note without weakening recorded-value/load/date/repetition checks.
- Final validated SHA before this documentation closure: `befeb442164e519ed02c6b52e834b3d5285879ff`.
- Backup validation [#44255883725 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44255883725).
- Browser validation [#44255883740 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44255883740).
- Main remains `0d0527a6463c3cfd0fbb54d69123316c9a384b42`; no merge or deployment.
- Next roadmap gate is G3.7 exercise guide: design-first source audit of current guide delivery, access/hold/keyboard interaction, honest draft/unavailable states and offline behaviour. Do not create/revise guide artwork or reviewed instructions as part of the initial design audit.

---


# Project Comeback — G3.7.1 Exercise Guide access checkpoint (2026-11-18)

- Live branch: `V21.2-development`; code checkpoint `d268ad338dc05c1613892542bce71b18246b7300` passed both workflows. Protected `main` remains `0d0527a6463c3cfd0fbb54d69123316c9a384b42`; no merge/deployment.
- Exercise cards now have an explicit Guide button. Heading supports 450 ms hold and Enter/Space; cancellation on movement/release/leave/cancel/lost capture/window blur. Touch vertical scroll is not prevented.
- Added labelled native dialog, visible close, focus-in, Tab/Shift+Tab containment, Escape/backdrop closing and focus restoration.
- Added `ProjectComebackExerciseGuide.resolveGuideState`: complete requires reviewed status, required setup/steps/cues/safety notes and verified local asset IDs. Draft/unreviewed/incomplete records are incomplete; absent records unavailable.
- Guide registry remains empty, so the UI currently shows **Guide unavailable** for all programme exercises. The 27 drafts and 25 existing descriptions remain unpublished and unmapped. Manual substitutions are not represented as verified guide matches.
- Complete-content renderer supports future explicit records and graceful image failure, but no production content exists yet. The next gate is a design-first explicit programme-slot registry and human review workflow.
- Canonical source and offline module match; browser tests cover state resolver, button/keyboard, Escape, focus trap/restoration, 450 ms hold, movement/release cancellation and set-state preservation. Offline test confirms guide runtime script is loaded and shell-cached. Shell cache advanced v25→v26; dedicated guide artwork cache v1 remains unchanged.
- Code SHA `d268ad338dc05c1613892542bce71b18246b7300`: browser [#44258944556 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44258944556); backup [#44258944562 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44258944562).
- No DB/schema/store/index, backup, history, catalogue, protected root app, merge or deployment changes.

---

## G3.7.2a — Exercise guide registry/review design checkpoint (2026-11-18)

- Live branch was inspected before work; branch remained at `7458cf67c50711b19cb13b9fd2f5f5d182d03f34` and protected main remained `0d0527a6463c3cfd0fbb54d69123316c9a384b42`.
- Added `docs/V21.2-EXERCISE-GUIDE-REGISTRY-REVIEW-DESIGN.md`, defining separate versioned guide content, digest-bound human review records and explicit programme-slot assignments. Assignment keys are exact source slot IDs, never display-name matching.
- Guide approval and assignment approval are distinct. Published guide versions are immutable; changes require a new version and fresh review. Variation/equipment inheritance must be explicit and reviewed. Manual substitutions do not automatically inherit the original guide.
- Validation is fail-closed: invalid/stale review/version/digest, identity/scope ambiguity, missing assets, conflicts or unapproved substitutions resolve incomplete/unavailable rather than guessed instruction.
- This increment is documentation/design only. No runtime implementation, registry population, guide publication, review/approval, exercise identity, artwork, DB/backup/history/catalogue change, merge or deployment.
- Next: G3.7.2b pure registry/assignment validation module and tests; registry stays empty.
- Exact final-SHA browser and backup workflows must pass before this documentation checkpoint is closed.


## G3.7.2b — Registry validation implementation checkpoint (2026-11-18)

- Live development branch inspected at `1c81bb7fc5a151382114c9bb15014013cec484cb`; protected main unchanged at `0d0527a6463c3cfd0fbb54d69123316c9a384b42`.
- Added pure validation module `src/modules/exercise-guide-registry.js`, matching offline mirror and 12 tests. Not loaded by production UI; registry remains empty.
- Enforces exact slot/source snapshot, guide/version, separate human guide and assignment review, digest bindings, explicit exercise/variation/equipment/context scope, required content and verified manifest assets. Conflicts, stale/unknown refs, invalid statuses, digest/scope mismatches and inheritance fail closed. Any registry error downgrades complete resolutions. Missing/withdrawn assignments are unavailable.
- Digest verifier is injected; no cryptographic SHA-256 implementation here. Tests use deterministic placeholder digest function. Production digest integration and renderer hookup remain later gates.
- Browser validation workflow adds registry tests and source/offline parity. No guide population/review, DB/backup/history, identity/catalogue, programme, UI, artwork/cache, protected root, merge or deployment changes. Validation pending exact final SHA.


### G3.7.2b implementation validation closure (2026-11-18)

- Final implementation SHA: `68564e39062b0ccd00310a9dcebaa3f31bdcf27b`.
- Browser validation [#44262108917 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44262108917); registry validation tests, source/offline parity and browser/offline suite all passed.
- Backup validation [#44262109060 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44262109060).
- Development branch verified at the implementation SHA; protected main remains `0d0527a6463c3cfd0fbb54d69123316c9a384b42`. No merge or deployment.
- Next: separate design/review for the production cryptographic digest implementation and runtime integration. Registry remains empty; no human reviews/approvals were created.


## G3.7.2c — Cryptographic integrity design checkpoint (2026-11-18)

- Inspected live branch `V21.2-development` at `33128054fc266a74b31b259f005f438609773d3c`; protected main unchanged at `0d0527a6463c3cfd0fbb54d69123316c9a384b42`.
- Design-only doc created: `docs/V21.2-EXERCISE-GUIDE-CRYPTO-INTEGRITY-DESIGN.md`. Defines canonical schema payloads, domain-separated SHA-256, guide content/asset set/assignment/review digest contracts, immutable lifecycle, tests and fail-closed behavior.
- Existing artwork manifest already contains per-asset SHA-256 and byte lengths; service worker verifies actual asset bytes before cache publication.
- Current validator is synchronous; Web Crypto is async. Production validation/resolution must become async. Missing/rejected crypto cannot fall back or pass.
- Hashes are integrity checks, not authenticated reviewer signatures. No implementation, runtime wiring, registry records, approvals, DB/backup/history, identity/catalogue, programme, UI, artwork/cache, merge or deployment changes.
- Exact final-SHA browser and backup validations required before closure.


## G3.7.2d — Canonicalisation/SHA-256 implementation checkpoint

- Implemented isolated module `src/modules/exercise-guide-crypto.js` and exact offline mirror `v21.2/assets/exercise-guide-crypto.js`; bundle parity check updated.
- Provides strict canonical JSON, SHA-256 byte hashing via Web Crypto only, allowlisted domain-separated canonical digest, and digest comparison. Fail closed when Web Crypto is absent/rejects.
- Tests cover known SHA-256 empty/`abc` vectors; key ordering/array order/Unicode/number formatting; rejection of non-finite/unsupported/cyclic/sparse/non-plain/accessor/symbol/extra-array-property/unpaired-surrogate inputs; domain separation, mismatch, deterministic results and error propagation.
- Not connected to guide registry, renderer or production app. Registry remains empty; no approvals.
- Exact-final-SHA browser and backup workflows required before PASS.


## G3.7.2e — Async digest contracts implementation

- Added `src/modules/exercise-guide-digests.js` plus exact offline mirror `v21.2/assets/exercise-guide-digests.js` and parity check.
- Four allowlisted payload contracts: guide content; asset-set manifest and tuples; programme-slot assignment bound to snapshot, guide version/content digest, scope and substitution; review bound to target/version/digest, decision, reviewer metadata, timestamp and notes.
- Asset tuples canonicalize by asset ID and duplicate IDs reject. Unknown fields and malformed schema values fail closed.
- Contract tests cover positive digest verification, tampering, cross-target/snapshot/version changes, asset tuple changes, deterministic output, nonmutation, schema rejection and unavailable/rejected crypto.
- Still isolated: no registry validator, runtime, renderer or registry records changed. Exact-final-SHA validations required before PASS.


## G3.7.2f — Async registry validation implementation

- Registry validator now uses async real SHA-256 contracts; injectable synchronous digest callbacks removed.
- Registry schema v2 requires guides, assetSets, reviews and assignments.
- Validation binds assignment to current source snapshot ID + digest, exact programme slot, guide version/content digest, scope/substitution; guide to asset-set release/digest; asset-set to manifest tuples and local assets; review records to exact target digests.
- Complete resolution requires approved assignment, guide and asset set plus exact-digest approve reviews. Conflicts, stale bindings, tampering, unapproved states, invalid scope and crypto failure fail closed.
- Tests cover empty registry/unavailable state, complete fixture, missing/rejected crypto, guide/asset/assignment/review tampering, snapshot and target mismatch, approval states, conflicts, withdrawn assignment, determinism and nonmutation.
- Registry remains empty; no human approvals or runtime wiring. Exact-final-SHA browser and backup validations required.


G3.7.2f hardening: asset-set human reviews bind `manifestId@release` and schema version, avoiding review ambiguity between releases of the same manifest.


G3.7.2f integrity amendment: guide content digest now also binds the exact unique ordered `assetIds` references. Validator requires each selected ID to exist in the guide's exact bound asset-set release and be locally verified. This closes the gap where the asset-set digest was valid but a guide's selected-artwork list could be altered independently.


## Gym Comeback V21.2 — G3.7.2g runtime integration checkpoint

Checkpoint based on the verified G3.7.2f SHA `8da7c28be06db8b319e3f83499d878a3d8e83529`. G3.7.2g implementation is underway on `V21.2-development` and is not yet PASS pending exact-final-SHA browser and backup workflows.

- Empty schema-v2 registry file added: `v21.2/assets/exercise-guide-registry.v2.json`; guides, assetSets, reviews and assignments remain empty.
- Added canonical source-snapshot payload + SHA-256 runtime validation using existing async crypto, digest and registry modules. It binds source provenance and ordered source programme slots; no guessed exercise matches.
- Async guide UI shows loading, awaits registry/manifest/validation, fails closed, and drops stale results through a request-generation gate. Closing the dialog invalidates pending requests. Registry fetch retries after failure and is available through offline shell cache.
- Browser scripts now load crypto/digest/registry/runtime modules. Service-worker shell cache version bumped v26→v27 and includes runtime assets and registry. Bundle parity and runtime tests added; browser test now waits for the resolved unavailable state.
- No guide content or approvals; no canonical identity decisions; no merge/deployment.
- Exact code SHA `7b9ec437de5e1f100425fb8dfab6ddb8c084cce9` passed browser validation #44273437234 and backup validation #44273437105. These workflows validated the exact code checkpoint; documentation is being finalized separately and its resulting SHA must be revalidated before declaring G3.7.2g PASS.


## G3.7.2h — Runtime resolver hardening implementation (2026-11-19)

- Added an explicit trust boundary between manifest-listed artwork and artwork verified from the dedicated local cache. The app verifies every packaged asset's MIME, byte length and SHA-256 before passing verified asset IDs into registry validation. Missing or corrupted cache entries fail closed without network fallback.
- Service-worker guide-artwork and celebration requests now return 404 when the dedicated verified cache lacks the requested entry. Install-time staging/publication verification remains unchanged.
- Added tests for malformed manifest rejection, missing/corrupt cached artwork and verified asset-ID gating, plus cache-only route assertions. Registry remains empty; no content, reviews, assignments or approvals populated. Exact-SHA browser and backup validation pending. Main unchanged; no merge or deployment.


## G3.7.2i — Artwork cache lifecycle and upgrade recovery (2026-11-19)

- Service-worker installation now checks for the current immutable guide cache first. If present, it verifies the cached manifest, all 41 asset bytes/MIME types/SHA-256 values and exact 42-entry inventory locally, allowing shell-only worker upgrades without fetching artwork or requiring network access.
- A genuinely new guide-cache namespace is still populated through staging and verified before publication. Failed publication deletes only that newly created namespace; the prior active cache remains untouched.
- Activation now claims clients before retiring older shell/guide namespaces. Successful replacement and failed replacement have browser coverage; the browser suite also verifies offline artwork continuity after activation.
- Guide registry remains empty. No guide content, assignments, reviews or approvals were added. No database, backup format, identity or programme changes. No merge or deployment.
- Implementation and validation commit: `6602987327a8adb15fecbc039d9e34943b9b89dc`. Browser validation [#44374952330 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44374952330); backup validation [#44374952571 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44374952571). Both runs target that exact SHA. Documentation-only checkpoint update follows; its resulting commit is being revalidated. Main remains unchanged; no merge or deployment.



## Current continuation checkpoint — G3.7.2j review readiness (2026-11-19)

**Implementation SHA:** ac55eaedfaa43b951695b07d1b20a0ce1b0eaa82 on V21.2-development.

- Verified live source inventory: 42 optional exercise-library rows; 25 existing explicit legacy guide descriptions; 15 exact-name overlaps; 27 generic-fallback optional rows; 27 draft guides with exact coverage of the generic-fallback set.
- Source-preserved five-day programme has 32 slots (7 / 7 / 6 / 6 / 6) and 17 distinct labels. All 32 exact slot IDs have a review-readiness assignment row and remain UNASSIGNED. Exact-name overlap is not an assignment or approval.
- Review queue: 35 ready for qualified review, 15 need clarification and 2 hold, across 52 descriptions/drafts. “Ready” means suitable to enter a qualified review, not approved or safe for publication.
- Holds: Hip / Ankle Mobility (combined movement categories) and Superman / Back Extension (distinguishable floor patterns).
- Clarification blockers: configuration-aware Machine Chest Press, Machine Shoulder Press and Leg Press Machine; confirmation of seated Leg Extension Machine; separate seated and prone/lying Leg Curl setup; no automatic Abdominal Crunch Machine mapping to base Abdominal Crunch; seated/standing decision for Dumbbell Shoulder Press.
- Reviewer evidence requirements, exact content/version digests, separate guide/asset-set/slot approvals, immutable version rules and approval invalidation/revocation are recorded in docs/V21.2-EXERCISE-GUIDE-REVIEW-READINESS.md.
- Added tests/exercise-guide-review-readiness.test.js to both browser and backup CI workflows. Its source contract checks the exact source inventory, draft coverage, queue counts/statuses, all 32 exact slot IDs/labels and the empty production registry.
- Browser validation [#44384280349 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44384280349) and backup validation [#44384280304 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44384280304) both completed against the exact implementation SHA above.
- No reviewer or qualification was invented; no human approval, guide record, asset-set approval, programme assignment or published content was added. Production v2 registry remains empty. The protected legacy root source and programme source are unchanged.
- Scope was review-readiness only: no catalogue/runtime/UI/database/backup/history/artwork/cache changes. No merge or deployment.

**Next boundary:** actual guide content review and any later publication require verified qualified human reviewers, exact-digest approvals and explicit per-slot assignments. Passing code tests does not satisfy that human approval gate. Do not populate the registry or publish drafts without that separate authorization.

Protected main remains 0d0527a6463c3cfd0fbb54d69123316c9a384b42.


---

# Gym Comeback V21.2 — G3.7.3a continuation checkpoint (2026-11-19)

**Current development branch:** `V21.2-development`  
**Implementation commit:** `8097a505cb8d5637ccbf26fb2226c99cb435fed8` — [Isolate V21.1 and V21.2 service-worker scopes](https://github.com/richardblades1980-prog/gym-comeback-app/commit/8097a505cb8d5637ccbf26fb2226c99cb435fed8)  
**Protected main:** `0d0527a6463c3cfd0fbb54d69123316c9a384b42` — unchanged.

## Hosting/origin decision

The user supplied the existing V21.1 address:
`https://richardblades1980-prog.github.io/gym-comeback-app/index.html`

The selected target for V21.2 is the same GitHub Pages project site at:
`https://richardblades1980-prog.github.io/gym-comeback-app/v21.2/`

Both paths share browser origin `https://richardblades1980-prog.github.io`. This is a design decision only. No Pages settings have changed; V21.2 is not published to that address. The raw.githack preview remains a different origin and test-data-only. Do not attempt real V21.1 migration on that preview.

## G3.7.3a implementation

- V21.1 root `sw.js` derives the V21.2 path from its own script URL and leaves all requests under that directory to the network / narrower V21.2 service worker.
- Root activation cache cleanup now deletes only obsolete keys beginning `gym-comeback-v21-1b-`; V21.2 shell/guide caches and unrelated namespaces are preserved.
- Root `index.html` is now part of the V21.1 install precache. This prevents an update from deleting the old root cache's only homepage before the new cache has an offline entry page.
- Added `tests/shared-origin-service-worker.test.js` (five focused tests), and added it to both browser and backup workflows.
- Extended `tests/browser-validation.js` with a same-origin dual-app scenario at the GitHub Pages-style `/gym-comeback-app/` path: install V21.1 root worker, open V21.2 at `/v21.2/`, verify separate controllers and caches/root homepage, simulate V21.1 worker replacement, confirm V21.2 cache/controller and same-origin sentinel survive, and cold-start both apps offline.

## Exact-SHA validation

- Browser validation [#44394324284 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44394324284) — all job steps completed successfully, including the new same-origin service-worker isolation test and the full Chromium suite.
- Backup validation [#44394324662 PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44394324662).
- Both workflow `head_sha` values exactly equal implementation commit `8097a505cb8d5637ccbf26fb2226c99cb435fed8`.

## Remaining gates / safety boundary

- Same-origin migration rehearsal remains open. Use a controlled real-shape V21.1 dataset, downloadable safety backup, explicit user confirmation, source-key preservation checks and post-migration verification. Do not experiment destructively on the live dataset.
- Verify HTTPS, manifest/icon delivery, install prompt and shortcut behaviour on the actual GitHub Pages target after a separately approved publication.
- Complete rollback/recovery runbook and preserve the V21.1 backup.
- Exercise-guide human review/qualification, exact digest approvals and all 32 explicit programme-slot assignments remain outstanding; the production guide registry is still empty.
- No merge, deployment, live hosting change, actual data migration or production approval occurred. Main remains unchanged.

**Next suggested work:** after this validated checkpoint, finish the independent release-readiness documentation sweep (included in this checkpoint), then design the controlled same-origin migration rehearsal without running it against live data.

---

# Gym Comeback V21.2 — GitHub Pages source confirmed (2026-11-19)

**User-provided evidence:** `Pages.pdf`, screenshot of repository Settings → Pages, timestamp 19 November 2026, 9:47 AM.

## Confirmed live Pages configuration

- Source mode: **Deploy from a branch**.
- Selected branch: **`main`**.
- Selected folder: **`/(root)`**.
- GitHub displays the site as live at `https://richardblades1980-prog.github.io/gym-comeback-app/`.
- GitHub's UI says it was last deployed by the repository owner **4 days ago** relative to the screenshot.
- The screenshot does **not** show the deployed commit SHA. Do not claim or infer the last deployment SHA.

## Candidate / publication state

- Development branch at pre-update inspection: `aa652df424ff19f9808980e219c5275b4f3283bf`.
- Candidate branch: `V21.2-pages-release-candidate`.
- Candidate SHA: `a721d7eab7fd0fa57a9f19a094cbc6c2ac24b4dd`.
- Candidate exact-SHA browser validation #44413382202: PASS.
- Candidate is designed to publish from `/(root)`; it preserves the V21.1 root entry page and manifest, includes the reviewed root worker coexistence change, and includes the complete `/v21.2/` app tree.
- Candidate is still unselected. No Pages source setting was changed and no publication occurred.

## Next action and safety boundary

The earlier missing preflight input is now answered: the current source is `main / (root)`. The next decision is whether to switch Pages to `V21.2-pages-release-candidate / (root)`. This is a production-facing source switch. Do not perform it until the user separately and explicitly approves publication. Keep `main` unchanged.

For rollback, restore the Pages source selection to `main / (root)`. Before any approved switch, re-check and record the exact current `main` SHA and verify the actual Pages deployment/build identity; the screenshot only establishes the selected source, not the precise last-published commit.

This update is documentation-only. It does not change the Pages setting, deploy, merge, alter live V21.1 records or access browser data.

---

# Gym Comeback V21.2 — GitHub Pages candidate publication completed (2026-11-19)

## Source switch and deployment

The user confirmed that Settings → Pages now selects **Deploy from a branch → `V21.2-pages-release-candidate / (root)`** (previously `main / (root)`).

- Candidate SHA deployed: `a721d7eab7fd0fa57a9f19a094cbc6c2ac24b4dd`.
- GitHub Pages build/deploy [#44418334493 — SUCCESS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44418334493). Build, report status and deploy jobs all completed successfully.
- Candidate browser validation [#44413382202 — PASS](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44413382202), exact same SHA.
- Artifact ID `14480412194`, `github-pages`, SHA-256 `3799bf16b6bb8c3c0654ed5c2c7f878a94e198a91f018aa1bbb767a20859262b`.

## Deployed artifact inspection

The downloaded artifact was inspected:
- 212 files total, including all 77 V21.2 app files; hidden validation files were excluded from the public Pages artifact.
- Root V21.1 `index.html` and manifest retain their exact protected-main Git blob SHAs (`e3eb0093648cc6c5d706bb5b1008b58ec01a5576` and `85944d49035521961509c6dce6ead097f5294535`).
- Root `sw.js` is the reviewed coexistence worker blob `df0181306af833d0760e9d749e06e60c5421b92f`.
- V21.2 entry page, service worker and manifest are present. Manifest identity/start/scope are relative to `./`; icon files were verified at 192×192, 512×512, maskable 512×512 and Apple touch 180×180.

## Remaining live-device checks / boundaries

Public routes:
- V21.1: `https://richardblades1980-prog.github.io/gym-comeback-app/`
- V21.2: `https://richardblades1980-prog.github.io/gym-comeback-app/v21.2/`

Assistant-runtime requests to the public host could not be completed (web fetch reported inaccessible; container DNS did not resolve the host). This does not demonstrate a Pages failure. The exact HTTP headers/MIME, rendered browser page, actual service-worker controller scope and phone installation therefore still need user-side confirmation.

Next: user opens both URLs and confirms V21.1 root and V21.2 subpath. Then test V21.2 Home Screen icon/standalone launch, disposable Gym/Hiking/Schedule data, backup download, reload and cold offline launch on the available phone. Record exact device/browser. Do not migrate or change existing V21.1 data. No production records or user data were accessed or modified.

Protected `main` remains unchanged at `0d0527a6463c3cfd0fbb54d69123316c9a384b42`. The Pages source is now the candidate branch; no merge to main occurred.


---

# Gym Comeback V21.2 — First live-host PC/mobile smoke check (2026-11-19)

The user reports that:
- Both the V21.1 root page and the V21.2 `/v21.2/` page loaded correctly on PC and mobile.
- All dropdowns worked.
- No records were saved during this smoke check.

This is a **user-reported PASS for page loading and dropdown interaction only**. The user did not provide browser/OS/device versions. No claim is made yet for save/reload persistence, backup/restore, service-worker controller scope, Home Screen installation, standalone launch or offline cold start.

Published host remains:
- V21.1: `https://richardblades1980-prog.github.io/gym-comeback-app/`
- V21.2: `https://richardblades1980-prog.github.io/gym-comeback-app/v21.2/`

Pages source remains `V21.2-pages-release-candidate / (root)`; deployment workflow #44418334493 succeeded at candidate SHA `a721d7eab7fd0fa57a9f19a094cbc6c2ac24b4dd`. The deployed artifact was inspected and all 77 V21.2 files were present; root V21.1 entry page and manifest remain byte-matched to protected main.

**Next owner-trial step:** when ready, create one clearly disposable V21.2 test record, save it, reload and confirm it persists, then download a backup. Keep all V21.1 records/localStorage untouched and do not run migration. Home Screen/standalone and cold-offline checks remain separate.

Protected `main` remains `0d0527a6463c3cfd0fbb54d69123316c9a384b42`. No V21.1 data was read, migrated, deleted or modified.
