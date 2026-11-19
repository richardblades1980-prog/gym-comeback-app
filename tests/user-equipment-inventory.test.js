const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { indexedDB } = require("fake-indexeddb");

function load() {
  const window = { indexedDB };
  const sandbox = { window };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/data/database.js"), "utf8"), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/data/backup.js"), "utf8"), sandbox);
  return { db: window.ProjectComebackDB, backup: window.ProjectComebackBackup };
}

async function reset(db, backup) {
  await db.open();
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(db.name);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
  await db.open();
  const safety = await backup.createLegacySafetyBackup();
  await db.upgradeToV6(safety);
  await backup.verifyIdentityUpgradeRoundTrip();
  await db.put("profile", { id: "profile-main", displayName: "Test profile" });
}

function customRecord(id, overrides) {
  return Object.assign({
    id: "user-equipment:" + id,
    recordType: "user-equipment-access",
    schemaVersion: 1,
    profileId: "profile-main",
    moduleId: "gym",
    itemKind: "custom",
    customName: "User described machine",
    location: { id: "gym", label: "Gym" },
    availability: "unknown",
    status: "active",
    confirmedConfiguration: {}
  }, overrides || {});
}

function v1Envelope(backup, equipment) {
  const data = Object.fromEntries(backup.legacyStores.map(name => [name, []]));
  data.profile = [{ id: "profile-main", displayName: "Test" }];
  data.equipment = equipment || [];
  return {
    app: "Project Comeback",
    appVersion: "V21.2A",
    backupFormatVersion: 1,
    exportedAt: "2026-11-19T00:00:00.000Z",
    includedModules: ["gym", "hiking"],
    backupScope: "full",
    data
  };
}

test("typed equipment API defaults unknown availability and keeps physical instances separate", async () => {
  const { db, backup } = load();
  await reset(db, backup);
  const first = customRecord("machine-1", { availability: undefined, instanceLabel: "Left machine" });
  delete first.availability;
  await db.addUserEquipment(first);
  await db.addUserEquipment(customRecord("machine-2", { instanceLabel: "Right machine" }));

  const rows = await db.listUserEquipment("profile-main", "gym");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.id).sort(), ["user-equipment:machine-1", "user-equipment:machine-2"]);
  assert.ok(rows.every(row => row.availability === "unknown"));
  assert.equal((await db.listUserEquipment("another-profile")).length, 0);
  assert.equal((await db.listUserEquipment("profile-main", "home")).length, 0);
});

test("catalogue inventory requires exact retained release identity and cannot silently rebind", async () => {
  const { db, backup } = load();
  await reset(db, backup);
  await db.add("catalogueReleases", {
    id: "catalogue-release-r1", catalogueId: "exercise-catalogue", version: 1, checksum: "sha256:test"
  });
  const item = {
    id: "user-equipment:catalogue-machine-1",
    recordType: "user-equipment-access",
    schemaVersion: 1,
    profileId: "profile-main",
    moduleId: "gym",
    itemKind: "catalogue",
    equipmentDefinitionId: "equipment-machine-a",
    catalogueId: "exercise-catalogue",
    catalogueReleaseId: "catalogue-release-r1",
    catalogueVersion: 1,
    location: { id: "home", label: "Home" }
  };
  await db.addUserEquipment(item);
  const saved = await db.get("equipment", item.id);
  assert.equal(saved.availability, "unknown");
  assert.equal(saved.status, "active");
  await assert.rejects(() => db.updateUserEquipment(Object.assign({}, saved, {
    catalogueReleaseId: "catalogue-release-r2",
    catalogueVersion: 2
  })), /identity field cannot be changed|release identity cannot be rebound/);
  await assert.rejects(() => db.addUserEquipment(Object.assign({}, item, {
    id: "user-equipment:missing-release", catalogueReleaseId: "missing-release"
  })), /not retained/);
});

test("typed equipment records cannot be spoofed through generic writes or hard-deleted", async () => {
  const { db, backup } = load();
  await reset(db, backup);
  const record = customRecord("protected");
  await db.addUserEquipment(record);
  await assert.rejects(() => db.put("equipment", { id: record.id, legacyRawValue: "overwrite" }), /must be updated through the validated inventory contract/);
  await assert.rejects(() => db.remove("equipment", record.id), /cannot be hard-deleted/);
  await db.retireUserEquipment(record.id, "profile-main");
  assert.equal((await db.listUserEquipment("profile-main")).length, 0);
  assert.equal((await db.get("equipment", record.id)).status, "retired");
});

test("V1 restore preview and restore preserve validated typed inventory while replacing legacy equipment", async () => {
  const { db, backup } = load();
  await reset(db, backup);
  const legacyBefore = { id: "legacy-equipment-before", legacyKey: "gym-comeback-gear", legacyRawValue: "{\"gym\":[\"old\"]}", migratedFromLegacy: true };
  const typed = customRecord("keep-on-v1-restore");
  await db.put("equipment", legacyBefore);
  await db.addUserEquipment(typed);
  const incoming = v1Envelope(backup, [{
    id: "legacy-equipment-from-backup",
    legacyKey: "gym-comeback-gear",
    legacyRawValue: "{\"gym\":[\"backup\"]}",
    migratedFromLegacy: true
  }]);

  const preview = await backup.previewRestore(incoming);
  assert.equal(preview.stores.equipment.behavior, "replace-preserve-typed");
  assert.equal(preview.stores.equipment.preserved, 1);
  assert.equal(preview.stores.equipment.removed, 1);
  assert.equal(preview.stores.equipment.projected, 2);
  assert.match(preview.stores.equipment.action, /preserve validated typed user inventory/);

  const result = await backup.restoreBackup(incoming, { confirmed: true });
  assert.equal(result.preservedUserEquipmentCount, 1);
  assert.equal(await db.get("equipment", legacyBefore.id), undefined);
  assert.equal((await db.get("equipment", "legacy-equipment-from-backup")).legacyRawValue, incoming.data.equipment[0].legacyRawValue);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await db.get("equipment", typed.id))),
    JSON.parse(JSON.stringify(typed))
  );
});

test("V1 restore blocks an ID collision with typed inventory and leaves all data unchanged", async () => {
  const { db, backup } = load();
  await reset(db, backup);
  const typed = customRecord("collision");
  await db.addUserEquipment(typed);
  const incoming = v1Envelope(backup, [{ id: typed.id, legacyRawValue: "not the typed record" }]);
  const preview = await backup.previewRestore(incoming);
  assert.equal(preview.stores.equipment.conflicts, 1);
  assert.equal(preview.stores.equipment.projected, null);
  await assert.rejects(() => backup.restoreBackup(incoming, { confirmed: true }), /ID conflicts with retained typed user inventory/);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await db.get("equipment", typed.id))),
    JSON.parse(JSON.stringify(typed))
  );
});

test("V2 backup and restore round-trip typed and legacy equipment records exactly", async () => {
  const { db, backup } = load();
  await reset(db, backup);
  const legacy = { id: "legacy-gear", legacyKey: "gym-comeback-gear", legacyRawValue: "{\"home\":[\"mat\"]}", migratedFromLegacy: true };
  const typed = customRecord("v2-round-trip", {
    location: { id: "home", label: "Home" },
    availability: "temporarily-unavailable",
    confirmedConfiguration: { loadingSystemId: "pin-selected-test", setupAttributeIds: ["adjustable-test"] }
  });
  await db.put("equipment", legacy);
  await db.addUserEquipment(typed);
  const envelope = await backup.createBackup();
  assert.equal(envelope.backupFormatVersion, 2);
  assert.ok(envelope.data.equipment.some(row => row.id === typed.id));
  await db.updateUserEquipment(Object.assign({}, typed, { availability: "available" }));
  const result = await backup.restoreBackup(envelope, { confirmed: true });
  assert.equal(result.restored, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await db.get("equipment", typed.id))),
    JSON.parse(JSON.stringify(envelope.data.equipment.find(row => row.id === typed.id)))
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(await db.get("equipment", legacy.id))),
    JSON.parse(JSON.stringify(legacy))
  );
});
