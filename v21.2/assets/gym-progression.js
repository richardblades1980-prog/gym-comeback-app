/* Project Comeback V21.2 — Gym week/day progression and manual unlocks. */
(function (global) {
  "use strict";
  const PLAN_ID = "gym-progression-plan", UNLOCK_ID = "gym-progression-unlocks";
  const DEFAULT_PLAN = Object.freeze({ weeks: 4, daysPerWeek: 2 });
  const VALID_WEEKS = Object.freeze([4, 8, 12]);
  function db() {
    if (!global.ProjectComebackDB) throw new Error("Load database.js before gym-progression.js.");
    return global.ProjectComebackDB;
  }
  function validatePlan(plan) {
    if (!plan || !VALID_WEEKS.includes(plan.weeks)) throw new Error("Programme length must be 4, 8 or 12 weeks.");
    if (!Number.isInteger(plan.daysPerWeek) || plan.daysPerWeek < 2 || plan.daysPerWeek > 5) {
      throw new Error("Planned training frequency must be 2 to 5 days per week.");
    }
    return true;
  }
  async function getPlan() {
    const saved = await db().get("preferences", PLAN_ID);
    return Object.assign({}, DEFAULT_PLAN, saved && saved.value || {});
  }
  async function savePlan(plan) {
    validatePlan(plan);
    const record = { id: PLAN_ID, value: { weeks: plan.weeks, daysPerWeek: plan.daysPerWeek }, updatedAt: new Date().toISOString() };
    await db().put("preferences", record);
    return record.value;
  }
  async function getManualUnlocks() {
    const saved = await db().get("preferences", UNLOCK_ID);
    return Array.isArray(saved && saved.value) ? saved.value.filter(item =>
      Number.isInteger(item.week) && item.week >= 1 && Number.isInteger(item.day) && item.day >= 1 && item.day <= 5
    ) : [];
  }
  async function setManualUnlock(week, day, unlocked) {
    if (!Number.isInteger(week) || week < 1 || !Number.isInteger(day) || day < 1 || day > 5) {
      throw new Error("A valid programme week and day are required.");
    }
    const current = await getManualUnlocks();
    const filtered = current.filter(item => item.week !== week || item.day !== day);
    if (unlocked) filtered.push({ week, day });
    await db().put("preferences", { id: UNLOCK_ID, value: filtered, updatedAt: new Date().toISOString() });
    return filtered;
  }
  async function hasCompletedWorkout(week, day) {
    const sessions = await db().getAllByIndex("sessions", "by_module", "gym");
    return sessions.some(session => session.status === "completed" && Number(session.week || 1) === week &&
      Number(session.day) === day && (!global.ProjectComebackGymWorkout || session.programmeSourceId === global.ProjectComebackGymWorkout.programmeSourceId));
  }
  async function isUnlocked(week, day, plan) {
    const config = plan || await getPlan();
    validatePlan(config);
    if (!Number.isInteger(week) || week < 1 || week > config.weeks || !Number.isInteger(day) || day < 1 || day > 5) return false;
    if (day > config.daysPerWeek) return false;
    const overrides = await getManualUnlocks();
    if (overrides.some(item => item.week === week && item.day === day)) return true;
    if (week === 1 && day === 1) return true;
    if (day > 1) return hasCompletedWorkout(week, day - 1);
    return hasCompletedWorkout(week - 1, config.daysPerWeek);
  }
  async function nextWorkout(week, day, plan) {
    const config = plan || await getPlan(); validatePlan(config);
    if (day < config.daysPerWeek) return { week, day: day + 1 };
    if (week < config.weeks) return { week: week + 1, day: 1 };
    return null;
  }
  async function history() {
    return (await db().getAllByIndex("sessions", "by_module", "gym"))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) ||
        Number(b.week || 1) - Number(a.week || 1) || Number(b.day || 0) - Number(a.day || 0) ||
        String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  }
  function summariseExerciseHistory(sessions, exercises, sets) {
    if (!Array.isArray(sessions) || !Array.isArray(exercises) || !Array.isArray(sets)) {
      throw new Error("Gym history summary requires session, exercise and set arrays.");
    }
    const completed = sessions.filter(session => session && session.moduleId === "gym" && session.status === "completed");
    const completedIds = new Set(completed.map(session => session.id));
    const completedExercises = exercises.filter(exercise => exercise && completedIds.has(exercise.sessionId));
    const exerciseIds = new Set(completedExercises.map(exercise => exercise.id));
    const linkedSets = sets.filter(set => set && completedIds.has(set.sessionId) && exerciseIds.has(set.exerciseRecordId));
    const setByExercise = new Map();
    linkedSets.forEach(set => {
      if (!setByExercise.has(set.exerciseRecordId)) setByExercise.set(set.exerciseRecordId, []);
      setByExercise.get(set.exerciseRecordId).push(set);
    });
    const sessionById = new Map(completed.map(session => [session.id, session]));
    const groups = new Map();
    completedExercises.forEach(exercise => {
      const rawSource = String(exercise.sourceExerciseLabel !== undefined ? exercise.sourceExerciseLabel : exercise.name || "");
      const sourceLabel = rawSource.trim() || "Unnamed exercise";
      const performed = String(exercise.performedExerciseName || "").trim();
      const substituted = Boolean(performed && performed !== sourceLabel);
      const session = sessionById.get(exercise.sessionId);
      const entry = {
        sessionId: exercise.sessionId,
        date: session && typeof session.date === "string" ? session.date : "",
        sourceLabel,
        performedExerciseName: substituted ? performed : sourceLabel,
        substituted,
        sets: (setByExercise.get(exercise.id) || []).slice().sort((a, b) => Number(a.setNumber) - Number(b.setNumber))
      };
      if (!groups.has(rawSource)) groups.set(rawSource, { sourceLabel, entries: [], sourceEntries: [], substitutions: [] });
      const group = groups.get(rawSource);
      group.entries.push(entry);
      if (substituted) group.substitutions.push(entry);
      else group.sourceEntries.push(entry);
    });
    const fmtLoad = value => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
    const summaryGroups = [...groups.values()].sort((a, b) => a.sourceLabel.localeCompare(b.sourceLabel)).map(group => {
      const sourceEntries = group.sourceEntries;
      const sourceSessionIds = new Set(sourceEntries.map(entry => entry.sessionId));
      const sourceSets = sourceEntries.flatMap(entry => entry.sets);
      const numericRepSets = sourceSets.filter(set => typeof set.reps === "string" && /^\d+$/.test(set.reps.trim()) && Number(set.reps) > 0);
      const recordedReps = numericRepSets.reduce((sum, set) => sum + Number(set.reps), 0);
      const recordedDurations = sourceSets.filter(set => set.duration !== undefined && set.duration !== null && String(set.duration).trim() !== "" && Number.isFinite(Number(set.duration)) && Number(set.duration) >= 0);
      const durationSeconds = recordedDurations.reduce((sum, set) => sum + Number(set.duration), 0);
      const datedLoads = new Map();
      sourceEntries.forEach(entry => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return;
        const loads = entry.sets.map(set => Number(set.weight)).filter(value => Number.isFinite(value) && value > 0);
        if (!loads.length) return;
        const heaviest = Math.max(...loads);
        datedLoads.set(entry.date, Math.max(datedLoads.get(entry.date) || 0, heaviest));
      });
      const loadPoints = [...datedLoads.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, load]) => ({ date, load }));
      let loadTrend = "No dated positive load entries to compare yet.";
      if (loadPoints.length === 1) loadTrend = "One dated heaviest recorded load: " + fmtLoad(loadPoints[0].load) + " kg. Add another dated session to compare.";
      if (loadPoints.length > 1) {
        const first = loadPoints[0], last = loadPoints[loadPoints.length - 1], change = Number((last.load - first.load).toFixed(2));
        loadTrend = loadPoints.length + " dated sessions with recorded loads · first " + fmtLoad(first.load) + " kg · latest " + fmtLoad(last.load) + " kg · recorded change " + (change > 0 ? "+" : "") + fmtLoad(change) + " kg. These are recorded loads, not a one-rep maximum.";
      }
      return {
        sourceLabel: group.sourceLabel,
        entries: group.entries,
        sourceEntries,
        substitutions: group.substitutions,
        sourceSessionCount: sourceSessionIds.size,
        sourceSetCount: sourceSets.length,
        recordedRepSetCount: numericRepSets.length,
        recordedReps,
        recordedDurationSetCount: recordedDurations.length,
        durationSeconds,
        loadPoints,
        loadTrend
      };
    });
    return { completedSessionCount: completed.length, exerciseRecordCount: completedExercises.length, setRecordCount: linkedSets.length, groups: summaryGroups };
  }

  global.ProjectComebackGymProgression = Object.freeze({
    defaultPlan: DEFAULT_PLAN, validWeeks: VALID_WEEKS, validatePlan, getPlan, savePlan,
    getManualUnlocks, setManualUnlock, hasCompletedWorkout, isUnlocked, nextWorkout, history, summariseExerciseHistory
  });
})(window);
