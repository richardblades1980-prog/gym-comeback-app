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

const { indexedDB } = require("fake-indexeddb");

test("IndexedDB day and range overviews read schedule and readiness without rewriting plans", async () => {
  const request = indexedDB.deleteDatabase("ProjectComebackDB");
  await new Promise((resolve, reject) => {
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
  const dbSandbox = { window: { indexedDB } };
  const dbSource = fs.readFileSync(path.join(__dirname, "../src/data/database.js"), "utf8");
  vm.runInNewContext(dbSource, dbSandbox);
  const managerSource = fs.readFileSync(path.join(__dirname, "../src/programme-manager/programme-manager.js"), "utf8");
  vm.runInNewContext(managerSource, dbSandbox);
  const db = dbSandbox.window.ProjectComebackDB;
  const integratedManager = dbSandbox.window.ProjectComebackProgrammeManager;

  await db.put("modules", { id: "gym", name: "Gym Comeback", enabled: true });
  await db.put("modules", { id: "hiking", name: "Hiking Preparation", enabled: true });
  await db.put("schedules", { id: "g1", moduleId: "gym", date: "2026-11-17", title: "Strength", status: "planned", durationMinutes: 45 });
  await db.put("schedules", { id: "h1", moduleId: "hiking", date: "2026-11-17", title: "Trail walk", status: "planned", durationMinutes: 90 });
  await db.put("schedules", { id: "g2", moduleId: "gym", date: "2026-11-18", title: "Cancelled session", status: "cancelled", durationMinutes: 30 });
  await db.put("readiness", { id: "r1", date: "2026-11-17", score: 3 });

  const day = await integratedManager.dayOverview("2026-11-17");
  assert.equal(day.gymSessions, 1);
  assert.equal(day.hikingSessions, 1);
  assert.equal(day.combinedDurationMinutes, 135);
  assert.equal(day.readiness.score, 3);
  assert.equal(day.flags.length, 1);

  const range = await integratedManager.rangeOverview("2026-11-17", "2026-11-18");
  assert.equal(range.totals.gymSessions, 1);
  assert.equal(range.totals.hikingSessions, 1);
  assert.equal(range.totals.combinedDurationMinutes, 135);
  assert.deepEqual(JSON.parse(JSON.stringify(range.days.map(item => item.date))), ["2026-11-17"]);
  assert.equal((await db.get("schedules", "g2")).status, "cancelled");
});
