const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = { window: {} };
const source = fs.readFileSync(path.join(__dirname, "../src/programme-manager/programme-manager.js"), "utf8");
vm.runInNewContext(source, sandbox);
const manager = sandbox.window.ProjectComebackProgrammeManager;

test("accepts valid gym and hiking schedule entries", () => {
  assert.equal(manager.validateScheduleEntry({
    moduleId: "gym", date: "2026-11-16", title: "Strength session", durationMinutes: 45
  }), true);
  assert.equal(manager.validateScheduleEntry({
    moduleId: "hiking", date: "2026-11-17", title: "Walk preparation"
  }), true);
});

test("rejects unknown module, invalid date and missing title", () => {
  assert.throws(() => manager.validateScheduleEntry({
    moduleId: "running", date: "2026-11-16", title: "Run"
  }), /moduleId/);
  assert.throws(() => manager.validateScheduleEntry({
    moduleId: "gym", date: "2026-02-30", title: "Strength"
  }), /YYYY-MM-DD/);
  assert.throws(() => manager.validateScheduleEntry({
    moduleId: "gym", date: "2026-11-16", title: " "
  }), /title is required/);
});

test("rejects invalid status and negative duration", () => {
  assert.throws(() => manager.validateScheduleEntry({
    moduleId: "gym", date: "2026-11-16", title: "Strength", status: "maybe"
  }), /Unsupported schedule status/);
  assert.throws(() => manager.validateScheduleEntry({
    moduleId: "hiking", date: "2026-11-16", title: "Walk", durationMinutes: -5
  }), /non-negative/);
});

test("day overview separates gym and hiking and surfaces same-day coordination", () => {
  const result = manager.summariseDay("2026-11-16", [
    { id: "g1", moduleId: "gym", date: "2026-11-16", title: "Strength", durationMinutes: 45, status: "planned" },
    { id: "h1", moduleId: "hiking", date: "2026-11-16", title: "Walk", durationMinutes: 30, status: "planned" },
    { id: "x1", moduleId: "gym", date: "2026-11-16", title: "Cancelled", status: "cancelled" }
  ], [{ id: "r1", date: "2026-11-16", score: 3 }]);
  assert.equal(result.gymSessions, 1);
  assert.equal(result.hikingSessions, 1);
  assert.equal(result.totalScheduled, 2);
  assert.equal(result.combinedDurationMinutes, 75);
  assert.equal(result.readiness.score, 3);
  assert.equal(result.flags.length, 1);
});

test("day overview ignores skipped sessions", () => {
  const result = manager.summariseDay("2026-11-16", [
    { moduleId: "gym", date: "2026-11-16", status: "skipped" }
  ], []);
  assert.equal(result.totalScheduled, 0);
  assert.equal(result.gymSessions, 0);
});
