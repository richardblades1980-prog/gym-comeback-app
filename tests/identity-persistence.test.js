"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { indexedDB } = require("fake-indexeddb");

const root = path.join(__dirname, "..");
const DB_NAME = "ProjectComebackDB";
const BASE_STORES = [
  "profile","objectives","equipment","readiness","weighIns","assessments","modules",
  "programmes","sessions","exerciseRecords","setRecords","hikingRecords","schedules",
  "progression","preferences","metadata","legacyRecords"
];

async function deleteDatabase() {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error || new Error("Could not delete test database."));
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}

function loadServices() {
  const sandbox = { window: { indexedDB } };
  for (const file of ["src/data/database.js", "src/data/backup.js", "src/data/exercise-identity.js"]) {
    vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window;
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

async function seedV5(db) {
  const values = {};
  for (const store of BASE_STORES) {
    const record = {
      id: "fixture-" + store,
      legacyKey: "legacy-" + store,
      legacyRawValue: "{ \"exact\": \"" + store + "  \" }",
      value: { store, exactWhitespace: "  keep  " }
    };
    await db.put(store, record);
    values[store] = await db.get(store, record.id);
  }
  return values;
}

async function prepareV6() {
  await deleteDatabase();
  const window = loadServices();
  const db = window.ProjectComebackDB;
  const initialConnection = await db.open();
  initialConnection.close();
  assert.equal(await db.getVersion(), 5, "ordinary open must not upgrade a populated v5 database");
  const safety = await window.ProjectComebackBackup.createLegacySafetyBackup();
  assert.equal(window.ProjectComebackBackup.validateBackup(safety).formatVersion, 1);
  const result = await db.upgradeToV6(safety);
  assert.equal(result.status, "upgraded");
  assert.equal(await db.getVersion(), 6);
  return { window, db, safety, result };
}

test("v5 upgrade is explicit, additive and preserves every populated store exactly", async () => {
  await deleteDatabase();
  const window = loadServices();
  const db = window.ProjectComebackDB;
  const initialConnection = await db.open();
  initialConnection.close();
  const before = await seedV5(db);
  const safety = await window.ProjectComebackBackup.createLegacySafetyBackup();

  assert.equal(await db.getVersion(), 5);
  const result = await db.upgradeToV6(safety);
  assert.equal(result.version, 6);
  const repeatedUpgrade = await db.upgradeToV6(safety);
  assert.equal(repeatedUpgrade.status, "already-upgraded");
  assert.equal(await db.count("metadata"), 2, "the safety snapshot is not duplicated on retry");
  for (const store of BASE_STORES) {
    const after = await db.get(store, before[store].id);
    assert.deepEqual(JSON.parse(JSON.stringify(after)), JSON.parse(JSON.stringify(before[store])), store + " must remain unchanged");
  }
  const snapshot = await db.get("metadata", result.safetySnapshotId);
  assert.equal(snapshot.type, "pre-identity-upgrade-safety-snapshot");
  assert.equal(snapshot.verificationStatus, "pending");
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot.data.metadata)), [before.metadata]);
  const connection = await db.open();
  try {
    for (const store of [
      "exerciseDefinitions","exerciseVariations","exerciseAliases","identityReviewEvents",
      "catalogueReleases","exerciseConfigurations","programmeVersions","programmeDays","programmeSlots"
    ]) assert.equal(connection.objectStoreNames.contains(store), true, store + " must be created");
  } finally { connection.close(); }
});

test("failed version-change transaction leaves schema v5 intact and can be retried cleanly", async () => {
  await deleteDatabase();
  const window = loadServices();
  const db = window.ProjectComebackDB;
  const initialConnection = await db.open();
  initialConnection.close();
  await db.put("metadata", { id: "identity-upgrade-v6-safety-snapshot", type: "deliberate-conflict" });
  const safety = await window.ProjectComebackBackup.createLegacySafetyBackup();

  await assert.rejects(() => db.upgradeToV6(safety));
  assert.equal(await db.getVersion(), 5);
  const beforeRetry = await db.open();
  try { assert.equal(beforeRetry.objectStoreNames.contains("identityReviewEvents"), false); }
  finally { beforeRetry.close(); }

  await db.remove("metadata", "identity-upgrade-v6-safety-snapshot");
  const retry = await db.upgradeToV6(safety);
  assert.equal(retry.status, "upgraded");
  assert.equal(await db.getVersion(), 6);
  assert.equal(await db.count("identityReviewEvents"), 0);
});

test("identity review events are append-only, idempotent per profile and correction-safe", async () => {
  const { window, db } = await prepareV6();
  const identity = window.ProjectComebackIdentity;
  await identity.storeCatalogueRelease({ id: "catalogue-1", version: 1, checksum: "sha256:catalogue-1" });
  const firstInput = {
    id: "review-original",
    reviewedAt: "2026-11-17T10:00:00.000Z",
    profileId: "profile-a",
    subjectType: "exerciseRecord",
    subjectId: "session-1-exercise-1",
    sourceNamespace: "v21.1.exercise-name",
    actor: "user",
    sourceExactValue: "  Bench-Press  ",
    sourceRawValue: "{ \"name\": \"  Bench-Press  \" }",
    previousMapping: null,
    proposedMapping: { exerciseDefinitionId: "exd_press", exerciseVariationId: null },
    outcome: "verified",
    evidence: { type: "explicit-user-confirmation" },
    catalogueReleaseId: "catalogue-1",
    idempotencyKey: "review-session-1-exercise-1"
  };
  const first = await identity.recordIdentityReviewEvent(firstInput);
  assert.equal(first.appended, true);
  const retry = await identity.recordIdentityReviewEvent({ ...firstInput, id: "review-retry" });
  assert.equal(retry.appended, false);
  assert.equal(retry.event.id, "review-original");
  const otherProfile = await identity.recordIdentityReviewEvent({ ...firstInput, id: "review-profile-b", profileId: "profile-b" });
  assert.equal(otherProfile.appended, true);

  const correction = await identity.recordIdentityReviewEvent({
    ...firstInput,
    id: "review-correction",
    reviewedAt: "2026-11-17T10:01:00.000Z",
    proposedMapping: { exerciseDefinitionId: "exd_incline_press", exerciseVariationId: null },
    previousMapping: first.event.proposedMapping,
    outcome: "reversed",
    idempotencyKey: "review-session-1-exercise-1-correction",
    reversesEventId: first.event.id
  });
  assert.equal(correction.appended, true);
  assert.equal((await db.getAll("identityReviewEvents")).length, 3);
  assert.equal((await db.get("identityReviewEvents", "review-original")).proposedMapping.exerciseDefinitionId, "exd_press");
  const projection = await identity.rebuildIdentityProjection("profile-a", "exerciseRecord", "session-1-exercise-1");
  assert.equal(projection.outcome, "reversed");
  assert.equal(projection.mapping, null);
  assert.equal(projection.eventCount, 2);
  await assert.rejects(() => db.put("identityReviewEvents", first.event), /append-only/);
  await assert.rejects(() => db.remove("identityReviewEvents", "review-original"), /append-only/);
});

test("catalogue release manifests are immutable and references retain used releases", async () => {
  const { window, db } = await prepareV6();
  const identity = window.ProjectComebackIdentity;
  const release = { id: "catalogue-2026.11.1", version: 1, checksum: "sha256:release-one", source: "bundled-versioned-local-asset" };
  assert.equal((await identity.storeCatalogueRelease(release)).stored, true);
  assert.equal((await identity.storeCatalogueRelease(release)).stored, false);
  await assert.rejects(() => identity.storeCatalogueRelease({ id: "catalogue-out-of-order", version: 1, checksum: "sha256:old" }), /monotonically/);
  await assert.rejects(() => identity.storeCatalogueRelease({ ...release, checksum: "sha256:changed" }), /immutable/);
  await assert.rejects(() => db.put("catalogueReleases", release), /append-only/);
  await assert.rejects(() => db.remove("catalogueReleases", release.id), /append-only/);

  await db.put("programmeVersions", { id: "programme-v1", programmeId: "programme-a", status: "published", catalogueReleaseId: release.id });
  await db.put("programmeVersions", { id: "programme-draft", status: "draft", catalogueReleaseId: "draft-release" });
  await db.put("sessions", { id: "session-active", status: "active", catalogueReleaseId: release.id });
  await db.put("sessions", { id: "session-cancelled", status: "cancelled", catalogueReleaseId: "cancelled-release" });
  await identity.recordIdentityReviewEvent({
    id: "release-review", profileId: "profile-a", subjectType: "exerciseRecord", subjectId: "record-1",
    sourceNamespace: "legacy", actor: "user", sourceExactValue: "Bench", outcome: "ambiguous",
    evidence: { candidateIds: ["exd_press", "exd_incline_press"] },
    catalogueReleaseId: release.id, idempotencyKey: "release-review-1"
  });
  const refs = await identity.getCatalogueReleaseReferences(release.id);
  assert.deepEqual(refs.map(item => item.type).sort(), ["identityReviewEvent", "programmeVersion", "session"]);
  assert.equal(await identity.isCatalogueReleaseRetained(release.id), true);
  assert.equal(await identity.isCatalogueReleaseRetained("draft-release"), false);
  assert.equal(await identity.isCatalogueReleaseRetained("cancelled-release"), false);
});

test("exercise definition and variation IDs are retained and retired by status, not deleted", async () => {
  const { db } = await prepareV6();
  await db.put("exerciseDefinitions", { id: "exd_stable", name: "Barbell Bench Press", status: "active" });
  await db.put("exerciseVariations", { id: "exv_stable", exerciseDefinitionId: "exd_stable", name: "Paused", status: "active" });
  await assert.rejects(() => db.remove("exerciseDefinitions", "exd_stable"), /retire them by changing status/);
  await assert.rejects(() => db.remove("exerciseVariations", "exv_stable"), /retire them by changing status/);
  await db.put("exerciseDefinitions", { id: "exd_stable", name: "Barbell Bench Press", status: "retired" });
  assert.equal((await db.get("exerciseDefinitions", "exd_stable")).status, "retired");
});

test("published programme versions, days and slots are immutable after publication", async () => {
  const { window, db } = await prepareV6();
  await window.ProjectComebackIdentity.storeCatalogueRelease({ id: "catalogue-1", version: 1, checksum: "sha256:catalogue-1" });
  await db.put("programmeVersions", { id: "programme-version-editable", programmeId: "programme-a", status: "draft", catalogueReleaseId: "catalogue-1" });
  await db.put("programmeDays", { id: "programme-day-editable", programmeVersionId: "programme-version-editable", dayLineageId: "day-lineage-1" });
  await db.put("programmeSlots", { id: "programme-slot-editable", programmeVersionId: "programme-version-editable", programmeDayId: "programme-day-editable", slotLineageId: "slot-lineage-1" });
  await db.put("programmeVersions", { id: "programme-version-editable", programmeId: "programme-a", status: "published", catalogueReleaseId: "catalogue-1" });
  await assert.rejects(() => db.put("programmeVersions", { id: "programme-version-editable", programmeId: "programme-a", status: "draft" }), /Published programme versions are immutable/);
  await assert.rejects(() => db.remove("programmeVersions", "programme-version-editable"), /Published programme versions are immutable/);
  await assert.rejects(() => db.put("programmeDays", { id: "programme-day-editable", programmeVersionId: "programme-version-editable", dayLineageId: "changed" }), /published programme version are immutable/);
  await assert.rejects(() => db.remove("programmeSlots", "programme-slot-editable"), /published programme version are immutable/);
});

test("historical display snapshots survive catalogue rename, retirement and missing release assets", async () => {
  const { window } = await prepareV6();
  const snapshot = window.ProjectComebackIdentity.createCanonicalDisplaySnapshot({
    locale: "en-AU",
    canonicalName: "Dumbbell Romanian Deadlift",
    variationName: "B-stance",
    equipmentLabels: ["Dumbbell"],
    shortCue: "Hinge at the hips"
  });
  const laterDefinition = { canonicalName: "DB Hip Hinge", status: "retired" };
  const availableReleaseAssets = new Set(["catalogue-current"]);
  assert.equal(availableReleaseAssets.has("catalogue-old"), false);
  assert.equal(snapshot.canonicalName, "Dumbbell Romanian Deadlift");
  assert.equal(snapshot.variationName, "B-stance");
  assert.deepEqual(Array.from(snapshot.equipmentLabels), ["Dumbbell"]);
  assert.equal(snapshot.shortCue, "Hinge at the hips");
  assert.equal(laterDefinition.canonicalName, "DB Hip Hinge");
});

test("reusable exercise configuration enforces typed fields and exact profile/variation/equipment scope", async () => {
  const { window } = await prepareV6();
  const identity = window.ProjectComebackIdentity;
  const base = {
    profileId: "profile-a",
    exerciseDefinitionId: "exd_rdl",
    exerciseVariationId: "exv_bstance",
    equipmentDefinitionId: "eqd_dumbbell",
    settings: { preferredProgressionFocus: "reps", recordingModeOverride: "reps" }
  };
  const saved = await identity.saveReusableConfiguration(base, ["reps", "timed-reps"]);
  const loaded = await identity.getReusableConfiguration(base);
  assert.equal(loaded.id, saved.id);
  assert.equal(loaded.settings.preferredProgressionFocus, "reps");
  assert.equal(loaded.configurationSchemaVersion, 1);
  assert.equal(loaded.provenance.source, "user-explicit");
  assert.notEqual((await identity.saveReusableConfiguration({ ...base, profileId: "profile-b" }, ["reps"])).id, saved.id);
  assert.notEqual((await identity.saveReusableConfiguration({ ...base, exerciseVariationId: null }, ["reps"])).id, saved.id);
  assert.notEqual((await identity.saveReusableConfiguration({ ...base, equipmentDefinitionId: null }, ["reps"])).id, saved.id);
  await assert.rejects(() => identity.saveReusableConfiguration({ ...base, settings: { setCount: 4 } }, ["reps"]), /only preferredProgressionFocus/);
  await assert.rejects(() => identity.saveReusableConfiguration({ ...base, setCount: 4 }, ["reps"]), /outside its approved/);
  await assert.rejects(() => identity.saveReusableConfiguration({ ...base, settings: { recordingModeOverride: "timed-hold" } }, ["reps"]), /supported by the selected/);
});

test("V1 restore preserves V6 identity data and exact unresolved legacy keys and values", async () => {
  const { window, db, safety } = await prepareV6();
  await assert.rejects(() => window.ProjectComebackBackup.restoreBackup(safety, { confirmed: true }), /Complete the post-upgrade V2 backup\/restore verification/);
  await window.ProjectComebackBackup.verifyIdentityUpgradeRoundTrip();
  const identity = window.ProjectComebackIdentity;
  await identity.recordIdentityReviewEvent({
    id: "review-retained", profileId: "profile-a", subjectType: "exerciseRecord", subjectId: "record-a",
    sourceNamespace: "v21.1.exercise-name", actor: "user", sourceExactValue: "  RDL (DB)  ",
    evidence: { type: "preserved-unresolved-legacy-source" },
    sourceRawValue: "{ \"setCount\": 4, \"focus\": \"weight\" }",
    outcome: "unresolved", idempotencyKey: "legacy-review-retained"
  });
  await identity.storeCatalogueRelease({ id: "catalogue-retained", version: 1, checksum: "sha256:retained" });
  await identity.saveReusableConfiguration({
    profileId: "profile-a", exerciseDefinitionId: "exd_rdl", settings: { preferredProgressionFocus: "reps" }
  }, ["reps"]);
  const legacyConfig = {
    id: "gym-comeback-ex-config-v1-2-bench-press",
    key: "gym-comeback-ex-config-v1-2-bench-press",
    rawValue: "{\"setCount\":4,\"focus\":\"weight\",\"recordingMode\":\"reps\"}"
  };
  safety.data.legacyRecords.push(legacyConfig);
  safety.recordCounts.legacyRecords = safety.data.legacyRecords.length;
  await db.put("legacyRecords", legacyConfig);

  const preview = await window.ProjectComebackBackup.previewRestore(safety);
  assert.ok(preview.preservedStores.includes("identityReviewEvents"));
  await window.ProjectComebackBackup.restoreBackup(safety, { confirmed: true });
  assert.equal((await db.get("identityReviewEvents", "review-retained")).sourceExactValue, "  RDL (DB)  ");
  assert.equal((await db.get("catalogueReleases", "catalogue-retained")).checksum, "sha256:retained");
  assert.equal((await db.getAll("exerciseConfigurations")).length, 1);
  const legacy = await db.get("legacyRecords", "gym-comeback-ex-config-v1-2-bench-press");
  assert.equal(legacy.key, "gym-comeback-ex-config-v1-2-bench-press");
  assert.equal(legacy.rawValue, "{\"setCount\":4,\"focus\":\"weight\",\"recordingMode\":\"reps\"}");
});

test("V2 backup export, append-only restore merge and safety-snapshot round trip verify", async () => {
  const { window, db } = await prepareV6();
  const identity = window.ProjectComebackIdentity;
  await identity.recordIdentityReviewEvent({
    id: "review-v2", profileId: "profile-a", subjectType: "exerciseRecord", subjectId: "record-v2",
    sourceNamespace: "catalogue", actor: "user", sourceExactValue: "Goblet squat",
    evidence: { type: "explicit-user-confirmation" }, outcome: "verified", proposedMapping: { exerciseDefinitionId: "exd_goblet_squat" },
    idempotencyKey: "review-v2-1"
  });
  await identity.storeCatalogueRelease({ id: "catalogue-v2", version: 2, checksum: "sha256:v2" });
  const historicalDisplay = identity.createCanonicalDisplaySnapshot({
    canonicalName: "Dumbbell Romanian Deadlift",
    variationName: "B-stance",
    equipmentLabels: ["Dumbbell"],
    shortCue: "Hinge at the hips"
  });
  await db.put("sessions", {
    id: "session-historical-display",
    status: "completed",
    catalogueReleaseId: "catalogue-v2",
    canonicalDisplaySnapshot: historicalDisplay
  });
  await identity.saveReusableConfiguration({
    profileId: "profile-a", exerciseDefinitionId: "exd_goblet_squat", settings: { preferredProgressionFocus: "weight" }
  }, ["reps"]);

  const envelope = await window.ProjectComebackBackup.createBackup();
  assert.equal(envelope.backupFormatVersion, 2);
  await db.put("exerciseDefinitions", { id: "exd-history-merge", name: "Goblet Squat", status: "active" });
  await db.put("exerciseVariations", { id: "exv-history-merge", exerciseDefinitionId: "exd-history-merge", name: "Tempo", status: "active" });
  await db.put("programmeVersions", { id: "programme-history-v1", programmeId: "programme-a", status: "draft", catalogueReleaseId: "catalogue-v2" });
  await db.put("programmeDays", { id: "programme-history-day", programmeVersionId: "programme-history-v1", dayLineageId: "day-lineage-v1" });
  await db.put("programmeSlots", { id: "programme-history-slot", programmeVersionId: "programme-history-v1", programmeDayId: "programme-history-day", slotLineageId: "slot-lineage-v1" });
  await db.put("programmeVersions", { id: "programme-history-v1", programmeId: "programme-a", status: "published", catalogueReleaseId: "catalogue-v2" });
  await window.ProjectComebackBackup.restoreBackup(envelope, { confirmed: true });
  assert.equal((await db.get("exerciseDefinitions", "exd-history-merge")).name, "Goblet Squat");
  assert.equal((await db.get("exerciseVariations", "exv-history-merge")).name, "Tempo");
  assert.equal((await db.get("programmeVersions", "programme-history-v1")).status, "published");
  assert.equal((await db.get("programmeSlots", "programme-history-slot")).slotLineageId, "slot-lineage-v1");
  assert.equal(window.ProjectComebackBackup.validateBackup(envelope).valid, true);
  assert.ok(envelope.data.identityReviewEvents.some(item => item.id === "review-v2"));
  assert.ok(envelope.data.catalogueReleases.some(item => item.id === "catalogue-v2"));

  const roundTrip = await window.ProjectComebackBackup.verifyIdentityUpgradeRoundTrip();
  assert.equal(roundTrip.status, "verified");
  const snapshot = await db.get("metadata", "identity-upgrade-v6-safety-snapshot");
  assert.equal(snapshot.verificationStatus, "complete");
  assert.ok(snapshot.roundTripBackupExportedAt);
  assert.equal((await db.get("identityReviewEvents", "review-v2")).outcome, "verified");
  assert.equal((await db.get("catalogueReleases", "catalogue-v2")).checksum, "sha256:v2");
  assert.deepEqual(JSON.parse(JSON.stringify((await db.get("sessions", "session-historical-display")).canonicalDisplaySnapshot)), JSON.parse(JSON.stringify(historicalDisplay)));
  assert.equal((await db.getAll("exerciseConfigurations")).length, 1);
});

test("backup validation rejects future formats and duplicate audit idempotency keys", async () => {
  const { window } = await prepareV6();
  const backup = window.ProjectComebackBackup;
  const envelope = await backup.createBackup();
  const future = { ...envelope, backupFormatVersion: 999 };
  assert.throws(() => backup.validateBackup(future), /Unsupported backup format/);
  const duplicate = JSON.parse(JSON.stringify(envelope));
  duplicate.data.identityReviewEvents = [
    { id: "a", eventSchemaVersion: 1, profileId: "p", idempotencyKey: "same", actor: "user", sourceNamespace: "legacy", sourceExactValue: "A", evidence: { type: "test" }, outcome: "ambiguous" },
    { id: "b", eventSchemaVersion: 1, profileId: "p", idempotencyKey: "same", actor: "user", sourceNamespace: "legacy", sourceExactValue: "B", evidence: { type: "test" }, outcome: "ambiguous" }
  ];
  assert.throws(() => backup.validateBackup(duplicate), /Duplicate profile-scoped/);
  const duplicateReleaseVersion = JSON.parse(JSON.stringify(envelope));
  duplicateReleaseVersion.data.catalogueReleases = [
    { id: "release-a", catalogueId: "exercise-catalogue", version: 1, checksum: "sha256:a" },
    { id: "release-b", catalogueId: "exercise-catalogue", version: 1, checksum: "sha256:b" }
  ];
  assert.throws(() => backup.validateBackup(duplicateReleaseVersion), /Duplicate catalogue release version/);
});
