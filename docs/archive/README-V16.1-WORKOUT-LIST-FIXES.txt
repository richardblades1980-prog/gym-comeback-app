GYM COMEBACK V16.1 — WORKOUT LIST FIXES (BETA)

BASED ON: Passed Gym Comeback V16.

FIXES
- Cardio/warm-up machines (treadmill, bike, elliptical, rower, etc.) remain available in the Exercise Library but are not inserted into the everyday strength workout. Record cardio using the existing cardio type and minutes fields.
- The library clearly labels cardio items as “Log in cardio fields” rather than adding them as strength exercise cards.
- Exercises already present in a day are labelled “Already in this workout” and cannot be added again from the library.
- Existing duplicate extras are deduplicated in the displayed workout, and cardio extras from older saved settings are ignored by the strength workout display.
- The regular programme and custom gear-matched workouts remain separate from any future Circuit Training feature. Circuit Training is not introduced in V16.1.

PRESERVED
- V16 personalisation and accessibility refinements.
- Five workout days, exercise swaps, smart progression, injury-aware alternatives, equipment matching, progress charts, bodyweight tracking and JSON backup/restore.
- Existing workout records and local storage keys.

TEST CHECKLIST
1. Open each workout day and confirm no duplicate exercise cards appear.
2. Search the Exercise Library for treadmill, stationary bike and elliptical; they should say “Log in cardio fields” and not be added as workout exercises.
3. Try adding an exercise that is already in the selected day; it should be labelled “Already in this workout”.
4. Add a new non-cardio exercise and confirm it appears once.
5. Test exercise swaps, saved workout logging, progress and JSON backup/restore.
6. Test on phone and desktop.

INSTALL
1. Keep the passed V16 ZIP as a backup.
2. Extract this ZIP and upload the package contents to GitHub Pages, preserving folder structure.
3. Commit and wait for deployment. The service-worker cache name has been updated. Do not clear site storage or browser data; that can erase local records.

This beta has been checked for JavaScript syntax, HTML ID uniqueness, manifest validity and ZIP integrity. Real browser/device testing is still required.
