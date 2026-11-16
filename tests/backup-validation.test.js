const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = { window: {} };
const source = fs.readFileSync(path.join(__dirname, "../src/data/backup.js"), "utf8");
vm.runInNewContext(source, sandbox);
const backup = sandbox.window.ProjectComebackBackup;

function validEnvelope() {
  const data = {};
  for (const store of backup.stores) data[store] = [];
  data.profile.push({ id: "profile-main", displayName: "Test" });
  data.sessions.push({ id: "gym-session-1", moduleId: "gym", date: "2026-01-01" });
  data.hikingRecords.push({ id: "hike-1", moduleId: "hiking", date: "2026-01-02" });
  return {
    app: "Project Comeback",
    appVersion: "V21.2A",
    backupFormatVersion: 1,
    exportedAt: "2026-01-03T00:00:00.000Z",
    includedModules: ["gym", "hiking"],
    backupScope: "full",
    data
  };
}

test("accepts a complete full backup containing both modules", () => {
  const result = backup.validateBackup(validEnvelope());
  assert.equal(result.valid, true);
  assert.equal(result.counts.profile, 1);
  assert.equal(result.counts.sessions, 1);
  assert.equal(result.counts.hikingRecords, 1);
});

test("rejects an unsupported backup format", () => {
  const data = validEnvelope();
  data.backupFormatVersion = 999;
  assert.throws(() => backup.validateBackup(data), /Unsupported backup format/);
});

test("rejects a backup missing a required store", () => {
  const data = validEnvelope();
  delete data.data.setRecords;
  assert.throws(() => backup.validateBackup(data), /Backup is incomplete/);
});

test("rejects duplicate IDs within a store", () => {
  const data = validEnvelope();
  data.data.profile.push({ id: "profile-main" });
  assert.throws(() => backup.validateBackup(data), /Duplicate record ID/);
});

test("rejects records without stable IDs", () => {
  const data = validEnvelope();
  data.data.weighIns.push({ date: "2026-01-01", weight: 80 });
  assert.throws(() => backup.validateBackup(data), /Invalid record/);
});

test("rejects records in an unknown store", () => {
  const data = validEnvelope();
  data.data.unrecognisedStore = [];
  assert.throws(() => backup.validateBackup(data), /unknown stores/i);
});

test("restore preview reports additions, changes, unchanged and removals without writing", async () => {
  const incoming = validEnvelope();
  incoming.data.profile.push({ id: "profile-new", displayName: "New" });
  incoming.data.profile.push({ id: "profile-changed", displayName: "Incoming" });
  const current = {
    profile: [
      { id: "profile-main", displayName: "Test" },
      { id: "profile-old", displayName: "Old" },
      { id: "profile-changed", displayName: "Previous" }
    ]
  };
  let writes = 0;
  sandbox.window.ProjectComebackDB = {
    getAll: async store => current[store] || [],
    put: async () => { writes += 1; }
  };
  const preview = await backup.previewRestore(incoming);
  assert.deepEqual(
    JSON.parse(JSON.stringify(preview.stores.profile)),
    { current: 3, incoming: 3, added: 1, changed: 1, unchanged: 1, removed: 1 }
  );
  assert.equal(preview.valid, true);
  assert.equal(writes, 0);
  delete sandbox.window.ProjectComebackDB;
});

test("restore requires confirmation and atomically replaces stores while retaining a pre-restore snapshot", async () => {
  const { indexedDB } = require("fake-indexeddb");
  const dbWindow = { indexedDB };
  const dbSandbox = { window: dbWindow };
  const dbSource = fs.readFileSync(path.join(__dirname, "../src/data/database.js"), "utf8");
  vm.runInNewContext(dbSource, dbSandbox);
  const backupSource = fs.readFileSync(path.join(__dirname, "../src/data/backup.js"), "utf8");
  vm.runInNewContext(backupSource, dbSandbox);
  const db = dbWindow.ProjectComebackDB;
  const restore = dbWindow.ProjectComebackBackup;

  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(db.name);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });

  await db.put("profile", { id: "old-profile", displayName: "Before restore" });
  await db.put("hikingRecords", { id: "old-hike", moduleId: "hiking", title: "Old hike", date: "2026-01-01" });
  const incoming = validEnvelope();
  incoming.data.profile = [{ id: "new-profile", displayName: "Restored profile" }];
  incoming.data.hikingRecords = [{ id: "new-hike", moduleId: "hiking", status: "completed", title: "Restored hike", date: "2026-01-02" }];
  incoming.data.schedules = [{ id: "new-schedule", moduleId: "gym", status: "planned", title: "Restored plan", date: "2026-01-03" }];

  await assert.rejects(() => restore.restoreBackup(incoming), /explicit user confirmation/);
  assert.equal(await db.count("profile"), 1);
  assert.equal((await db.get("profile", "old-profile")).displayName, "Before restore");

  const result = await restore.restoreBackup(incoming, { confirmed: true });
  assert.equal(result.restored, true);
  assert.equal(result.safetySnapshotStored, true);
  assert.equal(await db.get("profile", "old-profile"), undefined);
  assert.equal((await db.get("profile", "new-profile")).displayName, "Restored profile");
  assert.equal((await db.get("hikingRecords", "new-hike")).title, "Restored hike");
  assert.equal((await db.get("schedules", "new-schedule")).title, "Restored plan");

  const snapshot = await db.get("metadata", result.restoreId);
  assert.equal(snapshot.type, "pre-restore-safety-snapshot");
  assert.equal(snapshot.data.profile[0].id, "old-profile");
  assert.equal(snapshot.data.hikingRecords[0].id, "old-hike");
});
