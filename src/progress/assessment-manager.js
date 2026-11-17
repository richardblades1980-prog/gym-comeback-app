/* Project Comeback V21.2A — immutable assessment history.
 * The original baseline is write-once. Follow-up assessments are dated snapshots.
 * Missing measurements remain absent; comparisons never infer values.
 */
(function (global) {
  "use strict";
  const METRICS = Object.freeze({
    comfortableWalkMinutes: { label: "Comfortable walking duration", unit: "minutes", integer: false },
    stepUpsReps: { label: "Step-ups", unit: "repetitions", integer: true },
    singleLegBalanceSeconds: { label: "Single-leg balance", unit: "seconds", integer: false }
  });
  const BASELINE_ID = "original-baseline";
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + "T00:00:00Z");
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function makeId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") return "assessment-" + global.crypto.randomUUID();
    return "assessment-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function validateAssessment(input, kind) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("An assessment is required.");
    if (!validDate(input.date)) throw new Error("Assessment date must use YYYY-MM-DD.");
    if (!input.measures || typeof input.measures !== "object" || Array.isArray(input.measures)) throw new Error("Assessment measurements are required.");
    const measures = {};
    for (const [key, value] of Object.entries(input.measures)) {
      if (!Object.prototype.hasOwnProperty.call(METRICS, key)) throw new Error("Unsupported assessment measure: " + key);
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(METRICS[key].label + " must be a non-negative number.");
      if (METRICS[key].integer && !Number.isInteger(value)) throw new Error(METRICS[key].label + " must be a whole number.");
      measures[key] = value;
    }
    if (!Object.keys(measures).length) throw new Error("Record at least one measurement.");
    const notes = input.notes === undefined ? "" : String(input.notes).trim();
    if (notes.length > 1000) throw new Error("Assessment notes must be 1,000 characters or fewer.");
    return { id: kind === "baseline" ? BASELINE_ID : (input.id || makeId()), date: input.date, kind, measures, ...(notes ? { notes } : {}) };
  }
  function db() {
    if (!global.ProjectComebackDB) throw new Error("Load database.js before assessment-manager.js.");
    return global.ProjectComebackDB;
  }
  async function getBaseline() { return (await db().get("assessments", BASELINE_ID)) || null; }
  async function createBaseline(input) {
    if (await getBaseline()) throw new Error("The original baseline already exists and cannot be overwritten.");
    const record = validateAssessment(input, "baseline");
    await db().add("assessments", record);
    return record;
  }
  async function addFollowUp(input) {
    const record = validateAssessment(input, "follow-up");
    if (record.id === BASELINE_ID) throw new Error("A follow-up cannot use the protected baseline ID.");
    await db().add("assessments", record);
    return record;
  }
  async function listHistory() {
    const records = await db().getAll("assessments");
    return records.sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  }
  function compare(first, second) {
    if (!first || !second) throw new Error("Two saved assessments are required for comparison.");
    const results = {};
    for (const [key, definition] of Object.entries(METRICS)) {
      const hasFirst = Object.prototype.hasOwnProperty.call(first.measures || {}, key);
      const hasSecond = Object.prototype.hasOwnProperty.call(second.measures || {}, key);
      results[key] = { label: definition.label, unit: definition.unit, first: hasFirst ? first.measures[key] : null, second: hasSecond ? second.measures[key] : null, difference: hasFirst && hasSecond ? second.measures[key] - first.measures[key] : null };
    }
    return { first: { id: first.id, date: first.date, kind: first.kind }, second: { id: second.id, date: second.date, kind: second.kind }, measures: results };
  }
  async function compareBaselineToLatest() {
    const baseline = await getBaseline();
    if (!baseline) return null;
    const history = await listHistory();
    const latest = history.filter(item => item.id !== BASELINE_ID).at(-1);
    return latest ? compare(baseline, latest) : null;
  }
  global.ProjectComebackAssessments = Object.freeze({ metrics: METRICS, baselineId: BASELINE_ID, validDate, validateAssessment, getBaseline, createBaseline, addFollowUp, listHistory, compare, compareBaselineToLatest });
})(window);
