"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/data/gym-base-programme.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const programme = sandbox.window.ProjectComebackGymBaseProgramme;

const listDays = () => JSON.parse(JSON.stringify(programme.listDays()));

const expected = [
  ["Chest Press Machine","Lat Pulldown","Seated Cable Row","Leg Press","Seated Leg Extension","Dumbbell Lateral Raise","Abdominal Crunch"],
  ["Incline Chest Press","Shoulder Press Machine","Seated Hamstring Curl","Seated Leg Extension","Cable Triceps Pushdown","Dumbbell Biceps Curl","Prone or Lying Leg Curl"],
  ["Chest Press Machine","Lat Pulldown","Chair Squat / Sit-to-Stand","Glute Bridge","Dumbbell Biceps Curl","Plank"],
  ["Incline Chest Press","Seated Cable Row","Shoulder Press Machine","Dumbbell Lateral Raise","Cable Triceps Pushdown","Dumbbell Biceps Curl"],
  ["Seated Hamstring Curl","Seated Leg Extension","Glute Bridge","Chair Squat / Sit-to-Stand","Calf Raise","Abdominal Crunch"]
];

test("source-preserved five-day programme has the documented 32 slots", () => {
  assert.ok(programme);
  assert.deepEqual(JSON.parse(JSON.stringify(programme.validate())), {
    valid: true, dayCount: 5, slotCount: 32, slotCounts: [7,7,6,6,6]
  });
  const days = listDays();
  assert.equal(days.length, 5);
  days.forEach((day, index) => {
    assert.equal(day.dayNumber, index + 1);
    assert.deepEqual(day.slots.map(item => item.sourceExerciseLabel), expected[index]);
  });
});

test("source slot IDs are stable, unique and preserve repeated exercise slots", () => {
  const days = listDays();
  const slots = days.flatMap(day => day.slots);
  const ids = slots.map(item => item.slotId);
  assert.equal(slots.length, 32);
  assert.equal(new Set(ids).size, 32);
  assert.equal(slots.filter(item => item.sourceExerciseLabel === "Chest Press Machine").length, 2);
  assert.equal(slots.filter(item => item.sourceExerciseLabel === "Seated Leg Extension").length, 3);
});

test("source snapshot preserves provenance and does not assign canonical identities", () => {
  assert.equal(programme.source.snapshotId, "gym-base-programme-source-v1");
  assert.equal(programme.source.sourceGitBlobSha, "e3eb0093648cc6c5d706bb5b1008b58ec01a5576");
  assert.equal(programme.source.status, "source-snapshot-not-published-programme");
  for (const day of listDays()) {
    for (const item of day.slots) {
      assert.equal(item.identityLinkStatus, "unreviewed");
      assert.equal(Object.hasOwn(item, "exerciseDefinitionId"), false);
      assert.equal(Object.hasOwn(item, "exerciseVariationId"), false);
      assert.equal(item.defaultSetCount, 3);
      assert.ok(["reps","timed-hold"].includes(item.defaultRecordingMode));
    }
  }
});

test("Plank retains its legacy timed-hold default and other base slots use reps", () => {
  for (const day of listDays()) {
    for (const item of day.slots) {
      if (item.sourceExerciseLabel === "Plank") {
        assert.equal(item.defaultProgressionFocus, "duration");
        assert.equal(item.defaultRecordingMode, "timed-hold");
      } else {
        assert.equal(item.defaultProgressionFocus, "reps");
        assert.equal(item.defaultRecordingMode, "reps");
      }
    }
  }
});

test("day reads return independent copies and reject invalid day numbers", () => {
  const first = programme.getDay(1);
  first.slots[0].sourceExerciseLabel = "Changed locally";
  first.slots[0].sourceMuscleKeys.push("unreviewed-key");
  const second = programme.getDay(1);
  assert.equal(second.slots[0].sourceExerciseLabel, "Chest Press Machine");
  assert.equal(second.slots[0].sourceMuscleKeys.includes("unreviewed-key"), false);
  assert.throws(() => programme.getDay(0), /integer from 1 to 5/);
  assert.throws(() => programme.getDay(6), /integer from 1 to 5/);
});
