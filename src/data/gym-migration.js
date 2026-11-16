/* Project Comeback V21.2A — pure V21.1 Gym workout normalisation.
 * Source values are retained verbatim alongside typed convenience fields.
 * Completion is inferred only from explicit legacy set-status snapshots.
 */
(function (global) {
  "use strict";

  function parseJson(value, key) {
    if (value === null || value === undefined || value === "") return null;
    try { return JSON.parse(value); }
    catch (error) { throw new Error("Invalid legacy JSON in " + key + "."); }
  }

  function safePart(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]+/g, "-");
  }

  function numericOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function collectStatusSnapshots(snapshot, week, day, date) {
    const prefix = "gym-comeback-set-status-v1-" + week + "-" + day + "-" + (date || "undated") + "-";
    return Object.entries(snapshot).filter(([key]) => key.startsWith(prefix)).map(([key, raw]) => ({
      key,
      states: parseJson(raw, key) || {}
    })).filter(item => item.states && typeof item.states === "object" && !Array.isArray(item.states));
  }

  function inferCompletion(exercises, snapshots) {
    if (!exercises.length || !snapshots.length) return "incomplete";
    const allComplete = snapshots.some(snapshot => exercises.every(exercise => {
      const count = Math.max(1, Math.min(8, Number(exercise.setCount) || 3));
      return Array.from({ length: count }, (_, index) => index + 1)
        .every(number => snapshot.states[String(exercise.name) + "::" + number] === "complete");
    }));
    return allComplete ? "completed" : "incomplete";
  }

  function normaliseGymSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new Error("A legacy snapshot object is required.");
    }
    const sessions = [];
    const exerciseRecords = [];
    const setRecords = [];
    const warnings = [];
    const keys = Object.keys(snapshot).sort();
    for (const key of keys) {
      const match = /^gym-comeback-w(\d+)-d(\d+)$/.exec(key);
      if (!match) continue;
      const week = Number(match[1]);
      const day = Number(match[2]);
      const log = parseJson(snapshot[key], key);
      if (!log || typeof log !== "object" || Array.isArray(log)) {
        warnings.push({ key, reason: "Workout log is empty or not an object; retained only in legacyRecords." });
        continue;
      }
      if (!Array.isArray(log.exercises)) {
        warnings.push({ key, reason: "Workout log has no exercises array; retained only in legacyRecords." });
        continue;
      }
      const date = typeof log.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(log.date) ? log.date : null;
      const id = "gym-session-w" + week + "-d" + day;
      const exerciseData = log.exercises.map((exercise, index) => ({
        source: exercise,
        index,
        name: typeof exercise.name === "string" ? exercise.name : "Exercise " + (index + 1),
        setCount: Math.max(1, Math.min(8, Number(exercise.setCount) || (Array.isArray(exercise.sets) ? exercise.sets.length : 3)))
      }));
      const snapshots = collectStatusSnapshots(snapshot, week, day, date);
      const status = inferCompletion(exerciseData, snapshots);
      const durationRaw = log.sessionTime;
      const durationMinutes = numericOrNull(durationRaw);
      const session = {
        id,
        moduleId: "gym",
        week,
        day,
        date,
        status,
        durationMinutes,
        durationSource: durationRaw === undefined || durationRaw === "" ? null : "legacy-sessionTime",
        cardioType: log.cardioType || "",
        cardioTime: log.cardioTime || "",
        footFeeling: log.footFeeling || "",
        bodyWeight: numericOrNull(log.bodyWeight),
        warmup: log.warmup || null,
        cooldown: log.cooldown || null,
        notes: log.notes || "",
        legacyKey: key,
        legacyRawValue: snapshot[key],
        completionEvidenceKeys: snapshots.map(item => item.key)
      };
      sessions.push(session);
      exerciseData.forEach(item => {
        const exerciseId = id + "-exercise-" + String(item.index + 1);
        const exerciseRecord = {
          id: exerciseId,
          moduleId: "gym",
          sessionId: id,
          name: item.name,
          setCount: item.setCount,
          progressionFocus: item.source.progressionFocus || "",
          recordingMode: item.source.recordingMode || "",
          note: item.source.note || "",
          rir: item.source.rir || "",
          response: item.source.response || "",
          legacyRawValue: JSON.stringify(item.source)
        };
        exerciseRecords.push(exerciseRecord);
        const sets = Array.isArray(item.source.sets) ? item.source.sets : [];
        sets.forEach((set, setIndex) => {
          setRecords.push({
            id: exerciseId + "-set-" + String(setIndex + 1),
            moduleId: "gym",
            sessionId: id,
            exerciseRecordId: exerciseId,
            setNumber: setIndex + 1,
            weight: set.weight === undefined ? "" : String(set.weight),
            reps: set.reps === undefined ? "" : String(set.reps),
            duration: set.duration === undefined ? "" : String(set.duration),
            targetDuration: set.targetDuration === undefined ? "" : String(set.targetDuration),
            legacyRawValue: JSON.stringify(set)
          });
        });
      });
    }
    return {
      sessions,
      exerciseRecords,
      setRecords,
      warnings,
      counts: {
        sessions: sessions.length,
        completedSessions: sessions.filter(item => item.status === "completed").length,
        incompleteSessions: sessions.filter(item => item.status === "incomplete").length,
        exerciseRecords: exerciseRecords.length,
        setRecords: setRecords.length
      }
    };
  }

  global.ProjectComebackGymMigration = Object.freeze({ normaliseSnapshot: normaliseGymSnapshot });
})(window);
