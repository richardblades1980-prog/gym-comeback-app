/* Project Comeback V21.2A — read-only cross-store integrity diagnostics. */
(function (global) {
  "use strict";

  const STORE_NAMES = Object.freeze([
    "profile","objectives","equipment","readiness","weighIns","assessments","modules","programmes",
    "sessions","exerciseRecords","setRecords","hikingRecords","schedules","progression","preferences",
    "metadata","legacyRecords","exerciseDefinitions","exerciseVariations","exerciseAliases",
    "identityReviewEvents","catalogueReleases","exerciseConfigurations","programmeVersions",
    "programmeDays","programmeSlots"
  ]);

  function arrays(data) {
    const result = {};
    STORE_NAMES.forEach(name => result[name] = Array.isArray(data && data[name]) ? data[name] : []);
    return result;
  }
  function index(records) {
    return new Map(records.map(record => [String(record.id), record]));
  }
  function diagnoseData(input) {
    const data = arrays(input);
    const maps = {};
    STORE_NAMES.forEach(name => maps[name] = index(data[name]));
    const findings = [];
    function add(code, severity, store, record, reference, message) {
      findings.push({ code, severity, store, recordId: record && record.id !== undefined ? String(record.id) : null,
        reference: reference || null, message });
    }
    function missingRef(code, store, record, field, targetStore, severity) {
      const value = record && record[field];
      if (value === undefined || value === null || value === "") return;
      if (!maps[targetStore].has(String(value))) {
        add(code, severity || "error", store, record, { field, value, targetStore }, "Reference does not resolve to " + targetStore + ".");
      }
    }

    data.exerciseRecords.forEach(record => {
      missingRef("EXERCISE_SESSION_MISSING", "exerciseRecords", record, "sessionId", "sessions");
      const session = record.sessionId && maps.sessions.get(String(record.sessionId));
      if (session && record.moduleId && session.moduleId && record.moduleId !== session.moduleId) {
        add("EXERCISE_MODULE_MISMATCH", "error", "exerciseRecords", record,
          { field: "moduleId", value: record.moduleId, sessionId: session.id, sessionModuleId: session.moduleId },
          "Exercise module does not match its parent session.");
      }
      missingRef("EXERCISE_DEFINITION_MISSING", "exerciseRecords", record, "exerciseDefinitionId", "exerciseDefinitions");
      missingRef("EXERCISE_VARIATION_MISSING", "exerciseRecords", record, "exerciseVariationId", "exerciseVariations");
      const variation = record.exerciseVariationId && maps.exerciseVariations.get(String(record.exerciseVariationId));
      if (variation && record.exerciseDefinitionId && variation.exerciseDefinitionId !== record.exerciseDefinitionId) {
        add("EXERCISE_VARIATION_PARENT_MISMATCH", "error", "exerciseRecords", record,
          { variationId: variation.id, expectedDefinitionId: variation.exerciseDefinitionId, actualDefinitionId: record.exerciseDefinitionId },
          "Exercise variation belongs to a different exercise definition.");
      }
    });

    data.setRecords.forEach(record => {
      missingRef("SET_EXERCISE_MISSING", "setRecords", record, "exerciseRecordId", "exerciseRecords");
      missingRef("SET_SESSION_MISSING", "setRecords", record, "sessionId", "sessions");
      const exercise = record.exerciseRecordId && maps.exerciseRecords.get(String(record.exerciseRecordId));
      const session = record.sessionId && maps.sessions.get(String(record.sessionId));
      if (exercise && record.sessionId && exercise.sessionId && String(exercise.sessionId) !== String(record.sessionId)) {
        add("SET_EXERCISE_SESSION_MISMATCH", "error", "setRecords", record,
          { exerciseRecordId: exercise.id, exerciseSessionId: exercise.sessionId, setSessionId: record.sessionId },
          "Set record's session does not match its parent exercise.");
      }
      if (session && record.moduleId && session.moduleId && record.moduleId !== session.moduleId) {
        add("SET_MODULE_MISMATCH", "error", "setRecords", record,
          { sessionId: session.id, setModuleId: record.moduleId, sessionModuleId: session.moduleId },
          "Set module does not match its parent session.");
      }
      if (exercise && record.moduleId && exercise.moduleId && record.moduleId !== exercise.moduleId) {
        add("SET_EXERCISE_MODULE_MISMATCH", "error", "setRecords", record,
          { exerciseRecordId: exercise.id, setModuleId: record.moduleId, exerciseModuleId: exercise.moduleId },
          "Set module does not match its parent exercise.");
      }
    });

    data.exerciseVariations.forEach(record =>
      missingRef("VARIATION_DEFINITION_MISSING", "exerciseVariations", record, "exerciseDefinitionId", "exerciseDefinitions"));
    data.exerciseAliases.forEach(record =>
      missingRef("ALIAS_DEFINITION_MISSING", "exerciseAliases", record, "exerciseDefinitionId", "exerciseDefinitions"));
    data.exerciseConfigurations.forEach(record => {
      missingRef("CONFIG_DEFINITION_MISSING", "exerciseConfigurations", record, "exerciseDefinitionId", "exerciseDefinitions");
      missingRef("CONFIG_PROFILE_MISSING", "exerciseConfigurations", record, "profileId", "profile", "warning");
    });
    data.identityReviewEvents.forEach(record => {
      missingRef("REVIEW_RELEASE_MISSING", "identityReviewEvents", record, "catalogueReleaseId", "catalogueReleases", "warning");
      missingRef("REVIEW_REVERSAL_TARGET_MISSING", "identityReviewEvents", record, "reversesEventId", "identityReviewEvents", "warning");
      missingRef("REVIEW_SUPERSESSION_TARGET_MISSING", "identityReviewEvents", record, "supersedesEventId", "identityReviewEvents", "warning");
    });

    data.programmeVersions.forEach(record => {
      missingRef("PROGRAMME_VERSION_PARENT_MISSING", "programmeVersions", record, "programmeId", "programmes", "warning");
      missingRef("PROGRAMME_VERSION_RELEASE_MISSING", "programmeVersions", record, "catalogueReleaseId", "catalogueReleases",
        record.status === "published" ? "error" : "warning");
    });
    data.programmeDays.forEach(record =>
      missingRef("PROGRAMME_DAY_VERSION_MISSING", "programmeDays", record, "programmeVersionId", "programmeVersions"));
    data.programmeSlots.forEach(record => {
      missingRef("PROGRAMME_SLOT_VERSION_MISSING", "programmeSlots", record, "programmeVersionId", "programmeVersions");
      missingRef("PROGRAMME_SLOT_DAY_MISSING", "programmeSlots", record, "programmeDayId", "programmeDays");
      missingRef("PROGRAMME_SLOT_DEFINITION_MISSING", "programmeSlots", record, "exerciseDefinitionId", "exerciseDefinitions", "warning");
      missingRef("PROGRAMME_SLOT_RELEASE_MISSING", "programmeSlots", record, "catalogueReleaseId", "catalogueReleases", "warning");
      const day = record.programmeDayId && maps.programmeDays.get(String(record.programmeDayId));
      if (day && record.programmeVersionId && day.programmeVersionId &&
          String(day.programmeVersionId) !== String(record.programmeVersionId)) {
        add("PROGRAMME_SLOT_DAY_VERSION_MISMATCH", "error", "programmeSlots", record,
          { dayId: day.id, slotVersionId: record.programmeVersionId, dayVersionId: day.programmeVersionId },
          "Programme slot and parent day belong to different programme versions.");
      }
    });

    data.sessions.forEach(record => {
      missingRef("SESSION_PROGRAMME_VERSION_MISSING", "sessions", record, "programmeVersionId", "programmeVersions", "warning");
      missingRef("SESSION_CATALOGUE_RELEASE_MISSING", "sessions", record, "catalogueReleaseId", "catalogueReleases", "warning");
    });

    const pointer = maps.metadata.get("active-exercise-catalogue-release");
    if (pointer && pointer.value && pointer.value.releaseId) {
      if (!maps.catalogueReleases.has(String(pointer.value.releaseId))) {
        add("ACTIVE_CATALOGUE_RELEASE_MISSING", "error", "metadata", pointer,
          { field: "value.releaseId", value: pointer.value.releaseId, targetStore: "catalogueReleases" },
          "Active catalogue pointer references a release that is not retained.");
      }
    } else if (pointer && pointer.value && pointer.value.releaseId === undefined) {
      add("ACTIVE_CATALOGUE_POINTER_INVALID", "warning", "metadata", pointer, null,
        "Active catalogue metadata exists but does not contain a releaseId.");
    }

    findings.sort((a, b) => a.code.localeCompare(b.code) || a.store.localeCompare(b.store) ||
      String(a.recordId || "").localeCompare(String(b.recordId || "")));
    const errors = findings.filter(item => item.severity === "error").length;
    const warnings = findings.filter(item => item.severity === "warning").length;
    return { valid: errors === 0, status: errors ? "error" : warnings ? "warning" : "pass",
      scannedStores: STORE_NAMES.filter(name => Array.isArray(input && input[name])),
      recordCounts: Object.fromEntries(STORE_NAMES.map(name => [name, data[name].length])),
      summary: { errors, warnings, findings: findings.length }, findings };
  }

  async function diagnoseLiveDatabase() {
    const dbApi = global.ProjectComebackDB;
    if (!dbApi) throw new Error("Load database.js before integrity diagnostics.");
    const version = await dbApi.getVersion();
    const names = version >= 6 ? STORE_NAMES : STORE_NAMES.slice(0, 17);
    const data = {};
    await Promise.all(names.map(async name => { data[name] = await dbApi.getAll(name); }));
    return Object.assign(diagnoseData(data), { source: "live-database", databaseVersion: version });
  }

  global.ProjectComebackIntegrity = Object.freeze({
    stores: STORE_NAMES,
    diagnoseData,
    diagnoseLiveDatabase
  });
})(window);
