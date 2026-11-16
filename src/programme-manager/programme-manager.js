/* Project Comeback V21.2A — shared programme manager.
 * Coordinates calendar visibility and workload context without changing
 * module-owned programmes or prescribing unapproved recovery thresholds.
 */
(function (global) {
  "use strict";

  const MODULE_IDS = Object.freeze(["gym", "hiking"]);
  const SCHEDULE_STATUSES = Object.freeze(["planned", "completed", "skipped", "cancelled"]);

  function requireDb() {
    if (!global.ProjectComebackDB) throw new Error("Load database.js before programme-manager.js.");
    return global.ProjectComebackDB;
  }

  function validDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value + "T00:00:00Z"));
  }

  function validateScheduleEntry(entry) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("A schedule entry is required.");
    }
    if (!MODULE_IDS.includes(entry.moduleId)) throw new Error("Schedule moduleId must be gym or hiking.");
    if (!validDate(entry.date)) throw new Error("Schedule date must use YYYY-MM-DD.");
    if (typeof entry.title !== "string" || !entry.title.trim()) throw new Error("Schedule title is required.");
    if (entry.status && !SCHEDULE_STATUSES.includes(entry.status)) {
      throw new Error("Unsupported schedule status: " + entry.status);
    }
    if (entry.durationMinutes !== undefined &&
        (!Number.isFinite(entry.durationMinutes) || entry.durationMinutes < 0)) {
      throw new Error("durationMinutes must be a non-negative number.");
    }
    return true;
  }

  function makeId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") return global.crypto.randomUUID();
    return "schedule-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function summariseDay(date, scheduleEntries, readinessRecords) {
    const entries = scheduleEntries.filter(item => item.date === date &&
      !["cancelled", "skipped"].includes(item.status || "planned"));
    const gym = entries.filter(item => item.moduleId === "gym");
    const hiking = entries.filter(item => item.moduleId === "hiking");
    const readiness = readinessRecords
      .filter(item => item.date === date)
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0] || null;
    return {
      date,
      totalScheduled: entries.length,
      gymSessions: gym.length,
      hikingSessions: hiking.length,
      combinedDurationMinutes: entries.reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0),
      entries,
      readiness,
      flags: gym.length && hiking.length
        ? ["Both modules are scheduled today; review how the combined day fits your recovery."]
        : []
    };
  }

  async function listSchedule(options) {
    const opts = options || {};
    const db = requireDb();
    let records = await db.getAll("schedules");
    if (opts.moduleId) {
      if (!MODULE_IDS.includes(opts.moduleId)) throw new Error("Unknown module: " + opts.moduleId);
      records = records.filter(item => item.moduleId === opts.moduleId);
    }
    if (opts.from && !validDate(opts.from)) throw new Error("from must use YYYY-MM-DD.");
    if (opts.to && !validDate(opts.to)) throw new Error("to must use YYYY-MM-DD.");
    if (opts.from) records = records.filter(item => item.date >= opts.from);
    if (opts.to) records = records.filter(item => item.date <= opts.to);
    return records.sort((a, b) => a.date.localeCompare(b.date) ||
      String(a.moduleId).localeCompare(String(b.moduleId)) || String(a.title).localeCompare(String(b.title)));
  }

  async function saveSchedule(entry) {
    validateScheduleEntry(entry);
    const db = requireDb();
    const module = await db.get("modules", entry.moduleId);
    if (!module) throw new Error("Initialise the module registry before scheduling sessions.");
    if (!module.enabled) throw new Error("Cannot schedule a disabled module: " + entry.moduleId);
    const record = Object.assign({}, entry, {
      id: entry.id || makeId(),
      status: entry.status || "planned",
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await db.put("schedules", record);
    return record;
  }

  async function removeSchedule(id) {
    if (typeof id !== "string" || !id) throw new Error("A schedule ID is required.");
    return requireDb().remove("schedules", id);
  }

  async function dayOverview(date) {
    if (!validDate(date)) throw new Error("date must use YYYY-MM-DD.");
    const db = requireDb();
    const [schedule, readiness] = await Promise.all([
      listSchedule({ from: date, to: date }),
      db.getAll("readiness")
    ]);
    return summariseDay(date, schedule, readiness);
  }

  async function rangeOverview(from, to) {
    if (!validDate(from) || !validDate(to) || from > to) {
      throw new Error("A valid date range is required (from must be on or before to).");
    }
    const db = requireDb();
    const [schedule, readiness] = await Promise.all([
      listSchedule({ from, to }),
      db.getAll("readiness")
    ]);
    const days = [];
    for (let cursor = new Date(from + "T00:00:00Z");
      cursor.toISOString().slice(0, 10) <= to;
      cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const day = summariseDay(date, schedule, readiness);
      if (day.totalScheduled || day.readiness) days.push(day);
    }
    return {
      from,
      to,
      days,
      totals: {
        gymSessions: days.reduce((sum, day) => sum + day.gymSessions, 0),
        hikingSessions: days.reduce((sum, day) => sum + day.hikingSessions, 0),
        combinedDurationMinutes: days.reduce((sum, day) => sum + day.combinedDurationMinutes, 0)
      }
    };
  }

  global.ProjectComebackProgrammeManager = Object.freeze({
    modules: MODULE_IDS,
    statuses: SCHEDULE_STATUSES,
    validateScheduleEntry,
    summariseDay,
    listSchedule,
    saveSchedule,
    removeSchedule,
    dayOverview,
    rangeOverview
  });
})(window);
