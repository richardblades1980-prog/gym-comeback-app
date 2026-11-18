const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { indexedDB } = require("fake-indexeddb");

function setup() {
  const sandbox = { window: { indexedDB } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/data/database.js"), "utf8"), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/modules/gym-progression.js"), "utf8"), sandbox);
  return { db: sandbox.window.ProjectComebackDB, progression: sandbox.window.ProjectComebackGymProgression };
}

test("default and configurable plan preserve legacy 4/8/12 week and 2-5 day options", async () => {
  const { db, progression } = setup();
  assert.deepEqual(JSON.parse(JSON.stringify(await progression.getPlan())), { weeks: 4, daysPerWeek: 2 });
  await progression.savePlan({ weeks: 8, daysPerWeek: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(await progression.getPlan())), { weeks: 8, daysPerWeek: 5 });
  assert.ok(await db.get("preferences", "gym-progression-plan"));
  await assert.rejects(() => progression.savePlan({ weeks: 6, daysPerWeek: 3 }), /4, 8 or 12 weeks/);
  await assert.rejects(() => progression.savePlan({ weeks: 4, daysPerWeek: 1 }), /2 to 5 days/);
});

test("sequential progression unlocks next day/week only after completion", async () => {
  const { db, progression } = setup();
  const plan = { weeks: 4, daysPerWeek: 3 };
  assert.equal(await progression.isUnlocked(1, 1, plan), true);
  assert.equal(await progression.isUnlocked(1, 2, plan), false);
  assert.equal(await progression.isUnlocked(2, 1, plan), false);
  await db.put("sessions", { id: "w1d1", moduleId: "gym", status: "completed", week: 1, day: 1, programmeSourceId: "base" });
  assert.equal(await progression.isUnlocked(1, 2, plan), true);
  assert.equal(await progression.isUnlocked(1, 3, plan), false);
  await db.put("sessions", { id: "w1d2", moduleId: "gym", status: "completed", week: 1, day: 2, programmeSourceId: "base" });
  assert.equal(await progression.isUnlocked(1, 3, plan), true);
  assert.equal(await progression.isUnlocked(2, 1, plan), false);
  await db.put("sessions", { id: "w1d3", moduleId: "gym", status: "completed", week: 1, day: 3, programmeSourceId: "base" });
  assert.equal(await progression.isUnlocked(2, 1, plan), true);
  assert.equal(await progression.isUnlocked(2, 2, plan), false);
});

test("manual unlock/relock override; planned-frequency limit still applies", async () => {
  const { progression } = setup(), plan = { weeks: 4, daysPerWeek: 2 };
  assert.equal(await progression.isUnlocked(1, 2, plan), false);
  await progression.setManualUnlock(1, 2, true);
  assert.equal(await progression.isUnlocked(1, 2, plan), true);
  await progression.setManualUnlock(1, 2, false);
  assert.equal(await progression.isUnlocked(1, 2, plan), false);
  await progression.setManualUnlock(1, 5, true);
  assert.equal(await progression.isUnlocked(1, 5, plan), false);
});

test("completion is distinguished by explicit programme week/day", async () => {
  const { db, progression } = setup();
  await db.put("sessions", { id: "same-day-w1", moduleId: "gym", status: "completed", week: 1, day: 1, date: "2026-11-18" });
  await db.put("sessions", { id: "same-day-w2", moduleId: "gym", status: "in-progress", week: 2, day: 1, date: "2026-11-18" });
  assert.equal(await progression.hasCompletedWorkout(1, 1), true);
  assert.equal(await progression.hasCompletedWorkout(2, 1), false);
});

test("history includes unfinished sessions and sorts newest first", async () => {
  const { db, progression } = setup();
  await db.put("sessions", { id: "old", moduleId: "gym", status: "completed", week: 1, day: 1, date: "2026-11-01" });
  await db.put("sessions", { id: "new", moduleId: "gym", status: "in-progress", week: 2, day: 2, date: "2026-11-18" });
  const list = await progression.history();
  assert.deepEqual(list.map(item => item.id), ["new", "old"]);
});

test("next workout advances days, then weeks, and stops at plan end", async () => {
  const progression = setup().progression, plan = { weeks: 4, daysPerWeek: 3 };
  assert.deepEqual(JSON.parse(JSON.stringify(await progression.nextWorkout(2, 2, plan))), { week: 2, day: 3 });
  assert.deepEqual(JSON.parse(JSON.stringify(await progression.nextWorkout(2, 3, plan))), { week: 3, day: 1 });
  assert.equal(await progression.nextWorkout(4, 3, plan), null);
});
