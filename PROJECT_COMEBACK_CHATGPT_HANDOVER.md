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

- Active branch: `V21.2-development`.
- Current validated code branch head: `e0241d2a09308c9ed27073d7dd654d90a448d886`.
- Browser validation for that exact SHA: **success**, run [#44011654605](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44011654605).
- Backup validation for that exact SHA: **success**, run [#44011654603](https://github.com/richardblades1980-prog/gym-comeback-app/actions/runs/44011654603).
- The user's approved follow-up rule is implemented: save the original baseline first; follow-ups may be dated on the same day or later, never earlier.
- Canonical service `src/progress/assessment-manager.js` enforces baseline existence and date ordering. Browser bundle `v21.2/assets/assessment-manager.js` is synchronized and passed parity validation.
- `v21.2/index.html` explains that follow-up assessments are unavailable before baseline creation and starts its controls disabled.
- `v21.2/app.js` enables follow-up fields only when the immutable baseline exists, applies the baseline date as the form's minimum date, and adjusts the next default date when needed.
- Browser regressions verify: follow-up blocked before baseline; service rejects bypass attempts before baseline; earlier dates rejected; same-day follow-ups accepted; follow-up form unlocked after baseline; minimum date correctly displayed; immutable baseline; missing-value comparison; and duplicate-submit prevention.
- The same browser run also passed migration/reload, offline fixture, skip-link keyboard access, assessment UI, contrast, navigation state, mobile width, PWA metadata, safety snapshot/manual migration, full backup/restore, offline app reload, and cold-start IndexedDB persistence.
- Prior duplicate-submit guard remains in place for baseline and follow-up forms. Rapid repeated follow-up submissions create exactly one record.
- UX review confirms baseline immutability, missing-value handling, selector stability and newest-first history ordering.
- Remaining small UX polish item: improve the comparison panel's message when only one assessment exists.
- No merge or deployment has been performed. `main` and protected baseline branches remain untouched.

### Recent change log

| Date (UTC) | Commit | Change | Validation |
|---|---|---|---|
| 2026-11-17 | `71ac15a` | Corrected IndexedDB integration test for schema version 5 | Browser #134 and backup #226 passed |
| 2026-11-17 | `68799a7` | Added assessment navigation and screen structure | Follow-up checks triggered |
| 2026-11-17 | `00a7253` | Wired original baseline and follow-up assessment forms and comparisons | Browser #136 and backup #228 passed |
| 2026-11-17 | `5eb83f5` | Added assessment screen styling | Backup #229 passed; browser run later superseded |
| 2026-11-17 | `c182d60` | Bumped offline shell cache to v8 | Browser #138 and backup #230 passed |
| 2026-11-17 | `c200531` | Added browser regression test for assessment UI | Later browser checks exposed test sequencing issues; backup #231 passed |
| 2026-11-17 | `ac327d6` | Reloaded seeded assessment records before UI assertions | Later browser checks continued |
| 2026-11-17 | `87f566c` | Added this handover manual to the repository | Browser and backup checks were running at the time |
| 2026-11-17 | `34533cf` | Moved first-keyboard-focus skip-link test to immediately after app load | Backup #44007617283 passed; browser run superseded |
| 2026-11-17 | `8f86c2d` | Added persistent browser-context cleanup on browser-test failure paths | Backup #44008583130 passed; browser #44008583074 exposed stale initial-navigation assertion |
| 2026-11-17 | `94028b8` | Corrected navigation accessibility test sequencing while preserving first-load and tab-change checks | Browser #44008882136 and backup #44008882122 passed |
| 2026-11-17 | `fc17d64` | Added in-flight guards to prevent duplicate baseline/follow-up submissions | Browser #44010024786 and backup #44010024901 passed |
| 2026-11-17 | `7e652de` | Added rapid repeated-submit browser regression test | New test passed; restore count expectation then adjusted |
| 2026-11-17 | `a68cd16` | Aligned restore and cold-start assessment count assertions with dynamic test setup | Browser #44010251181 and backup #44010251174 passed |
| 2026-11-17 | `886c90f` | Added service-layer requirement for baseline before follow-ups and date ordering | Intermediate browser run blocked by expected source/bundle mismatch before bundle sync |
| 2026-11-17 | `47d12e4` | Added UI baseline gate, follow-up status guidance, and minimum date | Intermediate checks correctly detected stale browser service bundle |
| 2026-11-17 | `adb0ef2` | Added follow-up lock explanation and disabled initial form controls in HTML | Intermediate checks correctly detected stale browser service bundle |
| 2026-11-17 | `429154a` | Added browser tests for no-baseline rejection, earlier-date rejection, same-day allowance and UI unlock/date minimum | Intermediate parity run failed because browser bundle had not yet been synchronized |
| 2026-11-17 | `e0241d2` | Synchronized browser assessment service with canonical baseline sequencing rules | Browser #44011654605 passed; backup #44011654603 passed |

### Next actions (resume here)

1. Improve the assessment comparison empty state so a user with one saved assessment is told to add a follow-up before comparing.
2. Recheck assessment history, selector defaults and mobile layout after that small UX change, then run browser and backup validation.
3. Once the assessment UI is signed off, begin the next approved Visual Progress Journey increment. Start with a small, testable slice based on actual saved records only.
4. Keep all work on `V21.2-development`; inspect live head and exact run SHAs after each change. Do not merge or deploy without explicit approval.
5. Keep this handover manual updated with decisions, implementation commits, test outcomes and exact CI links.
