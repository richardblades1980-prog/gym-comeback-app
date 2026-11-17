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
