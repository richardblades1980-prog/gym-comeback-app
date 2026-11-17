"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { indexedDB } = require("fake-indexeddb");
const { webcrypto } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const dbSource = fs.readFileSync(path.join(root, "src/data/database.js"), "utf8");
const programmeSource = fs.readFileSync(path.join(root, "src/data/gym-base-programme.js"), "utf8");
const workoutSource = fs.readFileSync(path.join(root, "src/modules/gym-workout.js"), "utf8");

async function setup() {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("ProjectComebackDB");
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
  const window = { indexedDB, crypto: webcrypto };
  const sandbox = { window };
  vm.runInNewContext(dbSource, sandbox);
  vm.runInNewContext(programmeSource, sandbox);
  vm.runInNewContext(workoutSource, sandbox);
  const db = window.ProjectComebackDB;
  await db.open().then(connection => connection.close());
  await db.put("modules", { id: "gym", enabled: true, name: "Gym Comeback" });
  return { db, workout: window.ProjectComebackGymWorkout };
}

test("starting each source programme day creates the exact 7/7/6/6/6 exercise graph and three sets per slot", async () => {
  const { db, workout } = await setup();
  const counts = [];
  for (let day = 1; day <= 5; day++) {
    const result = await workout.startSession(day, "2026-11-18");
    assert.equal(result.created, true);
    assert.equal(result.resumed, false);
    assert.equal(result.workout.session.status, "in-progress");
    assert.equal(result.workout.session.moduleId, "gym");
    assert.equal(result.workout.session.day, day);
    assert.equal(result.workout.session.programmeSourceId, workout.programmeSourceId);
    counts.push(result.workout.exerciseRecords.length);
    assert.equal(result.workout.exerciseRecords.reduce((sum, exercise) => sum + exercise.sets.length, 0), result.workout.exerciseRecords.length * 3);
    for (const exercise of result.workout.exerciseRecords) {
      assert.equal(exercise.identityLinkStatus, "unreviewed");
      assert.equal(exercise.name, exercise.sourceExerciseLabel);
      assert.equal(exercise.setCount, 3);
      assert.equal(exercise.sets[0].status, "not-started");
      assert.deepEqual(exercise.sets.slice(1).map(set => set.status), ["locked", "locked"]);
    }
  }
  assert.deepEqual(counts, [7,7,6,6,6]);
  assert.equal(await db.count("sessions"), 5);
  assert.equal(await db.count("exerciseRecords"), 32);
  assert.equal(await db.count("setRecords"), 96);
});

test("starting the same day and date resumes the existing in-progress session instead of duplicating it", async () => {
  const { db, workout } = await setup();
  const first = await workout.startSession(1, "2026-11-18");
  const second = await workout.startSession(1, "2026-11-18");
  assert.equal(second.created, false);
  assert.equal(second.resumed, true);
  assert.equal(second.workout.session.id, first.workout.session.id);
  assert.equal(await db.count("sessions"), 1);
});

test("set entry persists, later sets stay locked, completion unlocks the next set, and undo preserves entered values", async () => {
  const { db, workout } = await setup();
  const created = await workout.startSession(1, "2026-11-18");
  const exercise = created.workout.exerciseRecords[0];
  await assert.rejects(() => workout.updateSetValues(created.workout, exercise.id, 2, { reps: "10" }), /previous set/);
  await workout.updateSetValues(created.workout, exercise.id, 1, { weight: "25", reps: "10" });
  await workout.startSet(created.workout, exercise.id, 1);
  await workout.completeSet(created.workout, exercise.id, 1);
  assert.equal(exercise.sets[0].status, "completed");
  assert.equal(exercise.sets[1].status, "not-started");

  let loaded = await workout.loadSession(created.workout.session.id);
  let savedExercise = loaded.exerciseRecords[0];
  assert.equal(savedExercise.sets[0].weight, "25");
  assert.equal(savedExercise.sets[0].reps, "10");
  assert.equal(savedExercise.sets[1].status, "not-started");

  await workout.startSet(loaded, savedExercise.id, 2);
  await workout.updateSetValues(loaded, savedExercise.id, 2, { reps: "8", weight: "27.5" });
  await workout.completeSet(loaded, savedExercise.id, 2);
  assert.equal(savedExercise.sets[2].status, "not-started");
  await workout.undoSet(loaded, savedExercise.id, 1);
  assert.equal(savedExercise.sets[0].status, "in-progress");
  assert.equal(savedExercise.sets[1].status, "locked");
  assert.equal(savedExercise.sets[2].status, "locked");
  assert.equal(savedExercise.sets[0].weight, "25");
  assert.equal(savedExercise.sets[1].reps, "8");

  loaded = await workout.loadSession(created.workout.session.id);
  savedExercise = loaded.exerciseRecords[0];
  assert.equal(savedExercise.sets[0].status, "in-progress");
  assert.equal(savedExercise.sets[1].status, "locked");
  assert.equal(savedExercise.sets[1].reps, "8");
});

test("a disabled Gym module prevents workout creation without partial session or exercise writes", async () => {
  const { db, workout } = await setup();
  await db.put("modules", { id: "gym", enabled: false, name: "Gym Comeback" });
  await assert.rejects(() => workout.startSession(1, "2026-11-18"), /disabled/);
  assert.equal(await db.count("sessions"), 0);
  assert.equal(await db.count("exerciseRecords"), 0);
  assert.equal(await db.count("setRecords"), 0);
});

test("invalid dates and set counts are rejected before creating a session", async () => {
  const { db, workout } = await setup();
  await assert.rejects(() => workout.startSession(1, "2026-99-99"), /valid YYYY-MM-DD/);
  await assert.rejects(() => workout.startSession(1, "2026-11-18", { setCount: 0 }), /between 1 and 8/);
  assert.equal(await db.count("sessions"), 0);
});
