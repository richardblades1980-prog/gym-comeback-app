GYM COMEBACK V18 — WORKOUT EXPERIENCE REFINEMENTS

Built from the passed V17 Smart Rest Timer beta. This release deliberately refines the existing experience rather than adding a new major feature.

CHANGES
- Phone set-entry cards are easier to use: each set gets a full-width card with weight and reps fields side-by-side and a prominent set-completed/rest button.
- Larger touch targets for key buttons and timer controls.
- Clear keyboard focus indicators for accessibility.
- Exercise cards are visibly highlighted while their controls are in use.
- Respects the device's reduced-motion preference.
- Corrected the app manifest version label and updated the service-worker cache name for V18.

PRESERVED BY DESIGN
All five workout days, exercise library and swaps, duplicate prevention, equipment matching, smart progression, injury-aware alternatives, bodyweight weight-field preference, progress charts, rest timer and settings, local storage, JSON backup/restore, and V17 version history.

TEST ON PHONE
1. Check workout set cards are readable and comfortable to tap.
2. Enter weight and reps for sets 1–3 and verify values remain after navigating away and back.
3. Tap SET COMPLETED — START REST and test add time, skip, cancel, and the BOOM alert.
4. Try exercise swapping and ensure there are no duplicates.
5. Check Progress, My Gear, Coach, and Settings.
6. Export a JSON backup and ensure it downloads. Do not clear browser data during testing.

INSTALL
Extract the ZIP and upload the contents into the existing GitHub Pages repository using the same process as previous releases. Keep the directory structure intact. After Pages updates, refresh the browser. If an older version is cached, close and reopen the site/app first; do not clear site data because that can erase local records.

This is a beta package. Syntax, manifest, HTML ID and ZIP checks should be performed before release; actual phone and PC testing is still required. It has not been deployed by the assistant.
