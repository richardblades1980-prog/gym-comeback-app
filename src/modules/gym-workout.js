/* Project Comeback V21.2 — persisted Gym workout session engine.
 * Keeps source programme slots distinct from canonical exercise identities.
 */
(function (global) {
  "use strict";

  const PROGRAMME_ID = "gym-base-programme-source-v1";
  const MAX_SETS = 8;
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
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
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

  async function findInProgress(day, date) {
    if (!Number.isInteger(day) || day < 1 || day > 5) throw new Error("Choose a programme day from 1 to 5.");
    if (!dateIsValid(date)) throw new Error("Workout date must be a valid YYYY-MM-DD date.");
    const db = dbService();
    const sessions = await db.getAllByIndex("sessions", "by_module_date", ["gym", date]);
    const existing = sessions
      .filter(item => item.moduleId === "gym" && item.status === "in-progress" &&
        item.day === day && item.programmeSourceId === PROGRAMME_ID)
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    return existing.length ? loadSession(existing[0].id) : null;
  }

  async function startSession(day, date, options) {
    options = options || {};
    const programme = programmeService();
    const sourceDay = programme.getDay(day);
    if (!dateIsValid(date)) throw new Error("Workout date must be a valid YYYY-MM-DD date.");
    const existing = await findInProgress(day, date);
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
      title: sourceDay.title,
      programmeSourceId: PROGRAMME_ID,
      programmeSourceStatus: programme.source.status,
      startedAt: new Date().toISOString()
    };
    const exerciseRecords = [];
    const setRecords = [];
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
    const saved = await dbService().createGymWorkoutBundle({ session, exerciseRecords, setRecords });
    return {
      created: true,
      resumed: false,
      workout: {
        session: saved.session,
        exerciseRecords: saved.exerciseRecords.map(exercise => Object.assign({}, exercise, {
          sets: saved.setRecords.filter(set => set.exerciseRecordId === exercise.id).sort(sortSets)
        }))
      }
    };
  }

  async function saveChanges(workout, changedExerciseIds, changedSetIds) {
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

  async function updateSetValues(workout, exerciseId, setNumber, values) {
    const exercise = getExercise(workout, exerciseId);
    const set = getSet(workout, exercise, setNumber);
    if (set.status === "locked") throw new Error("Complete the previous set before editing this set.");
    values = values || {};
    for (const field of ["weight", "reps", "duration", "targetDuration"]) {
      if (Object.prototype.hasOwnProperty.call(values, field)) {
        if (typeof values[field] !== "string") throw new Error(field + " must be entered as text.");
        set[field] = values[field];
      }
    }
    await saveChanges(workout, [], [set.id]);
    return set;
  }

  async function startSet(workout, exerciseId, setNumber) {
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

  async function completeSet(workout, exerciseId, setNumber) {
    const exercise = getExercise(workout, exerciseId);
    const set = getSet(workout, exercise, setNumber);
    if (set.status === "locked") throw new Error("Complete the previous set before completing this set.");
    set.status = "completed";
    set.completedAt = new Date().toISOString();
    unlockNext(exercise);
    updateExerciseStatus(exercise);
    await saveChanges(workout, [exercise.id], [set.id, ...exercise.sets.filter(item => item.status === "not-started" && item.setNumber === setNumber + 1).map(item => item.id)]);
    return { set, exerciseCompleted: exercise.status === "completed" };
  }

  async function undoSet(workout, exerciseId, setNumber) {
    const exercise = getExercise(workout, exerciseId);
    const set = getSet(workout, exercise, setNumber);
    set.status = "in-progress";
    delete set.completedAt;
    exercise.sets.filter(item => item.setNumber > setNumber).forEach(item => {
      if (item.status === "completed" || item.status === "in-progress") {
        item.status = "locked";
        delete item.startedAt;
        delete item.completedAt;
      }
    });
    updateExerciseStatus(exercise);
    await saveChanges(workout, [exercise.id], exercise.sets.filter(item => item.setNumber >= setNumber).map(item => item.id));
    return set;
  }

  global.ProjectComebackGymWorkout = Object.freeze({
    programmeSourceId: PROGRAMME_ID,
    setStatuses: SET_STATUSES,
    loadSession,
    findInProgress,
    startSession,
    updateSetValues,
    startSet,
    completeSet,
    undoSet
  });
})(window);
