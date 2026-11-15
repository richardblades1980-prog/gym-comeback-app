/* Project Comeback V21.2A — non-destructive legacy migration inspection.
 * This phase inventories and snapshots legacy localStorage only.
 * It deliberately does not import records or mark migration complete.
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

  async function inspect() {
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before migration.js.");
    const marker = await db.getMeta(MARKER_ID);
    const keys = listLegacyKeys(global.localStorage);
    const categories = {
      workoutDays: keys.filter(key => /^gym-comeback-w\\d+-d\\d+$/.test(key)),
      exerciseConfigs: keys.filter(key => key.startsWith("gym-comeback-ex-config-v1-")),
      setStatuses: keys.filter(key => key.startsWith("gym-comeback-set-status-v1-")),
      dayUnlocks: keys.filter(key => key.startsWith("gym-comeback-day-unlock-v1-")),
      other: []
    };
    const known = new Set([
      "gym-comeback-profile", "gym-comeback-gear", "gym-comeback-custom-gear",
      "gym-comeback-readiness", "gym-comeback-weigh-ins", "gym-comeback-rest-state",
      "gym-comeback-rest-alert", "gym-comeback-default-rest", "gym-comeback-max-weeks",
      "gym-comeback-preferred-day", "gym-comeback-landing-page",
      "gym-comeback-hide-quick-start", "gym-comeback-show-bodyweight-load"
    ]);
    const classified = new Set([
      ...categories.workoutDays, ...categories.exerciseConfigs,
      ...categories.setStatuses, ...categories.dayUnlocks
    ]);
    categories.other = keys.filter(key => known.has(key) || !classified.has(key));
    return {
      status: marker && marker.value === "verified" ? "verified" : "inspection-only",
      legacyKeyCount: keys.length,
      categories,
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

  global.ProjectComebackMigration = Object.freeze({
    inspect,
    createSafetySnapshot,
    downloadSafetySnapshot,
    parseLegacyJson,
    legacyPrefix: LEGACY_PREFIX,
    snapshotFormatVersion: SNAPSHOT_FORMAT
  });
})(window);
