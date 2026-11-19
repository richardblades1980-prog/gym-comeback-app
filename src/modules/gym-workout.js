/* Project Comeback V21.2 — persisted Gym workout session engine.
 * Keeps source programme slots distinct from canonical exercise identities.
 */
(function (global) {
  "use strict";

  const PROGRAMME_ID = "gym-base-programme-source-v1";
  const MAX_SETS = 8;
  const REST_PRESETS = Object.freeze([45, 60, 75, 90, 120, 150, 180]);
  const SET_STATUSES = Object.freeze(["locked", "not-started", "in-progress", "completed"]);

  function requiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) throw new Error(label + " is required.");
    return value;
  }
  function makeId(prefix) {
    const uuid = global.crypto && typeof global.crypto.randomUUID === "function"
      ? global.crypto.randomUUID()
      : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    return prefix + "-" + uuid;
  }
  function dateIsValid(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + "T00:00:00Z");
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function dbService() {
    if (!global.ProjectComebackDB) throw new Error("Load database.js before the Gym workout service.");
    return global.ProjectComebackDB;
  }
  function programmeService() {
    if (!global.ProjectComebackGymBaseProgramme) throw new Error("Load gym-base-programme.js before the Gym workout service.");
    return global.ProjectComebackGymBaseProgramme;
  }
  function sortSets(a, b) {
    return Number(a.setNumber) - Number(b.setNumber);
  }

  async function loadSession(sessionId) {
    requiredString(sessionId, "Gym session ID");
    const db = dbService();
    const session = await db.get("sessions", sessionId);
    if (!session || session.moduleId !== "gym") return null;
    const [exerciseRecords, allSets] = await Promise.all([
      db.getAllByIndex("exerciseRecords", "by_session", sessionId),
      db.getAllByIndex("setRecords", "by_session", sessionId)
    ]);
    const setsByExercise = new Map();
    allSets.forEach(set => {
      if (!setsByExercise.has(set.exerciseRecordId)) setsByExercise.set(set.exerciseRecordId, []);
      setsByExercise.get(set.exerciseRecordId).push(set);
    });
    exerciseRecords.sort((a, b) => Number(a.position) - Number(b.position));
    return {
      session,
      exerciseRecords: exerciseRecords.map(exercise => Object.assign({}, exercise, {
        sets: (setsByExercise.get(exercise.id) || []).sort(sortSets)
      }))
    };
  }

  async function findInProgress(day, date, week) {
    if (!Number.isInteger(day) || day < 1 || day > 5) throw new Error("Choose a programme day from 1 to 5.");
    if (!dateIsValid(date)) throw new Error("Workout date must be a valid YYYY-MM-DD date.");
    week = week === undefined ? 1 : week;
    if (!Number.isInteger(week) || week < 1) throw new Error("Programme week must be a positive integer.");
    const db = dbService();
    const sessions = await db.getAllByIndex("sessions", "by_module_date", ["gym", date]);
    const existing = sessions
      .filter(item => item.moduleId === "gym" && item.status === "in-progress" &&
        item.day === day && Number(item.week || 1) === week && item.programmeSourceId === PROGRAMME_ID)
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    return existing.length ? loadSession(existing[0].id) : null;
  }

  async function findPreviousWeekValues(day, week) {
    if (week <= 1) return new Map();
    const db = dbService();
    const sessions = (await db.getAll("sessions"))
      .filter(session => session.moduleId === "gym" &&
        Number(session.day) === day &&
        Number(session.week || 1) < week &&
        session.programmeSourceId === PROGRAMME_ID &&
        (session.status === "in-progress" || session.status === "completed"))
      .sort((a, b) =>
        Number(b.week || 1) - Number(a.week || 1) ||
        String(b.date || "").localeCompare(String(a.date || "")) ||
        String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))
      );
    const snapshots = await Promise.all(sessions.map(async session => {
      const [exercises, sets] = await Promise.all([
        db.getAllByIndex("exerciseRecords", "by_session", session.id),
        db.getAllByIndex("setRecords", "by_session", session.id)
      ]);
      return { session, exercises, sets };
    }));
    const valuesBySlot = new Map();
    snapshots.forEach(snapshot => {
      snapshot.exercises.forEach(exercise => {
        const slotId = exercise.programmeSlotId;
        if (!slotId || exercise.substitution || exercise.performedExerciseName || valuesBySlot.has(slotId)) return;
        const sets = snapshot.sets.filter(set => set.exerciseRecordId === exercise.id).sort(sortSets);
        const hasValues = sets.some(set =>
          ["weight", "reps", "duration"].some(field =>
            set[field] !== undefined && set[field] !== null && String(set[field]).trim() !== ""
          )
        );
        if (hasValues) valuesBySlot.set(slotId, { week: Number(snapshot.session.week || 1), sets });
      });
    });
    return valuesBySlot;
  }

  async function startSession(day, date, options) {
    options = options || {};
    const programme = programmeService();
    const sourceDay = programme.getDay(day);
    const week = options.week === undefined ? 1 : options.week;
    if (!Number.isInteger(week) || week < 1) throw new Error("Programme week must be a positive integer.");
    if (!dateIsValid(date)) throw new Error("Workout date must be a valid YYYY-MM-DD date.");
    const existing = await findInProgress(day, date, week);
    if (existing) return { created: false, resumed: true, workout: existing };

    const sessionId = makeId("gym-session");
    const setCount = options.setCount === undefined ? 3 : options.setCount;
    if (!Number.isInteger(setCount) || setCount < 1 || setCount > MAX_SETS) {
      throw new Error("Set count must be between 1 and " + MAX_SETS + ".");
    }
    const session = {
      id: sessionId,
      moduleId: "gym",
      status: "in-progress",
      date,
      day,
      week,
      title: sourceDay.title,
      programmeSourceId: PROGRAMME_ID,
      programmeSourceStatus: programme.source.status,
      startedAt: new Date().toISOString()
    };
    const exerciseRecords = [];
    const setRecords = [];
    const previousWeekValues = await findPreviousWeekValues(day, week);
    const prefilledWeeks = new Set();
    let prefilledExerciseCount = 0;
    sourceDay.slots.forEach((slot, index) => {
      const exerciseId = makeId("gym-exercise");
      const exercise = {
        id: exerciseId,
        moduleId: "gym",
        sessionId,
        position: index + 1,
        name: slot.sourceExerciseLabel,
        sourceExerciseLabel: slot.sourceExerciseLabel,
        description: slot.sourceDescription,
        sourceDescription: slot.sourceDescription,
        sourceGroupKey: slot.sourceGroupKey,
        sourceMuscleKeys: slot.sourceMuscleKeys.slice(),
        programmeSlotId: slot.slotId,
        programmeSourceId: PROGRAMME_ID,
        identityLinkStatus: "unreviewed",
        setCount,
        progressionFocus: slot.defaultProgressionFocus,
        recordingMode: slot.defaultRecordingMode,
        restSeconds: 90,
        status: "not-started"
      };
      exerciseRecords.push(exercise);
      for (let number = 1; number <= setCount; number++) {
        setRecords.push({
          id: makeId("gym-set"),
          moduleId: "gym",
          sessionId,
          exerciseRecordId: exerciseId,
          setNumber: number,
          status: number === 1 ? "not-started" : "locked",
          weight: "",
          reps: "",
          duration: "",
          targetDuration: ""
        });
      }
    });
    exerciseRecords.forEach(exercise => {
      const previous = previousWeekValues.get(exercise.programmeSlotId);
      if (!previous) return;
      let copiedForExercise = false;
      setRecords.filter(set => set.exerciseRecordId === exercise.id).forEach(set => {
        const priorSet = previous.sets.find(item => Number(item.setNumber) === Number(set.setNumber));
        if (!priorSet) return;
        ["weight", "reps", "duration"].forEach(field => {
          const value = priorSet[field];
          if (value !== undefined && value !== null && String(value).trim() !== "") {
            set[field] = String(value);
            copiedForExercise = true;
          }
        });
      });
      if (copiedForExercise) {
        prefilledExerciseCount += 1;
        prefilledWeeks.add(previous.week);
      }
    });
    const prefillSummary = prefilledExerciseCount ? {
      exerciseCount: prefilledExerciseCount,
      sourceWeeks: Array.from(prefilledWeeks).sort((a, b) => b - a)
    } : null;
    const saved = await dbService().createGymWorkoutBundle({ session, exerciseRecords, setRecords });
    return {
      created: true,
      resumed: false,
      prefillSummary,
      workout: {
        session: saved.session,
        exerciseRecords: saved.exerciseRecords.map(exercise => Object.assign({}, exercise, {
          sets: saved.setRecords.filter(set => set.exerciseRecordId === exercise.id).sort(sortSets)
        }))
      }
    };
  }

  function assertWorkoutInProgress(workout) {
    if (!workout || !workout.session || workout.session.moduleId !== "gym" || workout.session.status !== "in-progress") {
      throw new Error("Workout changes are only allowed while the Gym workout is in progress.");
    }
  }

  async function saveChanges(workout, changedExerciseIds, changedSetIds) {
    assertWorkoutInProgress(workout);
    const db = dbService();
    const exerciseIds = new Set(changedExerciseIds || []);
    const setIds = new Set(changedSetIds || []);
    const exercises = workout.exerciseRecords.filter(item => exerciseIds.has(item.id));
    const sets = workout.exerciseRecords.flatMap(item => item.sets || []).filter(item => setIds.has(item.id));
    return db.updateGymWorkoutBundle({
      sessionId: workout.session.id,
      exerciseRecords: exercises,
      setRecords: sets
    });
  }

  function getExercise(workout, exerciseId) {
    const exercise = workout && workout.exerciseRecords.find(item => item.id === exerciseId);
    if (!exercise) throw new Error("Exercise does not belong to this workout.");
    return exercise;
  }
  function getSet(workout, exercise, setNumber) {
    if (!Number.isInteger(setNumber) || setNumber < 1) throw new Error("Set number is invalid.");
    const set = exercise.sets.find(item => item.setNumber === setNumber);
    if (!set) throw new Error("Set does not exist in this exercise.");
    return set;
  }
  function unlockNext(exercise) {
    const next = exercise.sets.find(item => item.status === "locked");
    if (next) next.status = "not-started";
  }
  function updateExerciseStatus(exercise) {
    exercise.status = exercise.sets.every(item => item.status === "completed") ? "completed" :
      exercise.sets.some(item => item.status === "in-progress" || item.status === "completed") ? "in-progress" : "not-started";
  }

  async function setExerciseSubstitution(workout, exerciseId, replacementName, equipmentStatus) {
    assertWorkoutInProgress(workout);
    const exercise = getExercise(workout, exerciseId);
    if (!workout || !workout.session || workout.session.status !== "in-progress") {
      throw new Error("Exercise changes are only allowed in an in-progress workout.");
    }
    const label = requiredString(replacementName, "Replacement exercise name").trim();
    if (label.length > 120) throw new Error("Replacement exercise name must be 120 characters or fewer.");
    const allowedEquipmentStatuses = ["unknown", "available", "unavailable"];
    if (!allowedEquipmentStatuses.includes(equipmentStatus || "unknown")) {
      throw new Error("Equipment status must be unknown, available, or unavailable.");
    }
    const hasStartedSet = (exercise.sets || []).some(set =>
      set.status === "in-progress" || set.status === "completed" || set.startedAt || set.completedAt ||
      [set.weight, set.reps, set.duration, set.targetDuration].some(value => value !== undefined && value !== null && String(value).trim() !== "")
    );
    if (hasStartedSet || exercise.status !== "not-started") {
      throw new Error("An exercise cannot be changed after any set has started or recorded.");
    }
    if (label === exercise.sourceExerciseLabel) {
      delete exercise.substitution;
      delete exercise.performedExerciseName;
      exercise.name = exercise.sourceExerciseLabel;
    } else {
      exercise.performedExerciseName = label;
      exercise.substitution = {
        sourceExerciseLabel: exercise.sourceExerciseLabel,
        performedExerciseName: label,
        equipmentStatus: equipmentStatus || "unknown",
        selectedAt: new Date().toISOString(),
        selectionMode: "manual"
      };
    }
    await saveChanges(workout, [exercise.id], []);
    return exercise;
  }

  async function updateSetValues(workout, exerciseId, setNumber, values) {
    assertWorkoutInProgress(workout);
    const exercise = getExercise(workout, exerciseId);
    const set = getSet(workout, exercise, setNumber);
    if (set.status === "locked") throw new Error("Complete the previous set before editing this set.");
    values = values || {};
    for (const field of ["weight", "reps", "duration", "targetDuration"]) {
      if (Object.prototype.hasOwnProperty.call(values, field)) {
        if (typeof values[field] !== "string") throw new Error(field + " must be entered as text.");
        set[field] = values[field];
        if (field === "duration") {
          delete set.stopwatchStartedAt;
          const seconds = Number(values[field]);
          set.stopwatchElapsedMs = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 0;
        }
      }
    }
    await saveChanges(workout, [], [set.id]);
    return set;
  }

  async function startSet(workout, exerciseId, setNumber) {
    assertWorkoutInProgress(workout);
    const exercise = getExercise(workout, exerciseId);
    const set = getSet(workout, exercise, setNumber);
    if (set.status === "locked") throw new Error("Complete the previous set before starting this set.");
    if (set.status === "completed") throw new Error("Undo this completed set before restarting it.");
    set.status = "in-progress";
    set.startedAt = new Date().toISOString();
    updateExerciseStatus(exercise);
    await saveChanges(workout, [exercise.id], [set.id]);
    return set;
  }

  function stopwatchElapsedMs(set, now) {
    const saved = Math.max(0, Number(set.stopwatchElapsedMs) || 0);
    const startedAt = Number(set.stopwatchStartedAt);
    return saved + (Number.isFinite(startedAt) && startedAt > 0 ? Math.max(0, (now === undefined ? Date.now() : now) - startedAt) : 0);
  }

  async function startStopwatch(workout, exerciseId, setNumber) {
    assertWorkoutInProgress(workout);
    const exercise = getExercise(workout, exerciseId);
    const set = getSet(workout, exercise, setNumber);
    if (set.status === "locked") throw new Error("Complete the previous set before timing this set.");
    if (set.status === "completed") throw new Error("Undo this completed set before timing it again.");
    if (Number.isFinite(Number(set.stopwatchStartedAt))) return set;
    set.stopwatchElapsedMs = Math.max(0, Number(set.stopwatchElapsedMs) || 0);
    set.stopwatchStartedAt = Date.now();
    set.status = "in-progress";
    if (!set.startedAt) set.startedAt = new Date().toISOString();
    updateExerciseStatus(exercise);
    await saveChanges(workout, [exercise.id], [set.id]);
    return set;
  }

  async function stopStopwatch(workout, exerciseId, setNumber) {
    assertWorkoutInProgress(workout);
    const exercise = getExercise(workout, exerciseId);
    const set = getSet(workout, exercise, setNumber);
    if (set.status === "locked") throw new Error("Complete the previous set before timing this set.");
    set.stopwatchElapsedMs = stopwatchElapsedMs(set);
    delete set.stopwatchStartedAt;
    set.duration = String(Math.round(set.stopwatchElapsedMs / 1000));
    await saveChanges(workout, [], [set.id]);
    return set;
  }

  async function resetStopwatch(workout, exerciseId, setNumber) {
    assertWorkoutInProgress(workout);
    const exercise = getExercise(workout, exerciseId);
    const set = getSet(workout, exercise, setNumber);
    if (set.status === "locked") throw new Error("Complete the previous set before timing this set.");
    delete set.stopwatchStartedAt;
    set.stopwatchElapsedMs = 0;
    set.duration = "";
    await saveChanges(workout, [], [set.id]);
    return set;
  }

  async function completeSet(workout, exerciseId, setNumber) {
    assertWorkoutInProgress(workout);
    const exercise = getExercise(workout, exerciseId);
    const set = getSet(workout, exercise, setNumber);
    if (set.status === "locked") throw new Error("Complete the previous set before completing this set.");
    if (Number.isFinite(Number(set.stopwatchStartedAt))) {
      set.stopwatchElapsedMs = stopwatchElapsedMs(set);
      delete set.stopwatchStartedAt;
      set.duration = String(Math.round(set.stopwatchElapsedMs / 1000));
    }
    set.status = "completed";
    set.completedAt = new Date().toISOString();
    unlockNext(exercise);
    updateExerciseStatus(exercise);
    const exerciseIndex = workout.exerciseRecords.findIndex(item => item.id === exercise.id);
    const nextSetInExercise = exercise.sets.some(item => item.setNumber > setNumber && item.status === "not-started");
    const nextExerciseHasSet = workout.exerciseRecords.slice(exerciseIndex + 1)
      .some(nextExercise => nextExercise.sets.some(item => item.status === "not-started"));
    const hasFollowingSet = nextSetInExercise || nextExerciseHasSet;
    const restSeconds = Number(exercise.restSeconds) || 90;
    if (hasFollowingSet && restSeconds > 0) {
      workout.session.restEndAt = Date.now() + restSeconds * 1000;
      workout.session.restDurationSeconds = restSeconds;
      workout.session.restExerciseId = exercise.id;
      workout.session.restSetNumber = setNumber;
    } else clearRest(workout.session);
    await dbService().updateGymWorkoutBundle({ sessionId: workout.session.id, session: workout.session, exerciseRecords: [exercise], setRecords: [set, ...exercise.sets.filter(item => item.status === "not-started" && item.setNumber === setNumber + 1)] });
    return { set, exerciseCompleted: exercise.status === "completed", restStarted: Boolean(nextSet && restSeconds > 0) };
  }

  function clearRest(session) { delete session.restEndAt; delete session.restDurationSeconds; delete session.restExerciseId; delete session.restSetNumber; }

  async function setExerciseRest(workout, exerciseId, seconds) {
    assertWorkoutInProgress(workout);
    const exercise = getExercise(workout, exerciseId);
    if (!REST_PRESETS.includes(seconds)) throw new Error("Choose a supported rest duration.");
    exercise.restSeconds = seconds;
    await saveChanges(workout, [exercise.id], []);
    return exercise;
  }
  async function adjustRest(workout, seconds) {
    assertWorkoutInProgress(workout);
    if (!workout.session.restEndAt) throw new Error("No active rest timer.");
    if (!Number.isInteger(seconds) || seconds !== 15) throw new Error("Only +15 seconds is supported.");
    workout.session.restEndAt += seconds * 1000;
    workout.session.restDurationSeconds = (Number(workout.session.restDurationSeconds) || 0) + seconds;
    await dbService().updateGymWorkoutBundle({ sessionId: workout.session.id, session: workout.session });
    return workout.session;
  }
  async function skipRest(workout) { clearRest(workout.session); await dbService().updateGymWorkoutBundle({ sessionId: workout.session.id, session: workout.session }); return workout.session; }
  async function cancelRest(workout) {
    assertWorkoutInProgress(workout);
    return skipRest(workout);
  }

  async function undoSet(workout, exerciseId, setNumber) {
    assertWorkoutInProgress(workout);
    const exercise = getExercise(workout, exerciseId);
    const set = getSet(workout, exercise, setNumber);
    set.status = "in-progress";
    delete set.completedAt;
    exercise.sets.filter(item => item.setNumber > setNumber).forEach(item => {
      item.status = "locked";
      delete item.startedAt;
      delete item.completedAt;
    });
    updateExerciseStatus(exercise);
    if (workout.session.restExerciseId === exercise.id && Number(workout.session.restSetNumber) >= setNumber) {
      clearRest(workout.session);
    }
    await dbService().updateGymWorkoutBundle({
      sessionId: workout.session.id,
      session: workout.session,
      exerciseRecords: [exercise],
      setRecords: exercise.sets.filter(item => item.setNumber >= setNumber)
    });
    return set;
  }


  async function finishSession(workout) {
    if (!workout || !workout.session || workout.session.moduleId !== "gym") {
      throw new Error("A Gym workout is required.");
    }
    if (workout.session.status !== "in-progress") throw new Error("This Gym workout is not in progress.");
    const allSets = workout.exerciseRecords.flatMap(exercise => exercise.sets || []);
    if (!allSets.length || allSets.some(set => set.status !== "completed")) {
      throw new Error("Complete every set before finishing this workout.");
    }
    const now = new Date();
    const started = Date.parse(workout.session.startedAt || "");
    const durationMinutes = Number.isFinite(started) ? Math.max(0, Math.round((now.getTime() - started) / 60000)) : 0;
    const completedSession = Object.assign({}, workout.session);
    clearRest(completedSession);
    completedSession.status = "completed";
    completedSession.completedAt = now.toISOString();
    completedSession.durationMinutes = durationMinutes;
    // Persist the completed state before mutating the in-memory workout. A failed
    // write must leave the session in progress so the user can retry safely.
    await dbService().updateGymWorkoutBundle({ sessionId: workout.session.id, session: completedSession });
    Object.keys(workout.session).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(completedSession, key)) delete workout.session[key];
    });
    Object.assign(workout.session, completedSession);
    return workout.session;
  }

  global.ProjectComebackGymWorkout = Object.freeze({
    programmeSourceId: PROGRAMME_ID,
    setStatuses: SET_STATUSES,
    loadSession,
    findInProgress,
    startSession,
    setExerciseSubstitution,
    updateSetValues,
    startSet,
    completeSet,
    startStopwatch,
    stopStopwatch,
    resetStopwatch,
    undoSet,
    restPresets: REST_PRESETS,
    setExerciseRest,
    adjustRest,
    skipRest,
    cancelRest,
    finishSession
  });
})(window);
