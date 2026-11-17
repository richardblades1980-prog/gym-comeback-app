/* Project Comeback V21.2 — source-preserved five-day Gym programme.
 * This is a transcription of the protected V21.1 base programme, not a
 * canonical exercise catalogue or a published programme version.
 */
(function (global) {
  "use strict";

  const SOURCE = Object.freeze({
    snapshotId: "gym-base-programme-source-v1",
    sourceNamespace: "gym-comeback-v21.1-base-programme",
    sourceFile: "index.html",
    sourceGitBlobSha: "e3eb0093648cc6c5d706bb5b1008b58ec01a5576",
    status: "source-snapshot-not-published-programme"
  });

  function slot(day, position, name, description, groupKey, muscleKeys) {
    const isTimedHold = name === "Plank";
    return Object.freeze({
      slotId: "legacy-base-day-" + String(day).padStart(2, "0") +
        "-slot-" + String(position).padStart(2, "0"),
      position,
      sourceExerciseLabel: name,
      sourceDescription: description,
      sourceGroupKey: groupKey,
      sourceMuscleKeys: Object.freeze(muscleKeys.slice()),
      defaultSetCount: 3,
      defaultProgressionFocus: isTimedHold ? "duration" : "reps",
      defaultRecordingMode: isTimedHold ? "timed-hold" : "reps",
      identityLinkStatus: "unreviewed"
    });
  }

  const DAYS = Object.freeze([
    Object.freeze({
      dayNumber: 1,
      title: "Day 1 — Chest, Back & Quads",
      sourceTip: "Warm up 5–10 minutes. Rest 60–90 seconds. Leg press only if comfortable for your foot; use a pain-free range.",
      slots: Object.freeze([
        slot(1, 1, "Chest Press Machine", "Chest, triceps, front shoulders", "chest", ["chest", "triceps", "shoulders"]),
        slot(1, 2, "Lat Pulldown", "Lats, upper back, biceps", "back", ["back", "lats", "biceps"]),
        slot(1, 3, "Seated Cable Row", "Mid-back, lats, biceps", "back", ["back", "lats", "biceps"]),
        slot(1, 4, "Leg Press", "Quads, glutes, hamstrings assist", "legs", ["quads", "glutes", "hamstrings"]),
        slot(1, 5, "Seated Leg Extension", "Quadriceps", "legs", ["quads"]),
        slot(1, 6, "Dumbbell Lateral Raise", "Side deltoids, upper traps assist", "shoulders", ["shoulders", "traps"]),
        slot(1, 7, "Abdominal Crunch", "Abdominals and obliques", "core", ["abs"])
      ])
    }),
    Object.freeze({
      dayNumber: 2,
      title: "Day 2 — Shoulders, Arms & Hamstrings",
      sourceTip: "Warm up 5–10 minutes. Rest 60–90 seconds. Keep reps controlled; stop if pain increases.",
      slots: Object.freeze([
        slot(2, 1, "Incline Chest Press", "Upper chest, triceps, front shoulders", "chest", ["chest", "triceps", "shoulders"]),
        slot(2, 2, "Shoulder Press Machine", "Deltoids, triceps, upper traps assist", "shoulders", ["shoulders", "triceps", "traps"]),
        slot(2, 3, "Seated Hamstring Curl", "Hamstrings, calves assist", "legs", ["hamstrings", "calves"]),
        slot(2, 4, "Seated Leg Extension", "Quadriceps", "legs", ["quads"]),
        slot(2, 5, "Cable Triceps Pushdown", "Triceps, forearms stabilise", "arms", ["triceps", "forearms"]),
        slot(2, 6, "Dumbbell Biceps Curl", "Biceps, forearms stabilise", "arms", ["biceps", "forearms"]),
        slot(2, 7, "Prone or Lying Leg Curl", "Hamstrings, calves assist", "legs", ["hamstrings", "calves"])
      ])
    }),
    Object.freeze({
      dayNumber: 3,
      title: "Day 3 — Full Body",
      sourceTip: "Keep this session moderate and leave recovery between strength days. Choose comfortable variations.",
      slots: Object.freeze([
        slot(3, 1, "Chest Press Machine", "Chest, triceps and front shoulders", "chest", ["chest", "triceps", "shoulders"]),
        slot(3, 2, "Lat Pulldown", "Lats, upper back and biceps", "back", ["back", "lats", "biceps"]),
        slot(3, 3, "Chair Squat / Sit-to-Stand", "Quadriceps and glutes", "legs", ["quads", "glutes"]),
        slot(3, 4, "Glute Bridge", "Glutes and hamstrings", "legs", ["glutes", "hamstrings"]),
        slot(3, 5, "Dumbbell Biceps Curl", "Biceps and forearms", "arms", ["biceps", "forearms"]),
        slot(3, 6, "Plank", "Abs and trunk stabilisers", "core", ["abs"])
      ])
    }),
    Object.freeze({
      dayNumber: 4,
      title: "Day 4 — Upper Body",
      sourceTip: "Focus on controlled upper-body work. Use comfortable ranges and avoid painful movements.",
      slots: Object.freeze([
        slot(4, 1, "Incline Chest Press", "Upper chest, triceps and front shoulders", "chest", ["chest", "triceps", "shoulders"]),
        slot(4, 2, "Seated Cable Row", "Mid-back, lats and biceps", "back", ["back", "lats", "biceps"]),
        slot(4, 3, "Shoulder Press Machine", "Deltoids and triceps", "shoulders", ["shoulders", "triceps"]),
        slot(4, 4, "Dumbbell Lateral Raise", "Side deltoids", "shoulders", ["shoulders", "traps"]),
        slot(4, 5, "Cable Triceps Pushdown", "Triceps", "arms", ["triceps", "forearms"]),
        slot(4, 6, "Dumbbell Biceps Curl", "Biceps and forearms", "arms", ["biceps", "forearms"])
      ])
    }),
    Object.freeze({
      dayNumber: 5,
      title: "Day 5 — Lower Body & Core",
      sourceTip: "Use only pain-free ranges. If standing or leg work aggravates symptoms, skip it and choose a comfortable alternative.",
      slots: Object.freeze([
        slot(5, 1, "Seated Hamstring Curl", "Hamstrings", "legs", ["hamstrings", "calves"]),
        slot(5, 2, "Seated Leg Extension", "Quadriceps", "legs", ["quads"]),
        slot(5, 3, "Glute Bridge", "Glutes and hamstrings", "legs", ["glutes", "hamstrings"]),
        slot(5, 4, "Chair Squat / Sit-to-Stand", "Quadriceps and glutes", "legs", ["quads", "glutes"]),
        slot(5, 5, "Calf Raise", "Calf muscles", "legs", ["calves"]),
        slot(5, 6, "Abdominal Crunch", "Abdominals and obliques", "core", ["abs"])
      ])
    })
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validate() {
    const slotIds = new Set();
    let slotCount = 0;
    const expectedCounts = [7, 7, 6, 6, 6];

    if (DAYS.length !== 5) throw new Error("The source programme must contain exactly five days.");
    DAYS.forEach((day, dayIndex) => {
      if (day.dayNumber !== dayIndex + 1) throw new Error("Programme day numbers must be ordered from 1 to 5.");
      if (day.slots.length !== expectedCounts[dayIndex]) throw new Error("Unexpected slot count on programme day " + day.dayNumber + ".");
      day.slots.forEach((item, index) => {
        if (item.position !== index + 1) throw new Error("Programme slot order is invalid on day " + day.dayNumber + ".");
        if (!item.slotId || slotIds.has(item.slotId)) throw new Error("Programme slot IDs must be unique.");
        if (!item.sourceExerciseLabel || !item.sourceGroupKey || !Array.isArray(item.sourceMuscleKeys) || !item.sourceMuscleKeys.length) {
          throw new Error("A source programme slot is incomplete.");
        }
        if (item.identityLinkStatus !== "unreviewed") throw new Error("Source identity status must remain unreviewed until curation approval.");
        if (Object.prototype.hasOwnProperty.call(item, "exerciseDefinitionId") ||
            Object.prototype.hasOwnProperty.call(item, "exerciseVariationId")) {
          throw new Error("The source snapshot must not assign canonical exercise identities.");
        }
        slotIds.add(item.slotId);
        slotCount++;
      });
    });
    return { valid: true, dayCount: DAYS.length, slotCount, slotCounts: expectedCounts.slice() };
  }

  function listDays() {
    return DAYS.map(clone);
  }

  function getDay(dayNumber) {
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 5) {
      throw new Error("Programme day must be an integer from 1 to 5.");
    }
    return clone(DAYS[dayNumber - 1]);
  }

  global.ProjectComebackGymBaseProgramme = Object.freeze({
    source: SOURCE,
    validate,
    listDays,
    getDay
  });
})(window);
