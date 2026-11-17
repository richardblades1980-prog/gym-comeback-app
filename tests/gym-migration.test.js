const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = { window: {} };
const source = fs.readFileSync(path.join(__dirname, "../src/data/gym-migration.js"), "utf8");
vm.runInNewContext(source, sandbox);
const migration = sandbox.window.ProjectComebackGymMigration;

function fixture(statuses) {
  return {
    "gym-comeback-w2-d3": JSON.stringify({
      date: "2026-11-12",
      sessionTime: "47",
      cardioType: "Bike",
      cardioTime: "8",
      bodyWeight: "82.5",
      notes: "Felt steady",
      exercises: [{
        name: "Goblet squat",
        setCount: 2,
        progressionFocus: "reps",
        recordingMode: "reps",
        sets: [
          { weight: "12.5", reps: "10", duration: "", targetDuration: "" },
          { weight: "12.5", reps: "9", duration: "", targetDuration: "" }
        ],
        note: "Comfortable",
        rir: "2",
        response: "good"
      }, {
        name: "Plank",
        setCount: 1,
        progressionFocus: "duration",
        recordingMode: "timed-hold",
        sets: [{ weight: "", reps: "", duration: "35", targetDuration: "40" }]
      }]
    }),
    "gym-comeback-set-status-v1-2-3-2026-11-12-session-a": JSON.stringify(statuses)
  };
}

test("normalises Gym session, exercises and sets while preserving original values", () => {
  const raw = fixture({ "Goblet squat::1": "complete", "Goblet squat::2": "complete", "Plank::1": "complete" });
  const result = migration.normaliseSnapshot(raw);
  assert.equal(result.sessions.length, 1);
  assert.equal(result.sessions[0].moduleId, "gym");
  assert.equal(result.sessions[0].status, "completed");
  assert.equal(result.sessions[0].durationMinutes, 47);
  assert.equal(result.sessions[0].legacyRawValue, raw["gym-comeback-w2-d3"]);
  assert.equal(result.exerciseRecords.length, 2);
  assert.equal(result.setRecords.length, 3);
  assert.equal(result.setRecords[2].duration, "35");
  assert.equal(result.setRecords[2].targetDuration, "40");
  assert.equal(result.counts.completedSessions, 1);
});

test("does not infer completion from multiple same-date session snapshots", () => {
  const raw = fixture({ "Goblet squat::1": "complete", "Goblet squat::2": "complete", "Plank::1": "complete" });
  raw["gym-comeback-set-status-v1-2-3-2026-11-12-session-b"] = JSON.stringify({
    "Goblet squat::1": "complete",
    "Goblet squat::2": "started",
    "Plank::1": "complete"
  });
  const result = migration.normaliseSnapshot(raw);
  assert.equal(result.sessions[0].status, "incomplete");
  assert.equal(result.sessions[0].completionEvidenceKeys.length, 2);
  assert.ok(result.warnings.some(item => item.key === "gym-comeback-w2-d3" && item.reason.includes("Multiple same-date completion snapshots")));
  assert.equal(result.sessions[0].legacyRawValue, raw["gym-comeback-w2-d3"]);
});

test("does not mark a workout complete without complete set-status evidence", () => {
  const raw = fixture({ "Goblet squat::1": "complete", "Goblet squat::2": "started", "Plank::1": "complete" });
  const result = migration.normaliseSnapshot(raw);
  assert.equal(result.sessions[0].status, "incomplete");
  assert.equal(result.counts.incompleteSessions, 1);
});

test("does not invent completion when status snapshots are absent", () => {
  const raw = fixture({});
  delete raw["gym-comeback-set-status-v1-2-3-2026-11-12-session-a"];
  const result = migration.normaliseSnapshot(raw);
  assert.equal(result.sessions[0].status, "incomplete");
});

test("preserves malformed or unsupported workout logs as warnings rather than dropping silently", () => {
  const result = migration.normaliseSnapshot({
    "gym-comeback-w1-d1": "{bad json",
    "gym-comeback-w1-d2": JSON.stringify({ date: "2026-11-01" })
  });
  assert.equal(result.sessions.length, 0);
  assert.equal(result.warnings.length, 2);
  const malformed = migration.normaliseSnapshot({ "gym-comeback-w1-d1": "{bad json" });
  assert.equal(malformed.sessions.length, 0);
  assert.equal(malformed.warnings.length, 1);
});

test("normalisation is deterministic across repeated runs", () => {
  const raw = fixture({ "Goblet squat::1": "complete", "Goblet squat::2": "complete", "Plank::1": "complete" });
  const first = migration.normaliseSnapshot(raw);
  const second = migration.normaliseSnapshot(raw);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
});


test("rejects impossible calendar dates and retains the original workout value", () => {
  const raw = fixture({ "Goblet squat::1": "complete", "Goblet squat::2": "complete", "Plank::1": "complete" });
  const log = JSON.parse(raw["gym-comeback-w2-d3"]);
  log.date = "2026-02-30";
  raw["gym-comeback-w2-d3"] = JSON.stringify(log);
  const result = migration.normaliseSnapshot(raw);
  assert.equal(result.sessions[0].date, null);
  assert.equal(result.sessions[0].status, "incomplete");
  assert.equal(result.sessions[0].legacyRawValue, raw["gym-comeback-w2-d3"]);
  assert.ok(result.warnings.some(item => item.key === "gym-comeback-w2-d3" && item.reason.includes("date is invalid")));
});

test("accepts valid leap-day dates and leaves genuinely absent dates undated without warning", () => {
  const leap = fixture({ "Goblet squat::1": "complete", "Goblet squat::2": "complete", "Plank::1": "complete" });
  const leapLog = JSON.parse(leap["gym-comeback-w2-d3"]);
  leapLog.date = "2024-02-29";
  leap["gym-comeback-w2-d3"] = JSON.stringify(leapLog);
  const oldEvidenceKey = "gym-comeback-set-status-v1-2-3-2026-11-12-session-a";
  const leapEvidenceKey = "gym-comeback-set-status-v1-2-3-2024-02-29-session-a";
  leap[leapEvidenceKey] = leap[oldEvidenceKey];
  delete leap[oldEvidenceKey];
  const leapResult = migration.normaliseSnapshot(leap);
  assert.equal(leapResult.sessions[0].date, "2024-02-29");
  assert.equal(leapResult.sessions[0].status, "completed");
  assert.equal(leapResult.warnings.length, 0);
  const undated = fixture({ "Goblet squat::1": "complete", "Goblet squat::2": "complete", "Plank::1": "complete" });
  const undatedLog = JSON.parse(undated["gym-comeback-w2-d3"]);
  delete undatedLog.date;
  undated["gym-comeback-w2-d3"] = JSON.stringify(undatedLog);
  const undatedResult = migration.normaliseSnapshot(undated);
  assert.equal(undatedResult.sessions[0].date, null);
  assert.equal(undatedResult.warnings.length, 0);
});

test("preserves blank and explicitly recorded optional resistance without inferring exercise load", () => {
  const raw = fixture({});
  const log = JSON.parse(raw["gym-comeback-w2-d3"]);
  log.exercises = [{
    name: "Bodyweight movement",
    setCount: 1,
    sets: [{ weight: "", reps: "8" }]
  }, {
    name: "Mobility movement",
    setCount: 1,
    sets: [{ weight: "2.5", reps: "6" }]
  }];
  raw["gym-comeback-w2-d3"] = JSON.stringify(log);
  const result = migration.normaliseSnapshot(raw);
  assert.equal(result.setRecords[0].weight, "");
  assert.equal(result.setRecords[1].weight, "2.5");
  assert.equal(result.setRecords[0].legacyRawValue, JSON.stringify({ weight: "", reps: "8" }));
  assert.equal(result.setRecords[1].legacyRawValue, JSON.stringify({ weight: "2.5", reps: "6" }));
  assert.equal(result.sessions[0].legacyRawValue, raw["gym-comeback-w2-d3"]);
});

test("does not invent missing exercise names and preserves exact supplied names", () => {
  const raw = fixture({ "Goblet squat::1": "complete", "Goblet squat::2": "complete", "Plank::1": "complete" });
  const log = JSON.parse(raw["gym-comeback-w2-d3"]);
  log.exercises[0].name = "  Goblet  squat (DB)  ";
  delete log.exercises[1].name;
  raw["gym-comeback-w2-d3"] = JSON.stringify(log);
  const result = migration.normaliseSnapshot(raw);
  assert.equal(result.exerciseRecords[0].name, "  Goblet  squat (DB)  ");
  assert.equal(result.exerciseRecords[1].name, "");
  assert.equal(result.sessions[0].status, "incomplete");
  assert.equal(result.sessions[0].legacyRawValue, raw["gym-comeback-w2-d3"]);
  assert.ok(result.warnings.some(item => item.reason.includes("no usable name")));
});

test("does not invent a name for a malformed exercise entry", () => {
  const raw = fixture({});
  const log = JSON.parse(raw["gym-comeback-w2-d3"]);
  log.exercises[0] = null;
  raw["gym-comeback-w2-d3"] = JSON.stringify(log);
  const result = migration.normaliseSnapshot(raw);
  assert.equal(result.exerciseRecords[0].name, "");
  assert.ok(result.warnings.some(item => item.reason.includes("no usable name")));
});



test("preserves distinct exercise names that collide under legacy normalisation", () => {
  const raw = fixture({
    "Bench-Press::1": "complete",
    "Bench Press::1": "complete",
    "RDL (DB)::1": "complete",
    "RDL DB::1": "complete"
  });
  const log = JSON.parse(raw["gym-comeback-w2-d3"]);
  const names = ["Bench-Press", "Bench Press", "RDL (DB)", "RDL DB"];
  log.exercises = names.map(name => ({
    name,
    setCount: 1,
    sets: [{ weight: "", reps: "8", duration: "" }]
  }));
  raw["gym-comeback-w2-d3"] = JSON.stringify(log);

  const result = migration.normaliseSnapshot(raw);

  assert.deepEqual(Array.from(result.exerciseRecords, record => record.name), names);
  assert.equal(new Set(result.exerciseRecords.map(record => record.id)).size, names.length);
  assert.equal(result.sessions[0].legacyRawValue, raw["gym-comeback-w2-d3"]);
  assert.deepEqual(Array.from(result.setRecords, record => record.reps), ["8", "8", "8", "8"]);
});
