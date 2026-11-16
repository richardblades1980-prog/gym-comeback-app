/* Project Comeback V21.2A — safe, restartable legacy storage migration.
 * Every legacy localStorage value is preserved byte-for-byte as a string.
 * Original localStorage is never changed or deleted by this module.
 */
(function (global) {
  "use strict";

  const LEGACY_PREFIX = "gym-comeback-";
  const MARKER_ID = "migration-v21.2a";
  const SNAPSHOT_FORMAT = 2;

  function storageAvailable(storage) {
    if (!storage) throw new Error("Browser localStorage is unavailable.");
    return storage;
  }

  function listLegacyKeys(storage) {
    storage = storageAvailable(storage);
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(LEGACY_PREFIX)) keys.push(key);
    }
    return keys.sort();
  }

  function snapshotLegacyStorage(storage) {
    storage = storageAvailable(storage);
    const snapshot = {};
    listLegacyKeys(storage).forEach(key => {
      snapshot[key] = storage.getItem(key);
    });
    return snapshot;
  }

  function parseLegacyJson(value, key) {
    if (value === null || value === "") return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      const wrapped = new Error("Legacy data is not valid JSON: " + key);
      wrapped.cause = error;
      throw wrapped;
    }
  }

  function classifyKeys(keys) {
    const categories = {
      workoutDays: keys.filter(key => /^gym-comeback-w\d+-d\d+$/.test(key)),
      exerciseConfigs: keys.filter(key => key.startsWith("gym-comeback-ex-config-v1-")),
      setStatuses: keys.filter(key => key.startsWith("gym-comeback-set-status-v1-")),
      dayUnlocks: keys.filter(key => key.startsWith("gym-comeback-day-unlock-v1-")),
      other: []
    };
    const classified = new Set([
      ...categories.workoutDays, ...categories.exerciseConfigs,
      ...categories.setStatuses, ...categories.dayUnlocks
    ]);
    categories.other = keys.filter(key => !classified.has(key));
    return categories;
  }

  async function inspect() {
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before migration.js.");
    const marker = await db.getMeta(MARKER_ID);
    const keys = listLegacyKeys(global.localStorage);
    return {
      status: marker && marker.value && marker.value.status === "complete" ? "complete" : "ready-to-import",
      legacyKeyCount: keys.length,
      categories: classifyKeys(keys),
      legacyKeys: keys,
      marker: marker || null
    };
  }

  async function createSafetySnapshot() {
    const data = snapshotLegacyStorage(global.localStorage);
    const snapshot = {
      app: "Project Comeback",
      backupFormatVersion: SNAPSHOT_FORMAT,
      snapshotType: "legacy-localStorage-safety-copy",
      exportedAt: new Date().toISOString(),
      sourcePrefix: LEGACY_PREFIX,
      recordCount: Object.keys(data).length,
      data
    };
    return JSON.stringify(snapshot, null, 2);
  }

  async function downloadSafetySnapshot() {
    const json = await createSafetySnapshot();
    const blob = new Blob([json], { type: "application/json" });
    const url = global.URL.createObjectURL(blob);
    try {
      const link = global.document.createElement("a");
      link.href = url;
      link.download = "ProjectComeback-Legacy-Safety-" + new Date().toISOString().slice(0, 10) + ".json";
      link.click();
    } finally {
      global.setTimeout(() => global.URL.revokeObjectURL(url), 1000);
    }
    return json;
  }

  async function importLegacyData() {
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before migration.js.");
    const current = await inspect();
    if (current.status === "complete") {
      return { status: "already-imported", recordCount: current.marker.value.recordCount };
    }
    const snapshot = snapshotLegacyStorage(global.localStorage);
    if (Object.keys(snapshot).length !== current.legacyKeyCount) {
      throw new Error("Legacy storage changed during inspection. Please retry the migration.");
    }
    const result = await db.importLegacySnapshot(snapshot, MARKER_ID);
    const verify = await db.getAll("legacyRecords");
    const importedKeys = new Set(verify.map(record => record.key));
    const missing = Object.keys(snapshot).filter(key => !importedKeys.has(key));
    const mismatched = Object.entries(snapshot).filter(([key, value]) => {
      const record = verify.find(item => item.key === key);
      return !record || record.rawValue !== value;
    }).map(([key]) => key);
    if (missing.length || mismatched.length) {
      throw new Error("Migration verification failed. Missing keys: " + missing.join(", ") +
        ". Mismatched values: " + mismatched.join(", "));
    }
    const unchanged = Object.entries(snapshot).every(([key, value]) => global.localStorage.getItem(key) === value);
    if (!unchanged) {
      throw new Error("Legacy localStorage changed unexpectedly. Do not continue; retain the safety snapshot.");
    }
    await db.setMeta(MARKER_ID, {
      status: "complete",
      recordCount: Object.keys(snapshot).length,
      completedAt: new Date().toISOString(),
      snapshotId: result.snapshotId
    }, "migration");
    return Object.assign({}, result, {
      status: "complete",
      verified: true,
      originalStorageUnchanged: true,
      verifiedRecordCount: Object.keys(snapshot).length
    });
  }

  global.ProjectComebackMigration = Object.freeze({
    inspect,
    createSafetySnapshot,
    downloadSafetySnapshot,
    importLegacyData,
    parseLegacyJson,
    legacyPrefix: LEGACY_PREFIX,
    snapshotFormatVersion: SNAPSHOT_FORMAT
  });
})(window);
