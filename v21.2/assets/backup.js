/* Project Comeback V21.2A — versioned full backup and transactional restore.
 * This service is intentionally separate from the live V21.1 interface.
 */
(function (global) {
  "use strict";

  const APP_ID = "Project Comeback";
  const APP_VERSION = "V21.2A";
  const FORMAT_VERSION = 1;
  const STORE_NAMES = ["profile","objectives","equipment","readiness","weighIns","modules","programmes","sessions","exerciseRecords","setRecords","hikingRecords","schedules","progression","preferences","metadata","legacyRecords"];

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validateEnvelope(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Backup must be a JSON object.");
    }
    if (data.app !== APP_ID) throw new Error("This file is not a Project Comeback backup.");
    if (data.backupFormatVersion !== FORMAT_VERSION) {
      throw new Error("Unsupported backup format version: " + data.backupFormatVersion);
    }
    if (!data.data || typeof data.data !== "object" || Array.isArray(data.data)) {
      throw new Error("Backup data section is missing or invalid.");
    }
    const missing = STORE_NAMES.filter(name => !Array.isArray(data.data[name]));
    if (missing.length) throw new Error("Backup is incomplete. Missing stores: " + missing.join(", "));
    const unknown = Object.keys(data.data).filter(name => !STORE_NAMES.includes(name));
    if (unknown.length) throw new Error("Backup contains unknown stores: " + unknown.join(", "));
    const counts = {};
    for (const name of STORE_NAMES) {
      const records = data.data[name];
      const ids = new Set();
      for (const record of records) {
        if (!record || typeof record !== "object" || Array.isArray(record) ||
            record.id === undefined || record.id === null || record.id === "") {
          throw new Error("Invalid record found in store: " + name);
        }
        if (ids.has(String(record.id))) throw new Error("Duplicate record ID in " + name + ": " + record.id);
        ids.add(String(record.id));
      }
      counts[name] = records.length;
    }
    return { valid: true, counts, totalRecords: Object.values(counts).reduce((a, b) => a + b, 0) };
  }

  async function createBackup() {
    const dbApi = global.ProjectComebackDB;
    if (!dbApi) throw new Error("Load database.js before backup.js.");
    const db = await dbApi.open();
    try {
      const tx = db.transaction(STORE_NAMES, "readonly");
      const done = new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || new Error("Backup read transaction aborted."));
        tx.onerror = () => reject(tx.error || new Error("Backup read transaction failed."));
      });
      const data = {};
      const requests = STORE_NAMES.map(name => new Promise((resolve, reject) => {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => { data[name] = request.result; resolve(); };
        request.onerror = () => reject(request.error || new Error("Could not read store: " + name));
      }));
      await Promise.all(requests);
      await done;
      const envelope = {
        app: APP_ID,
        appVersion: APP_VERSION,
        backupFormatVersion: FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        includedModules: ["gym", "hiking"],
        backupScope: "full",
        recordCounts: Object.fromEntries(STORE_NAMES.map(name => [name, data[name].length])),
        data
      };
      validateEnvelope(envelope);
      return envelope;
    } finally {
      db.close();
    }
  }

  async function createBackupJson() {
    return JSON.stringify(await createBackup(), null, 2);
  }

  async function downloadBackup() {
    const json = await createBackupJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = global.URL.createObjectURL(blob);
    try {
      const link = global.document.createElement("a");
      link.href = url;
      link.download = "ProjectComeback-Full-Backup-" + new Date().toISOString().slice(0, 10) + ".json";
      link.click();
    } finally {
      global.setTimeout(() => global.URL.revokeObjectURL(url), 1000);
    }
    return { exported: true, bytes: json.length };
  }

  async function parseBackup(input) {
    let data = input;
    if (typeof input === "string") {
      try { data = JSON.parse(input); }
      catch (error) { throw new Error("Backup file is not valid JSON."); }
    }
    const validation = validateEnvelope(data);
    return { data: cloneJson(data), validation };
  }

  function stableJson(value) {
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map(key =>
        JSON.stringify(key) + ":" + stableJson(value[key])
      ).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  async function previewRestore(input) {
    const parsed = await parseBackup(input);
    const dbApi = global.ProjectComebackDB;
    if (!dbApi) throw new Error("Load database.js before backup.js.");
    const currentRecords = {};
    await Promise.all(STORE_NAMES.map(async name => {
      currentRecords[name] = await dbApi.getAll(name);
    }));

    const stores = {};
    for (const name of STORE_NAMES) {
      const current = currentRecords[name];
      const incoming = parsed.data.data[name];
      const currentById = new Map(current.map(record => [String(record.id), record]));
      const incomingIds = new Set(incoming.map(record => String(record.id)));
      let unchanged = 0;
      let changed = 0;
      let added = 0;
      for (const record of incoming) {
        const existing = currentById.get(String(record.id));
        if (!existing) added += 1;
        else if (stableJson(existing) === stableJson(record)) unchanged += 1;
        else changed += 1;
      }
      const removed = current.filter(record => !incomingIds.has(String(record.id))).length;
      stores[name] = {
        current: current.length,
        incoming: incoming.length,
        added,
        changed,
        unchanged,
        removed
      };
    }

    return {
      valid: true,
      appVersion: parsed.data.appVersion || null,
      exportedAt: parsed.data.exportedAt || null,
      includedModules: Array.isArray(parsed.data.includedModules) ? parsed.data.includedModules.slice() : [],
      backupScope: parsed.data.backupScope || "full",
      totalIncomingRecords: parsed.validation.totalRecords,
      stores,
      warning: "Restoring replaces all current records in the listed stores. Review this preview and create a separate backup before confirming."
    };
  }

  async function restoreBackup(input, options) {
    const opts = options || {};
    if (opts.confirmed !== true) {
      throw new Error("Restore requires explicit user confirmation.");
    }
    const parsed = await parseBackup(input);
    const envelope = parsed.data;
    const dbApi = global.ProjectComebackDB;
    if (!dbApi) throw new Error("Load database.js before backup.js.");
    const db = await dbApi.open();
    try {
      const readTx = db.transaction(STORE_NAMES, "readonly");
      const readDone = new Promise((resolve, reject) => {
        readTx.oncomplete = resolve;
        readTx.onabort = () => reject(readTx.error || new Error("Pre-restore snapshot read failed."));
        readTx.onerror = () => reject(readTx.error || new Error("Pre-restore snapshot read failed."));
      });
      const current = {};
      await Promise.all(STORE_NAMES.map(name => new Promise((resolve, reject) => {
        const request = readTx.objectStore(name).getAll();
        request.onsuccess = () => { current[name] = request.result; resolve(); };
        request.onerror = () => reject(request.error || new Error("Could not snapshot store: " + name));
      })));
      await readDone;

      const restoreId = "pre-restore-" + new Date().toISOString().replace(/[^0-9]/g, "");
      const safetyRecord = {
        id: restoreId,
        type: "pre-restore-safety-snapshot",
        createdAt: new Date().toISOString(),
        sourceBackupExportedAt: envelope.exportedAt,
        recordCounts: Object.fromEntries(STORE_NAMES.map(name => [name, current[name].length])),
        data: current
      };

      const tx = db.transaction(STORE_NAMES, "readwrite");
      const done = new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || new Error("Restore transaction aborted; existing data remains unchanged."));
        tx.onerror = () => reject(tx.error || new Error("Restore transaction failed; existing data remains unchanged."));
      });
      for (const name of STORE_NAMES) tx.objectStore(name).clear();
      for (const name of STORE_NAMES) {
        const store = tx.objectStore(name);
        for (const record of envelope.data[name]) store.put(record);
      }
      tx.objectStore("metadata").put(safetyRecord);
      await done;
      return {
        restored: true,
        restoreId,
        counts: parsed.validation.counts,
        totalRecords: parsed.validation.totalRecords,
        safetySnapshotStored: true
      };
    } finally {
      db.close();
    }
  }

  global.ProjectComebackBackup = Object.freeze({
    appVersion: APP_VERSION,
    formatVersion: FORMAT_VERSION,
    stores: Object.freeze(STORE_NAMES.slice()),
    createBackup,
    createBackupJson,
    downloadBackup,
    parseBackup,
    previewRestore,
    validateBackup: validateEnvelope,
    restoreBackup
  });
})(window);
