GYM COMEBACK V20.5 — BACK-TO-TOP & NUMERIC WORKOUT ENTRY

INSTALL / UPDATE
1. Keep your passed V20.4.1 ZIP as the rollback backup.
2. Extract this ZIP.
3. Upload the CONTENTS of the extracted folder to the root of your existing GitHub Pages repository, replacing the previous files.
4. Commit and publish.
5. Open the site in Chrome, refresh, and confirm VERSION V20.5 appears in the top-right badge. If the installed PWA shows an old version, open the website in Chrome once to allow the service worker to update.

WHAT'S NEW
- Adds a large, thumb-friendly “Back to top” button at the bottom of the page.
- The button scrolls smoothly to the top; it respects the app's Reduce Motion preference.
- Weight entries use a decimal numeric keypad hint.
- Reps and timed-set duration entries use an integer numeric keypad hint.
- Numeric fields provide a Done action hint where supported by the device keyboard.
- Existing number validation, units, step sizes and stored values are unchanged.
- All V20.4.1 sequential workout-day locking, manual overrides, V20.3 automatic exercise collapse, V20.2 warm-up/cool-down, individual set counts and prior features are retained.

BETA TEST CHECKLIST
1. Scroll to the very bottom of the page and tap Back to top. Confirm it returns to the top.
2. Test the button on a phone and on a desktop browser.
3. Enable Reduce Motion in Settings and confirm the button still works without animated scrolling.
4. Open an exercise and tap a Weight field. Confirm a decimal-friendly numeric keyboard appears.
5. Tap a Reps field. Confirm an integer numeric keypad appears.
6. For a timed exercise, tap Duration. Confirm an integer numeric keypad appears.
7. Enter values, navigate away and return, and confirm values are retained.
8. Confirm the top-right badge and About section both show V20.5.
9. Confirm V20.4.1 sequential locking, manual override, completed-exercise collapse, warm-up/cool-down, set counts and backup/restore still work.

DEVICE NOTE
The app requests decimal/numeric keyboard layouts using standard HTML inputmode and enterkeyhint attributes. The exact keyboard appearance and Done key are controlled by the device/browser and can vary. Values remain standard numeric inputs; this update does not change the training or progression rules.
