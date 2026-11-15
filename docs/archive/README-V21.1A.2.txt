GYM COMEBACK V21.1A.2 — OBJECTIVE-TO-PLAN INTEGRATION FIX

This update fixes an integration gap found during mobile beta testing.

WHAT CHANGED
- The selected primary training objective now drives the personalised workout's displayed goal.
- Exercise substitution priorities use the selected primary objective rather than an outdated legacy profile goal.
- The Coach plan suggestion uses the same objective-aware goal.
- If the primary objective is still "Not sure — recommend one for me", the existing profile goal remains the fallback.
- The secondary objective remains supportive and does not override the primary objective.

WHAT IS PRESERVED
- Workout history and logged results.
- Exercise-specific progression preferences.
- Existing profile details and saved equipment.

INSTALL
1. Replace the previous deployed app files with the contents of this ZIP.
2. Allow the service worker to update; if the old version remains visible, close the app/browser tab and reopen it.
3. Confirm the version badge reads V21.1A.2.

BETA TEST
1. Set Primary objective to General fitness and save.
2. Open Train > Make this workout fit your setup > Build my personalised week.
3. Confirm the Goal summary says Improve general fitness.
4. Change Primary objective to Muscular endurance, save, and rebuild the week.
5. Confirm the Goal summary says Improve endurance.
6. Confirm the exercise plan and Coach plan suggestion follow the primary objective.
7. Confirm exercise-specific progression preferences and workout history remain intact.

This is a beta build. Recommendations are guidance, not medical clearance. Review exercise substitutions and comfort before training.
