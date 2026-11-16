const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = { window: {} };
const source = fs.readFileSync(path.join(__dirname, "../src/shared/workload-summary.js"), "utf8");
vm.runInNewContext(source, sandbox);
const workload = sandbox.window.ProjectComebackWorkload;

test("summarises completed Gym and Hiking duration separately", () => {
  const result = workload.summariseRange("2026-11-01", "2026-11-30", [
    { id: "g1", moduleId: "gym", date: "2026-11-02", status: "completed", durationMinutes: 50 },
    { id: "g2", moduleId: "gym", date: "2026-11-03", status: "completed", durationMinutes: 35 },
    { id: "g3", moduleId: "gym", date: "2026-11-04", status: "planned", durationMinutes: 90 },
    { id: "g4", moduleId: "gym", date: "2026-10-31", status: "completed", durationMinutes: 20 }
  ], [
    { id: "h1", moduleId: "hiking", date: "2026-11-02", status: "completed", durationMinutes: 120 },
    { id: "h2", moduleId: "hiking", date: "2026-11-05", status: "completed" }
  ]);
  assert.equal(result.gym.sessionCount, 2);
  assert.equal(result.gym.durationMinutes, 85);
  assert.equal(result.hiking.sessionCount, 2);
  assert.equal(result.hiking.durationMinutes, 120);
  assert.equal(result.hiking.durationMissingCount, 1);
  assert.equal(Object.hasOwn(result, "combinedDurationMinutes"), false);
});

test("rejects impossible dates and reversed ranges", () => {
  assert.throws(() => workload.summariseRange("2026-02-30", "2026-03-01", [], []), /valid date range/);
  assert.throws(() => workload.summariseRange("2026-11-30", "2026-11-01", [], []), /valid date range/);
});

test("rejects invalid recorded duration rather than silently counting it", () => {
  assert.throws(() => workload.summariseRange("2026-11-01", "2026-11-30", [
    { id: "g1", moduleId: "gym", date: "2026-11-02", status: "completed", durationMinutes: -10 }
  ], []), /invalid recorded durationMinutes/);
});

test("ignores incomplete and out-of-range records", () => {
  const result = workload.summariseRange("2026-11-01", "2026-11-30", [
    { id: "g1", date: "2026-11-02", status: "skipped", durationMinutes: 40 },
    { id: "g2", date: "2026-12-02", status: "completed", durationMinutes: 40 }
  ], []);
  assert.equal(result.gym.sessionCount, 0);
  assert.equal(result.gym.durationMinutes, 0);
});

test("reads the legacy Gym sessionTime field without losing its recorded minutes", () => {
  const result = workload.summariseRange("2026-11-01", "2026-11-30", [
    { id: "legacy-gym-1", moduleId: "gym", date: "2026-11-10", status: "completed", sessionTime: "42" }
  ], []);
  assert.equal(result.gym.durationMinutes, 42);
  assert.equal(result.gym.durationRecordedCount, 1);
});
