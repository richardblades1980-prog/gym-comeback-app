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

## 8. Current work in progress — verify live state first

The assessment data foundation has been implemented and its previous validation passed:
- Browser validation #134 — success.
- Backup validation #226 — success.
- Both were for commit `71ac15a11f90c03d3492f23a90a06c6ffaac4652`.

After those checks passed, the assessment user interface was started:
- Added an Assessments navigation tab.
- Added original baseline form, follow-up form, Before & Now selectors, comparison display and assessment history.
- Connected forms to the immutable assessment service.
- Added styling and bumped service-worker cache to v8.
- Added browser regression coverage for the assessment UI and comparisons.

**These UI changes are not yet confirmed by CI.** The last known commits before the handover manual were:
- `68799a7` — assessment screen structure.
- `00a7253` — baseline/follow-up UI behavior.
- `5eb83f5` — assessment styling.
- `c182d60` — offline cache v8.
- `c200531` — assessment UI regression tests.
- `ac327d6` — reload seeded assessment records before UI assertions.

The exact live branch head may have advanced when this manual is read. Always inspect the GitHub branch and Actions before acting.

**Immediate next actions:**
1. Check current branch head and Actions runs for `V21.2-development`.
2. Inspect any failed browser run logs. In particular, verify the new UI test's expected comparison labels/values and assessment record counts.
3. Fix failures on the development branch only and rerun until browser and backup validation are green.
4. Review the UI for accessibility, empty states, duplicate form submission, date ordering and missing-measure behavior.
5. Update this manual with the final validated commit SHA, CI run links and any new decisions.
6. Only then move to the next approved progress-journey feature. Do not deploy or merge without explicit approval.

## 9. How the user wants collaboration to work

- Give concise, meaningful progress updates when a milestone is reached or a problem is found.
- Do not flood the user with routine internal steps.
- Explain what changed, why it matters and whether validation passed.
- Be honest about what is implemented versus merely designed/approved.
- If the repository or tools are unavailable in a new chat, explain that clearly and ask the user to reconnect or provide the relevant files; do not pretend to have committed code.
- Never ask the user to repeat context already contained in this guide.
