GYM COMEBACK V21.1 — STAGE A: PROGRESSION FOUNDATIONS

BUILT FROM
Passed V21.0 Training Objectives beta. The V21.0 workout screens, local data model, exercise settings, workout history and backup behaviour are retained.

NEW IN STAGE A
1. Each exercise receives a progression-method suggestion based on the selected primary training objective and the movement type. Timed holds and cardio activities favour duration; strength favours weight for resistance exercises; muscular endurance favours repetitions; muscle development favours repetitions; general fitness and an undecided objective favour balanced progression.
2. The suggestion explains why it was made and shows the user's current method separately. It does not silently change the user's choice.
3. All six existing methods remain available: reps first, weight first, duration first, sets first, balanced progression and manual progression.
4. Changing an exercise's progression method now explains the likely trade-offs and asks for confirmation. Cancelling restores the previous choice.
5. Previous workout records remain available after a method change and are not rewritten.

SCOPE LIMIT
This is Stage A only. It establishes method recommendations and user control; it does not yet implement the complete adaptive progression decision engine, recovery hierarchy, progression timeline or weekly/monthly reviews. Those belong to later V21.1 stages.

BETA CHECKLIST
- Open Train and inspect several exercises.
- Confirm timed holds/cardio suggest Duration first.
- In Coach, choose Strength as primary, return to Train and confirm resistance exercises suggest Weight first.
- Choose Muscular endurance and confirm resistance exercises suggest Reps first.
- Choose Muscle development and confirm resistance exercises suggest Reps first.
- Choose General fitness or Not sure and confirm Balanced progression is suggested.
- Change an exercise method; read the explanation and confirm.
- Change another method but cancel; confirm the old method remains selected.
- Confirm different exercises can keep different methods.
- Save a workout, change a method, and confirm previous workout records remain.
- Confirm set count, carry-forward, set completion, workout-day locking, readiness, backup/restore and existing progress screens still work.

INSTALL
1. Export a fresh Gym Comeback data backup before updating.
2. Keep the passed V20.7 and V21.0 ZIPs as rollback copies.
3. Extract this ZIP and upload the contents of the gc206 folder to the root of the GitHub Pages repository, replacing the previous app files.
4. Open the app and check the top-right version badge reads VERSION V21.1. If an old version appears, refresh once and allow the service worker to update.
