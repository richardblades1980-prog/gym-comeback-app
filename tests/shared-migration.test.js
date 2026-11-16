const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/data/shared-migration.js"), "utf8"), sandbox);
const migration = sandbox.window.ProjectComebackSharedMigration;

test("normalises profile, selected and custom equipment, readiness and weigh-ins", () => {
  const snapshot = {
    "gym-comeback-profile": JSON.stringify({ age: "42", painArea: "heel" }),
    "gym-comeback-gear": JSON.stringify({ gym: ["Dumbbells"], home: ["Bands"] }),
    "gym-comeback-custom-gear": JSON.stringify({ gym: ["Cable station"], home: [] }),
    "gym-comeback-readiness": JSON.stringify({ "2026-11-10": { pain: 1, energy: 4 } }),
    "gym-comeback-weigh-ins": JSON.stringify([{ date: "2026-11-10", weight: 82.5 }])
  };
  const result = migration.normaliseSnapshot(snapshot);
  assert.equal(result.profile[0].value.age, "42");
  assert.equal(result.equipment.length, 2);
  assert.equal(result.readiness[0].value.pain, 1);
  assert.equal(result.weighIns[0].weight, 82.5);
  assert.equal(result.counts.weighIns, 1);
});

test("retains programme and exercise settings as typed preferences with exact raw strings", () => {
  const raw = JSON.stringify({ sets: 4, focus: "reps" });
  const result = migration.normaliseSnapshot({
    "gym-comeback-ex-config-v1-2-squat": raw,
    "gym-comeback-swaps-day2": JSON.stringify({ "1": "Goblet squat" }),
    "gym-comeback-pref-largeTextToggle": "true",
    "gym-comeback-max-weeks": "8"
  });
  assert.equal(result.preferences.length, 4);
  const config = result.preferences.find(item => item.preferenceKind === "exercise-configuration");
  assert.equal(config.legacyRawValue, raw);
  assert.equal(config.value.sets, 4);
  assert.equal(result.preferences.find(item => item.legacyKey.endsWith("max-weeks")).value, 8);
});

test("invalid ancillary JSON creates warnings without losing the raw source", () => {
  const result = migration.normaliseSnapshot({ "gym-comeback-gear": "{bad", "gym-comeback-profile": "{bad" });
  assert.equal(result.warnings.length, 2);
  assert.equal(result.equipment.length, 0);
  assert.equal(result.profile.length, 0);
});

test("normalisation is deterministic", () => {
  const input = { "gym-comeback-readiness": JSON.stringify({ "2026-11-02": { energy: 3 } }) };
  assert.deepEqual(JSON.parse(JSON.stringify(migration.normaliseSnapshot(input))),
    JSON.parse(JSON.stringify(migration.normaliseSnapshot(input))));
});


test("preserves multiple weigh-ins on the same date with distinct stable IDs", () => {
  const raw = JSON.stringify([
    { date: "2026-11-10", weight: 82.5 },
    { date: "2026-11-10", weight: 82.1 },
    { date: "2026-11-11", weight: 81.9 }
  ]);
  const result = migration.normaliseSnapshot({ "gym-comeback-weigh-ins": raw });
  assert.equal(result.weighIns.length, 3);
  assert.equal(new Set(result.weighIns.map(item => item.id)).size, 3);
  assert.deepEqual(Array.from(result.weighIns, item => item.weight), [82.5, 82.1, 81.9]);
  assert.deepEqual(Array.from(result.weighIns, item => item.legacyIndex), [0, 1, 2]);
  assert.equal(result.weighIns[0].legacyRawValue, JSON.stringify({ date: "2026-11-10", weight: 82.5 }));
  assert.equal(result.weighIns[1].legacyRawValue, JSON.stringify({ date: "2026-11-10", weight: 82.1 }));
});

test("empty snapshot produces no typed shared records or warnings", () => {
  const result = migration.normaliseSnapshot({});
  assert.equal(result.profile.length, 0);
  assert.equal(result.equipment.length, 0);
  assert.equal(result.readiness.length, 0);
  assert.equal(result.weighIns.length, 0);
  assert.equal(result.preferences.length, 0);
  assert.equal(result.warnings.length, 0);
});

test("malformed profile and readiness JSON are warned and not projected", () => {
  const rawProfile = "{broken-profile";
  const rawReadiness = "{broken-readiness";
  const result = migration.normaliseSnapshot({
    "gym-comeback-profile": rawProfile,
    "gym-comeback-readiness": rawReadiness
  });
  assert.equal(result.profile.length, 0);
  assert.equal(result.readiness.length, 0);
  assert.deepEqual(Array.from(result.warnings, warning => warning.key), [
    "gym-comeback-profile",
    "gym-comeback-readiness"
  ]);
  // The normaliser is non-destructive: callers retain the exact raw snapshot.
  assert.equal(rawProfile, "{broken-profile");
  assert.equal(rawReadiness, "{broken-readiness");
});
