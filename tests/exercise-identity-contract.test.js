const test = require("node:test");
const assert = require("node:assert/strict");

// Design-level acceptance fixtures for the proposed canonical identity model.
// These assertions pin data relationships before a production service exists.
// They deliberately do not claim that V21.2 currently implements this model.

const equipmentDefinitions = [
  { id: "eqd_01J000000000000000001", name: "Dumbbell", status: "active" },
  { id: "eqd_01J000000000000000002", name: "Barbell", status: "active" }
];

const exerciseDefinitions = [
  {
    id: "exd_01J000000000000000001",
    kind: "system",
    canonicalName: "Dumbbell Romanian Deadlift",
    status: "active",
    requiredEquipmentDefinitionIds: ["eqd_01J000000000000000001"]
  },
  {
    id: "exd_01J000000000000000002",
    kind: "system",
    canonicalName: "Barbell Romanian Deadlift",
    status: "active",
    requiredEquipmentDefinitionIds: ["eqd_01J000000000000000002"]
  }
];

const variations = [
  {
    id: "exv_01J000000000000000001",
    exerciseDefinitionId: "exd_01J000000000000000001",
    name: "Single-leg",
    attributes: { laterality: "unilateral" },
    equipmentDefinitionIds: ["eqd_01J000000000000000001"]
  },
  {
    id: "exv_01J000000000000000002",
    exerciseDefinitionId: "exd_01J000000000000000001",
    name: "B-stance",
    attributes: { stance: "B-stance" },
    equipmentDefinitionIds: ["eqd_01J000000000000000001"]
  }
];

function definitionById(id) {
  return exerciseDefinitions.find(item => item.id === id);
}

function resolveExactVerifiedAlias(aliases, sourceNamespace, exactValue) {
  const matches = aliases.filter(item =>
    item.sourceNamespace === sourceNamespace &&
    item.exactValue === exactValue &&
    item.verificationStatus === "verified"
  );
  return matches.length === 1 ? matches[0] : null;
}

function normalizedLegacyName(value) {
  return String(value || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function configurationIdentity(record) {
  return [
    record.profileId,
    record.exerciseDefinitionId,
    record.exerciseVariationId || "base",
    record.equipmentDefinitionId || "any-equipment"
  ].join("|");
}

function historyIdentity(record) {
  if (record.identityStatus !== "verified" || !record.exerciseDefinitionId) {
    return "unresolved-record:" + record.id;
  }
  return record.exerciseDefinitionId + "|" + (record.exerciseVariationId || "base");
}

function assertOpaqueId(value, prefix) {
  assert.match(value, new RegExp("^" + prefix + "_[A-Z0-9]{12,}$"));
  assert.ok(!value.toLowerCase().includes("romanian"));
}

test("exercise definition IDs are opaque and independent of editable display names", () => {
  const originalId = exerciseDefinitions[0].id;
  const renamed = { ...exerciseDefinitions[0], canonicalName: "DB Hip Hinge" };
  assert.equal(renamed.id, originalId);
  assertOpaqueId(renamed.id, "exd");
  assert.notEqual(exerciseDefinitions[0].id, exerciseDefinitions[1].id);
});

test("variations have their own immutable IDs and must reference a real parent definition", () => {
  for (const variation of variations) {
    assertOpaqueId(variation.id, "exv");
    assert.ok(definitionById(variation.exerciseDefinitionId), "variation parent must exist");
  }
  assert.notEqual(variations[0].id, variations[1].id);
  assert.equal(variations[0].exerciseDefinitionId, variations[1].exerciseDefinitionId);
  assert.notEqual(
    historyIdentity({ id: "performed-a", identityStatus: "verified", exerciseDefinitionId: variations[0].exerciseDefinitionId, exerciseVariationId: variations[0].id }),
    historyIdentity({ id: "performed-b", identityStatus: "verified", exerciseDefinitionId: variations[1].exerciseDefinitionId, exerciseVariationId: variations[1].id })
  );
});

test("exercise equipment references catalogue definitions, not user equipment record IDs", () => {
  const userEquipmentRecord = {
    id: "user-equipment-dumbbell-set-1",
    moduleId: "gym",
    equipmentDefinitionId: equipmentDefinitions[0].id
  };
  for (const definition of exerciseDefinitions) {
    for (const equipmentId of definition.requiredEquipmentDefinitionIds) {
      assert.ok(equipmentDefinitions.some(item => item.id === equipmentId));
      assert.notEqual(equipmentId, userEquipmentRecord.id);
    }
  }
  assert.equal(userEquipmentRecord.equipmentDefinitionId, equipmentDefinitions[0].id);
});

test("programme versions are separate immutable snapshots and slots are version-scoped", () => {
  const versionOne = Object.freeze({
    id: "prv_01J000000000000000001",
    programmeId: "prg_01J000000000000000001",
    versionNumber: 1,
    status: "published"
  });
  const versionTwo = Object.freeze({
    id: "prv_01J000000000000000002",
    programmeId: versionOne.programmeId,
    versionNumber: 2,
    status: "published",
    basedOnVersionId: versionOne.id
  });
  const slotOne = {
    id: "psl_01J000000000000000001",
    programmeVersionId: versionOne.id,
    slotLineageId: "lineage_01J000000000000000001",
    exerciseDefinitionId: exerciseDefinitions[0].id
  };
  const slotTwo = {
    id: "psl_01J000000000000000002",
    programmeVersionId: versionTwo.id,
    slotLineageId: slotOne.slotLineageId,
    exerciseDefinitionId: exerciseDefinitions[1].id
  };

  assert.notEqual(versionOne.id, versionTwo.id);
  assert.equal(versionOne.programmeId, versionTwo.programmeId);
  assert.notEqual(slotOne.id, slotTwo.id);
  assert.equal(slotOne.slotLineageId, slotTwo.slotLineageId);
  assert.notEqual(slotOne.exerciseDefinitionId, slotTwo.exerciseDefinitionId);
  assert.equal(slotOne.programmeVersionId, versionOne.id);
  assert.equal(slotTwo.programmeVersionId, versionTwo.id);
  assert.equal(Object.isFrozen(versionOne), true);
});

test("exact verified aliases can distinguish names that share a normalised search key", () => {
  const aliases = [
    {
      id: "alias_01J000000000000000001",
      sourceNamespace: "v21.1.exercise-name",
      exactValue: "Bench-Press",
      normalizedSearchKey: normalizedLegacyName("Bench-Press"),
      exerciseDefinitionId: exerciseDefinitions[0].id,
      verificationStatus: "verified"
    },
    {
      id: "alias_01J000000000000000002",
      sourceNamespace: "v21.1.exercise-name",
      exactValue: "Bench Press",
      normalizedSearchKey: normalizedLegacyName("Bench Press"),
      exerciseDefinitionId: exerciseDefinitions[1].id,
      verificationStatus: "verified"
    }
  ];

  assert.equal(aliases[0].normalizedSearchKey, aliases[1].normalizedSearchKey);
  assert.equal(resolveExactVerifiedAlias(aliases, "v21.1.exercise-name", "Bench-Press").exerciseDefinitionId, exerciseDefinitions[0].id);
  assert.equal(resolveExactVerifiedAlias(aliases, "v21.1.exercise-name", "Bench Press").exerciseDefinitionId, exerciseDefinitions[1].id);
  assert.equal(resolveExactVerifiedAlias(aliases, "other-source", "Bench Press"), null);
  assert.equal(resolveExactVerifiedAlias(aliases, "v21.1.exercise-name", "bench press"), null);
});

test("a colliding name-derived legacy configuration remains unresolved", () => {
  const rawPreference = {
    id: "legacy:gym-comeback-ex-config-v1-1-bench-press",
    legacyKey: "gym-comeback-ex-config-v1-1-bench-press",
    legacyRawValue: "{\"setCount\":4,\"progressionFocus\":\"reps\"}",
    identityStatus: "unresolved",
    exerciseDefinitionId: null
  };
  const candidates = [
    { exactName: "Bench-Press", exerciseDefinitionId: exerciseDefinitions[0].id },
    { exactName: "Bench Press", exerciseDefinitionId: exerciseDefinitions[1].id }
  ];
  assert.equal(normalizedLegacyName(candidates[0].exactName), normalizedLegacyName(candidates[1].exactName));
  assert.equal(rawPreference.exerciseDefinitionId, null);
  assert.equal(rawPreference.identityStatus, "unresolved");
  assert.equal(rawPreference.legacyRawValue, "{\"setCount\":4,\"progressionFocus\":\"reps\"}");
});

test("unresolved historical records retain exact names and raw values and do not merge by name", () => {
  const first = {
    id: "gym-session-a-exercise-1",
    name: "  RDL (DB)  ",
    legacyRawValue: "{\"name\":\"  RDL (DB)  \",\"sets\":[{\"weight\":\"42.5\",\"reps\":\"8\"}]}",
    identityStatus: "unresolved",
    exerciseDefinitionId: null,
    exerciseVariationId: null
  };
  const second = { ...first, id: "gym-session-b-exercise-1" };
  assert.equal(first.name, "  RDL (DB)  ");
  assert.equal(first.legacyRawValue.includes("\"weight\":\"42.5\""), true);
  assert.notEqual(historyIdentity(first), historyIdentity(second));
  assert.equal(first.exerciseDefinitionId, null);
  assert.equal(first.exerciseVariationId, null);
});

test("reusable configuration identity is profile, definition, variation and equipment scoped", () => {
  const base = {
    profileId: "profile-owner-1",
    exerciseDefinitionId: exerciseDefinitions[0].id,
    exerciseVariationId: null,
    equipmentDefinitionId: null,
    settings: { setCount: 3, progressionFocus: "reps" }
  };
  const otherDefinition = { ...base, exerciseDefinitionId: exerciseDefinitions[1].id };
  const variationSpecific = { ...base, exerciseVariationId: variations[0].id };
  const equipmentSpecific = { ...base, equipmentDefinitionId: equipmentDefinitions[0].id };
  const otherProfile = { ...base, profileId: "profile-owner-2" };

  const keys = [base, otherDefinition, variationSpecific, equipmentSpecific, otherProfile].map(configurationIdentity);
  assert.equal(new Set(keys).size, keys.length);
  assert.notEqual(base.settings, { reps: 8 }, "configuration defaults are not performed set results");
});

test("performed exercise identity remains separate from canonical definition identity", () => {
  const performedA = {
    id: "gym-session-a-exercise-1",
    sessionId: "gym-session-a",
    name: "Dumbbell Romanian Deadlift",
    exerciseDefinitionId: exerciseDefinitions[0].id,
    identityStatus: "verified"
  };
  const performedB = {
    id: "gym-session-b-exercise-1",
    sessionId: "gym-session-b",
    name: "Dumbbell Romanian Deadlift",
    exerciseDefinitionId: exerciseDefinitions[0].id,
    identityStatus: "verified"
  };
  assert.notEqual(performedA.id, performedB.id);
  assert.equal(historyIdentity(performedA), historyIdentity(performedB));
  assert.notEqual(performedA.id, performedA.exerciseDefinitionId);
});


// Decision review contracts: these fixtures express the recommended model;
// they are not production services and do not imply that V21.2 implements it.

const variationDimensions = Object.freeze([
  "implement",
  "grip",
  "stance",
  "laterality",
  "rangeOfMotion"
]);
const prescriptionOnlyDimensions = Object.freeze([
  "load",
  "reps",
  "sets",
  "restSeconds",
  "tempo",
  "effort"
]);

function applyCatalogueRelease(existingSystem, release) {
  const incoming = new Map(release.definitions.map(item => [item.id, item]));
  const next = existingSystem.map(previous => {
    const updated = incoming.get(previous.id);
    if (!updated) return { ...previous, status: "retired" };
    incoming.delete(previous.id);
    return updated;
  });
  return next.concat([...incoming.values()]);
}

function validateLineageSnapshot(version) {
  const dayIds = new Set();
  const slotIds = new Set();
  const lineages = new Set();
  for (const day of version.days) {
    if (dayIds.has(day.id)) return false;
    dayIds.add(day.id);
    for (const slot of day.slots) {
      if (slotIds.has(slot.id) || lineages.has(slot.slotLineageId)) return false;
      if (slot.programmeVersionId !== version.id || slot.programmeDayId !== day.id) return false;
      slotIds.add(slot.id);
      lineages.add(slot.slotLineageId);
    }
  }
  return true;
}

test("variation taxonomy distinguishes curated execution variants from prescription settings", () => {
  assert.deepEqual([...variationDimensions], [
    "implement", "grip", "stance", "laterality", "rangeOfMotion"
  ]);
  assert.ok(prescriptionOnlyDimensions.every(item => !variationDimensions.includes(item)));
  const explicitVariations = [
    { id: "exv_barbell", attributes: { implement: "barbell" } },
    { id: "exv_dumbbell", attributes: { implement: "dumbbell" } },
    { id: "exv_single_leg", attributes: { laterality: "unilateral" } }
  ];
  assert.equal(new Set(explicitVariations.map(item => item.id)).size, explicitVariations.length);
  assert.equal(explicitVariations.length, 3, "only curated variations exist; no Cartesian product is generated");
});

test("materially different movement mechanics receive separate exercise definitions", () => {
  const definitions = [
    { id: "exd_rdl", movementPattern: "hip-hinge", canonicalName: "Romanian deadlift" },
    { id: "exd_conventional_deadlift", movementPattern: "floor-pull", canonicalName: "Conventional deadlift" },
    { id: "exd_machine_chest_press", movementPattern: "machine-horizontal-press", canonicalName: "Machine chest press" }
  ];
  assert.equal(new Set(definitions.map(item => item.id)).size, definitions.length);
  assert.notEqual(definitions[0].id, definitions[1].id);
  assert.notEqual(definitions[0].movementPattern, definitions[1].movementPattern);
  assert.ok(definitions.every(item => item.id.startsWith("exd_")));
});

test("system catalogue release is versioned bundled authority with a local IndexedDB materialisation", () => {
  const release = Object.freeze({
    releaseId: "system-catalogue-2026.11.1",
    version: 1,
    checksum: "sha256:0123456789abcdef",
    source: "bundled-versioned-local-asset",
    definitions: [{ id: "exd_catalogue_001", kind: "system", canonicalName: "Goblet squat" }]
  });
  const indexedDbMaterialisation = {
    releaseId: release.releaseId,
    checksum: release.checksum,
    status: "materialised"
  };
  assert.equal(release.source, "bundled-versioned-local-asset");
  assert.equal(indexedDbMaterialisation.releaseId, release.releaseId);
  assert.equal(indexedDbMaterialisation.checksum, release.checksum);
  assert.equal(release.definitions[0].kind, "system");
});

test("catalogue refresh retires removed system IDs and never overwrites custom records or user aliases", () => {
  const existingSystem = [
    { id: "exd_system_a", kind: "system", canonicalName: "Old label", status: "active" },
    { id: "exd_system_retired", kind: "system", canonicalName: "Retired movement", status: "active" }
  ];
  const customDefinitions = [
    { id: "exd_custom_owner_1", kind: "custom", canonicalName: "My variation" }
  ];
  const aliases = [
    { id: "alias_owner_1", exactValue: "My old name", exerciseDefinitionId: "exd_custom_owner_1", verificationStatus: "verified" }
  ];
  const release = {
    releaseId: "system-catalogue-2026.12.1",
    definitions: [{ id: "exd_system_a", kind: "system", canonicalName: "Updated label", status: "active" }]
  };
  const refreshedSystem = applyCatalogueRelease(existingSystem, release);
  assert.equal(refreshedSystem.find(item => item.id === "exd_system_a").canonicalName, "Updated label");
  assert.equal(refreshedSystem.find(item => item.id === "exd_system_retired").status, "retired");
  assert.deepEqual(customDefinitions, [
    { id: "exd_custom_owner_1", kind: "custom", canonicalName: "My variation" }
  ]);
  assert.equal(aliases[0].verificationStatus, "verified");
  assert.equal(aliases[0].exerciseDefinitionId, "exd_custom_owner_1");
});

test("published programme versions use separate version-scoped day and slot IDs with stable semantic lineage", () => {
  const versionOne = {
    id: "prv_programme_1",
    versionNumber: 1,
    days: [{
      id: "pdy_v1_day_a",
      programmeVersionId: "prv_programme_1",
      dayLineageId: "daylineage_upper",
      label: "Upper body",
      slots: [
        { id: "psl_v1_a", programmeVersionId: "prv_programme_1", programmeDayId: "pdy_v1_day_a", slotLineageId: "slotlineage_press", exerciseDefinitionId: "exd_press", order: 1 },
        { id: "psl_v1_b", programmeVersionId: "prv_programme_1", programmeDayId: "pdy_v1_day_a", slotLineageId: "slotlineage_row", exerciseDefinitionId: "exd_row", order: 2 }
      ]
    }]
  };
  const versionTwo = {
    id: "prv_programme_2",
    versionNumber: 2,
    basedOnVersionId: versionOne.id,
    days: [{
      id: "pdy_v2_day_a",
      programmeVersionId: "prv_programme_2",
      dayLineageId: "daylineage_upper",
      label: "Upper strength",
      slots: [
        { id: "psl_v2_b", programmeVersionId: "prv_programme_2", programmeDayId: "pdy_v2_day_a", slotLineageId: "slotlineage_row", exerciseDefinitionId: "exd_row", order: 1 },
        { id: "psl_v2_a", programmeVersionId: "prv_programme_2", programmeDayId: "pdy_v2_day_a", slotLineageId: "slotlineage_press", exerciseDefinitionId: "exd_incline_press", order: 2 }
      ]
    }]
  };
  assert.equal(validateLineageSnapshot(versionOne), true);
  assert.equal(validateLineageSnapshot(versionTwo), true);
  assert.notEqual(versionOne.days[0].id, versionTwo.days[0].id);
  assert.equal(versionOne.days[0].dayLineageId, versionTwo.days[0].dayLineageId);
  const oldPress = versionOne.days[0].slots[0];
  const newPress = versionTwo.days[0].slots[1];
  assert.notEqual(oldPress.id, newPress.id);
  assert.equal(oldPress.slotLineageId, newPress.slotLineageId);
  assert.notEqual(oldPress.exerciseDefinitionId, newPress.exerciseDefinitionId);
  assert.notEqual(oldPress.order, newPress.order, "reordering does not change logical slot lineage");
});

test("split or merged programme slots receive new lineages with explicit predecessor links", () => {
  const oldLineage = "slotlineage_compound";
  const splitSlots = [
    { slotLineageId: "slotlineage_split_a", supersedesSlotLineageIds: [oldLineage] },
    { slotLineageId: "slotlineage_split_b", supersedesSlotLineageIds: [oldLineage] }
  ];
  const mergedSlot = {
    slotLineageId: "slotlineage_merged",
    supersedesSlotLineageIds: ["slotlineage_split_a", "slotlineage_split_b"]
  };
  assert.ok(splitSlots.every(slot => slot.slotLineageId !== oldLineage));
  assert.ok(splitSlots.every(slot => slot.supersedesSlotLineageIds.includes(oldLineage)));
  assert.deepEqual(mergedSlot.supersedesSlotLineageIds, splitSlots.map(slot => slot.slotLineageId));
  assert.notEqual(mergedSlot.slotLineageId, oldLineage);
});

test("performed session snapshots pin the exact programme version, slot and labels used", () => {
  const performed = Object.freeze({
    id: "gym-session-77-exercise-1",
    programmeVersionId: "prv_programme_1",
    programmeSlotId: "psl_v1_a",
    exerciseDefinitionId: "exd_press",
    exerciseVariationId: "exv_barbell",
    exerciseNameSnapshot: "Flat bench press",
    variationNameSnapshot: "Barbell",
    prescriptionSnapshot: Object.freeze({ sets: 3, repTarget: "8-10" })
  });
  const laterProgrammeEdit = {
    programmeVersionId: "prv_programme_2",
    programmeSlotId: "psl_v2_a",
    exerciseDefinitionId: "exd_incline_press"
  };
  assert.equal(performed.programmeVersionId, "prv_programme_1");
  assert.equal(performed.programmeSlotId, "psl_v1_a");
  assert.equal(performed.exerciseNameSnapshot, "Flat bench press");
  assert.notEqual(performed.programmeVersionId, laterProgrammeEdit.programmeVersionId);
  assert.notEqual(performed.exerciseDefinitionId, laterProgrammeEdit.exerciseDefinitionId);
});



// Decision contracts: append-only review history, release retention/snapshots,
// and a strict boundary between reusable preferences and prescriptions/results.
// These remain fixtures, not production persistence services.

function appendReviewEvent(events, candidate) {
  const duplicate = events.find(event =>
    event.profileId === candidate.profileId &&
    event.idempotencyKey === candidate.idempotencyKey
  );
  if (duplicate) return { event: duplicate, appended: false };
  const event = Object.freeze({ ...candidate });
  events.push(event);
  return { event, appended: true };
}

function referencedCatalogueReleases({ programmeVersions, sessions, reviewEvents }) {
  const refs = new Set();
  for (const version of programmeVersions) {
    if (version.status === "published" && version.catalogueReleaseId) refs.add(version.catalogueReleaseId);
  }
  for (const session of sessions) {
    if (session.catalogueReleaseId && (session.status === "active" || session.status === "completed")) {
      refs.add(session.catalogueReleaseId);
    }
  }
  for (const event of reviewEvents) {
    if (event.catalogueReleaseId) refs.add(event.catalogueReleaseId);
  }
  return refs;
}

const reusableConfigurationFields = Object.freeze([
  "preferredProgressionFocus",
  "recordingModeOverride"
]);
const progressionFocusValues = ["reps", "weight", "duration", "sets", "balanced", "manual"];
const recordingModeValues = ["reps", "timed-hold", "timed-reps"];

function validateReusableConfiguration(record, supportedRecordingModes) {
  if (!record.profileId || !record.exerciseDefinitionId) return false;
  const keys = Object.keys(record.settings || {});
  if (keys.some(key => !reusableConfigurationFields.includes(key))) return false;
  const settings = record.settings || {};
  if (settings.preferredProgressionFocus &&
      !progressionFocusValues.includes(settings.preferredProgressionFocus)) return false;
  if (settings.recordingModeOverride &&
      (!recordingModeValues.includes(settings.recordingModeOverride) ||
       !supportedRecordingModes.includes(settings.recordingModeOverride))) return false;
  return true;
}

function renderHistoricalDisplay(displaySnapshot, currentDefinition) {
  return displaySnapshot || { canonicalName: currentDefinition.canonicalName };
}

test("identity review decisions append events and corrections never rewrite earlier evidence", () => {
  const events = [];
  const verified = appendReviewEvent(events, {
    id: "irev_01J000000000000000001",
    eventSchemaVersion: 1,
    profileId: "profile-a",
    subjectType: "exerciseRecord",
    subjectId: "session-a-exercise-1",
    sourceNamespace: "v21.1.exercise-name",
    sourceExactValue: "  Bench-Press  ",
    previousMapping: null,
    proposedMapping: { exerciseDefinitionId: "exd_press", exerciseVariationId: null },
    outcome: "verified",
    reviewerId: "profile-a",
    reviewedAt: "2026-11-17T10:00:00Z",
    evidence: { type: "explicit-user-confirmation" },
    catalogueReleaseId: "catalogue-1",
    idempotencyKey: "review-session-a-exercise-1-v1"
  });
  const correction = appendReviewEvent(events, {
    id: "irev_01J000000000000000002",
    eventSchemaVersion: 1,
    profileId: "profile-a",
    subjectType: "exerciseRecord",
    subjectId: "session-a-exercise-1",
    sourceNamespace: "v21.1.exercise-name",
    sourceExactValue: "  Bench-Press  ",
    previousMapping: verified.event.proposedMapping,
    proposedMapping: { exerciseDefinitionId: "exd_incline_press", exerciseVariationId: null },
    outcome: "reversed",
    reviewerId: "profile-a",
    reviewedAt: "2026-11-18T10:00:00Z",
    evidence: { type: "corrected-explicit-review" },
    catalogueReleaseId: "catalogue-2",
    idempotencyKey: "review-session-a-exercise-1-correction-v1",
    reversesEventId: verified.event.id
  });
  assert.equal(verified.appended, true);
  assert.equal(correction.appended, true);
  assert.equal(events.length, 2);
  assert.equal(events[0].proposedMapping.exerciseDefinitionId, "exd_press");
  assert.equal(events[0].sourceExactValue, "  Bench-Press  ");
  assert.equal(events[1].reversesEventId, events[0].id);
  assert.equal(events[1].previousMapping.exerciseDefinitionId, "exd_press");
  assert.equal(events[1].proposedMapping.exerciseDefinitionId, "exd_incline_press");
  assert.equal(Object.isFrozen(events[0]), true);
});

test("review event retries are idempotent within a profile but independent across profiles", () => {
  const events = [];
  const first = {
    id: "irev_profile_a",
    profileId: "profile-a",
    idempotencyKey: "review-123",
    subjectId: "record-a",
    outcome: "verified"
  };
  const original = appendReviewEvent(events, first);
  const retry = appendReviewEvent(events, { ...first, id: "irev_retry_duplicate" });
  const otherProfile = appendReviewEvent(events, {
    ...first,
    id: "irev_profile_b",
    profileId: "profile-b"
  });
  assert.equal(original.appended, true);
  assert.equal(retry.appended, false);
  assert.equal(retry.event.id, "irev_profile_a");
  assert.equal(otherProfile.appended, true);
  assert.equal(events.length, 2);
});

test("review events preserve exact source evidence, mapping transition and release provenance", () => {
  const event = {
    id: "irev_evidence",
    profileId: "profile-a",
    sourceNamespace: "legacy.exercise-config",
    sourceExactValue: "gym-comeback-ex-config-v1-2-bench-press",
    sourceRawValue: "{ \"setCount\": 4, \"focus\": \"weight\" }",
    previousMapping: null,
    proposedMapping: null,
    outcome: "ambiguous",
    evidence: { candidateIds: ["exd_press", "exd_incline_press"] },
    catalogueReleaseId: "catalogue-2026.11.1",
    idempotencyKey: "legacy-config-review-1"
  };
  assert.equal(event.sourceExactValue, "gym-comeback-ex-config-v1-2-bench-press");
  assert.equal(event.sourceRawValue, "{ \"setCount\": 4, \"focus\": \"weight\" }");
  assert.equal(event.outcome, "ambiguous");
  assert.equal(event.proposedMapping, null);
  assert.equal(event.catalogueReleaseId, "catalogue-2026.11.1");
  assert.deepEqual(event.evidence.candidateIds, ["exd_press", "exd_incline_press"]);
});

test("catalogue release retention follows published programmes, retained sessions and audit references", () => {
  const refs = referencedCatalogueReleases({
    programmeVersions: [
      { status: "published", catalogueReleaseId: "release-1" },
      { status: "draft", catalogueReleaseId: "release-draft" }
    ],
    sessions: [
      { status: "completed", catalogueReleaseId: "release-2" },
      { status: "active", catalogueReleaseId: "release-3" },
      { status: "cancelled", catalogueReleaseId: "release-4" }
    ],
    reviewEvents: [
      { catalogueReleaseId: "release-5" },
      { catalogueReleaseId: null }
    ]
  });
  assert.deepEqual([...refs].sort(), ["release-1", "release-2", "release-3", "release-5"]);
  assert.equal(refs.has("release-draft"), false);
  assert.equal(refs.has("release-4"), false);
});

test("historical display uses immutable snapshots after catalogue rename or retirement", () => {
  const snapshot = Object.freeze({
    snapshotSchemaVersion: 1,
    locale: "en-AU",
    canonicalName: "Dumbbell Romanian Deadlift",
    variationName: "B-stance",
    equipmentLabels: ["Dumbbell"],
    shortCue: "Hinge at the hips"
  });
  const currentCatalogueDefinition = {
    canonicalName: "DB Hip Hinge",
    status: "retired"
  };
  const display = renderHistoricalDisplay(snapshot, currentCatalogueDefinition);
  assert.equal(display.canonicalName, "Dumbbell Romanian Deadlift");
  assert.equal(display.variationName, "B-stance");
  assert.deepEqual(display.equipmentLabels, ["Dumbbell"]);
  assert.equal(display.shortCue, "Hinge at the hips");
  assert.equal(currentCatalogueDefinition.canonicalName, "DB Hip Hinge");
});

test("backup snapshots contain enough historical labels without requiring the old release asset", () => {
  const backupRecord = {
    exerciseDefinitionId: "exd_rdl",
    exerciseVariationId: "exv_bstance",
    catalogueReleaseId: "catalogue-old",
    canonicalDisplaySnapshot: {
      snapshotSchemaVersion: 1,
      canonicalName: "Dumbbell Romanian Deadlift",
      variationName: "B-stance",
      equipmentLabels: ["Dumbbell"],
      locale: "en-AU"
    },
    name: "  RDL (DB)  ",
    legacyRawValue: "{\"name\":\"  RDL (DB)  \"}"
  };
  const unavailableReleaseAssets = new Set(["catalogue-current"]);
  assert.equal(unavailableReleaseAssets.has(backupRecord.catalogueReleaseId), false);
  assert.equal(backupRecord.canonicalDisplaySnapshot.canonicalName, "Dumbbell Romanian Deadlift");
  assert.equal(backupRecord.name, "  RDL (DB)  ");
  assert.equal(backupRecord.legacyRawValue, "{\"name\":\"  RDL (DB)  \"}");
});

test("reusable configuration accepts only personal preferences supported by the exercise", () => {
  const valid = {
    id: "exc_profile_a_rdl",
    profileId: "profile-a",
    exerciseDefinitionId: "exd_rdl",
    exerciseVariationId: "exv_bstance",
    equipmentDefinitionId: "eqd_dumbbell",
    settings: {
      preferredProgressionFocus: "reps",
      recordingModeOverride: "reps"
    }
  };
  assert.equal(validateReusableConfiguration(valid, ["reps", "timed-reps"]), true);
  assert.equal(validateReusableConfiguration({
    ...valid,
    settings: { recordingModeOverride: "timed-hold" }
  }, ["reps", "timed-reps"]), false);
  assert.equal(validateReusableConfiguration({
    ...valid,
    settings: { preferredProgressionFocus: "random" }
  }, ["reps"]), false);
});

test("set count, targets, rest, tempo and effort are programme prescriptions, not reusable defaults", () => {
  const programmePrescription = {
    programmeSlotId: "psl_v1",
    setCount: 4,
    repTarget: "8-10",
    durationTargetSeconds: null,
    restSeconds: 90,
    tempo: "3-1-1",
    effortTarget: { type: "RIR", value: 2 },
    progressionFocus: "weight"
  };
  const reusable = {
    profileId: "profile-a",
    exerciseDefinitionId: "exd_rdl",
    settings: { preferredProgressionFocus: "reps" }
  };
  const performed = {
    sets: [{ weight: "42.5", reps: "9", duration: "", rir: "2" }],
    response: "same"
  };
  assert.equal(Object.hasOwn(reusable.settings, "setCount"), false);
  assert.equal(Object.hasOwn(reusable.settings, "restSeconds"), false);
  assert.equal(Object.hasOwn(reusable.settings, "tempo"), false);
  assert.equal(programmePrescription.setCount, 4);
  assert.equal(programmePrescription.restSeconds, 90);
  assert.equal(performed.sets[0].weight, "42.5");
  assert.equal(performed.sets[0].reps, "9");
  assert.equal(performed.sets[0].duration, "");
  assert.equal(performed.response, "same");
});

test("configuration identity is isolated by profile, definition, variation and equipment context", () => {
  const base = {
    profileId: "profile-a",
    exerciseDefinitionId: "exd_rdl",
    exerciseVariationId: null,
    equipmentDefinitionId: null
  };
  const scopes = [
    base,
    { ...base, profileId: "profile-b" },
    { ...base, exerciseDefinitionId: "exd_deadlift" },
    { ...base, exerciseVariationId: "exv_bstance" },
    { ...base, equipmentDefinitionId: "eqd_dumbbell" }
  ];
  const keys = scopes.map(item => JSON.stringify([
    item.profileId, item.exerciseDefinitionId,
    item.exerciseVariationId || null, item.equipmentDefinitionId || null
  ]));
  assert.equal(new Set(keys).size, scopes.length);
});

test("legacy day-scoped name-derived configuration stays unresolved and preserves exact key and raw value", () => {
  const legacy = {
    key: "gym-comeback-ex-config-v1-2-bench-press",
    rawValue: "{\"setCount\":4,\"focus\":\"weight\",\"recordingMode\":\"reps\"}",
    identityStatus: "unresolved",
    profileId: null,
    exerciseDefinitionId: null,
    programmeSlotId: null
  };
  const afterReviewOfExerciseNameAlone = { ...legacy };
  assert.equal(afterReviewOfExerciseNameAlone.key, legacy.key);
  assert.equal(afterReviewOfExerciseNameAlone.rawValue, legacy.rawValue);
  assert.equal(afterReviewOfExerciseNameAlone.identityStatus, "unresolved");
  assert.equal(afterReviewOfExerciseNameAlone.profileId, null);
  assert.equal(afterReviewOfExerciseNameAlone.programmeSlotId, null);
  assert.equal(afterReviewOfExerciseNameAlone.exerciseDefinitionId, null);
});

