/* Project Comeback V21.2A — safe migration coordinator.
 * The legacy converter is deliberately gated until its mapping tests pass.
 * This file never deletes localStorage data.
 */
(function (global) {
  "use strict";

  const LEGACY_PREFIX = "gym-comeback-";
  const MARKER_ID = "migration-v21.2a";

  function listLegacyKeys(storage) {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(LEGACY_PREFIX)) keys.push(key);
    }
    return keys.sort();
  }

  function snapshotLegacyStorage(storage) {
    const snapshot = {};
    listLegacyKeys(storage).forEach(key => {
      snapshot[key] = storage.getItem(key);
    });
    return snapshot;
  }

  async function inspect() {
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before migration.js.");
    const marker = await db.getMeta(MARKER_ID);
    const keys = listLegacyKeys(global.localStorage);
    return {
      status: marker && marker.value === "verified" ? "verified" : "not-migrated",
      legacyKeyCount: keys.length,
      legacyKeys: keys,
      marker: marker || null
    };
  }

  async function createSafetySnapshot() {
    const snapshot = {
      app: "Project Comeback",
      backupFormatVersion: 2,
      snapshotType: "legacy-localStorage-safety-copy",
      exportedAt: new Date().toISOString(),
      sourcePrefix: LEGACY_PREFIX,
      data: snapshotLegacyStorage(global.localStorage)
    };
    return JSON.stringify(snapshot, null, 2);
  }

  async function markVerified(details) {
    const db = global.ProjectComebackDB;
    await db.setMeta(MARKER_ID, "verified", "migration");
    await db.put("metadata", {
      id: "migration-v21.2a-details",
      type: "migration",
      value: details || {},
      completedAt: new Date().toISOString()
    });
  }

  global.ProjectComebackMigration = Object.freeze({
    inspect,
    createSafetySnapshot,
    markVerified,
    legacyPrefix: LEGACY_PREFIX
  });
})(window);
