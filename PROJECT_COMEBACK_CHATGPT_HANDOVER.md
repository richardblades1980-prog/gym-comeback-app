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
- Optional resistance regression commit: 3a37114bf115bcdb433b1895f1bde97498a50efa. Backup validation #44047763668 PASS on exact SHA. Browser validation #44047763627 was still running (bundle parity passed; Chromium installation in progress) when this entry was prepared. Do not mark this commit fully validated until that run completes.
- Current audit principle: keep exact exercise names; keep absent dates undated and invalid dates warned/undated; retain raw source values; keep blank weights blank; use only explicitly saved resistance values. Do not infer exercise classification, body mass, added load, completion, or physiological improvement from missing fields.

### Current next actions after same-date/optional-load audit
1. Confirm browser validation #44047763627 for commit 3a37114bf115bcdb433b1895f1bde97498a50efa; it must finish successfully before the optional-load test is called passed.
2. Update this manual with the final result and commit it on V21.2-development; then validate browser and backup workflows on the exact handover commit.
3. Continue reviewing source-grounded historical Gym name matching. Specifically assess the legacy normalized-name prefill/history behavior for collisions without silently changing historical records or introducing fuzzy matching into migration.
4. Keep all work on V21.2-development; production main remains untouched. No merge or deployment without explicit approval.
