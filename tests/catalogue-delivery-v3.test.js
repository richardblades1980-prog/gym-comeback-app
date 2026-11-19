"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { indexedDB } = require("fake-indexeddb");

const root = path.join(__dirname, "..");
const deliverySource = fs.readFileSync(path.join(root, "src/data/catalogue-delivery.js"), "utf8");
const V2_VOCABULARY_KEYS = [
  "bodyRegions", "muscles", "jointActions", "movementPatterns", "bodyPositions",
  "supportPoints", "stabilisationDemands", "balanceDemands", "footContactDemands",
  "footPressureDemands", "weightBearingDemands", "impactDemands", "propulsionDemands",
  "bracingDemands", "equipmentFamilies", "equipmentLoadingSystems",
  "equipmentMovementMechanics", "equipmentOrientations", "equipmentSetupAttributes"
];
const V2_COVERAGE_ARRAYS = [
  "primaryInvolvement", "secondaryInvolvement", "otherRelevantInvolvement",
  "jointActionIds", "movementPatternIds", "bodyPositionIds", "supportPointIds",
  "stabilisationDemandIds", "balanceDemandIds", "footContactDemandIds",
  "footPressureDemandIds", "weightBearingDemandIds", "impactDemandIds",
  "propulsionDemandIds", "setupBracingDemandIds", "equipmentConfigurationConstraints"
];

function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}
function sha256(value) {
  return "sha256:" + crypto.createHash("sha256").update(value).digest("hex");
}
function bindReview(target, id) {
  const copy = JSON.parse(JSON.stringify(target));
  return Object.assign(copy, {
    reviewBinding: {
      targetDigest: sha256(stableJson(target)),
      reviewRecordId: "review-" + id,
      reviewerScopeId: "test-only-qualified-review-scope",
      decision: "approved",
      evidenceRefs: ["test-only:source-evidence:" + id]
    }
  });
}
function countVocabulary(vocab) {
  return V2_VOCABULARY_KEYS.reduce((count, key) => count + (Array.isArray(vocab[key]) ? vocab[key].length : 0), 0);
}
function makeVocabulary() {
  const vocab = { version: 1 };
  V2_VOCABULARY_KEYS.forEach(key => { vocab[key] = []; });
  vocab.bodyRegions = [{ id: "body-upper", label: "Upper body (test fixture)" }];
  vocab.muscles = [{ id: "muscle-chest", label: "Chest (test fixture)" }];
  vocab.jointActions = [{ id: "joint-press", label: "Press action (test fixture)" }];
  vocab.movementPatterns = [{ id: "movement-horizontal-press", label: "Horizontal press (test fixture)" }];
  vocab.bodyPositions = [{ id: "position-seated", label: "Seated (test fixture)" }];
  vocab.supportPoints = [{ id: "support-back-pad", label: "Back pad (test fixture)" }];
  vocab.stabilisationDemands = [{ id: "stabilisation-trunk", label: "Trunk stabilisation (test fixture)" }];
  vocab.balanceDemands = [{ id: "balance-supported", label: "Supported balance (test fixture)" }];
  vocab.footContactDemands = [{ id: "foot-contact-floor", label: "Foot contact with floor (test fixture)" }];
  vocab.footPressureDemands = [{ id: "foot-pressure-low", label: "Foot pressure descriptor (test fixture)" }];
  vocab.weightBearingDemands = [{ id: "weight-bearing-seated", label: "Seated weight-bearing descriptor (test fixture)" }];
  vocab.impactDemands = [{ id: "impact-none-reviewed", label: "No impact identified in this reviewed fixture" }];
  vocab.propulsionDemands = [{ id: "propulsion-none-reviewed", label: "No propulsion identified in this reviewed fixture" }];
  vocab.bracingDemands = [{ id: "bracing-seated", label: "Seated setup bracing (test fixture)" }];
  vocab.equipmentFamilies = [
    { id: "family-machine", label: "Machine (test fixture)" },
    { id: "family-free-weights", label: "Free weights (test fixture)" },
    { id: "family-bench", label: "Bench (test fixture)" }
  ];
  vocab.equipmentLoadingSystems = [
    { id: "loading-pin-selected", label: "Selectorised / pin-selected (test fixture)" },
    { id: "loading-free-weight", label: "Free weight (test fixture)" }
  ];
  vocab.equipmentMovementMechanics = [{ id: "mechanics-fixed-path", label: "Fixed path (test fixture)" }];
  vocab.equipmentOrientations = [{ id: "orientation-horizontal", label: "Horizontal (test fixture)" }];
  vocab.equipmentSetupAttributes = [{ id: "setup-adjustable", label: "Adjustable setup (test fixture)" }];
  return vocab;
}
function makeEquipmentDefinition({id, name, familyId, loadingSystemIds = [], setupAttributeIds = [], index = 1}) {
  return bindReview({
    id, canonicalName: name, familyId, reviewStatus: "approved",
    loadingSystemIds, movementMechanicIds: id === "equipment-fixture-machine" ? ["mechanics-fixed-path"] : [],
    orientationIds: id === "equipment-fixture-machine" ? ["orientation-horizontal"] : [],
    setupAttributeIds, sourceRefs: ["test-only:equipment-source:" + index]
  }, "equipment-" + index);
}
function makeEquipmentRequirements(status, equipmentIds = []) {
  if (status === "incomplete") return { reviewStatus: "incomplete", groups: [] };
  const groups = status === "reviewed-none" ? [] : [{
    id: "group-main-equipment",
    alternatives: [
      {
        equipmentDefinitionIds: [equipmentIds[0]],
        configurationConstraints: [{
          equipmentDefinitionId: equipmentIds[0],
          attribute: "loadingSystemIds",
          valueId: "loading-pin-selected"
        }]
      },
      {
        equipmentDefinitionIds: [equipmentIds[1], equipmentIds[2]],
        configurationConstraints: [{
          equipmentDefinitionId: equipmentIds[2],
          attribute: "setupAttributeIds",
          valueId: "setup-adjustable"
        }]
      }
    ]
  }];
  return bindReview({ reviewStatus: status, groups }, "requirements-" + status);
}
function makeMovementDemandProfile(status = "complete") {
  if (status === "incomplete") return { reviewStatus: "incomplete", coverage: {} };
  const coverage = Object.fromEntries(V2_COVERAGE_ARRAYS.map(key => [key, []]));
  coverage.primaryInvolvement = [{ bodyRegionIds: ["body-upper"], muscleIds: ["muscle-chest"] }];
  coverage.jointActionIds = ["joint-press"];
  coverage.movementPatternIds = ["movement-horizontal-press"];
  coverage.bodyPositionIds = ["position-seated"];
  coverage.supportPointIds = ["support-back-pad"];
  coverage.stabilisationDemandIds = ["stabilisation-trunk"];
  coverage.balanceDemandIds = ["balance-supported"];
  coverage.footContactDemandIds = ["foot-contact-floor"];
  coverage.footPressureDemandIds = ["foot-pressure-low"];
  coverage.weightBearingDemandIds = ["weight-bearing-seated"];
  coverage.impactDemandIds = ["impact-none-reviewed"];
  coverage.propulsionDemandIds = ["propulsion-none-reviewed"];
  coverage.setupBracingDemandIds = ["bracing-seated"];
  return bindReview({ reviewStatus: "complete", coverage }, "movement-demand");
}
function makeV2Payload(releaseId = "fixture-v2", version = 2) {
  const controlledVocabularies = makeVocabulary();
  const equipmentDefinitions = [
    makeEquipmentDefinition({
      id: "equipment-fixture-machine", name: "Fixture Selectorised Machine",
      familyId: "family-machine", loadingSystemIds: ["loading-pin-selected"], index: 1
    }),
    makeEquipmentDefinition({
      id: "equipment-fixture-dumbbells", name: "Fixture Dumbbell Set",
      familyId: "family-free-weights", loadingSystemIds: ["loading-free-weight"], index: 2
    }),
    makeEquipmentDefinition({
      id: "equipment-fixture-bench", name: "Fixture Adjustable Bench",
      familyId: "family-bench", setupAttributeIds: ["setup-adjustable"], index: 3
    })
  ];
  const definitions = [
    {
      id: "exercise-fixture-press", kind: "system", canonicalName: "Fixture Press",
      equipmentRequirements: makeEquipmentRequirements("reviewed-required", equipmentDefinitions.map(item => item.id)),
      movementDemandProfile: makeMovementDemandProfile("complete")
    },
    {
      id: "exercise-fixture-no-equipment", kind: "system", canonicalName: "Fixture No Equipment Movement",
      equipmentRequirements: makeEquipmentRequirements("reviewed-none"),
      movementDemandProfile: makeMovementDemandProfile("complete")
    },
    {
      id: "exercise-fixture-incomplete", kind: "system", canonicalName: "Fixture Incomplete Review",
      equipmentRequirements: makeEquipmentRequirements("incomplete"),
      movementDemandProfile: makeMovementDemandProfile("incomplete")
    }
  ];
  const variations = [{
    id: "variation-fixture-press-seated", exerciseDefinitionId: "exercise-fixture-press",
    name: "Seated fixture variation",
    equipmentRequirements: makeEquipmentRequirements("reviewed-required", equipmentDefinitions.map(item => item.id)),
    movementDemandProfile: makeMovementDemandProfile("complete")
  }];
  return {
    catalogueId: "exercise-catalogue", releaseId, version, schemaVersion: 2,
    definitions, variations, equipmentDefinitions,
    controlledVocabularies,
    controlledVocabulariesReviewBinding: {
      targetDigest: sha256(stableJson(controlledVocabularies)),
      reviewRecordId: "review-controlled-vocabularies-fixture",
      reviewerScopeId: "test-only-vocabulary-review-scope",
      decision: "approved",
      evidenceRefs: ["test-only:controlled-vocabulary-source"]
    }
  };
}
function makeV1Payload(releaseId = "fixture-v1", version = 1) {
  return {
    catalogueId: "exercise-catalogue", releaseId, version, schemaVersion: 1,
    definitions: [{ id: "exercise-v1-fixture", kind: "system", canonicalName: "V1 Fixture Exercise" }],
    variations: []
  };
}
function makeManifest(payload) {
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const checksum = sha256(bytes);
  const manifest = {
    id: payload.releaseId, catalogueId: payload.catalogueId, releaseId: payload.releaseId,
    version: payload.version, schemaVersion: payload.schemaVersion,
    checksum, byteLength: bytes.length, contentType: "application/json",
    assetUrl: "./catalogues/exercise/" + payload.releaseId + "/" + checksum.slice(7) + ".json",
    entryCount: payload.definitions.length, variationCount: payload.variations.length
  };
  if (payload.schemaVersion >= 2) {
    manifest.equipmentDefinitionCount = payload.equipmentDefinitions.length;
    manifest.vocabularyEntryCount = countVocabulary(payload.controlledVocabularies);
  }
  if (payload.schemaVersion === 3) {
    manifest.descriptionCount = [payload.equipmentDefinitions, payload.definitions, payload.variations]
      .flat().filter(item => Object.prototype.hasOwnProperty.call(item, "description")).length;
  }
  return { manifest, bytes };
}

function bindDescription(subject, description, id) {
  subject.description = description;
  subject.descriptionReviewBinding = {
    targetDigest: sha256(stableJson({ id: subject.id, description })),
    reviewRecordId: "review-description-" + id,
    reviewerScopeId: "test-only-description-review-scope",
    decision: "approved",
    evidenceRefs: ["test-only:description-source:" + id]
  };
  return subject;
}
function makeV3Payload(releaseId = "fixture-v3", version = 3) {
  const payload = makeV2Payload(releaseId, version);
  payload.schemaVersion = 3;
  payload.descriptionLocale = "en-AU";
  bindDescription(payload.equipmentDefinitions[0], "A selectorised resistance machine for controlled strength exercises.", "equipment");
  bindDescription(payload.definitions[0], "A seated upper-body pressing exercise using supported resistance.", "exercise");
  bindDescription(payload.variations[0], "A seated setup that provides back support during the press.", "variation");
  return payload;
}

async function deleteDatabase() {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("ProjectComebackDB");
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error || new Error("Could not clear catalogue test database."));
    request.onblocked = () => reject(new Error("Catalogue test database deletion was blocked."));
  });
}
async function createRuntime() {
  await deleteDatabase();
  const cacheStore = new Map();
  const cacheInstances = new Map();
  const cacheApi = {
    async open(name) {
      if (!cacheStore.has(name)) cacheStore.set(name, new Map());
      const entries = cacheStore.get(name);
      const cache = {
        async match(url) {
          const response = entries.get(String(url));
          return response ? response.clone() : undefined;
        },
        async put(url, response) { entries.set(String(url), response.clone()); },
        async delete(url) { return entries.delete(String(url)); },
        async keys() { return [...entries.keys()]; }
      };
      cacheInstances.set(name, cache);
      return cache;
    },
    async keys() { return [...cacheStore.keys()]; }
  };
  const window = {
    indexedDB, crypto: crypto.webcrypto, caches: cacheApi,
    location: { href: "https://comeback.test/v21.2/" },
    fetch: async () => { throw new Error("test fixture is offline"); }
  };
  const context = {
    window, TextEncoder, TextDecoder, Uint8Array, URL, Response,
    console, setTimeout, clearTimeout
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "src/data/database.js"), "utf8"), context, { filename: "database.js" });
  vm.runInNewContext(fs.readFileSync(path.join(root, "src/data/backup.js"), "utf8"), context, { filename: "backup.js" });
  vm.runInNewContext(deliverySource, context, { filename: "catalogue-delivery.js" });
  const initialConnection = await window.ProjectComebackDB.open();
  assert.equal(initialConnection.version, 5);
  initialConnection.close();
  const safety = await window.ProjectComebackBackup.createLegacySafetyBackup();
  await window.ProjectComebackDB.upgradeToV6(safety);
  assert.equal(await window.ProjectComebackDB.getVersion(), 6, "the delivery v2 runtime must continue to use IndexedDB V6");
  return { window, caches: cacheApi, cacheStore, cacheInstances };
}
async function install(runtime, payload) {
  const { manifest, bytes } = makeManifest(payload);
  const result = await runtime.window.ProjectComebackCatalogueDelivery.installRelease(manifest, new Uint8Array(bytes));
  return { manifest, bytes, result };
}

test("v1 releases remain installable/readable and equipment lookup fails explicitly", async () => {
  const runtime = await createRuntime();
  const v1 = await install(runtime, makeV1Payload());
  assert.equal(v1.result.status, "active");
  const exercises = await runtime.window.ProjectComebackCatalogueDelivery.lookup("V1 Fixture");
  assert.equal(exercises.length, 1);
  assert.equal(exercises[0].canonicalName, "V1 Fixture Exercise");
  await assert.rejects(
    runtime.window.ProjectComebackCatalogueDelivery.lookupEquipment(""),
    /equipment definitions are unavailable for a schema v1 catalogue release/
  );
});

test("v2 installs, validates OR-of-AND requirements and looks up equipment offline from the exact release asset", async () => {
  const runtime = await createRuntime();
  const v1 = await install(runtime, makeV1Payload());
  const v2 = await install(runtime, makeV2Payload());
  assert.equal(v2.result.status, "active");
  assert.equal(v2.manifest.schemaVersion, 2);
  assert.equal((await runtime.window.ProjectComebackCatalogueDelivery.getStatus()).release.releaseId, "fixture-v2");

  const equipment = await runtime.window.ProjectComebackCatalogueDelivery.lookupEquipment("Fixture");
  assert.equal(equipment.length, 3);
  assert.deepEqual([...equipment].map(item => item.id).sort(), [
    "equipment-fixture-bench", "equipment-fixture-dumbbells", "equipment-fixture-machine"
  ]);
  assert.equal((await runtime.window.ProjectComebackCatalogueDelivery.lookupEquipment("machine"))[0].id, "equipment-fixture-machine");

  const exercises = await runtime.window.ProjectComebackCatalogueDelivery.lookup("Fixture Press");
  assert.equal(exercises.length, 1);
  assert.equal(exercises[0].equipmentRequirements.reviewStatus, "reviewed-required");
  assert.equal(exercises[0].equipmentRequirements.groups[0].alternatives.length, 2);
  assert.equal(exercises[0].movementDemandProfile.reviewStatus, "complete");
  const partial = await runtime.window.ProjectComebackCatalogueDelivery.lookup("Fixture Incomplete Review");
  assert.equal(partial[0].equipmentRequirements.reviewStatus, "incomplete");
  assert.equal(partial[0].movementDemandProfile.reviewStatus, "incomplete");

  const userEquipmentRows = await runtime.window.ProjectComebackDB.getAll("equipment");
  assert.equal(userEquipmentRows.length, 0, "system equipment definitions must not be written to the personal equipment store");

  const cachedResponse = [...runtime.cacheStore.values()][1];
  assert.ok(cachedResponse, "the v2 release must have a dedicated CacheStorage entry");
  assert.equal(v1.result.status, "active");
});

test("v2 rejects unknown equipment references before activation", async () => {
  const runtime = await createRuntime();
  const payload = makeV2Payload("fixture-v2-unknown", 2);
  const requirements = payload.definitions[0].equipmentRequirements;
  delete requirements.reviewBinding;
  requirements.groups[0].alternatives[0].equipmentDefinitionIds = ["equipment-does-not-exist"];
  requirements.groups[0].alternatives[0].configurationConstraints = [];
  payload.definitions[0].equipmentRequirements = bindReview(requirements, "unknown-equipment-refreshed");
  const { manifest, bytes } = makeManifest(payload);
  await assert.rejects(
    runtime.window.ProjectComebackCatalogueDelivery.installRelease(manifest, new Uint8Array(bytes)),
    /unknown equipment definition/
  );
  assert.equal((await runtime.window.ProjectComebackCatalogueDelivery.getStatus()).status, "unavailable");
});

test("v2 rejects ID collisions across equipment, exercise and variation record types", async () => {
  const runtime = await createRuntime();
  const payload = makeV2Payload("fixture-v2-collision", 2);
  const equipment = payload.equipmentDefinitions[0];
  delete equipment.reviewBinding;
  equipment.id = payload.definitions[0].id;
  payload.equipmentDefinitions[0] = bindReview(equipment, "collision-equipment");
  const { manifest, bytes } = makeManifest(payload);
  await assert.rejects(
    runtime.window.ProjectComebackCatalogueDelivery.installRelease(manifest, new Uint8Array(bytes)),
    /IDs must be unique across record types/
  );
});

test("v2 rejects stale review digests and incomplete complete-profile coverage", async () => {
  const runtime = await createRuntime();
  const payload = makeV2Payload("fixture-v2-stale-review", 2);
  payload.equipmentDefinitions[0].reviewBinding.targetDigest = "sha256:" + "0".repeat(64);
  const { manifest, bytes } = makeManifest(payload);
  await assert.rejects(
    runtime.window.ProjectComebackCatalogueDelivery.installRelease(manifest, new Uint8Array(bytes)),
    /review target digest does not match/
  );

  const secondRuntime = await createRuntime();
  const incomplete = makeV2Payload("fixture-v2-incomplete-coverage", 2);
  delete incomplete.definitions[0].movementDemandProfile.coverage.balanceDemandIds;
  delete incomplete.definitions[0].movementDemandProfile.reviewBinding;
  incomplete.definitions[0].movementDemandProfile = bindReview(
    incomplete.definitions[0].movementDemandProfile, "coverage-missing"
  );
  const second = makeManifest(incomplete);
  await assert.rejects(
    secondRuntime.window.ProjectComebackCatalogueDelivery.installRelease(second.manifest, new Uint8Array(second.bytes)),
    /missing coverage array balanceDemandIds/
  );
});

test("v2 rejects vocabulary and requirement fields that are missing or unresolved", async () => {
  const runtime = await createRuntime();
  const payload = makeV2Payload("fixture-v2-missing-requirements", 2);
  delete payload.definitions[0].equipmentRequirements;
  const item = makeManifest(payload);
  await assert.rejects(
    runtime.window.ProjectComebackCatalogueDelivery.installRelease(item.manifest, new Uint8Array(item.bytes)),
    /equipmentRequirements is required/
  );

  const secondRuntime = await createRuntime();
  const badVocab = makeV2Payload("fixture-v2-bad-vocabulary", 2);
  delete badVocab.controlledVocabularies.footPressureDemands;
  const second = makeManifest(badVocab);
  await assert.rejects(
    secondRuntime.window.ProjectComebackCatalogueDelivery.installRelease(second.manifest, new Uint8Array(second.bytes)),
    /controlledVocabularies.footPressureDemands must be an array/
  );
});

test("v2 equipment lookup re-fetches the exact immutable asset when cache bytes are missing", async () => {
  const runtime = await createRuntime();
  const payload = makeV2Payload("fixture-v2-refetch", 2);
  const { manifest, bytes } = makeManifest(payload);
  await runtime.window.ProjectComebackCatalogueDelivery.installRelease(manifest, new Uint8Array(bytes));
  const cacheName = [...runtime.cacheStore.keys()].find(name => name.includes(manifest.releaseId));
  const assetUrl = new URL(manifest.assetUrl, runtime.window.location.href).href;
  runtime.cacheStore.get(cacheName).delete(assetUrl);
  let requested = null;
  runtime.window.fetch = async (url, options) => {
    requested = { url, options };
    return new Response(bytes, { status: 200, headers: { "content-type": "application/json" } });
  };
  const equipment = await runtime.window.ProjectComebackCatalogueDelivery.lookupEquipment("Selectorised");
  assert.equal(equipment.length, 1);
  assert.equal(equipment[0].id, "equipment-fixture-machine");
  assert.equal(requested.url, manifest.assetUrl);
  assert.equal(requested.options.cache, "no-store");
  assert.equal(requested.options.credentials, "same-origin");
});

test("corrupt cached v2 bytes are never returned as equipment and fail closed offline", async () => {
  const runtime = await createRuntime();
  const payload = makeV2Payload("fixture-v2-corrupt-cache", 2);
  const { manifest, bytes } = makeManifest(payload);
  await runtime.window.ProjectComebackCatalogueDelivery.installRelease(manifest, new Uint8Array(bytes));
  const cacheName = [...runtime.cacheStore.keys()].find(name => name.includes(manifest.releaseId));
  const assetUrl = new URL(manifest.assetUrl, runtime.window.location.href).href;
  runtime.cacheStore.get(cacheName).set(assetUrl, new Response("tampered", {
    status: 200, headers: { "content-type": "application/json" }
  }));
  await assert.rejects(
    runtime.window.ProjectComebackCatalogueDelivery.lookupEquipment(""),
    /asset is unavailable online and no verified cached copy exists/
  );
});


test("v3 installs reviewed descriptions for equipment, exercises and variations and supports offline lookup", async () => {
  const runtime = await createRuntime();
  const payload = makeV3Payload();
  const { manifest, bytes } = makeManifest(payload);
  assert.equal(manifest.descriptionCount, 3);
  const installed = await runtime.window.ProjectComebackCatalogueDelivery.installRelease(manifest, new Uint8Array(bytes));
  assert.equal(installed.status, "active");
  const status = await runtime.window.ProjectComebackCatalogueDelivery.getStatus();
  assert.equal(status.release.descriptionCount, 3);
  const equipment = await runtime.window.ProjectComebackCatalogueDelivery.lookupEquipment("Selectorised");
  assert.equal(equipment[0].description, "A selectorised resistance machine for controlled strength exercises.");
  const exercise = (await runtime.window.ProjectComebackCatalogueDelivery.lookup("Fixture Press"))[0];
  assert.equal(exercise.description, "A seated upper-body pressing exercise using supported resistance.");
  assert.equal(exercise.variations[0].description, "A seated setup that provides back support during the press.");
});

test("v3 rejects missing locale, count mismatch, absent/stale bindings and invalid plain text", async () => {
  const cases = [
    ["missing locale", p => { delete p.descriptionLocale; }, /descriptionLocale must be en-AU/],
    ["missing binding", p => { delete p.definitions[0].descriptionReviewBinding; }, /description review binding is required/],
    ["orphan binding", p => { delete p.definitions[0].description; }, /orphan description review binding/],
    ["markup", p => { bindDescription(p.definitions[0], "<b>Press</b>", "markup"); }, /plain text without HTML or Markdown/],
    ["markdown", p => { bindDescription(p.definitions[0], "**Press**", "markdown"); }, /plain text without HTML or Markdown/],
    ["single emphasis", p => { bindDescription(p.definitions[0], "*Press*", "single-emphasis"); }, /plain text without HTML or Markdown/],
    ["whitespace", p => { bindDescription(p.definitions[0], " Press ", "whitespace"); }, /must be trimmed/],
    ["control/newline", p => { bindDescription(p.definitions[0], "Press\\nmovement", "newline"); }, /single paragraph without control characters/],
    ["unicode length", p => { bindDescription(p.definitions[0], "😀".repeat(1001), "long"); }, /exceeds 1,000 Unicode characters/],
    ["stale digest", p => { p.definitions[0].descriptionReviewBinding.targetDigest = "sha256:" + "0".repeat(64); }, /description review target digest does not match/]
  ];
  for (const [name, mutate, expected] of cases) {
    const runtime = await createRuntime();
    const payload = makeV3Payload("fixture-v3-" + name.replace(/[^a-z]+/gi, "-"), 3);
    mutate(payload);
    const { manifest, bytes } = makeManifest(payload);
    await assert.rejects(runtime.window.ProjectComebackCatalogueDelivery.installRelease(manifest, new Uint8Array(bytes)), expected, name);
    assert.equal((await runtime.window.ProjectComebackCatalogueDelivery.getStatus()).status, "unavailable", name);
  }
});

test("v3 does not permit vocabulary descriptions", async () => {
  const runtime = await createRuntime();
  const payload = makeV3Payload("fixture-v3-vocabulary-description", 3);
  payload.controlledVocabularies.muscles[0].description = "Not supported on vocabulary entries.";
  const item = makeManifest(payload);
  await assert.rejects(runtime.window.ProjectComebackCatalogueDelivery.installRelease(item.manifest, new Uint8Array(item.bytes)), /controlled vocabulary descriptions are not supported in v3/);
});

test("v3 manifest rejects missing descriptionCount and v1/v2 reject v3 payload features", async () => {
  const runtime = await createRuntime();
  const payload = makeV3Payload("fixture-v3-manifest", 3);
  const { manifest, bytes } = makeManifest(payload);
  const missingCount = { ...manifest }; delete missingCount.descriptionCount;
  await assert.rejects(runtime.window.ProjectComebackCatalogueDelivery.installRelease(missingCount, new Uint8Array(bytes)), /descriptionCount is required/);
  const v2 = makeV2Payload("fixture-v2-description-forbidden", 2);
  bindDescription(v2.definitions[0], "A description that must require schema v3.", "v2");
  const v2item = makeManifest(v2);
  await assert.rejects(runtime.window.ProjectComebackCatalogueDelivery.installRelease(v2item.manifest, new Uint8Array(v2item.bytes)), /v2 payloads cannot contain catalogue descriptions/);
  const countMismatch = { ...manifest, descriptionCount: manifest.descriptionCount + 1 };
  await assert.rejects(runtime.window.ProjectComebackCatalogueDelivery.installRelease(countMismatch, new Uint8Array(bytes)), /description count does not match/);
  const unsupported = { ...manifest, schemaVersion: 4 };
  await assert.throws(() => runtime.window.ProjectComebackCatalogueDelivery.validateManifest(unsupported), /unsupported manifest\/payload schema version/);
});

test("v3 to v2 replacement clears prior descriptions without touching personal equipment", async () => {
  const runtime = await createRuntime();
  const first = makeManifest(makeV3Payload("fixture-v3-to-v2", 3));
  await runtime.window.ProjectComebackCatalogueDelivery.installRelease(first.manifest, new Uint8Array(first.bytes));
  const second = makeManifest(makeV2Payload("fixture-v2-after-v3", 4));
  await runtime.window.ProjectComebackCatalogueDelivery.installRelease(second.manifest, new Uint8Array(second.bytes));
  const exercise = await runtime.window.ProjectComebackCatalogueDelivery.lookup("Fixture Press");
  assert.equal(Object.prototype.hasOwnProperty.call(exercise[0], "description"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(exercise[0].variations[0], "description"), false);
  const equipment = await runtime.window.ProjectComebackCatalogueDelivery.lookupEquipment("Selectorised");
  assert.equal(Object.prototype.hasOwnProperty.call(equipment[0], "description"), false);
  assert.equal((await runtime.window.ProjectComebackDB.getAll("equipment")).length, 0);
  assert.equal((await runtime.window.ProjectComebackCatalogueDelivery.getStatus()).release.descriptionCount, 0);
});

test("failed v3 validation leaves an already active v2 release unchanged", async () => {
  const runtime = await createRuntime();
  const v2 = await install(runtime, makeV2Payload("fixture-v2-before-v3", 2));
  const before = await runtime.window.ProjectComebackCatalogueDelivery.getStatus();
  const payload = makeV3Payload("fixture-v3-fails", 3);
  payload.descriptionLocale = "fr-FR";
  const invalid = makeManifest(payload);
  await assert.rejects(runtime.window.ProjectComebackCatalogueDelivery.installRelease(invalid.manifest, new Uint8Array(invalid.bytes)), /descriptionLocale must be en-AU/);
  const after = await runtime.window.ProjectComebackCatalogueDelivery.getStatus();
  assert.equal(after.release.releaseId, before.release.releaseId);
  assert.equal(after.release.checksum, v2.manifest.checksum);
});
