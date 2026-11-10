GYM COMEBACK V21.0 — PRIMARY AND SECONDARY TRAINING OBJECTIVES

BUILT FROM
Passed V20.7 Smart Set Carry-Forward baseline. Existing workout functionality is retained.

NEW IN V21.0
1. Users can choose one primary training objective: muscle development, strength, muscular endurance, general fitness, or not sure — recommend one for me.
2. Users can optionally choose a different secondary objective, or select no secondary objective.
3. Primary and secondary objectives are saved in the existing local profile.
4. Users can change objectives later. When changing an already-saved objective, the app explains that future recommendations may change and asks for confirmation.
5. Previous workout records, weights, repetitions and progress are not rewritten or deleted when objectives change.
6. Objective selections are included in the existing profile backup/restore data.

IMPORTANT SCOPE
V21.0 records the user's objectives. It does not yet use them to make adaptive progression decisions. Objective-aware progression is developed and validated in later V21 releases.

BETA TEST
- Open Coach and find Your training objectives at the top.
- Select each primary objective and save.
- Select a secondary objective and save.
- Confirm the same objective cannot be selected as both primary and secondary.
- Change an already-saved objective and confirm the explanation/confirmation appears.
- Cancel a change and confirm the previous selection remains.
- Confirm changes save after reloading the app.
- Export a backup and confirm primaryObjective and secondaryObjective are present in the profile.
- Restore/merge the backup on a test profile and confirm profile objectives import when no local profile exists.
- Confirm existing workout logs, set carry-forward, set completion, workout locking, warm-up/cool-down, readiness, backups and progress still work.

UPLOAD
Extract the ZIP and upload the contents of the gc206 folder to the root of your GitHub Pages repository, replacing the previous files. Keep the V20.7 ZIP untouched as the stable rollback backup. Export a fresh data backup before updating.

DATA
Workout records remain stored locally in the browser on this device. Training objectives are saved as part of the local profile and included in backups.
