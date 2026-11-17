/* Project Comeback V21.2A — canonical exercise identity persistence services. */
(function (global) {
  "use strict";

  const PROGRESSION_FOCUS = Object.freeze(["reps", "weight", "duration", "sets", "balanced", "manual"]);
  const RECORDING_MODES = Object.freeze(["reps", "timed-hold", "timed-reps"]);
  const CONFIGURATION_FIELDS = Object.freeze(["preferredProgressionFocus", "recordingModeOverride"]);

  function stableJson(value) {
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  function requiredString(value, field) {
    if (typeof value !== "string" || !value.trim()) throw new Error(field + " is required.");
    return value;
  }

  function validateReviewEvent(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("An identity review event is required.");
    if (input.eventSchemaVersion !== undefined && input.eventSchemaVersion !== 1) throw new Error("Unsupported identity review event schema version.");
    requiredString(input.id, "Review event ID");
    requiredString(input.profileId, "Profile ID");
    requiredString(input.subjectType, "Subject type");
    requiredString(input.subjectId, "Subject ID");
    requiredString(input.sourceNamespace, "Source namespace");
    requiredString(input.actor, "Review actor");
    if (typeof input.sourceExactValue !== "string") throw new Error("sourceExactValue must preserve the exact original string, including blanks and whitespace.");
    if (input.sourceRawValue !== undefined && typeof input.sourceRawValue !== "string") throw new Error("sourceRawValue must remain the exact original raw string when supplied.");
    requiredString(input.idempotencyKey, "Profile-scoped idempotency key");
    if (!["verified", "ambiguous", "rejected", "unresolved", "reversed"].includes(input.outcome)) {
      throw new Error("Identity review outcome is not supported.");
    }
    if (input.outcome === "reversed" && !input.reversesEventId && !input.supersedesEventId) {
      throw new Error("A correction must reference the event it reverses or supersedes.");
    }
    if (!input.evidence || typeof input.evidence !== "object" || Array.isArray(input.evidence) || !Object.keys(input.evidence).length) {
      throw new Error("Review evidence must be a non-empty object.");
    }
    if (input.reviewedAt !== undefined && (typeof input.reviewedAt !== "string" || !Number.isFinite(Date.parse(input.reviewedAt)))) {
      throw new Error("Review timestamp must be a valid date-time string.");
    }
    if (input.outcome === "verified" && (!input.proposedMapping || typeof input.proposedMapping !== "object" || Array.isArray(input.proposedMapping))) {
      throw new Error("A verified identity decision requires an explicit proposed mapping.");
    }
  }

  function comparableEvent(event) {
    const copy = Object.assign({}, event);
    delete copy.id;
    delete copy.createdAt;
    delete copy.updatedAt;
    delete copy.reviewedAt;
    return stableJson(copy);
  }

  async function recordIdentityReviewEvent(input) {
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before the identity service.");
    validateReviewEvent(input);
    if (input.catalogueReleaseId && !await db.get("catalogueReleases", input.catalogueReleaseId)) {
      throw new Error("Identity review event references a catalogue release that is not retained.");
    }
    const event = Object.assign({}, input, {
      eventSchemaVersion: input.eventSchemaVersion || 1,
      reviewedAt: input.reviewedAt || new Date().toISOString()
    });
    try {
      await db.add("identityReviewEvents", event);
      return { event, appended: true };
    } catch (error) {
      let matches = [];
      try {
        matches = await db.getAllByIndex("identityReviewEvents", "by_profile_idempotency", [event.profileId, event.idempotencyKey]);
      } catch (lookupError) {}
      const existing = matches[0];
      if (existing && comparableEvent(existing) === comparableEvent(event)) return { event: existing, appended: false };
      if (existing) throw new Error("This profile-scoped idempotency key already belongs to a different review decision.");
      throw error;
    }
  }

  async function listIdentityReviewEvents(profileId, subjectType, subjectId) {
    requiredString(profileId, "Profile ID");
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before the identity service.");
    const events = subjectType && subjectId
      ? await db.getAllByIndex("identityReviewEvents", "by_subject", [profileId, subjectType, subjectId])
      : await db.getAllByIndex("identityReviewEvents", "by_profile", profileId);
    return events.sort((a, b) => String(a.reviewedAt || "").localeCompare(String(b.reviewedAt || "")) || String(a.id).localeCompare(String(b.id)));
  }

  async function rebuildIdentityProjection(profileId, subjectType, subjectId) {
    const events = await listIdentityReviewEvents(profileId, subjectType, subjectId);
    const latest = events.length ? events[events.length - 1] : null;
    return {
      profileId,
      subjectType,
      subjectId,
      lastReviewEventId: latest ? latest.id : null,
      mapping: latest && latest.outcome === "verified" ? latest.proposedMapping || null : null,
      outcome: latest ? latest.outcome : "unreviewed",
      eventCount: events.length
    };
  }

  async function storeCatalogueRelease(input) {
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before the identity service.");
    if (!input || typeof input !== "object") throw new Error("A catalogue release manifest is required.");
    const id = requiredString(input.id || input.releaseId, "Catalogue release ID");
    if (!Number.isInteger(input.version) || input.version < 1) throw new Error("Catalogue release version must be a positive integer.");
    requiredString(input.checksum, "Catalogue release checksum");
    const catalogueId = input.catalogueId || "exercise-catalogue";
    const manifest = Object.assign({}, input, { id, releaseId: id, catalogueId });
    const existing = await db.get("catalogueReleases", id);
    if (existing) {
      if (stableJson(existing) === stableJson(Object.assign({}, manifest, {
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt
      }))) return { release: existing, stored: false };
      throw new Error("Catalogue releases are immutable; an existing release ID cannot be replaced.");
    }
    const releases = await db.getAll("catalogueReleases");
    const latestVersion = releases.filter(item => (item.catalogueId || "exercise-catalogue") === catalogueId)
      .reduce((latest, item) => Math.max(latest, Number(item.version) || 0), 0);
    if (manifest.version <= latestVersion) {
      throw new Error("Catalogue release versions must increase monotonically within a catalogue.");
    }
    try {
      await db.add("catalogueReleases", manifest);
      return { release: manifest, stored: true };
    } catch (error) {
      let raced;
      try { raced = await db.get("catalogueReleases", id); } catch (lookupError) {}
      if (raced && stableJson(raced) === stableJson(Object.assign({}, manifest, {
        createdAt: raced.createdAt,
        updatedAt: raced.updatedAt
      }))) return { release: raced, stored: false };
      throw error;
    }
  }

  async function getCatalogueReleaseReferences(releaseId) {
    requiredString(releaseId, "Catalogue release ID");
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before the identity service.");
    const [versions, sessions, events] = await Promise.all([
      db.getAll("programmeVersions"),
      db.getAll("sessions"),
      db.getAll("identityReviewEvents")
    ]);
    const references = [];
    versions.filter(item => item.status === "published" && item.catalogueReleaseId === releaseId)
      .forEach(item => references.push({ type: "programmeVersion", id: item.id }));
    sessions.filter(item => item.status !== "cancelled" && item.status !== "deleted" && item.catalogueReleaseId === releaseId)
      .forEach(item => references.push({ type: "session", id: item.id }));
    events.filter(item => item.catalogueReleaseId === releaseId)
      .forEach(item => references.push({ type: "identityReviewEvent", id: item.id }));
    return references;
  }

  async function isCatalogueReleaseRetained(releaseId) {
    return (await getCatalogueReleaseReferences(releaseId)).length > 0;
  }

  async function saveReusableConfiguration(input, supportedRecordingModes) {
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before the identity service.");
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("A reusable exercise configuration is required.");
    const allowedRecordFields = new Set(["profileId", "exerciseDefinitionId", "exerciseVariationId", "equipmentDefinitionId", "settings", "createdAt", "provenance"]);
    if (Object.keys(input).some(key => !allowedRecordFields.has(key))) {
      throw new Error("Reusable configuration record contains fields outside its approved identity and settings scope.");
    }
    const profileId = requiredString(input.profileId, "Profile ID");
    const exerciseDefinitionId = requiredString(input.exerciseDefinitionId, "Exercise definition ID");
    const exerciseVariationId = input.exerciseVariationId || null;
    const equipmentDefinitionId = input.equipmentDefinitionId || null;
    if (exerciseVariationId !== null && (typeof exerciseVariationId !== "string" || !exerciseVariationId)) throw new Error("Exercise variation ID must be a non-empty string or null.");
    if (equipmentDefinitionId !== null && (typeof equipmentDefinitionId !== "string" || !equipmentDefinitionId)) throw new Error("Equipment definition ID must be a non-empty string or null.");
    const settings = input.settings || {};
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("Configuration settings must be an object.");
    const keys = Object.keys(settings);
    if (!keys.length || keys.some(key => !CONFIGURATION_FIELDS.includes(key))) {
      throw new Error("Reusable configuration accepts only preferredProgressionFocus and recordingModeOverride.");
    }
    if (settings.preferredProgressionFocus !== undefined && !PROGRESSION_FOCUS.includes(settings.preferredProgressionFocus)) {
      throw new Error("preferredProgressionFocus is not a supported value.");
    }
    if (settings.recordingModeOverride !== undefined) {
      if (!RECORDING_MODES.includes(settings.recordingModeOverride) ||
          !Array.isArray(supportedRecordingModes) || !supportedRecordingModes.includes(settings.recordingModeOverride)) {
        throw new Error("recordingModeOverride must be supported by the selected exercise definition or variation.");
      }
    }
    const scopeKey = JSON.stringify([profileId, exerciseDefinitionId, exerciseVariationId, equipmentDefinitionId]);
    const id = "exercise-config:" + encodeURIComponent(scopeKey);
    const existing = await db.get("exerciseConfigurations", id);
    const provenance = input.provenance === undefined ? { source: "user-explicit" } : input.provenance;
    if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) throw new Error("Configuration provenance must be an object.");
    const record = {
      id,
      configurationSchemaVersion: 1,
      provenance: Object.assign({}, provenance),
      scopeKey,
      profileId,
      exerciseDefinitionId,
      exerciseVariationId,
      equipmentDefinitionId,
      settings: Object.assign({}, settings),
      createdAt: existing ? existing.createdAt : (input.createdAt || new Date().toISOString())
    };
    await db.put("exerciseConfigurations", record);
    return record;
  }

  async function getReusableConfiguration(scope) {
    const db = global.ProjectComebackDB;
    if (!db) throw new Error("Load database.js before the identity service.");
    const scopeKey = JSON.stringify([
      requiredString(scope.profileId, "Profile ID"),
      requiredString(scope.exerciseDefinitionId, "Exercise definition ID"),
      scope.exerciseVariationId || null,
      scope.equipmentDefinitionId || null
    ]);
    const records = await db.getAllByIndex("exerciseConfigurations", "by_scope_key", scopeKey);
    return records[0] || null;
  }

  function createCanonicalDisplaySnapshot(input) {
    if (!input || typeof input !== "object") throw new Error("A historical display snapshot is required.");
    const canonicalName = requiredString(input.canonicalName, "Canonical display name");
    const equipmentLabels = input.equipmentLabels === undefined ? [] : input.equipmentLabels;
    if (!Array.isArray(equipmentLabels) || equipmentLabels.some(label => typeof label !== "string")) {
      throw new Error("Historical equipment labels must be an array of exact strings.");
    }
    if (input.locale !== undefined && typeof input.locale !== "string") throw new Error("Historical display locale must be a string.");
    const snapshot = {
      snapshotSchemaVersion: 1,
      locale: input.locale || "en-AU",
      canonicalName,
      variationName: input.variationName === undefined ? null : input.variationName,
      equipmentLabels: equipmentLabels.slice(),
      shortCue: input.shortCue === undefined ? null : input.shortCue
    };
    if (snapshot.variationName !== null && typeof snapshot.variationName !== "string") throw new Error("Variation display name must be a string or null.");
    if (snapshot.shortCue !== null && typeof snapshot.shortCue !== "string") throw new Error("Historical cue must be a string or null.");
    Object.freeze(snapshot.equipmentLabels);
    return Object.freeze(snapshot);
  }

  global.ProjectComebackIdentity = Object.freeze({
    progressionFocusValues: PROGRESSION_FOCUS,
    recordingModeValues: RECORDING_MODES,
    reusableConfigurationFields: CONFIGURATION_FIELDS,
    recordIdentityReviewEvent,
    listIdentityReviewEvents,
    rebuildIdentityProjection,
    storeCatalogueRelease,
    getCatalogueReleaseReferences,
    isCatalogueReleaseRetained,
    saveReusableConfiguration,
    getReusableConfiguration,
    createCanonicalDisplaySnapshot
  });
})(window);
