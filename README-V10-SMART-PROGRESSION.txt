GYM COMEBACK V10 — SMART PROGRESSION

Built from the V9.1 beta-tested package. V9.1 remains unchanged as the stable backup.

What is new
- Each exercise now records reps in reserve (RIR) for the last set and symptom response (better/no symptoms, same/manageable, worse/aggravated).
- Exercise cards display a progression suggestion based on the current session and the most recent earlier log for the same exercise on the same workout day.
- Suggestions prioritise reps before load. A small load increase is suggested only when all three sets reach 12 reps, RIR is at least 2, and symptoms are stable or better.
- Worsening symptoms override progression and advise holding/reducing or modifying the movement.
- Suggestions are advisory only: no weight, reps, or workout plan is changed automatically.
- Existing logs remain readable; new fields are optional and older backups remain supported.
- Service-worker cache version updated for the V10 release.

Beta tests
1. Open an exercise and confirm RIR and symptom-response controls appear.
2. Enter fewer than 12 reps in one set: the suggestion should favour holding load and building reps.
3. Enter 12 reps in all three sets, choose 2+ reps in reserve, and choose symptoms same/better: the app should suggest a small load increase.
4. Change symptom response to worse: the advice must switch to hold/reduce and must not suggest progressing.
5. Reload the app and confirm RIR/symptom entries persist.
6. Check old logs, CSV export, and JSON backup/restore still work.
7. Test on your phone and check that the controls remain usable on a narrow screen.

Important
- This is rules-based training support, not medical advice. Stop movements that aggravate symptoms and seek qualified guidance when appropriate.
- The app uses local device storage. Download a JSON backup before switching devices or clearing browser data.
- This ZIP has not been deployed to GitHub Pages and has not been fully tested on a phone.
