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
  global.ProjectComebackGymProgression = Object.freeze({
    defaultPlan: DEFAULT_PLAN, validWeeks: VALID_WEEKS, validatePlan, getPlan, savePlan,
    getManualUnlocks, setManualUnlock, hasCompletedWorkout, isUnlocked, nextWorkout, history
  });
})(window);
