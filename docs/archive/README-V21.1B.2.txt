GYM COMEBACK V21.1B.2 — SELECTABLE TIMED REPETITION RECORDING

BASE CHECKPOINT
Built directly from the V21.1B.1 beta package, which the user reported worked well in initial testing. V21.1B.1 remains the previous checkpoint.

WHAT CHANGED
1. Adds a separate per-exercise Set recording mode selector:
   - Normal repetitions
   - Timed hold
   - Timed repetitions
2. Recording mode is independent of the exercise's progression preference. Changing from Duration first to Weight first (or another progression preference) does not remove a selected timer.
3. Timed repetitions record, per set:
   - Weight used, where applicable
   - Actual elapsed time (stopwatch or manual entry/correction)
   - Number of repetitions completed in that time
   - Target duration separately from actual elapsed time
4. Timed holds continue to record actual elapsed time without a repetitions field.
5. Normal repetitions continue to record reps without a timer.
6. For timed repetitions, the progression review counts a set as fully recorded only when both actual time and repetitions are present. Missing optional data does not prevent workout logging or saving.
7. Existing duration-first exercises are migrated to Timed hold by default, preserving their previous timed-set behaviour. Other existing exercises default to Normal repetitions. Users can change the recording mode at any time.

WHAT IS PRESERVED
- All V21.1B.1 workout logging fixes, session-scoped completion status, stopwatch behaviour, exercise collapse behaviour and factory reset remain in place.
- V21.1A.2 objective-to-plan integration remains intact.
- Recording mode is stored with the existing per-exercise configuration and included in the existing exercise configuration backup.
- Progression preference remains a separate setting and continues to control the coaching emphasis.
- No Hiking Preparation or universal equipment library changes are included in this release.

INSTALL
1. Download and unzip this package.
2. Upload the contents of the gc206 folder to the same GitHub Pages deployment location, replacing the previous release files.
3. Keep the folder structure intact, including assets, icons, manifest.webmanifest, index.html and sw.js.
4. Refresh/reopen Gym Comeback.
5. Confirm the fixed top-right badge and About section both show V21.1B.2.
6. The service worker cache name has changed to V21.1B.2. If the previous version remains visible, close the app/browser tab completely and reopen it. If necessary, clear the site's old cached data and reload.

BETA TEST CHECKLIST
A. Recording mode independence
- Choose an exercise and set Recording mode to Timed repetitions.
- Confirm a stopwatch, target duration, actual time field, repetitions field and weight field (where applicable) are visible.
- Change Progression preference to Weight first and accept the confirmation.
- Confirm Timed repetitions remains selected and all fields remain visible.
- Change progression preference again (e.g. Reps first or Balanced) and confirm recording mode remains unchanged.

B. Timed repetition logging
- Start and stop the stopwatch; confirm actual time is recorded.
- Enter repetitions completed during that time.
- Enter/change weight where applicable.
- Save the workout and confirm the set record retains weight, actual duration and reps.
- Try manual time entry without using the stopwatch.
- Test each set independently and confirm each set keeps its own values.
- Leave either reps or time blank and confirm the workout still saves; progression review should not count that set as a fully recorded timed-repetition result.

C. Other recording modes
- Select Timed hold; confirm timer and actual time appear but no repetitions field appears.
- Select Normal repetitions; confirm reps appear and timer fields disappear.
- Confirm changing recording mode does not change the progression preference.
- Confirm changing progression preference does not change recording mode.

D. Regression checks
- Confirm existing V21.1B.1 session completion behaviour still works.
- Confirm existing timed-hold stopwatch still starts, stops, resets and accepts manual correction.
- Confirm exercises remain expanded until manually collapsed.
- Confirm objective-to-plan integration and previous workout history remain intact.
- Confirm backup export includes exercise configurations and restore retains recording mode.

VALIDATION NOTE
This package is source-checked and archive-checked. It has not been live-tested in a browser, on Android, or on the user's deployed GitHub Pages site in this build session. User beta testing is still required.

Gym Comeback is a beta training journal. Recommendations are guidance, not medical clearance.
