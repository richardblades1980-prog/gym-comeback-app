GYM COMEBACK V13.1 — EXERCISE-SWAP BUG FIX

WHAT’S FIXED
1. Repeatedly swapping an exercise now replaces the same exercise slot every time.
2. A second or later swap no longer gets stuck on the first replacement.
3. Swaps are stored by exercise slot, preventing a replacement from being appended as an extra exercise.
4. Existing V13 name-based swap data remains readable for backward compatibility.
5. Version badge, About section, footer, manifest and service-worker cache identify V13.1.

REGRESSION TESTS TO TRY
- Open a workout and use Safer swap on one exercise. Confirm the replacement occupies the same numbered card.
- Use Safer swap on that replacement and choose a different movement. Confirm the second movement replaces the first in the same card and the exercise count does not increase.
- Repeat a third time, then change to another day and back. Confirm the latest choice remains and no extra card appears.
- Check any previous V13 swaps still display sensibly.
- Recheck personalised week builder, gear-matched workouts, injury-aware alternatives, five workout days, bodyweight weight-field setting, logging, progression, CSV export, JSON backup and restore.

SAFETY
The builder is a transparent rule-based aid, not a medical assessment. It cannot guarantee an exercise is safe. Review every movement, follow clinician restrictions, and stop if symptoms worsen.

BUILD STATUS
JavaScript syntax and ZIP integrity checks are required before release. Packaged for user beta testing; not deployed to GitHub Pages or tested on the user’s phone.
