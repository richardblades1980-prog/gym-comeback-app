GYM COMEBACK V20 — ADAPTIVE TRAINING ENGINE FOUNDATION

WHAT'S NEW
- Daily readiness check-in on the Progress page.
- Records energy (1–5), general fatigue (1–5), muscle soreness (1–5), and pain/symptoms (0–10).
- Rules-based, explainable guidance:
  * Pain/symptoms 7–10: pause aggravating activity and seek prompt qualified advice.
  * Pain/symptoms 4–6: ease back and review symptoms; avoid movements that increase symptoms.
  * Low energy, high fatigue or high soreness: recovery focus; consider an easier session or more recovery.
  * Average check-in: steady pace; repeat familiar work and avoid pushing progression.
  * Favourable check-in: follow the established planned session with controlled technique.
- Check-in saved by local calendar date on this device.
- Readiness records included in Comeback backup export and merged on import.
- Reset all progress clears readiness check-ins while retaining profile, equipment and programme setup.
- V19.4 exercise-specific Adaptive Training Review retained.
- Version badge, About, manifest and service-worker cache updated to V20.

SAFETY AND LIMITATIONS
- This is a simple self-report check-in, not a medical assessment, diagnosis or medical clearance.
- A favourable score is not permission to train through pain or ignore unusual symptoms.
- Recommendations are advisory only; no workout, exercise selection, load or reps are changed automatically.
- Users should stop aggravating activity and seek appropriate qualified advice for new, severe, persistent or worsening symptoms.
- V20 does not yet use a multi-day recovery trend or automatically modify a training plan. Those are later milestones and require further testing.

INSTALL
1. Keep the V19.6 ZIP as your stable backup.
2. Extract this V20 ZIP.
3. Upload the CONTENTS of the extracted folder to the same GitHub Pages root, replacing previous app files. Do not upload the ZIP itself or put the files in an extra nested folder.
4. Commit and publish.
5. Open the website in Chrome and refresh. If an installed PWA shows an old version, close it and open the website in Chrome to allow the service worker to update.
6. Confirm VERSION V20 appears at the top-right and About says V20.

BETA TEST CHECKLIST
- Open Progress and find Today's training readiness.
- Save a favourable check-in (energy 4, fatigue 1, soreness 1, pain 0): expect READY FOR YOUR PLANNED SESSION.
- Save an average check-in (energy 3, fatigue 3, soreness 2, pain 0): expect STEADY PACE.
- Save low energy/high fatigue (energy 2, fatigue 4): expect RECOVERY FOCUS.
- Save pain 5: expect EASE BACK.
- Save pain 8: expect PAUSE.
- Reload the app and confirm today's check-in is restored.
- Export a backup, then import it on another device and confirm the readiness check-in is included.
- Confirm existing workout records, exercise swaps, gear and profile remain intact.
- Use Reset all progress only if you intend to clear all training history; confirm readiness history is cleared too.

TECHNICAL CHECKS
- JavaScript syntax check.
- HTML parser check.
- Readiness rule unit checks.
- Backup/restore field presence checks.
- ZIP integrity check.

This package is a beta. It has not been deployed to GitHub Pages or tested on physical phones/computers in this build session.
