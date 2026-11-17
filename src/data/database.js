/* Project Comeback V21.2A — IndexedDB foundation.
 * This module is intentionally not wired into the V21.1 UI yet.
 * It provides the storage foundation for controlled migration and testing.
 */
(function (global) {
  "use strict";

  const DB_NAME = "ProjectComebackDB";
  const DB_VERSION = 6;
  const BASE_DB_VERSION = 5;
  const IMMUTABLE_STORES = new Set(["identityReviewEvents", "catalogueReleases"]);
  let currentVersion = BASE_DB_VERSION;
  const STORES = {
    profile: { keyPath: "id", indexes: [] },
    objectives: { keyPath: "id", indexes: [{ name: "by_type", keyPath: "type" }] },
    equipment: { keyPath: "id", indexes: [{ name: "by_module", keyPath: "moduleId" }] },
    readiness: { keyPath: "id", indexes: [{ name: "by_date", keyPath: "date" }] },
    weighIns: { keyPath: "id", indexes: [{ name: "by_date", keyPath: "date" }] },
    assessments: { keyPath: "id", indexes: [{ name: "by_date", keyPath: "date" }, { name: "by_kind", keyPath: "kind" }] },
    modules: { keyPath: "id", indexes: [{ name: "by_enabled", keyPath: "enabled" }] },
    programmes: { keyPath: "id", indexes: [{ name: "by_module", keyPath: "moduleId" }, { name: "by_status", keyPath: "status" }] },
    sessions: { keyPath: "id", indexes: [{ name: "by_module", keyPath: "moduleId" }, { name: "by_module_date", keyPath: ["moduleId", "date"] }, { name: "by_programme", keyPath: "programmeId" }, { name: "by_status", keyPath: "status" }] },
    exerciseRecords: { keyPath: "id", indexes: [{ name: "by_session", keyPath: "sessionId" }, { name: "by_module", keyPath: "moduleId" }] },
    setRecords: { keyPath: "id", indexes: [{ name: "by_exercise", keyPath: "exerciseRecordId" }, { name: "by_session", keyPath: "sessionId" }, { name: "by_module", keyPath: "moduleId" }] },
    hikingRecords: { keyPath: "id", indexes: [{ name: "by_date", keyPath: "date" }, { name: "by_programme", keyPath: "programmeId" }, { name: "by_module", keyPath: "moduleId" }] },
    schedules: { keyPath: "id", indexes: [{ name: "by_date", keyPath: "date" }, { name: "by_module_date", keyPath: ["moduleId", "date"] }] },
    progression: { keyPath: "id", indexes: [{ name: "by_module", keyPath: "moduleId" }] },
    preferences: { keyPath: "id", indexes: [] },
    metadata: { keyPath: "id", indexes: [{ name: "by_type", keyPath: "type" }] },
    legacyRecords: { keyPath: "id", indexes: [{ name: "by_key", keyPath: "key" }] },
    exerciseDefinitions: { keyPath: "id", indexes: [{ name: "by_kind", keyPath: "kind" }, { name: "by_status", keyPath: "status" }] },
    exerciseVariations: { keyPath: "id", indexes: [{ name: "by_definition", keyPath: "exerciseDefinitionId" }, { name: "by_status", keyPath: "status" }] },
    exerciseAliases: { keyPath: "id", indexes: [{ name: "by_profile_source", keyPath: ["profileId", "sourceNamespace", "exactValue"], unique: true }, { name: "by_definition", keyPath: "exerciseDefinitionId" }] },
    identityReviewEvents: { keyPath: "id", indexes: [{ name: "by_profile", keyPath: "profileId" }, { name: "by_subject", keyPath: ["profileId", "subjectType", "subjectId"] }, { name: "by_profile_idempotency", keyPath: ["profileId", "idempotencyKey"], unique: true }, { name: "by_catalogue_release", keyPath: "catalogueReleaseId" }] },
    catalogueReleases: { keyPath: "id", indexes: [{ name: "by_version", keyPath: "version" }, { name: "by_catalogue_version", keyPath: ["catalogueId", "version"], unique: true }] },
    exerciseConfigurations: { keyPath: "id", indexes: [{ name: "by_profile", keyPath: "profileId" }, { name: "by_scope_key", keyPath: "scopeKey", unique: true }] },
    programmeVersions: { keyPath: "id", indexes: [{ name: "by_programme", keyPath: "programmeId" }, { name: "by_status", keyPath: "status" }, { name: "by_catalogue_release", keyPath: "catalogueReleaseId" }] },
    programmeDays: { keyPath: "id", indexes: [{ name: "by_version", keyPath: "programmeVersionId" }, { name: "by_lineage", keyPath: "dayLineageId" }] },
    programmeSlots: { keyPath: "id", indexes: [{ name: "by_version", keyPath: "programmeVersionId" }, { name: "by_day", keyPath: "programmeDayId" }, { name: "by_lineage", keyPath: "slotLineageId" }, { name: "by_definition", keyPath: "exerciseDefinitionId" }, { name: "by_catalogue_release", keyPath: "catalogueReleaseId" }] }
  };

  const BASE_STORE_NAMES = Object.freeze([
    "profile", "objectives", "equipment", "readiness", "weighIns", "assessments",
    "modules", "programmes", "sessions", "exerciseRecords", "setRecords",
    "hikingRecords", "schedules", "progression", "preferences", "metadata", "legacyRecords"
  ]);
  const IDENTITY_STORE_NAMES = Object.freeze([
    "exerciseDefinitions", "exerciseVariations", "exerciseAliases",
    "identityReviewEvents", "catalogueReleases", "exerciseConfigurations",
    "programmeVersions", "programmeDays", "programmeSlots"
  ]);

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

  function createStores(db, transaction, names) {
    names.forEach(name => {
      const config = STORES[name];
      const store = db.objectStoreNames.contains(name)
        ? transaction.objectStore(name)
        : db.createObjectStore(name, { keyPath: config.keyPath });
      config.indexes.forEach(index => {
        if (!store.indexNames.contains(index.name)) {
          store.createIndex(index.name, index.keyPath, { unique: index.unique === true });
        }
      });
    });
  }

  function openAtVersion(version, upgrade) {
    if (!global.indexedDB) return Promise.reject(new Error("IndexedDB is not available in this browser."));
    return new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, version);
      request.onupgradeneeded = event => {
        if (upgrade) upgrade(request.result, request.transaction, event.oldVersion);
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

  function openCurrentVersion() {
    if (!global.indexedDB) return Promise.reject(new Error("IndexedDB is not available in this browser."));
    return new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME);
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error("Could not inspect Project Comeback database version."));
      request.onblocked = () => reject(new Error("Database access is blocked by another open Project Comeback tab."));
    });
  }

  async function open() {
    let db = await openCurrentVersion();
    if (db.version < BASE_DB_VERSION) {
      db.close();
      db = await openAtVersion(BASE_DB_VERSION, (upgradedDb, transaction) => {
        createStores(upgradedDb, transaction, BASE_STORE_NAMES);
      });
    }
    if (db.version > DB_VERSION) {
      const version = db.version;
      db.close();
      throw new Error("This Project Comeback database was created by a newer schema version (" + version + "). Update the app before writing data.");
    }
    currentVersion = db.version;
    return db;
  }

  async function getVersion() {
    const db = await open();
    try { return db.version; }
    finally { db.close(); }
  }

  function validateIdentitySafetyEnvelope(envelope) {
    if (!envelope || typeof envelope !== "object" || envelope.app !== "Project Comeback" ||
        envelope.backupFormatVersion !== 1 || !envelope.data || typeof envelope.data !== "object") {
      throw new Error("A validated V1 full safety backup is required before the identity schema upgrade.");
    }
    const actual = Object.keys(envelope.data).sort();
    const expected = BASE_STORE_NAMES.slice().sort();
    if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
      throw new Error("The pre-upgrade safety backup must contain the exact V1 store set.");
    }
    for (const name of BASE_STORE_NAMES) {
      if (!Array.isArray(envelope.data[name])) throw new Error("The pre-upgrade safety backup is missing store: " + name);
      for (const record of envelope.data[name]) {
        if (!record || typeof record !== "object" || record.id === undefined || record.id === null || record.id === "") {
          throw new Error("The pre-upgrade safety backup contains an invalid record in " + name + ".");
        }
      }
    }
  }

  async function upgradeToV6(safetyEnvelope) {
    validateIdentitySafetyEnvelope(safetyEnvelope);
    const current = await open();
    const version = current.version;
    current.close();
    if (version === DB_VERSION) return { status: "already-upgraded", version, safetySnapshotId: "identity-upgrade-v6-safety-snapshot" };
    if (version !== BASE_DB_VERSION) {
      throw new Error("Identity foundation upgrade requires schema v5; found v" + version + ".");
    }
    const safetySnapshotId = "identity-upgrade-v6-safety-snapshot";
    const safetyRecord = {
      id: safetySnapshotId,
      type: "pre-identity-upgrade-safety-snapshot",
      backupFormatVersion: 1,
      exportedAt: safetyEnvelope.exportedAt || null,
      createdAt: new Date().toISOString(),
      verificationStatus: "pending",
      data: JSON.parse(JSON.stringify(safetyEnvelope.data))
    };
    return new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = event => {
        if (event.oldVersion !== BASE_DB_VERSION) {
          request.transaction.abort();
          return;
        }
        createStores(request.result, request.transaction, IDENTITY_STORE_NAMES);
        request.transaction.objectStore("metadata").add(safetyRecord);
      };
      request.onsuccess = () => {
        currentVersion = request.result.version;
        request.result.close();
        resolve({ status: "upgraded", version: DB_VERSION, safetySnapshotId });
      };
      request.onerror = () => reject(request.error || new Error("Identity schema upgrade failed; the version-change transaction was rolled back."));
      request.onblocked = () => reject(new Error("Identity schema upgrade is blocked by another open Project Comeback tab. Close other tabs and retry."));
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
      if (!db.objectStoreNames.contains(name)) throw new Error("Store " + name + " is not available until the identity foundation schema upgrade is completed.");
      const tx = db.transaction(name, mode);
      const done = transactionDone(tx);
      const store = tx.objectStore(name);
      const workResult = Promise.resolve().then(() => work(store, tx));
      const [result] = await Promise.all([workResult, done]);
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

  async function add(name, record) {
    if (!record || record.id === undefined || record.id === null || record.id === "") {
      throw new Error("Records must have a stable, non-empty id.");
    }
    await assertProgrammeRecordMutable(name, record);
    if (name === "identityReviewEvents") {
      if (record.eventSchemaVersion !== 1 || !record.profileId || !record.idempotencyKey || !record.actor ||
          typeof record.sourceExactValue !== "string" || !record.sourceNamespace ||
          !record.evidence || typeof record.evidence !== "object" || Array.isArray(record.evidence) || !Object.keys(record.evidence).length ||
          !["verified", "ambiguous", "rejected", "unresolved", "reversed"].includes(record.outcome) ||
          (record.outcome === "verified" && (!record.proposedMapping || typeof record.proposedMapping !== "object" || Array.isArray(record.proposedMapping))) ||
          (record.outcome === "reversed" && !record.reversesEventId && !record.supersedesEventId)) {
        throw new Error("Identity review events require profile-scoped provenance, exact source evidence and a supported outcome.");
      }
      if (record.catalogueReleaseId && !await get("catalogueReleases", record.catalogueReleaseId)) {
        throw new Error("Identity review event references a catalogue release that is not retained.");
      }
    }
    if (name === "catalogueReleases") {
      if (!record.catalogueId || !Number.isInteger(record.version) || record.version < 1 || !record.checksum) {
        throw new Error("Catalogue release records require a catalogue ID, positive version and checksum.");
      }
      const releases = await getAll("catalogueReleases");
      const latestVersion = releases.filter(item => item.catalogueId === record.catalogueId)
        .reduce((latest, item) => Math.max(latest, Number(item.version) || 0), 0);
      if (record.version <= latestVersion) throw new Error("Catalogue release versions must increase monotonically within a catalogue.");
    }
    const now = new Date().toISOString();
    const saved = Object.assign({}, record, {
      createdAt: record.createdAt || now,
      updatedAt: now
    });
    return withStore(name, "readwrite", store => requestResult(store.add(saved)));
  }

  async function assertProgrammeRecordMutable(name, recordOrId) {
    if (!["programmeVersions", "programmeDays", "programmeSlots"].includes(name)) return;
    if (recordOrId && typeof recordOrId === "object") {
      if (name === "programmeVersions" && (!recordOrId.programmeId || !recordOrId.status)) {
        throw new Error("Programme versions require a programme ID and lifecycle status.");
      }
      if (name === "programmeDays" && (!recordOrId.programmeVersionId || !recordOrId.dayLineageId)) {
        throw new Error("Programme days require a parent version and stable day lineage ID.");
      }
      if (name === "programmeSlots" && (!recordOrId.programmeVersionId || !recordOrId.programmeDayId || !recordOrId.slotLineageId)) {
        throw new Error("Programme slots require a parent version, day and stable slot lineage ID.");
      }
    }
    const id = typeof recordOrId === "string" ? recordOrId : recordOrId && recordOrId.id;
    const existing = id ? await get(name, id) : undefined;
    if (name === "programmeVersions") {
      if (existing && existing.status === "published") throw new Error("Published programme versions are immutable; create a new version instead.");
      if (recordOrId && typeof recordOrId === "object" && recordOrId.status === "published") {
        if (!recordOrId.catalogueReleaseId) throw new Error("A published programme version must pin an immutable catalogue release.");
        const release = await get("catalogueReleases", recordOrId.catalogueReleaseId);
        if (!release) throw new Error("A published programme version must reference a retained catalogue release manifest.");
      }
      return;
    }
    const versionIds = new Set([
      existing && existing.programmeVersionId,
      recordOrId && typeof recordOrId === "object" ? recordOrId.programmeVersionId : null
    ].filter(Boolean));
    for (const versionId of versionIds) {
      const version = await get("programmeVersions", versionId);
      if (version && version.status === "published") {
        throw new Error("Days and slots in a published programme version are immutable; create a new version instead.");
      }
    }
  }


  function validateGymWorkoutCreateBundle(bundle) {
    if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
      throw new Error("A Gym workout bundle is required.");
    }
    const session = bundle.session;
    const exercises = bundle.exerciseRecords;
    const sets = bundle.setRecords;
    if (!session || typeof session !== "object" || session.moduleId !== "gym" ||
        typeof session.id !== "string" || !session.id || !/^gym-\d{4}-\d{2}-\d{2}$/.test(session.status || "")) {
      // The status is checked below; the date-shaped expression here intentionally
      // only rejects absent core session identity. Session status is not an ID field.
      if (!session || typeof session !== "object" || session.moduleId !== "gym" ||
          typeof session.id !== "string" || !session.id) {
        throw new Error("Gym session requires a stable ID and moduleId gym.");
      }
    }
    if (!Array.isArray(exercises) || !exercises.length || !Array.isArray(sets) || !sets.length) {
      throw new Error("A new Gym workout must contain exercise and set records.");
    }
    if (session.status !== "in-progress") throw new Error("A new Gym workout must start in progress.");
    if (!Number.isInteger(session.day) || session.day < 1 || session.day > 5) {
      throw new Error("Gym session day must be an integer from 1 to 5.");
    }
    if (typeof session.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(session.date)) {
      throw new Error("Gym session date must use YYYY-MM-DD.");
    }
    const exerciseIds = new Set();
    const expectedSets = new Map();
    for (const exercise of exercises) {
      if (!exercise || typeof exercise !== "object" || exercise.moduleId !== "gym" ||
          exercise.sessionId !== session.id || typeof exercise.id !== "string" || !exercise.id ||
          typeof exercise.name !== "string" || !exercise.name.trim() ||
          !Number.isInteger(exercise.setCount) || exercise.setCount < 1 || exercise.setCount > 8) {
        throw new Error("Gym exercise records require a stable ID, exact name, session link and valid set count.");
      }
      if (exerciseIds.has(exercise.id)) throw new Error("Gym exercise record IDs must be unique.");
      exerciseIds.add(exercise.id);
      expectedSets.set(exercise.id, exercise.setCount);
    }
    const setIds = new Set();
    const setNumbers = new Set();
    for (const set of sets) {
      if (!set || typeof set !== "object" || set.moduleId !== "gym" ||
          set.sessionId !== session.id || typeof set.id !== "string" || !set.id ||
          !exerciseIds.has(set.exerciseRecordId) ||
          !Number.isInteger(set.setNumber) || set.setNumber < 1 ||
          set.setNumber > expectedSets.get(set.exerciseRecordId)) {
        throw new Error("Gym set records require a valid parent exercise, session link and set number.");
      }
      if (setIds.has(set.id)) throw new Error("Gym set record IDs must be unique.");
      const key = set.exerciseRecordId + "::" + set.setNumber;
      if (setNumbers.has(key)) throw new Error("Gym set numbers must be unique within each exercise.");
      setIds.add(set.id);
      setNumbers.add(key);
      for (const field of ["weight", "reps", "duration", "targetDuration"]) {
        if (set[field] !== undefined && typeof set[field] !== "string") {
          throw new Error("Gym set field " + field + " must be stored as a string.");
        }
      }
    }
    const requiredSetCount = [...expectedSets.values()].reduce((sum, count) => sum + count, 0);
    if (sets.length !== requiredSetCount) throw new Error("Gym workout bundle must include every initial set.");
    for (const [exerciseId, count] of expectedSets.entries()) {
      for (let number = 1; number <= count; number++) {
        if (!setNumbers.has(exerciseId + "::" + number)) throw new Error("Gym workout bundle is missing a set record.");
      }
    }
    return { session, exercises, sets };
  }

  async function createGymWorkoutBundle(bundle) {
    const validated = validateGymWorkoutCreateBundle(bundle);
    const db = await open();
    const requiredStores = ["modules", "sessions", "exerciseRecords", "setRecords"];
    try {
      if (requiredStores.some(name => !db.objectStoreNames.contains(name))) {
        throw new Error("Gym workout stores are not available in this database.");
      }
      const tx = db.transaction(requiredStores, "readwrite");
      const done = transactionDone(tx);
      let failure = null;
      const now = new Date().toISOString();
      const moduleRequest = tx.objectStore("modules").get("gym");
      moduleRequest.onsuccess = () => {
        const module = moduleRequest.result;
        if (!module || module.enabled !== true) {
          failure = new Error("Gym module is disabled; the workout was not created.");
          try { tx.abort(); } catch (error) {}
          return;
        }
        try {
          tx.objectStore("sessions").add(Object.assign({}, validated.session, {
            createdAt: validated.session.createdAt || now,
            updatedAt: now
          }));
          validated.exercises.forEach(record => {
            tx.objectStore("exerciseRecords").add(Object.assign({}, record, {
              createdAt: record.createdAt || now,
              updatedAt: now
            }));
          });
          validated.sets.forEach(record => {
            tx.objectStore("setRecords").add(Object.assign({}, record, {
              createdAt: record.createdAt || now,
              updatedAt: now
            }));
          });
        } catch (error) {
          failure = error;
          try { tx.abort(); } catch (abortError) {}
        }
      };
      try {
        await done;
      } catch (error) {
        throw failure || error;
      }
      return {
        session: Object.assign({}, validated.session),
        exerciseRecords: validated.exercises.map(record => Object.assign({}, record)),
        setRecords: validated.sets.map(record => Object.assign({}, record))
      };
    } finally {
      db.close();
    }
  }

  function validateGymWorkoutUpdateBundle(bundle) {
    if (!bundle || typeof bundle !== "object" || Array.isArray(bundle) ||
        typeof bundle.sessionId !== "string" || !bundle.sessionId) {
      throw new Error("Gym workout updates require a session ID.");
    }
    const session = bundle.session || null;
    const exercises = bundle.exerciseRecords === undefined ? [] : bundle.exerciseRecords;
    const sets = bundle.setRecords === undefined ? [] : bundle.setRecords;
    if ((!session && !exercises.length && !sets.length) ||
        !Array.isArray(exercises) || !Array.isArray(sets)) {
      throw new Error("Gym workout updates must contain records to save.");
    }
    if (session && (session.id !== bundle.sessionId || session.moduleId !== "gym")) {
      throw new Error("Gym session update has an invalid identity.");
    }
    const seen = { exerciseRecords: new Set(), setRecords: new Set() };
    for (const [name, records] of [["exerciseRecords", exercises], ["setRecords", sets]]) {
      for (const record of records) {
        if (!record || typeof record !== "object" || record.moduleId !== "gym" ||
            record.sessionId !== bundle.sessionId || typeof record.id !== "string" || !record.id) {
          throw new Error("Gym " + name + " updates must retain their Gym module and session identity.");
        }
        if (seen[name].has(record.id)) throw new Error("Gym update contains duplicate " + name + " IDs.");
        seen[name].add(record.id);
      }
    }
    return { session, exercises, sets };
  }

  async function updateGymWorkoutBundle(bundle) {
    const validated = validateGymWorkoutUpdateBundle(bundle);
    const db = await open();
    const requiredStores = ["modules", "sessions", "exerciseRecords", "setRecords"];
    try {
      if (requiredStores.some(name => !db.objectStoreNames.contains(name))) {
        throw new Error("Gym workout stores are not available in this database.");
      }
      const tx = db.transaction(requiredStores, "readwrite");
      const done = transactionDone(tx);
      let failure = null;
      let pendingChecks = 2 + validated.exercises.length + validated.sets.length;
      const now = new Date().toISOString();
      const fail = message => {
        if (failure) return;
        failure = message instanceof Error ? message : new Error(message);
        try { tx.abort(); } catch (error) {}
      };
      const checkFinished = () => {
        pendingChecks--;
      };
      const moduleRequest = tx.objectStore("modules").get("gym");
      moduleRequest.onsuccess = () => {
        if (!moduleRequest.result || moduleRequest.result.enabled !== true) {
          fail("Gym module is disabled; workout changes were not saved.");
          return;
        }
        checkFinished();
      };
      const sessionRequest = tx.objectStore("sessions").get(bundle.sessionId);
      sessionRequest.onsuccess = () => {
        const existing = sessionRequest.result;
        if (!existing || existing.moduleId !== "gym") {
          fail("Gym workout session no longer exists.");
          return;
        }
        if (validated.session) {
          const updated = Object.assign({}, validated.session, {
            createdAt: existing.createdAt || validated.session.createdAt || now,
            updatedAt: now
          });
          tx.objectStore("sessions").put(updated);
        }
        checkFinished();
      };
      validated.exercises.forEach(record => {
        const request = tx.objectStore("exerciseRecords").get(record.id);
        request.onsuccess = () => {
          const existing = request.result;
          if (!existing || existing.moduleId !== "gym" || existing.sessionId !== bundle.sessionId ||
              existing.name !== record.name || existing.programmeSlotId !== record.programmeSlotId) {
            fail("Gym exercise record is missing or its source identity changed.");
            return;
          }
          tx.objectStore("exerciseRecords").put(Object.assign({}, record, {
            createdAt: existing.createdAt || record.createdAt || now,
            updatedAt: now
          }));
          checkFinished();
        };
      });
      validated.sets.forEach(record => {
        const request = tx.objectStore("setRecords").get(record.id);
        request.onsuccess = () => {
          const existing = request.result;
          if (!existing || existing.moduleId !== "gym" || existing.sessionId !== bundle.sessionId ||
              existing.exerciseRecordId !== record.exerciseRecordId || existing.setNumber !== record.setNumber) {
            fail("Gym set record is missing or its exercise/set identity changed.");
            return;
          }
          tx.objectStore("setRecords").put(Object.assign({}, record, {
            createdAt: existing.createdAt || record.createdAt || now,
            updatedAt: now
          }));
          checkFinished();
        };
      });
      try {
        await done;
      } catch (error) {
        throw failure || error;
      }
      return { sessionId: bundle.sessionId, updatedAt: now };
    } finally {
      db.close();
    }
  }

  async function put(name, record) {
    if (IMMUTABLE_STORES.has(name)) throw new Error("Store " + name + " is append-only and cannot be overwritten.");
    if (!record || record.id === undefined || record.id === null || record.id === "") {
      throw new Error("Records must have a stable, non-empty id.");
    }
    await assertProgrammeRecordMutable(name, record);
    const now = new Date().toISOString();
    const saved = Object.assign({}, record, {
      createdAt: record.createdAt || now,
      updatedAt: now
    });
    return withStore(name, "readwrite", store => requestResult(store.put(saved)));
  }

  async function remove(name, id) {
    if (IMMUTABLE_STORES.has(name)) throw new Error("Store " + name + " is append-only and records cannot be deleted.");
    if (name === "exerciseDefinitions" || name === "exerciseVariations") throw new Error("Exercise definitions and variations are retained by ID; retire them by changing status instead of deleting.");
    await assertProgrammeRecordMutable(name, id);
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


  // Commit every typed legacy projection and the completion marker atomically.
  // Existing records are accepted only when they are the same migration projection;
  // unrelated/newer user data causes the whole transaction to abort.
  async function commitLegacyMigration(projection, markerId, summary) {
    const mapping = {
      profile: "profile",
      equipment: "equipment",
      readiness: "readiness",
      weighIns: "weighIns",
      preferences: "preferences",
      sessions: "sessions",
      exerciseRecords: "exerciseRecords",
      setRecords: "setRecords"
    };
    if (!projection || typeof projection !== "object") throw new Error("A migration projection is required.");
    const entries = [];
    Object.entries(mapping).forEach(([field, storeName]) => {
      const records = projection[field] || [];
      if (!Array.isArray(records)) throw new Error("Migration projection field must be an array: " + field);
      records.forEach(record => {
        if (!record || typeof record.id !== "string" || !record.id) throw new Error("Every migrated record requires a stable id.");
        entries.push({ storeName, record });
      });
    });
    const ids = new Set();
    entries.forEach(({ storeName, record }) => {
      const token = storeName + ":" + record.id;
      if (ids.has(token)) throw new Error("Duplicate migrated record id: " + token);
      ids.add(token);
    });

    const db = await open();
    try {
      const names = [...new Set([...entries.map(item => item.storeName), "metadata"])];
      const tx = db.transaction(names, "readwrite");
      const done = transactionDone(tx);
      const metaStore = tx.objectStore("metadata");
      const marker = await requestResult(metaStore.get(markerId));
      if (marker && marker.value && marker.value.status === "complete") {
        await done;
        return { status: "already-complete", counts: marker.value.counts || {} };
      }

      const existing = await Promise.all(entries.map(({ storeName, record }) =>
        requestResult(tx.objectStore(storeName).get(record.id))));
      const conflictIndex = existing.findIndex((old, index) => old &&
        (old.legacyKey !== entries[index].record.legacyKey ||
         old.legacyRawValue !== entries[index].record.legacyRawValue));
      if (conflictIndex >= 0) {
        const conflict = entries[conflictIndex];
        tx.abort();
        try { await done; } catch (ignored) {}
        throw new Error("Migration conflict: existing " + conflict.storeName + " record " + conflict.record.id +
          " does not match this legacy source. No migration records were committed.");
      }
      const now = new Date().toISOString();
      entries.forEach((entry, index) => {
        if (!existing[index]) {
          tx.objectStore(entry.storeName).put(Object.assign({}, entry.record, {
            createdAt: now,
            updatedAt: now,
            migratedFromLegacy: true
          }));
        }
      });
      const counts = summary && summary.counts ? summary.counts : {};
      metaStore.put({
        id: markerId,
        type: "migration",
        value: Object.assign({}, summary || {}, {
          status: "complete",
          completedAt: now,
          counts
        }),
        updatedAt: now
      });
      await done;
      return { status: "complete", writtenCount: entries.length, counts };
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
      names.filter(name => !IMMUTABLE_STORES.has(name)).forEach(name => tx.objectStore(name).clear());
      await done;
    } finally {
      db.close();
    }
  }

  global.ProjectComebackDB = Object.freeze({
    name: DB_NAME,
    get version() { return currentVersion; },
    getVersion,
    upgradeToV6,
    createGymWorkoutBundle,
    updateGymWorkoutBundle,
    stores: Object.freeze(Object.keys(STORES)),
    open,
    get,
    getAll,
    getAllByIndex,
    put,
    add,
    remove,
    count,
    getMeta,
    setMeta,
    importLegacySnapshot,
    commitLegacyMigration
  });
})(window);
