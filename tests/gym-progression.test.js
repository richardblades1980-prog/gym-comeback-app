const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { indexedDB } = require("fake-indexeddb");

async function setup() {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("ProjectComebackDB");
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
  const sandbox = { window: { indexedDB } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/data/database.js"), "utf8"), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/modules/gym-progression.js"), "utf8"), sandbox);
  const db = sandbox.window.ProjectComebackDB;
  await db.open().then(connection => connection.close());
  return { db, progression: sandbox.window.ProjectComebackGymProgression };
}

test("default and configurable plan preserve legacy 4/8/12 week and 2-5 day options", async () => {
  const { db, progression } = await setup();
  assert.deepEqual(JSON.parse(JSON.stringify(await progression.getPlan())), { weeks: 4, daysPerWeek: 2 });
  await progression.savePlan({ weeks: 8, daysPerWeek: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(await progression.getPlan())), { weeks: 8, daysPerWeek: 5 });
  assert.ok(await db.get("preferences", "gym-progression-plan"));
  await assert.rejects(() => progression.savePlan({ weeks: 6, daysPerWeek: 3 }), /4, 8 or 12 weeks/);
  await assert.rejects(() => progression.savePlan({ weeks: 4, daysPerWeek: 1 }), /2 to 5 days/);
});

test("sequential progression unlocks next day/week only after completion", async () => {
  const { db, progression } = await setup();
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
  const { progression } = await setup(), plan = { weeks: 4, daysPerWeek: 2 };
  assert.equal(await progression.isUnlocked(1, 2, plan), false);
  await progression.setManualUnlock(1, 2, true);
  assert.equal(await progression.isUnlocked(1, 2, plan), true);
  await progression.setManualUnlock(1, 2, false);
  assert.equal(await progression.isUnlocked(1, 2, plan), false);
  await progression.setManualUnlock(1, 5, true);
  assert.equal(await progression.isUnlocked(1, 5, plan), false);
});

test("completion is distinguished by explicit programme week/day", async () => {
  const { db, progression } = await setup();
  await db.put("sessions", { id: "same-day-w1", moduleId: "gym", status: "completed", week: 1, day: 1, date: "2026-11-18" });
  await db.put("sessions", { id: "same-day-w2", moduleId: "gym", status: "in-progress", week: 2, day: 1, date: "2026-11-18" });
  assert.equal(await progression.hasCompletedWorkout(1, 1), true);
  assert.equal(await progression.hasCompletedWorkout(2, 1), false);
});

test("history includes unfinished sessions and sorts newest first", async () => {
  const { db, progression } = await setup();
  await db.put("sessions", { id: "old", moduleId: "gym", status: "completed", week: 1, day: 1, date: "2026-11-01" });
  await db.put("sessions", { id: "new", moduleId: "gym", status: "in-progress", week: 2, day: 2, date: "2026-11-18" });
  const list = await progression.history();
  assert.deepEqual(list.map(item => item.id), ["new", "old"]);
});

test("next workout advances days, then weeks, and stops at plan end", async () => {
  const progression = (await setup()).progression, plan = { weeks: 4, daysPerWeek: 3 };
  assert.deepEqual(JSON.parse(JSON.stringify(await progression.nextWorkout(2, 2, plan))), { week: 2, day: 3 });
  assert.deepEqual(JSON.parse(JSON.stringify(await progression.nextWorkout(2, 3, plan))), { week: 3, day: 1 });
  assert.equal(await progression.nextWorkout(4, 3, plan), null);
});


test("exercise-history summary filters incomplete sessions and keeps exact source-name groups", async () => {
  const { progression } = await setup();
  const result = progression.summariseExerciseHistory(
    [
      { id: "s1", moduleId: "gym", status: "completed", date: "2026-11-01" },
      { id: "s2", moduleId: "gym", status: "completed", date: "2026-11-02" },
      { id: "s3", moduleId: "gym", status: "in-progress", date: "2026-11-03" }
    ],
    [
      { id: "e1", sessionId: "s1", name: "Press", sourceExerciseLabel: "Press" },
      { id: "e2", sessionId: "s2", name: "Press", sourceExerciseLabel: "Press" },
      { id: "e3", sessionId: "s3", name: "Press", sourceExerciseLabel: "Press" },
      { id: "e4", sessionId: "s1", name: "press", sourceExerciseLabel: "press" }
    ],
    [
      { id: "set1", sessionId: "s1", exerciseRecordId: "e1", setNumber: 1, status: "completed", weight: "20", reps: "10", duration: "30" },
      { id: "set2", sessionId: "s2", exerciseRecordId: "e2", setNumber: 1, status: "completed", weight: "25", reps: "8" },
      { id: "set3", sessionId: "s3", exerciseRecordId: "e3", setNumber: 1, status: "completed", weight: "100", reps: "10" },
      { id: "set4", sessionId: "s1", exerciseRecordId: "e4", setNumber: 1, status: "completed", reps: "5" }
    ]
  );
  assert.equal(result.completedSessionCount, 2);
  assert.equal(result.exerciseRecordCount, 3);
  assert.equal(result.setRecordCount, 3);
  assert.equal(result.groups.length, 2);
  const press = result.groups.find(group => group.sourceLabel === "Press");
  assert.equal(press.sourceSessionCount, 2);
  assert.equal(press.sourceSetCount, 2);
  assert.equal(press.recordedReps, 18);
  assert.equal(press.durationSeconds, 30);
  assert.equal(press.loadPoints.length, 2);
  assert.equal(press.loadTrend.includes("recorded change +5 kg"), true);
  assert.equal(result.groups.find(group => group.sourceLabel === "press").recordedReps, 5);
});

test("manual substitutions remain visible but are excluded from source exercise trends", async () => {
  const { progression } = await setup();
  const result = progression.summariseExerciseHistory(
    [{ id: "s1", moduleId: "gym", status: "completed", date: "2026-11-01" }],
    [
      { id: "e1", sessionId: "s1", name: "Programme Press", sourceExerciseLabel: "Programme Press" },
      { id: "e2", sessionId: "s1", name: "Programme Row", sourceExerciseLabel: "Programme Row", performedExerciseName: "Band Row", substitution: { selectionMode: "manual", performedExerciseName: "Band Row" } }
    ],
    [
      { id: "set1", sessionId: "s1", exerciseRecordId: "e1", setNumber: 1, status: "completed", weight: "20", reps: "10" },
      { id: "set2", sessionId: "s1", exerciseRecordId: "e2", setNumber: 1, status: "completed", weight: "90", reps: "10" }
    ]
  );
  const source = result.groups.find(group => group.sourceLabel === "Programme Row");
  assert.equal(source.sourceSessionCount, 0);
  assert.equal(source.sourceSetCount, 0);
  assert.equal(source.loadPoints.length, 0);
  assert.equal(source.substitutions.length, 1);
  assert.equal(source.substitutions[0].performedExerciseName, "Band Row");
  assert.equal(source.substitutions[0].sets[0].weight, "90");
});

test("load trend ignores invalid or undated loads and uses the heaviest valid load per date", async () => {
  const { progression } = await setup();
  const result = progression.summariseExerciseHistory(
    [
      { id: "s1", moduleId: "gym", status: "completed", date: "2026-11-01" },
      { id: "s2", moduleId: "gym", status: "completed", date: "2026-11-01" },
      { id: "s3", moduleId: "gym", status: "completed", date: "invalid" },
      { id: "s4", moduleId: "gym", status: "completed", date: "2026-11-03" }
    ],
    ["s1","s2","s3","s4"].map((id,i)=>({id:"e"+id,sessionId:id,name:"Lift",sourceExerciseLabel:"Lift"})),
    [
      {id:"a",sessionId:"s1",exerciseRecordId:"es1",weight:"10",reps:"1"},
      {id:"b",sessionId:"s2",exerciseRecordId:"es2",weight:"12.5",reps:"1"},
      {id:"c",sessionId:"s3",exerciseRecordId:"es3",weight:"50",reps:"1"},
      {id:"d",sessionId:"s4",exerciseRecordId:"es4",weight:"0",reps:"1"},
      {id:"e",sessionId:"s4",exerciseRecordId:"es4",weight:"not numeric",reps:"1"}
    ]
  );
  const group=result.groups[0];
  assert.deepEqual(JSON.parse(JSON.stringify(group.loadPoints)),[{date:"2026-11-01",load:12.5}]);
  assert.equal(group.loadTrend.includes("One dated heaviest recorded load"),true);
});

test("exercise-history summary reports repetitions and durations only when explicitly valid", async () => {
  const { progression } = await setup();
  const result = progression.summariseExerciseHistory(
    [{id:"s",moduleId:"gym",status:"completed",date:"2026-11-18"}],
    [{id:"e",sessionId:"s",name:"Timed hold",sourceExerciseLabel:"Timed hold"}],
    [
      {id:"a",sessionId:"s",exerciseRecordId:"e",reps:"5",duration:"20"},
      {id:"b",sessionId:"s",exerciseRecordId:"e",reps:"0",duration:"-2"},
      {id:"c",sessionId:"s",exerciseRecordId:"e",reps:"2.5",duration:"abc"}
    ]
  );
  assert.equal(result.groups[0].recordedReps,5);
  assert.equal(result.groups[0].recordedRepSetCount,1);
  assert.equal(result.groups[0].durationSeconds,20);
  assert.equal(result.groups[0].recordedDurationSetCount,1);
});

test("exercise-history summary rejects non-array inputs", async () => {
  const { progression } = await setup();
  assert.throws(() => progression.summariseExerciseHistory([], null, []), /requires session, exercise and set arrays/);
});
