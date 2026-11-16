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
  assert.throws(() => migration.normaliseSnapshot({ "gym-comeback-w1-d1": "{bad json" }), /Invalid legacy JSON/);
});

test("normalisation is deterministic across repeated runs", () => {
  const raw = fixture({ "Goblet squat::1": "complete", "Goblet squat::2": "complete", "Plank::1": "complete" });
  const first = migration.normaliseSnapshot(raw);
  const second = migration.normaliseSnapshot(raw);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
});
