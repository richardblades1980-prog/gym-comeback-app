/* Project Comeback V21.2A — descriptive workload summaries.
 * Gym and Hiking remain separate. This service reports recorded duration only;
 * it does not infer intensity, prescribe recovery, or alter programmes.
 */
(function (global) {
  "use strict";

  const MODULES = Object.freeze(["gym", "hiking"]);

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + "T00:00:00Z");
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function validateRange(from, to) {
    if (!validDate(from) || !validDate(to) || from > to) {
      throw new Error("A valid date range is required (from must be on or before to).");
    }
  }

  function completedInRange(records, from, to, moduleId) {
    if (!Array.isArray(records)) throw new Error(moduleId + " records must be an array.");
    return records.filter(record => {
      if (!record || typeof record !== "object" || Array.isArray(record)) return false;
      if (record.moduleId && record.moduleId !== moduleId) return false;
      if (record.status !== "completed") return false;
      if (!validDate(record.date) || record.date < from || record.date > to) return false;
      return true;
    });
  }

  function summariseModule(records, moduleId) {
    const byDate = {};
    let durationMinutes = 0;
    let durationRecordedCount = 0;
    for (const record of records) {
      const rawDuration = record.durationMinutes !== undefined ? record.durationMinutes : record.sessionTime;
      if (rawDuration === undefined || rawDuration === null || rawDuration === "") {
        byDate[record.date] = byDate[record.date] || { sessions: 0, durationMinutes: 0, durationRecordedCount: 0 };
        byDate[record.date].sessions += 1;
        continue;
      }
      const minutes = typeof rawDuration === "number" ? rawDuration :
        (typeof rawDuration === "string" && rawDuration.trim() !== "" ? Number(rawDuration) : NaN);
      if (!Number.isFinite(minutes) || minutes < 0) {
        throw new Error(moduleId + " record " + record.id + " has an invalid recorded duration.");
      }
      durationMinutes += minutes;
      durationRecordedCount += 1;
      byDate[record.date] = byDate[record.date] || { sessions: 0, durationMinutes: 0, durationRecordedCount: 0 };
      byDate[record.date].sessions += 1;
      byDate[record.date].durationMinutes += minutes;
      byDate[record.date].durationRecordedCount += 1;
    }
    return {
      sessionCount: records.length,
      durationMinutes,
      durationRecordedCount,
      durationMissingCount: records.length - durationRecordedCount,
      byDate
    };
  }

  function summariseRange(from, to, gymRecords, hikingRecords) {
    validateRange(from, to);
    const gym = completedInRange(gymRecords, from, to, "gym");
    const hiking = completedInRange(hikingRecords, from, to, "hiking");
    return {
      from,
      to,
      basis: "Completed records with recorded duration only; no intensity or recovery score is inferred.",
      gym: summariseModule(gym, "gym"),
      hiking: summariseModule(hiking, "hiking")
    };
  }

  async function rangeOverview(from, to) {
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before workload-summary.js.");
    const [gymRecords, hikingRecords] = await Promise.all([
      db.getAllByIndex("sessions", "by_module", "gym"),
      db.getAllByIndex("hikingRecords", "by_module", "hiking")
    ]);
    return summariseRange(from, to, gymRecords, hikingRecords);
  }

  global.ProjectComebackWorkload = Object.freeze({
    summariseRange,
    rangeOverview
  });
})(window);
