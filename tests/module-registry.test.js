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
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error || new Error("Could not delete test database."));
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}

async function loadServices() {
  const sandbox = { window: { indexedDB } };
  for (const file of ["database.js", "module-registry.js"]) {
    const sourcePath = path.join(__dirname, "../src", file === "database.js" ? "data" : "modules", file);
    vm.runInNewContext(fs.readFileSync(sourcePath, "utf8"), sandbox);
  }
  const db = sandbox.window.ProjectComebackDB;
  const modules = sandbox.window.ProjectComebackModules;
  await db.open();
  await modules.initialise();
  return { db, modules };
}

test("module ownership allows only the owning enabled module to write", async () => {
  await deleteDatabase();
  const { db, modules } = await loadServices();
  await modules.putOwnedRecord("gym", "sessions", {
    id: "gym-session-1", moduleId: "gym", date: "2026-11-17", status: "completed"
  });
  await modules.putOwnedRecord("hiking", "hikingRecords", {
    id: "hike-1", moduleId: "hiking", date: "2026-11-17", status: "completed"
  });

  await assert.rejects(
    modules.putOwnedRecord("gym", "hikingRecords", { id: "wrong-store", moduleId: "gym" }),
    /cannot write to store/
  );
  await assert.rejects(
    modules.putOwnedRecord("hiking", "hikingRecords", { id: "wrong-owner", moduleId: "gym" }),
    /matching moduleId/
  );
  assert.equal((await modules.getOwnedRecords("gym", "sessions")).length, 1);
  assert.equal((await modules.getOwnedRecords("hiking", "hikingRecords")).length, 1);
  assert.equal(await db.count("sessions"), 1);
});

test("disabling a module blocks new writes but preserves existing records for reading", async () => {
  await deleteDatabase();
  const { db, modules } = await loadServices();
  const original = {
    id: "hike-preserved", moduleId: "hiking", date: "2026-11-16",
    title: "Existing trail", status: "completed", distanceKm: 8
  };
  await modules.putOwnedRecord("hiking", "hikingRecords", original);

  const disabled = await modules.setEnabled("hiking", false);
  assert.equal(disabled.enabled, false);
  await assert.rejects(
    modules.putOwnedRecord("hiking", "hikingRecords", {
      id: "hike-blocked", moduleId: "hiking", date: "2026-11-17", title: "New trail"
    }),
    /is disabled/
  );

  const preserved = await modules.getOwnedRecords("hiking", "hikingRecords");
  assert.equal(preserved.length, 1);
  assert.equal(preserved[0].id, original.id);
  assert.equal(preserved[0].distanceKm, 8);
  assert.equal(await db.count("hikingRecords"), 1);

  const enabled = await modules.setEnabled("hiking", true);
  assert.equal(enabled.enabled, true);
  await modules.putOwnedRecord("hiking", "hikingRecords", {
    id: "hike-after-enable", moduleId: "hiking", date: "2026-11-18", title: "New trail"
  });
  assert.equal((await modules.getOwnedRecords("hiking", "hikingRecords")).length, 2);
});
