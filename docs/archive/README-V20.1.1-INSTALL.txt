GYM COMEBACK V20.1.1 – SET COUNT FIX

INSTALL / UPDATE
1. Keep your V20.1 ZIP as a backup.
2. Extract this ZIP.
3. Upload the CONTENTS of this folder to the root of your existing GitHub Pages repository, replacing the old files.
4. Commit/publish.
5. Refresh the website and confirm V20.1.1 appears in the top-right badge.

FIX
- Selecting 1–8 sets now updates the actual set cards for that exercise.
- Existing entries are saved before the set structure is rebuilt.
- New set count is saved after rebuilding and retained when reopening the workout.
- Reducing set count removes completion statuses for removed sets.
- Per-exercise progression preferences remain available.

TEST
- Set one exercise to 2 sets; confirm only SET 1 and SET 2 appear.
- Set another to 4 sets; confirm SET 1 through SET 4 appear.
- Navigate away and return; confirm both counts remain independent.
- Record values, change count, and confirm existing set entries remain.
- Complete all displayed sets and confirm completion status works.

This is a beta fix. Keep V20.1 as a backup until tested.
