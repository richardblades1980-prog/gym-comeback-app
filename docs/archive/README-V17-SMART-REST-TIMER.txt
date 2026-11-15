GYM COMEBACK V17 — SMART REST TIMER BETA

Built from the passed V16.1 stable release. V16.1 remains unchanged as the rollback copy.

WHAT'S NEW
- Tap “SET COMPLETED — START REST” on a set to launch the timer.
- Configure a default rest period in Plan → Smart rest timer.
- Override the rest period per exercise if desired.
- Full-screen, large countdown with progress bar.
- Add 15 seconds, skip rest, or cancel.
- Big BOOM / TIME FOR YOUR NEXT SET visual finish.
- Select sound + vibration, sound only, vibration only, or visual only. Device/browser support and permissions affect sound/vibration.
- Countdown uses a saved end timestamp, so it catches up after switching apps or reloading. Some mobile browsers may pause timers or restrict audio while backgrounded; the visual alert appears when the app is foregrounded.

IMPORTANT BEHAVIOUR
The set button starts the rest timer; it does not write or mark reps/weight in the workout log. Continue recording reps and weight in the existing fields and save the workout as before. The timer does not change your exercise progression rules or medical restrictions. Rest periods are suggestions, not requirements; take longer if you need it.

TEST CHECKLIST
1. Open a workout and tap a set's completion button.
2. Confirm large countdown and progress bar appear.
3. Add 15 seconds and confirm it extends the countdown.
4. Skip rest and confirm the BOOM screen appears.
5. Dismiss it and confirm you return to the workout.
6. Change the default rest in Plan and check the button uses it.
7. Set a per-exercise override and check it takes priority.
8. Test sound/vibration settings if permitted by your device.
9. Start a timer, navigate to another tab or reload; confirm remaining time is recovered.
10. Regression test exercise swapping, logging, progress charts, bodyweight tracking, and JSON backup/restore.

SAFETY & DATA
- No workout records are intentionally changed by timer actions.
- Do not clear browser storage during testing.
- Keep the V16.1 ZIP as the known-good backup.
- Build/ZIP checks are not a substitute for phone and PC beta testing.
