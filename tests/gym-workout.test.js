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
  return { db, workout: window.ProjectComebackGymWorkout, window };
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
      assert.equal(JSON.stringify(exercise.sets.slice(1).map(set => set.status)), JSON.stringify(["locked", "locked"]));
    }
  }
  assert.deepEqual(counts, [7,7,6,6,6]);
  assert.equal(await db.count("sessions"), 5);
  assert.equal(await db.count("exerciseRecords"), 32);
  assert.equal(await db.count("setRecords"), 96);
});

test("programme week is saved and same date/day sessions resume only within the selected week", async () => {
  const { db, workout } = await setup();
  const week1 = await workout.startSession(1, "2026-11-18", { week: 1 });
  const week1Resume = await workout.startSession(1, "2026-11-18", { week: 1 });
  const week2 = await workout.startSession(1, "2026-11-18", { week: 2 });
  assert.equal(week1Resume.resumed, true);
  assert.equal(week1Resume.workout.session.id, week1.workout.session.id);
  assert.equal(week2.created, true);
  assert.notEqual(week2.workout.session.id, week1.workout.session.id);
  assert.equal(week1.workout.session.week, 1);
  assert.equal(week2.workout.session.week, 2);
  assert.equal((await db.get("sessions", week2.workout.session.id)).week, 2);
  assert.equal(await db.count("sessions"), 2);
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


test("a workout cannot be finished until every set is complete, then saves completed duration", async () => {
  const { db, workout } = await setup();
  const created = await workout.startSession(1, "2026-11-18", { setCount: 1 });
  await assert.rejects(() => workout.finishSession(created.workout), /Complete every set/);
  for (const exercise of created.workout.exerciseRecords) {
    await workout.startSet(created.workout, exercise.id, 1);
    await workout.completeSet(created.workout, exercise.id, 1);
  }
  const finished = await workout.finishSession(created.workout);
  assert.equal(finished.status, "completed");
  assert.ok(finished.completedAt);
  assert.equal(typeof finished.durationMinutes, "number");
  const stored = await db.get("sessions", finished.id);
  assert.equal(stored.status, "completed");
  assert.equal(stored.durationMinutes, finished.durationMinutes);
});

test("invalid dates and set counts are rejected before creating a session", async () => {
  const { db, workout } = await setup();
  await assert.rejects(() => workout.startSession(1, "2026-99-99"), /valid YYYY-MM-DD/);
  await assert.rejects(() => workout.startSession(1, "2026-11-18", { setCount: 0 }), /between 1 and 8/);
  assert.equal(await db.count("sessions"), 0);
});

test("timed-set stopwatch persists across reload, resumes from its timestamp, supports manual correction and reset", async () => {
  const { db, workout } = await setup();
  const created = await workout.startSession(1, "2026-11-18");
  const exercise = created.workout.exerciseRecords[0];
  exercise.recordingMode = "timed-hold";
  await db.put("exerciseRecords", exercise);

  const set = await workout.startStopwatch(created.workout, exercise.id, 1);
  assert.equal(set.status, "in-progress");
  assert.ok(Number.isFinite(set.stopwatchStartedAt));
  assert.equal(set.stopwatchElapsedMs, 0);

  set.stopwatchStartedAt = Date.now() - 2400;
  await db.put("setRecords", set);
  let loaded = await workout.loadSession(created.workout.session.id);
  let loadedSet = loaded.exerciseRecords[0].sets[0];
  assert.ok(Number.isFinite(loadedSet.stopwatchStartedAt));

  const stopped = await workout.stopStopwatch(loaded, exercise.id, 1);
  assert.equal(stopped.stopwatchStartedAt, undefined);
  assert.ok(stopped.stopwatchElapsedMs >= 2000);
  assert.equal(stopped.duration, String(Math.round(stopped.stopwatchElapsedMs / 1000)));

  await workout.updateSetValues(loaded, exercise.id, 1, { targetDuration: "30" });
  await workout.updateSetValues(loaded, exercise.id, 1, { duration: "9" });
  assert.equal(stopped.stopwatchStartedAt, undefined);
  assert.equal(stopped.stopwatchElapsedMs, 9000);
  assert.equal(stopped.duration, "9");
  assert.equal(stopped.targetDuration, "30", "manual actual-time correction must not overwrite the target");

  await workout.startStopwatch(loaded, exercise.id, 1);
  const reset = await workout.resetStopwatch(loaded, exercise.id, 1);
  assert.equal(reset.stopwatchStartedAt, undefined);
  assert.equal(reset.stopwatchElapsedMs, 0);
  assert.equal(reset.duration, "");
  const persisted = await workout.loadSession(created.workout.session.id);
  assert.equal(persisted.exerciseRecords[0].sets[0].stopwatchElapsedMs, 0);
  assert.equal(persisted.exerciseRecords[0].sets[0].duration, "");
});

test("smart rest starts on set completion, persists absolute end time, supports +15, skip, cancel and exercise presets", async () => {
  const { db, workout } = await setup();
  const created = await workout.startSession(1, "2026-11-18");
  const exercise = created.workout.exerciseRecords[0];
  assert.equal(exercise.restSeconds, 90);
  await workout.setExerciseRest(created.workout, exercise.id, 120);
  assert.equal(exercise.restSeconds, 120);
  await workout.startSet(created.workout, exercise.id, 1);
  const result = await workout.completeSet(created.workout, exercise.id, 1);
  assert.equal(result.restStarted, true);
  assert.ok(Number.isFinite(created.workout.session.restEndAt));
  assert.equal(created.workout.session.restDurationSeconds, 120);
  const loaded = await workout.loadSession(created.workout.session.id);
  assert.equal(loaded.session.restEndAt, created.workout.session.restEndAt);
  await workout.adjustRest(loaded, 15);
  assert.equal(loaded.session.restEndAt, created.workout.session.restEndAt + 15000);
  assert.equal(loaded.session.restDurationSeconds, 135);
  await workout.skipRest(loaded);
  assert.equal(loaded.session.restEndAt, undefined);
  await workout.startSet(loaded, exercise.id, 2);
  await workout.completeSet(loaded, exercise.id, 2);
  assert.ok(loaded.session.restEndAt);
  await workout.undoSet(loaded, exercise.id, 2);
  assert.equal(loaded.session.restEndAt, undefined, "undoing the set that started rest also clears that rest timer");
  assert.equal((await db.get("sessions", loaded.session.id)).restEndAt, undefined);
  await workout.startSet(loaded, exercise.id, 2);
  await workout.completeSet(loaded, exercise.id, 2);
  assert.ok(loaded.session.restEndAt);
  await workout.cancelRest(loaded);
  assert.equal(loaded.session.restEndAt, undefined);
  await assert.rejects(() => workout.setExerciseRest(loaded, exercise.id, 80), /supported rest duration/);
  const persisted = await db.get("sessions", loaded.session.id);
  assert.equal(persisted.restEndAt, undefined);
});


test("finishing a workout commits first and leaves the live session retryable after a failed write", async () => {
  const { db, workout, window } = await setup();
  const created = await workout.startSession(1, "2026-11-18");
  await assert.rejects(
    () => workout.finishSession(created.workout),
    /Complete every set before finishing/
  );

  for (const exercise of created.workout.exerciseRecords) {
    for (const set of exercise.sets) {
      await workout.startSet(created.workout, exercise.id, set.setNumber);
      await workout.completeSet(created.workout, exercise.id, set.setNumber);
    }
  }

  const sessionId = created.workout.session.id;
  Object.assign(created.workout.session, {
    restEndAt: Date.now() + 5000,
    restDurationSeconds: 90,
    restExerciseId: created.workout.exerciseRecords[0].id,
    restSetNumber: 3
  });
  await db.updateGymWorkoutBundle({ sessionId, session: created.workout.session });

  const originalDb = window.ProjectComebackDB;
  window.ProjectComebackDB = Object.assign({}, originalDb, {
    updateGymWorkoutBundle: async bundle => {
      if (bundle.session && bundle.session.status === "completed") {
        throw new Error("Injected completion write failure");
      }
      return originalDb.updateGymWorkoutBundle(bundle);
    }
  });
  await assert.rejects(
    () => workout.finishSession(created.workout),
    /Injected completion write failure/
  );
  assert.equal(created.workout.session.status, "in-progress");
  assert.equal(created.workout.session.completedAt, undefined);
  assert.ok(created.workout.session.restEndAt, "the in-memory rest state is unchanged when the completion write fails");
  assert.equal((await db.get("sessions", sessionId)).status, "in-progress");

  window.ProjectComebackDB = originalDb;
  const completed = await workout.finishSession(created.workout);
  assert.equal(completed.status, "completed");
  assert.ok(completed.completedAt);
  assert.equal(completed.restEndAt, undefined);
  const persisted = await db.get("sessions", sessionId);
  assert.equal(persisted.status, "completed");
  assert.equal(persisted.completedAt, completed.completedAt);
  assert.equal(persisted.restEndAt, undefined);
});

test("completing a timed set stops its running stopwatch and saves the elapsed duration", async () => {
  const { db, workout } = await setup();
  const created = await workout.startSession(1, "2026-11-18");
  const exercise = created.workout.exerciseRecords[0];
  const set = await workout.startStopwatch(created.workout, exercise.id, 1);
  set.stopwatchStartedAt = Date.now() - 3100;
  await db.put("setRecords", set);
  const result = await workout.completeSet(created.workout, exercise.id, 1);
  assert.equal(result.set.status, "completed");
  assert.equal(result.set.stopwatchStartedAt, undefined);
  assert.ok(result.set.stopwatchElapsedMs >= 3000);
  assert.equal(result.set.duration, String(Math.round(result.set.stopwatchElapsedMs / 1000)));
});

test("manual exercise substitution preserves programme identity, sets, persists, and permits a repeated swap before work begins", async () => {
  const { db, workout } = await setup();
  const created = await workout.startSession(1, "2026-11-18");
  const exercise = created.workout.exerciseRecords[0];
  const original = {
    name: exercise.name,
    sourceExerciseLabel: exercise.sourceExerciseLabel,
    programmeSlotId: exercise.programmeSlotId,
    sourceDescription: exercise.sourceDescription,
    setIds: exercise.sets.map(set => set.id),
    setValues: exercise.sets.map(set => [set.weight, set.reps, set.duration, set.targetDuration, set.status])
  };
  await workout.setExerciseSubstitution(created.workout, exercise.id, "Dumbbell Floor Press", "available");
  assert.equal(exercise.name, original.sourceExerciseLabel, "database identity remains the programme exercise");
  assert.equal(exercise.performedExerciseName, "Dumbbell Floor Press");
  assert.equal(exercise.substitution.sourceExerciseLabel, original.sourceExerciseLabel);
  assert.equal(exercise.substitution.performedExerciseName, "Dumbbell Floor Press");
  assert.equal(exercise.substitution.equipmentStatus, "available");
  assert.ok(exercise.substitution.selectedAt);
  assert.equal(exercise.substitution.selectionMode, "manual");
  assert.equal(exercise.sourceExerciseLabel, original.sourceExerciseLabel);
  assert.equal(exercise.programmeSlotId, original.programmeSlotId);
  assert.equal(exercise.sourceDescription, original.sourceDescription);
  assert.deepEqual(exercise.sets.map(set => set.id), original.setIds);
  assert.deepEqual(exercise.sets.map(set => [set.weight, set.reps, set.duration, set.targetDuration, set.status]), original.setValues);

  await workout.setExerciseSubstitution(created.workout, exercise.id, "Resistance Band Chest Press", "unknown");
  assert.equal(exercise.name, original.sourceExerciseLabel, "source name remains immutable across repeated swaps");
  assert.equal(exercise.substitution.sourceExerciseLabel, original.sourceExerciseLabel);
  assert.equal(exercise.substitution.equipmentStatus, "unknown");

  let loaded = await workout.loadSession(created.workout.session.id);
  let saved = loaded.exerciseRecords[0];
  assert.equal(saved.name, original.sourceExerciseLabel, "database identity remains the programme exercise");
  assert.equal(saved.performedExerciseName, "Resistance Band Chest Press");
  assert.equal(saved.sourceExerciseLabel, original.sourceExerciseLabel);
  assert.equal(saved.programmeSlotId, original.programmeSlotId);
  assert.deepEqual(saved.sets.map(set => set.id), original.setIds);
  assert.deepEqual(saved.sets.map(set => [set.weight, set.reps, set.duration, set.targetDuration, set.status]), original.setValues);

  await workout.setExerciseSubstitution(loaded, saved.id, original.sourceExerciseLabel, "unknown");
  assert.equal(saved.name, original.sourceExerciseLabel);
  assert.equal(saved.performedExerciseName, undefined);
  assert.equal(saved.substitution, undefined);
  const restored = await workout.loadSession(created.workout.session.id);
  assert.equal(restored.exerciseRecords[0].name, original.sourceExerciseLabel);
  assert.equal(restored.exerciseRecords[0].substitution, undefined);
  assert.equal(await db.count("exerciseRecords"), 7);
});

test("manual exercise substitution rejects invalid input, unsupported equipment status, and any started or recorded set", async () => {
  const { workout } = await setup();
  const created = await workout.startSession(1, "2026-11-18");
  const exercise = created.workout.exerciseRecords[0];
  await assert.rejects(() => workout.setExerciseSubstitution(created.workout, exercise.id, "  ", "unknown"), /Replacement exercise name is required/);
  await assert.rejects(() => workout.setExerciseSubstitution(created.workout, exercise.id, "x".repeat(121), "unknown"), /120 characters/);
  await assert.rejects(() => workout.setExerciseSubstitution(created.workout, exercise.id, "Dumbbell Press", "maybe"), /Equipment status/);
  await workout.updateSetValues(created.workout, exercise.id, 1, { reps: "8" });
  await assert.rejects(() => workout.setExerciseSubstitution(created.workout, exercise.id, "Dumbbell Press", "available"), /after any set has started or recorded/);
  await workout.updateSetValues(created.workout, exercise.id, 1, { reps: "" });
  await workout.startSet(created.workout, exercise.id, 1);
  await assert.rejects(() => workout.setExerciseSubstitution(created.workout, exercise.id, "Dumbbell Press", "available"), /after any set has started or recorded/);
});
