/* Project Comeback V21.2A — V1-compatible full backup and append-only restore. */
(function (global) {
  "use strict";

  const APP_ID = "Project Comeback";
  const APP_VERSION = "V21.2A";
  const LEGACY_STORE_NAMES = Object.freeze([
    "profile","objectives","equipment","readiness","weighIns","assessments","modules",
    "programmes","sessions","exerciseRecords","setRecords","hikingRecords","schedules",
    "progression","preferences","metadata","legacyRecords"
  ]);
  const IDENTITY_STORE_NAMES = Object.freeze([
    "exerciseDefinitions","exerciseVariations","exerciseAliases","identityReviewEvents",
    "catalogueReleases","exerciseConfigurations","programmeVersions","programmeDays","programmeSlots"
  ]);
  const STORE_NAMES = Object.freeze([...LEGACY_STORE_NAMES, ...IDENTITY_STORE_NAMES]);
  const HISTORY_MERGE_STORES = new Set(["identityReviewEvents", "catalogueReleases", "exerciseDefinitions", "exerciseVariations", "programmeVersions", "programmeDays", "programmeSlots"]);
  const RESTORE_SNAPSHOT_TYPE = "pre-restore-safety-snapshot";
  const RESTORE_SNAPSHOT_RETENTION = 3;

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function stableJson(value) {
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  function eventComparable(value) {
    const copy = Object.assign({}, value);
    delete copy.id;
    delete copy.createdAt;
    delete copy.updatedAt;
    delete copy.reviewedAt;
    return stableJson(copy);
  }

  function validateEnvelope(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Backup must be a JSON object.");
    if (data.app !== APP_ID) throw new Error("This file is not a Project Comeback backup.");
    const version = data.backupFormatVersion;
    if (version !== 1 && version !== 2) throw new Error("Unsupported backup format version: " + version);
    if (!data.data || typeof data.data !== "object" || Array.isArray(data.data)) throw new Error("Backup data section is missing or invalid.");
    const expectedStores = version === 1 ? LEGACY_STORE_NAMES : STORE_NAMES;
    const missing = expectedStores.filter(name => !Array.isArray(data.data[name]));
    if (missing.length) throw new Error("Backup is incomplete. Missing stores: " + missing.join(", "));
    const unknown = Object.keys(data.data).filter(name => !expectedStores.includes(name));
    if (unknown.length) throw new Error("Backup contains unknown stores: " + unknown.join(", "));
    const counts = {};
    for (const name of expectedStores) {
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
    if (version === 2) {
      const idempotency = new Set();
      for (const event of data.data.identityReviewEvents) {
        if (typeof event.profileId !== "string" || !event.profileId ||
            typeof event.idempotencyKey !== "string" || !event.idempotencyKey) {
          throw new Error("Identity review events require profile-scoped idempotency keys.");
        }
        if (event.eventSchemaVersion !== 1 || typeof event.actor !== "string" || !event.actor ||
            typeof event.sourceNamespace !== "string" || typeof event.sourceExactValue !== "string" ||
            !event.evidence || typeof event.evidence !== "object" || Array.isArray(event.evidence) ||
            !Object.keys(event.evidence).length) {
          throw new Error("Identity review event is missing its supported schema, actor, exact source or evidence.");
        }
        if (!["verified", "ambiguous", "rejected", "unresolved", "reversed"].includes(event.outcome)) {
          throw new Error("Identity review event contains an unsupported outcome.");
        }
        if (event.outcome === "verified" && (!event.proposedMapping || typeof event.proposedMapping !== "object" || Array.isArray(event.proposedMapping))) {
          throw new Error("Verified identity events require a proposed mapping.");
        }
        if (event.outcome === "reversed" && !event.reversesEventId && !event.supersedesEventId) {
          throw new Error("Reversal events must identify the event they correct.");
        }
        const key = JSON.stringify([event.profileId, event.idempotencyKey]);
        if (idempotency.has(key)) throw new Error("Duplicate profile-scoped identity review idempotency key.");
        idempotency.add(key);
      }
      const releaseVersions = new Set();
      for (const release of data.data.catalogueReleases) {
        if (!Number.isInteger(release.version) || release.version < 1 ||
            typeof release.catalogueId !== "string" || !release.catalogueId ||
            typeof release.checksum !== "string" || !release.checksum) {
          throw new Error("Catalogue release manifests require a positive version and checksum.");
        }
        const key = JSON.stringify([release.catalogueId || "exercise-catalogue", release.version]);
        if (releaseVersions.has(key)) throw new Error("Duplicate catalogue release version within a catalogue.");
        releaseVersions.add(key);
      }
      const releaseIds = new Set(data.data.catalogueReleases.map(release => String(release.id)));
      for (const event of data.data.identityReviewEvents) {
        if (event.catalogueReleaseId && !releaseIds.has(String(event.catalogueReleaseId))) {
          throw new Error("Identity review event references a catalogue release absent from the backup.");
        }
      }
      for (const versionRecord of data.data.programmeVersions) {
        if (versionRecord.status === "published" &&
            (!versionRecord.catalogueReleaseId || !releaseIds.has(String(versionRecord.catalogueReleaseId)))) {
          throw new Error("Published programme versions must pin a retained catalogue release.");
        }
      }
      for (const session of data.data.sessions) {
        if (session.status !== "cancelled" && session.status !== "deleted" && session.catalogueReleaseId &&
            !releaseIds.has(String(session.catalogueReleaseId))) {
          throw new Error("Session history references a catalogue release absent from the backup.");
        }
      }
      for (const slot of data.data.programmeSlots) {
        if (slot.catalogueReleaseId && !releaseIds.has(String(slot.catalogueReleaseId))) {
          throw new Error("Programme slots reference a catalogue release absent from the backup.");
        }
      }
      for (const day of data.data.programmeDays) {
        if (!day.programmeVersionId || !day.dayLineageId) throw new Error("Programme day snapshots require parent version and stable lineage IDs.");
      }
      for (const slot of data.data.programmeSlots) {
        if (!slot.programmeVersionId || !slot.programmeDayId || !slot.slotLineageId) {
          throw new Error("Programme slot snapshots require parent version, day and stable lineage IDs.");
        }
      }
      const scopes = new Set();
      for (const record of data.data.exerciseConfigurations) {
        if (typeof record.scopeKey !== "string" || !record.scopeKey ||
            typeof record.profileId !== "string" || !record.profileId ||
            typeof record.exerciseDefinitionId !== "string" || !record.exerciseDefinitionId ||
            record.configurationSchemaVersion !== 1 ||
            !record.provenance || typeof record.provenance !== "object" || Array.isArray(record.provenance) ||
            !record.settings || typeof record.settings !== "object" || Array.isArray(record.settings)) {
          throw new Error("Reusable exercise configurations require a versioned, scoped record with provenance.");
        }
        const allowed = ["preferredProgressionFocus", "recordingModeOverride"];
        if (!Object.keys(record.settings).length || Object.keys(record.settings).some(key => !allowed.includes(key))) {
          throw new Error("Reusable exercise configuration contains a prescription or unsupported field.");
        }
        if (record.settings.preferredProgressionFocus !== undefined &&
            !["reps", "weight", "duration", "sets", "balanced", "manual"].includes(record.settings.preferredProgressionFocus)) {
          throw new Error("Reusable exercise configuration has an unsupported progression focus.");
        }
        if (record.settings.recordingModeOverride !== undefined &&
            !["reps", "timed-hold", "timed-reps"].includes(record.settings.recordingModeOverride)) {
          throw new Error("Reusable exercise configuration has an unsupported recording mode.");
        }
        if (scopes.has(record.scopeKey)) throw new Error("Duplicate reusable exercise configuration scope.");
        scopes.add(record.scopeKey);
      }
    }
    return {
      valid: true,
      formatVersion: version,
      counts,
      totalRecords: Object.values(counts).reduce((a, b) => a + b, 0)
    };
  }

  async function readStores(db, names) {
    const tx = db.transaction(names, "readonly");
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error("Backup read transaction aborted."));
      tx.onerror = () => reject(tx.error || new Error("Backup read transaction failed."));
    });
    const data = {};
    await Promise.all(names.map(name => new Promise((resolve, reject) => {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => { data[name] = request.result; resolve(); };
      request.onerror = () => reject(request.error || new Error("Could not read store: " + name));
    })));
    await done;
    return data;
  }

  async function createBackup() {
    const dbApi = global.ProjectComebackDB;
    if (!dbApi) throw new Error("Load database.js before backup.js.");
    const db = await dbApi.open();
    try {
      const upgraded = db.version >= 6;
      const names = upgraded ? STORE_NAMES : LEGACY_STORE_NAMES;
      const data = await readStores(db, names);
      const envelope = {
        app: APP_ID,
        appVersion: APP_VERSION,
        backupFormatVersion: upgraded ? 2 : 1,
        exportedAt: new Date().toISOString(),
        includedModules: ["gym", "hiking"],
        backupScope: "full",
        recordCounts: Object.fromEntries(names.map(name => [name, data[name].length])),
        data
      };
      validateEnvelope(envelope);
      return envelope;
    } finally {
      db.close();
    }
  }

  async function createLegacySafetyBackup() {
    const dbApi = global.ProjectComebackDB;
    if (!dbApi) throw new Error("Load database.js before backup.js.");
    const db = await dbApi.open();
    try {
      if (db.version !== 5) throw new Error("A pre-identity V1 safety backup is only required from schema v5.");
      const data = await readStores(db, LEGACY_STORE_NAMES);
      const envelope = {
        app: APP_ID,
        appVersion: APP_VERSION,
        backupFormatVersion: 1,
        exportedAt: new Date().toISOString(),
        includedModules: ["gym", "hiking"],
        backupScope: "full",
        recordCounts: Object.fromEntries(LEGACY_STORE_NAMES.map(name => [name, data[name].length])),
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

  async function downloadEnvelope(envelope, filename) {
    validateEnvelope(envelope);
    const json = JSON.stringify(envelope, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = global.URL.createObjectURL(blob);
    try {
      const link = global.document.createElement("a");
      link.href = url;
      link.download = filename || ("ProjectComeback-Full-Backup-" + new Date().toISOString().slice(0, 10) + ".json");
      link.click();
    } finally {
      global.setTimeout(() => global.URL.revokeObjectURL(url), 1000);
    }
    return { exported: true, bytes: json.length };
  }

  async function downloadBackup() {
    const envelope = await createBackup();
    return downloadEnvelope(envelope);
  }

  async function parseBackup(input) {
    let original = input;
    if (typeof input === "string") {
      try { original = JSON.parse(input); }
      catch (error) { throw new Error("Backup file is not valid JSON."); }
    }
    const validation = validateEnvelope(original);
    const sourceFormatVersion = validation.formatVersion;
    const data = cloneJson(original);
    if (sourceFormatVersion === 1) {
      IDENTITY_STORE_NAMES.forEach(name => { data.data[name] = []; });
    }
    return { data, sourceFormatVersion, validation };
  }

  function stableRecordJson(value) {
    return stableJson(value);
  }

  async function validateBackupIntegrity(input) {
    const parsed = await parseBackup(input);
    if (!global.ProjectComebackIntegrity) throw new Error("Load integrity.js before cross-store diagnostics.");
    return global.ProjectComebackIntegrity.diagnoseData(parsed.data.data);
  }

  async function previewRestore(input) {
    const integrityDiagnostics = global.ProjectComebackIntegrity ? {
      incoming: await validateBackupIntegrity(input),
      live: await global.ProjectComebackIntegrity.diagnoseLiveDatabase()
    } : null;
    const parsed = await parseBackup(input);
    const dbApi = global.ProjectComebackDB;
    if (!dbApi) throw new Error("Load database.js before backup.js.");
    const currentVersion = typeof dbApi.getVersion === "function" ? await dbApi.getVersion() : 5;
    if (parsed.sourceFormatVersion === 2 && currentVersion < 6) throw new Error("This V2 backup requires the V6 identity foundation. Upgrade the database before restoring it.");
    const names = parsed.sourceFormatVersion === 1 ? LEGACY_STORE_NAMES : STORE_NAMES;
    const currentRecords = {};
    await Promise.all(names.map(async name => { currentRecords[name] = await dbApi.getAll(name); }));
    const stores = {};
    for (const name of names) {
      const current = currentRecords[name], incoming = parsed.data.data[name];
      const merge = HISTORY_MERGE_STORES.has(name);
      const preserveTypedEquipment = parsed.sourceFormatVersion === 1 && currentVersion >= 6 && name === "equipment";
      const isTypedEquipment = record => preserveTypedEquipment && typeof dbApi.isUserEquipmentAccessRecord === "function" &&
        dbApi.isUserEquipmentAccessRecord(record);
      const preservedEquipment = preserveTypedEquipment ? current.filter(isTypedEquipment) : [];
      const replaceCurrent = preserveTypedEquipment ? current.filter(record => !isTypedEquipment(record)) : current;
      const currentById = new Map(replaceCurrent.map(record => [String(record.id), record]));
      const incomingIds = new Set(incoming.map(record => String(record.id)));
      const preservedIds = new Set(preservedEquipment.map(record => String(record.id)));
      let unchanged = 0, changed = 0, added = 0, conflicts = 0, idempotencySkipped = 0;
      for (const record of incoming) {
        const existing = currentById.get(String(record.id));
        if (preservedIds.has(String(record.id))) { conflicts++; continue; }
        if (!existing) {
          if (merge && name === "identityReviewEvents") {
            const byKey = current.find(item => item.profileId === record.profileId && item.idempotencyKey === record.idempotencyKey);
            if (byKey) { if (eventComparable(byKey) === eventComparable(record)) idempotencySkipped++; else conflicts++; continue; }
          }
          added++;
        } else if (stableRecordJson(existing) === stableRecordJson(record)) unchanged++;
        else if (merge) { changed++; conflicts++; }
        else changed++;
      }
      const removed = merge ? 0 : replaceCurrent.filter(record => !incomingIds.has(String(record.id))).length;
      const behavior = preserveTypedEquipment ? "replace-preserve-typed" : (merge ? "merge-preserve" : "replace");
      stores[name] = {
        behavior,
        action: preserveTypedEquipment
          ? "Replace legacy equipment records; preserve validated typed user inventory"
          : (merge ? "Merge incoming records; preserve existing history" : "Replace existing records with incoming records"),
        description: preserveTypedEquipment
          ? "Legacy equipment records are replaced from the V1 backup. Validated typed C2 inventory records already on this V6 device are retained; ID collisions stop the restore."
          : (merge
            ? "Existing records remain. Identical records are skipped; new records are appended; immutable conflicts stop the restore."
            : name === "metadata"
              ? "Existing metadata is replaced. Restore also writes one pre-restore safety snapshot."
              : "Existing records are cleared and incoming records are written."),
        current: current.length, incoming: incoming.length, added, changed, unchanged, removed,
        preserved: preservedEquipment.length, conflicts, idempotencySkipped,
        projected: conflicts ? null : (merge ? current.length + added : incoming.length + preservedEquipment.length + (name === "metadata" ? 1 : 0))
      };
    }
    if (stores.metadata && !stores.metadata.conflicts) {
      const currentMetadata = currentRecords.metadata || [];
      const incomingMetadata = parsed.data.data.metadata || [];
      const currentUpgrade = currentMetadata.find(record => record.id === "identity-upgrade-v6-safety-snapshot");
      const incomingUpgrade = incomingMetadata.find(record => record.id === "identity-upgrade-v6-safety-snapshot");
      const newestPreview = { id: "__restore-preview__", type: RESTORE_SNAPSHOT_TYPE, createdAt: new Date().toISOString() };
      const retainedCount = retainedRestoreSnapshots(currentMetadata, incomingMetadata, newestPreview).length;
      const incomingBaseCount = incomingMetadata.filter(record => !isRestoreSafetySnapshot(record)).length;
      const preserveUpgradeCount = currentUpgrade && !incomingUpgrade ? 1 : 0;
      stores.metadata.projected = incomingBaseCount + preserveUpgradeCount + retainedCount;
      stores.metadata.description = "Existing metadata is replaced, the pre-restore safety snapshot is written, the newest three restore snapshots are retained, and the pre-identity-upgrade safety snapshot is preserved when omitted.";
    }
    const preservedStores = parsed.sourceFormatVersion === 1 && currentVersion >= 6 ? await Promise.all(IDENTITY_STORE_NAMES.map(async name => ({
      name, behavior: "preserve-untouched", action: "Preserve current records; backup does not contain this store",
      current: (await dbApi.getAll(name)).length, incoming: 0, projected: null
    }))) : [];
    return {
      valid: true, sourceFormatVersion: parsed.sourceFormatVersion,
      appVersion: parsed.data.appVersion || null, exportedAt: parsed.data.exportedAt || null,
      includedModules: Array.isArray(parsed.data.includedModules) ? parsed.data.includedModules.slice() : [],
      backupScope: parsed.data.backupScope || "full", totalIncomingRecords: parsed.validation.totalRecords,
      restoreSafetySnapshotRetention: RESTORE_SNAPSHOT_RETENTION,
      integrityDiagnostics,
      stores, preservedStores: preservedStores.map(store => store.name), preservedStoreDetails: preservedStores,
      warning: parsed.sourceFormatVersion === 1
        ? "V1 restore replaces original V1 data. On V6, validated typed C2 equipment inventory is preserved while legacy equipment data is replaced; V6 identity stores are preserved untouched. Restore safety snapshots are bounded to the newest three."
        : "Replace stores are overwritten. Append/merge stores retain existing history, skip identical records, append new records, and stop on immutable conflicts. A pre-restore safety snapshot is saved in metadata."
    };
  }

  function isRestoreSafetySnapshot(record) {
    return !!record && record.type === RESTORE_SNAPSHOT_TYPE;
  }

  function retainedRestoreSnapshots(existing, incoming, newest) {
    const byId = new Map();
    for (const record of [...(existing || []), ...(incoming || []), newest].filter(isRestoreSafetySnapshot)) {
      byId.set(String(record.id), record);
    }
    return [...byId.values()].sort((a, b) => {
      const at = Date.parse(a.createdAt || "");
      const bt = Date.parse(b.createdAt || "");
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    }).slice(0, RESTORE_SNAPSHOT_RETENTION);
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Restore request failed."));
    });
  }

  async function restoreBackup(input, options) {
    const opts = options || {};
    if (opts.confirmed !== true) throw new Error("Restore requires explicit user confirmation.");
    const parsed = await parseBackup(input);
    const dbApi = global.ProjectComebackDB;
    if (!dbApi) throw new Error("Load database.js before backup.js.");
    const db = await dbApi.open();
    try {
      if (parsed.sourceFormatVersion === 2 && db.version < 6) {
        throw new Error("This V2 backup requires the V6 identity foundation. Upgrade the database before restoring it.");
      }
      if (db.version >= 6) {
        const upgradeSnapshot = await dbApi.get("metadata", "identity-upgrade-v6-safety-snapshot");
        if (upgradeSnapshot && upgradeSnapshot.verificationStatus !== "complete") {
          const incomingSnapshot = parsed.sourceFormatVersion === 2
            ? parsed.data.data.metadata.find(record => record.id === "identity-upgrade-v6-safety-snapshot")
            : null;
          if (!incomingSnapshot || incomingSnapshot.type !== "pre-identity-upgrade-safety-snapshot" ||
              incomingSnapshot.verificationStatus !== "pending" || !incomingSnapshot.data) {
            throw new Error("Complete the post-upgrade V2 backup/restore verification before restoring a backup that does not retain the pre-upgrade safety snapshot.");
          }
        }
      }
      const availableStores = db.version >= 6 ? STORE_NAMES : LEGACY_STORE_NAMES;
      const restoreStores = parsed.sourceFormatVersion === 1 ? LEGACY_STORE_NAMES : STORE_NAMES;
      const current = await readStores(db, availableStores);
      const restoreId = "pre-restore-" + new Date().toISOString().replace(/[^0-9]/g, "") + "-" + Math.random().toString(36).slice(2, 8);
      // A restore safety snapshot must not contain earlier restore snapshots.
      // This prevents recursive payload growth while preserving other metadata safeguards.
      const safetyData = Object.assign({}, current, {
        metadata: current.metadata.filter(record => !isRestoreSafetySnapshot(record))
      });
      const safetyRecord = {
        id: restoreId,
        type: RESTORE_SNAPSHOT_TYPE,
        createdAt: new Date().toISOString(),
        sourceBackupExportedAt: parsed.data.exportedAt || null,
        recordCounts: Object.fromEntries(availableStores.map(name => [name, safetyData[name].length])),
        data: safetyData
      };

      const tx = db.transaction(restoreStores, "readwrite");
      const done = new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || new Error("Restore transaction aborted; existing data remains unchanged."));
        tx.onerror = () => reject(tx.error || new Error("Restore transaction failed; existing data remains unchanged."));
      });
      let preservedEquipment = [];
      const failTransaction = async message => {
        try { tx.abort(); } catch (ignored) {}
        try { await done; } catch (ignored) {}
        throw new Error(message);
      };

      try {
        if (parsed.sourceFormatVersion === 1 && db.version >= 6 && typeof dbApi.isUserEquipmentAccessRecord === "function") {
          const liveEquipment = await requestResult(tx.objectStore("equipment").getAll());
          preservedEquipment = liveEquipment.filter(record => dbApi.isUserEquipmentAccessRecord(record));
          const incomingIds = new Set((parsed.data.data.equipment || []).map(record => String(record.id)));
          if (preservedEquipment.some(record => incomingIds.has(String(record.id)))) {
            await failTransaction("Restore stopped: a V1 equipment ID conflicts with retained typed user inventory.");
          }
        }
        for (const name of restoreStores) {
          if (!HISTORY_MERGE_STORES.has(name)) tx.objectStore(name).clear();
        }
        for (const name of restoreStores) {
          const store = tx.objectStore(name);
          for (const record of parsed.data.data[name]) {
            if (!HISTORY_MERGE_STORES.has(name)) {
              if (name === "metadata" && isRestoreSafetySnapshot(record)) continue;
              store.put(record);
              continue;
            }
            const existingById = await requestResult(store.get(record.id));
            if (existingById) {
              if (stableJson(existingById) !== stableJson(record)) {
                await failTransaction("Restore stopped: immutable " + name + " record " + record.id + " conflicts with existing history.");
              }
              continue;
            }
            if (name === "identityReviewEvents") {
              const existingByKey = await requestResult(store.index("by_profile_idempotency").get([record.profileId, record.idempotencyKey]));
              if (existingByKey) {
                if (eventComparable(existingByKey) !== eventComparable(record)) {
                  await failTransaction("Restore stopped: profile-scoped review idempotency key conflicts with existing audit history.");
                }
                continue;
              }
            }
            store.add(record);
          }
        }
        for (const record of preservedEquipment) {
          await requestResult(tx.objectStore("equipment").add(record));
        }
        const metadataStore = tx.objectStore("metadata");
        const incomingMetadata = parsed.data.data.metadata || [];
        // Preserve the current pre-identity-upgrade snapshot if present.
        const currentUpgradeSnapshot = current.metadata.find(record => record.id === "identity-upgrade-v6-safety-snapshot");
        if (currentUpgradeSnapshot) metadataStore.put(currentUpgradeSnapshot);

        // Preserve restore-snapshot history across restores, but cap it at the newest three.
        const retainedSnapshots = retainedRestoreSnapshots(current.metadata, incomingMetadata, safetyRecord);
        for (const snapshot of retainedSnapshots) metadataStore.put(snapshot);
        metadataStore.put(safetyRecord);
        await done;
      } catch (error) {
        try { tx.abort(); } catch (ignored) {}
        try { await done; } catch (ignored) {}
        throw new Error("Restore stopped; existing data remains unchanged. " + (error && error.message ? error.message : String(error)));
      }
      return {
        restored: true,
        restoreId,
        sourceFormatVersion: parsed.sourceFormatVersion,
        counts: parsed.validation.counts,
        totalRecords: parsed.validation.totalRecords,
        safetySnapshotStored: true,
        historyStoresMerged: parsed.sourceFormatVersion === 2 ? ["identityReviewEvents", "catalogueReleases", "exerciseDefinitions", "exerciseVariations", "programmeVersions", "programmeDays", "programmeSlots"] : [],
        preservedUserEquipmentCount: preservedEquipment.length
      };
    } finally {
      db.close();
    }
  }

  async function verifyIdentityUpgradeRoundTrip() {
    const dbApi = global.ProjectComebackDB;
    if (!dbApi) throw new Error("Load database.js before backup.js.");
    const snapshotId = "identity-upgrade-v6-safety-snapshot";
    const snapshot = await dbApi.get("metadata", snapshotId);
    if (!snapshot) return { status: "not-required" };
    if (snapshot.verificationStatus === "complete") return { status: "already-verified", snapshotId };
    const envelope = await createBackup();
    if (envelope.backupFormatVersion !== 2) throw new Error("Post-upgrade verification requires a V2 backup.");
    const parsed = await parseBackup(envelope);
    if (!parsed.validation.valid || parsed.sourceFormatVersion !== 2) throw new Error("Post-upgrade backup validation failed.");
    await restoreBackup(envelope, { confirmed: true });
    const current = await dbApi.get("metadata", snapshotId);
    if (!current || current.type !== "pre-identity-upgrade-safety-snapshot") {
      throw new Error("The pre-upgrade safety snapshot was not retained through the V2 restore round trip.");
    }
    await dbApi.put("metadata", Object.assign({}, current, {
      verificationStatus: "complete",
      verifiedAt: new Date().toISOString(),
      roundTripBackupExportedAt: envelope.exportedAt
    }));
    return { status: "verified", snapshotId, totalRecords: parsed.validation.totalRecords };
  }

  global.ProjectComebackBackup = Object.freeze({
    appVersion: APP_VERSION,
    formatVersion: 2,
    stores: STORE_NAMES,
    legacyStores: LEGACY_STORE_NAMES,
    createBackup,
    createLegacySafetyBackup,
    createBackupJson,
    downloadEnvelope,
    downloadBackup,
    parseBackup,
    previewRestore,
    validateBackup: validateEnvelope,
    validateBackupIntegrity,
    restoreBackup,
    verifyIdentityUpgradeRoundTrip
  });
})(window);
