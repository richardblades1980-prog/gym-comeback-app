const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { indexedDB } = require("fake-indexeddb");

const DB_NAME = "ProjectComebackDB";

function deleteDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not delete test database."));
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}

function loadDatabase() {
  const sandbox = { window: { indexedDB } };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../src/data/database.js"), "utf8"),
    sandbox
  );
  return sandbox.window.ProjectComebackDB;
}

function projection() {
  return {
    profile: [{ id: "profile-legacy", legacyKey: "gym-comeback-profile", legacyRawValue: "{\"age\":44}", value: { age: 44 } }],
    equipment: [{ id: "equipment-legacy", legacyKey: "gym-comeback-gear", legacyRawValue: "{\"gym\":[]}", items: [] }],
    readiness: [{ id: "readiness-2026-11-10", legacyKey: "gym-comeback-readiness", legacyRawValue: "{\"2026-11-10\":{}}", date: "2026-11-10" }],
    weighIns: [{ id: "weigh-in-2026-11-10-0", legacyKey: "gym-comeback-weigh-ins", legacyRawValue: "[{\"date\":\"2026-11-10\",\"weight\":82}]", date: "2026-11-10", weight: 82 }],
    preferences: [{ id: "preference-large-text", legacyKey: "gym-comeback-pref-largeTextToggle", legacyRawValue: "true", value: true }],
    sessions: [{ id: "gym-session-w1-d1", legacyKey: "gym-comeback-w1-d1", legacyRawValue: "{\"date\":\"2026-11-10\"}", moduleId: "gym", date: "2026-11-10" }],
    exerciseRecords: [{ id: "gym-session-w1-d1-exercise-0", legacyKey: "gym-comeback-w1-d1", legacyRawValue: "{\"name\":\"Squat\"}", sessionId: "gym-session-w1-d1", moduleId: "gym" }],
    setRecords: [{ id: "gym-session-w1-d1-exercise-0-set-0", legacyKey: "gym-comeback-w1-d1", legacyRawValue: "{\"weight\":\"10\",\"reps\":\"8\"}", sessionId: "gym-session-w1-d1", moduleId: "gym" }]
  };
}

const markerId = "migration-integration-test";

test("real IndexedDB commits all typed stores and completion marker atomically", async () => {
  await deleteDatabase();
  const db = loadDatabase();
  const data = projection();
  const summary = { sourceKeyCount: 5, counts: Object.fromEntries(Object.entries(data).map(([key, records]) => [key, records.length])) };

  const result = await db.commitLegacyMigration(data, markerId, summary);

  assert.equal(result.status, "complete");
  for (const [store, records] of Object.entries(data)) {
    const saved = await db.getAll(store);
    assert.equal(saved.length, records.length, store + " record count");
    assert.equal(saved[0].migratedFromLegacy, true, store + " migration flag");
  }
  const gymSessions = await db.getAllByIndex("sessions", "by_module", "gym");
  assert.equal(gymSessions.length, 1, "Gym-owned sessions can be read through the module index");
  assert.equal(db.version, 4, "database schema version includes the Gym session module index");
  const marker = await db.getMeta(markerId);
  assert.equal(marker.value.status, "complete");
  assert.deepEqual(JSON.parse(JSON.stringify(marker.value.counts)), summary.counts);
});

test("real IndexedDB rolls back the whole migration on deterministic-ID conflict", async () => {
  await deleteDatabase();
  const db = loadDatabase();
  await db.put("profile", {
    id: "profile-legacy",
    legacyKey: "different-source",
    legacyRawValue: "not-the-same-source",
    value: { age: 99 }
  });

  await assert.rejects(
    db.commitLegacyMigration(projection(), markerId, { counts: { profile: 1, equipment: 1 } }),
    /Migration conflict: existing profile record profile-legacy/
  );

  assert.equal((await db.getAll("equipment")).length, 0);
  assert.equal((await db.getAll("sessions")).length, 0);
  assert.equal((await db.getMeta(markerId)), undefined);
  assert.equal((await db.get("profile", "profile-legacy")).value.age, 99);
});

test("real IndexedDB permits a clean retry after a conflict is resolved", async () => {
  await deleteDatabase();
  const db = loadDatabase();
  await db.put("profile", {
    id: "profile-legacy",
    legacyKey: "different-source",
    legacyRawValue: "not-the-same-source",
    value: { age: 99 }
  });
  const data = projection();

  await assert.rejects(db.commitLegacyMigration(data, markerId, { counts: { profile: 1 } }), /Migration conflict/);
  assert.equal(await db.count("equipment"), 0);
  await db.remove("profile", "profile-legacy");

  const retried = await db.commitLegacyMigration(data, markerId, { counts: { profile: 1, equipment: 1 } });
  assert.equal(retried.status, "complete");
  assert.equal(await db.count("profile"), 1);
  assert.equal(await db.count("equipment"), 1);
  assert.equal((await db.getMeta(markerId)).value.status, "complete");
});

test("real IndexedDB repeated completion is idempotent", async () => {
  await deleteDatabase();
  const db = loadDatabase();
  const data = projection();
  const first = await db.commitLegacyMigration(data, markerId, { counts: { profile: 1 } });
  const second = await db.commitLegacyMigration(data, markerId, { counts: { profile: 1 } });

  assert.equal(first.status, "complete");
  assert.equal(second.status, "already-complete");
  assert.equal(await db.count("profile"), 1);
  assert.equal(await db.count("sessions"), 1);
});
