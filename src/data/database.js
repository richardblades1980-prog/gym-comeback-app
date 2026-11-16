/* Project Comeback V21.2A — IndexedDB foundation.
 * This module is intentionally not wired into the V21.1 UI yet.
 * It provides the storage foundation for controlled migration and testing.
 */
(function (global) {
  "use strict";

  const DB_NAME = "ProjectComebackDB";
  const DB_VERSION = 3;
  const STORES = {
    profile: { keyPath: "id", indexes: [] },
    objectives: { keyPath: "id", indexes: [{ name: "by_type", keyPath: "type" }] },
    equipment: { keyPath: "id", indexes: [{ name: "by_module", keyPath: "moduleId" }] },
    readiness: { keyPath: "id", indexes: [{ name: "by_date", keyPath: "date" }] },
    weighIns: { keyPath: "id", indexes: [{ name: "by_date", keyPath: "date" }] },
    modules: { keyPath: "id", indexes: [{ name: "by_enabled", keyPath: "enabled" }] },
    programmes: { keyPath: "id", indexes: [{ name: "by_module", keyPath: "moduleId" }, { name: "by_status", keyPath: "status" }] },
    sessions: { keyPath: "id", indexes: [{ name: "by_module_date", keyPath: ["moduleId", "date"] }, { name: "by_programme", keyPath: "programmeId" }, { name: "by_status", keyPath: "status" }] },
    exerciseRecords: { keyPath: "id", indexes: [{ name: "by_session", keyPath: "sessionId" }, { name: "by_module", keyPath: "moduleId" }] },
    setRecords: { keyPath: "id", indexes: [{ name: "by_exercise", keyPath: "exerciseRecordId" }, { name: "by_session", keyPath: "sessionId" }, { name: "by_module", keyPath: "moduleId" }] },
    hikingRecords: { keyPath: "id", indexes: [{ name: "by_date", keyPath: "date" }, { name: "by_programme", keyPath: "programmeId" }, { name: "by_module", keyPath: "moduleId" }] },
    schedules: { keyPath: "id", indexes: [{ name: "by_date", keyPath: "date" }, { name: "by_module_date", keyPath: ["moduleId", "date"] }] },
    progression: { keyPath: "id", indexes: [{ name: "by_module", keyPath: "moduleId" }] },
    preferences: { keyPath: "id", indexes: [] },
    metadata: { keyPath: "id", indexes: [{ name: "by_type", keyPath: "type" }] },
    legacyRecords: { keyPath: "id", indexes: [{ name: "by_key", keyPath: "key" }] }
  };

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    });
  }

  function open() {
    if (!global.indexedDB) return Promise.reject(new Error("IndexedDB is not available in this browser."));
    return new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        Object.entries(STORES).forEach(([name, config]) => {
          const store = db.objectStoreNames.contains(name)
            ? request.transaction.objectStore(name)
            : db.createObjectStore(name, { keyPath: config.keyPath });
          config.indexes.forEach(index => {
            if (!store.indexNames.contains(index.name)) {
              store.createIndex(index.name, index.keyPath, { unique: false });
            }
          });
        });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error("Could not open Project Comeback database."));
      request.onblocked = () => reject(new Error("Database upgrade is blocked by another open Project Comeback tab."));
    });
  }

  function validateStore(name) {
    if (!Object.prototype.hasOwnProperty.call(STORES, name)) {
      throw new Error("Unknown Project Comeback store: " + name);
    }
  }

  async function withStore(name, mode, work) {
    validateStore(name);
    const db = await open();
    try {
      const tx = db.transaction(name, mode);
      const done = transactionDone(tx);
      const store = tx.objectStore(name);
      const result = await work(store, tx);
      await done;
      return result;
    } finally {
      db.close();
    }
  }

  async function get(name, id) {
    return withStore(name, "readonly", store => requestResult(store.get(id)));
  }

  async function getAll(name, query) {
    return withStore(name, "readonly", store => requestResult(store.getAll(query)));
  }

  async function getAllByIndex(name, indexName, query) {
    validateStore(name);
    const db = await open();
    try {
      const tx = db.transaction(name, "readonly");
      const done = transactionDone(tx);
      const store = tx.objectStore(name);
      if (!store.indexNames.contains(indexName)) {
        tx.abort();
        throw new Error("Unknown index " + indexName + " on store " + name);
      }
      const result = await requestResult(store.index(indexName).getAll(query));
      await done;
      return result;
    } finally {
      db.close();
    }
  }

  async function put(name, record) {
    if (!record || record.id === undefined || record.id === null || record.id === "") {
      throw new Error("Records must have a stable, non-empty id.");
    }
    const now = new Date().toISOString();
    const saved = Object.assign({}, record, {
      createdAt: record.createdAt || now,
      updatedAt: now
    });
    return withStore(name, "readwrite", store => requestResult(store.put(saved)));
  }

  async function remove(name, id) {
    return withStore(name, "readwrite", store => requestResult(store.delete(id)));
  }

  async function count(name) {
    return withStore(name, "readonly", store => requestResult(store.count()));
  }

  async function getMeta(id) {
    return get("metadata", id);
  }

  async function setMeta(id, value, type) {
    return put("metadata", { id, value, type: type || "system" });
  }

  async function importLegacySnapshot(snapshot, snapshotId) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new Error("A legacy storage snapshot object is required.");
    }
    const id = snapshotId || "legacy-localStorage-v21.2a";
    const entries = Object.entries(snapshot);
    if (entries.some(([key, value]) => !key || typeof value !== "string")) {
      throw new Error("Legacy snapshot entries must contain a key and its original string value.");
    }
    const db = await open();
    try {
      const names = ["legacyRecords", "metadata"];
      const tx = db.transaction(names, "readwrite");
      const done = transactionDone(tx);
      const legacyStore = tx.objectStore("legacyRecords");
      const metaStore = tx.objectStore("metadata");
      const existing = await requestResult(metaStore.get(id));
      if (existing && existing.value && existing.value.status === "complete") {
        await done;
        return { status: "already-imported", recordCount: existing.value.recordCount };
      }
      const backupId = id + "-safety-snapshot";
      const backup = {
        id: backupId,
        type: "legacy-safety-snapshot",
        createdAt: new Date().toISOString(),
        recordCount: entries.length,
        entries: snapshot
      };
      await requestResult(metaStore.put(backup));
      for (const [key, rawValue] of entries) {
        await requestResult(legacyStore.put({
          id: key,
          key,
          rawValue,
          source: "localStorage",
          importedAt: new Date().toISOString()
        }));
      }
      await requestResult(metaStore.put({
        id,
        type: "migration",
        value: {
          status: "pending-verification",
          recordCount: entries.length,
          importedAt: new Date().toISOString(),
          snapshotId: backupId
        }
      }));
      await done;
      return { status: "pending-verification", recordCount: entries.length, snapshotId: backupId };
    } catch (error) {
      throw error;
    } finally {
      db.close();
    }
  }

  async function clearDatabase() {
    const db = await open();
    try {
      const names = Array.from(db.objectStoreNames);
      const tx = db.transaction(names, "readwrite");
      const done = transactionDone(tx);
      names.forEach(name => tx.objectStore(name).clear());
      await done;
    } finally {
      db.close();
    }
  }

  global.ProjectComebackDB = Object.freeze({
    name: DB_NAME,
    version: DB_VERSION,
    stores: Object.freeze(Object.keys(STORES)),
    open,
    get,
    getAll,
    getAllByIndex,
    put,
    remove,
    count,
    getMeta,
    setMeta,
    importLegacySnapshot
  });
})(window);
