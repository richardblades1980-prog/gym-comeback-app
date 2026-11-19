/* Project Comeback V21.2A — verified immutable catalogue delivery. */
(function (global) {
  "use strict";

  const CATALOGUE_ID = "exercise-catalogue";
  const ACTIVE_POINTER_ID = "active-exercise-catalogue-release";
  const CACHE_PREFIX = "project-comeback-v21-2a-catalogue-";
  const MANIFEST_SCHEMA_VERSION = 1;
  const PAYLOAD_SCHEMA_V2 = 2;
  const V2_VOCABULARY_KEYS = Object.freeze([
    "bodyRegions", "muscles", "jointActions", "movementPatterns", "bodyPositions",
    "supportPoints", "stabilisationDemands", "balanceDemands", "footContactDemands",
    "footPressureDemands", "weightBearingDemands", "impactDemands", "propulsionDemands",
    "bracingDemands", "equipmentFamilies", "equipmentLoadingSystems",
    "equipmentMovementMechanics", "equipmentOrientations", "equipmentSetupAttributes"
  ]);
  const V2_COVERAGE_ARRAYS = Object.freeze([
    "primaryInvolvement", "secondaryInvolvement", "otherRelevantInvolvement",
    "jointActionIds", "movementPatternIds", "bodyPositionIds", "supportPointIds",
    "stabilisationDemandIds", "balanceDemandIds", "footContactDemandIds",
    "footPressureDemandIds", "weightBearingDemandIds", "impactDemandIds",
    "propulsionDemandIds", "setupBracingDemandIds", "equipmentConfigurationConstraints"
  ]);
  const V2_CONFIGURATION_FIELDS = Object.freeze([
    "loadingSystemIds", "movementMechanicIds", "orientationIds", "setupAttributeIds"
  ]);
  const V2_CONFIGURATION_VOCABULARY = Object.freeze({
    loadingSystemIds: "equipmentLoadingSystems",
    movementMechanicIds: "equipmentMovementMechanics",
    orientationIds: "equipmentOrientations",
    setupAttributeIds: "equipmentSetupAttributes"
  });
  const V2_COVERAGE_VOCABULARY = Object.freeze({
    jointActionIds: "jointActions",
    movementPatternIds: "movementPatterns",
    bodyPositionIds: "bodyPositions",
    supportPointIds: "supportPoints",
    stabilisationDemandIds: "stabilisationDemands",
    balanceDemandIds: "balanceDemands",
    footContactDemandIds: "footContactDemands",
    footPressureDemandIds: "footPressureDemands",
    weightBearingDemandIds: "weightBearingDemands",
    impactDemandIds: "impactDemands",
    propulsionDemandIds: "propulsionDemands",
    setupBracingDemandIds: "bracingDemands"
  });

  function fail(message) { throw new Error("Catalogue: " + message); }
  function requiredString(value, field) {
    if (typeof value !== "string" || !value.trim()) fail(field + " is required.");
    return value;
  }
  function validateManifest(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) fail("release manifest is invalid.");
    const manifest = Object.assign({}, input);
    manifest.catalogueId = requiredString(manifest.catalogueId, "catalogueId");
    if (manifest.catalogueId !== CATALOGUE_ID) fail("unsupported catalogue ID.");
    manifest.releaseId = requiredString(manifest.releaseId, "releaseId");
    manifest.id = manifest.releaseId;
    if (!Number.isInteger(manifest.version) || manifest.version < 1) fail("version must be a positive integer.");
    if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION && manifest.schemaVersion !== PAYLOAD_SCHEMA_V2) fail("unsupported manifest/payload schema version.");
    if (manifest.contentType !== "application/json") fail("content type must be application/json.");
    if (!Number.isInteger(manifest.byteLength) || manifest.byteLength < 2) fail("byteLength is invalid.");
    if (!Number.isInteger(manifest.entryCount) || manifest.entryCount < 0) fail("entryCount is invalid.");
    if (manifest.variationCount !== undefined && (!Number.isInteger(manifest.variationCount) || manifest.variationCount < 0)) fail("variationCount is invalid.");
    if (manifest.schemaVersion === PAYLOAD_SCHEMA_V2) {
      if (!Number.isInteger(manifest.variationCount) || !Number.isInteger(manifest.equipmentDefinitionCount) ||
          manifest.equipmentDefinitionCount < 0 || !Number.isInteger(manifest.vocabularyEntryCount) ||
          manifest.vocabularyEntryCount < 0) {
        fail("v2 variation, equipment-definition and vocabulary counts are required.");
      }
    } else if (manifest.equipmentDefinitionCount !== undefined || manifest.vocabularyEntryCount !== undefined) {
      fail("v1 manifests cannot declare v2-only catalogue counts.");
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(manifest.checksum || "")) fail("checksum must be sha256 followed by 64 lowercase hexadecimal characters.");
    requiredString(manifest.assetUrl, "assetUrl");
    if ((!manifest.assetUrl.startsWith("./") && !manifest.assetUrl.startsWith("/")) || manifest.assetUrl.startsWith("//")) fail("assetUrl must be a same-origin relative path.");
    if (manifest.assetUrl.indexOf("..") !== -1) fail("assetUrl cannot traverse parent paths.");
    const expectedAssetSuffix = "/catalogues/exercise/" + encodeURIComponent(manifest.releaseId) + "/" + manifest.checksum.slice(7) + ".json";
    if (!manifest.assetUrl.endsWith(expectedAssetSuffix)) fail("assetUrl must be an immutable release-and-digest path.");
    return manifest;
  }
  async function sha256(bytes) {
    if (!global.crypto || !global.crypto.subtle) fail("Web Crypto SHA-256 is unavailable in this context.");
    const digest = await global.crypto.subtle.digest("SHA-256", bytes);
    return "sha256:" + Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  }
  function isRecord(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }
  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }
  function uniqueIdArray(values, allowedIds, field) {
    if (!Array.isArray(values)) fail(field + " must be an array.");
    const seen = new Set();
    for (const id of values) {
      requiredString(id, field + " reference");
      if (seen.has(id)) fail(field + " contains a duplicate reference.");
      if (allowedIds && !allowedIds.has(id)) fail(field + " references an unknown controlled-vocabulary ID.");
      seen.add(id);
    }
    return seen;
  }
  async function validateReviewBinding(target, binding, field) {
    if (!isRecord(binding)) fail(field + " review binding is required.");
    requiredString(binding.reviewRecordId, field + " reviewRecordId");
    requiredString(binding.reviewerScopeId, field + " reviewerScopeId");
    if (binding.decision !== "approved") fail(field + " review decision must be approved.");
    if (!/^sha256:[a-f0-9]{64}$/.test(binding.targetDigest || "")) fail(field + " targetDigest is invalid.");
    if (!Array.isArray(binding.evidenceRefs) || !binding.evidenceRefs.length) fail(field + " evidenceRefs must contain at least one source.");
    const evidenceSeen = new Set();
    binding.evidenceRefs.forEach((reference, index) => {
      requiredString(reference, field + " evidence reference");
      if (evidenceSeen.has(reference)) fail(field + " evidenceRefs contain a duplicate.");
      evidenceSeen.add(reference);
    });
    const targetCopy = Object.assign({}, target);
    delete targetCopy.reviewBinding;
    const actualDigest = await sha256(new TextEncoder().encode(stableJson(targetCopy)));
    if (actualDigest !== binding.targetDigest) fail(field + " review target digest does not match the reviewed content.");
  }
  function validateInvolvement(values, vocab, field) {
    if (!Array.isArray(values)) fail(field + " must be an array.");
    values.forEach((entry, index) => {
      if (!isRecord(entry)) fail(field + "[" + index + "] is invalid.");
      const bodies = uniqueIdArray(entry.bodyRegionIds, vocab.bodyRegions, field + " bodyRegionIds");
      const muscles = uniqueIdArray(entry.muscleIds, vocab.muscles, field + " muscleIds");
      if (!bodies.size && !muscles.size) fail(field + "[" + index + "] must reference a body region or muscle.");
    });
  }
  function validateConfigurationConstraint(constraint, alternative, equipmentById, vocab, field) {
    if (!isRecord(constraint)) fail(field + " is invalid.");
    const equipmentId = requiredString(constraint.equipmentDefinitionId, field + " equipmentDefinitionId");
    if (!alternative.has(equipmentId)) fail(field + " must constrain equipment included in the same alternative.");
    const attribute = requiredString(constraint.attribute, field + " attribute");
    if (!V2_CONFIGURATION_VOCABULARY[attribute]) fail(field + " uses an unsupported configuration attribute.");
    const valueId = requiredString(constraint.valueId, field + " valueId");
    const vocabulary = vocab[V2_CONFIGURATION_VOCABULARY[attribute]];
    if (!vocabulary.has(valueId)) fail(field + " valueId is not in the matching configuration vocabulary.");
    const equipment = equipmentById.get(equipmentId);
    if (!equipment[attribute].includes(valueId)) fail(field + " valueId is not supported by the referenced equipment definition.");
  }
  async function validateEquipmentRequirements(requirements, equipmentById, vocab, field) {
    if (!isRecord(requirements)) fail(field + " is required.");
    const status = requiredString(requirements.reviewStatus, field + " reviewStatus");
    if (!["reviewed-required", "reviewed-none", "incomplete"].includes(status)) {
      fail(field + " reviewStatus is unsupported.");
    }
    if (!Array.isArray(requirements.groups)) fail(field + " groups must be an array.");
    if (status === "reviewed-none" && requirements.groups.length !== 0) fail(field + " reviewed-none must have no requirement groups.");
    if (status === "reviewed-required" && requirements.groups.length === 0) fail(field + " reviewed-required must contain at least one group.");
    if (status === "incomplete" && requirements.reviewBinding) fail(field + " incomplete requirements cannot carry an approval binding.");
    if (status !== "incomplete") await validateReviewBinding(requirements, requirements.reviewBinding, field);
    const groupIds = new Set();
    requirements.groups.forEach((group, groupIndex) => {
      const groupField = field + " groups[" + groupIndex + "]";
      if (!isRecord(group)) fail(groupField + " is invalid.");
      const groupId = requiredString(group.id, groupField + " id");
      if (groupIds.has(groupId)) fail(field + " group IDs must be unique.");
      groupIds.add(groupId);
      if (!Array.isArray(group.alternatives) || group.alternatives.length === 0) fail(groupField + " must contain at least one alternative.");
      group.alternatives.forEach((alternative, alternativeIndex) => {
        const altField = groupField + " alternatives[" + alternativeIndex + "]";
        if (!isRecord(alternative)) fail(altField + " is invalid.");
        const equipmentIds = uniqueIdArray(alternative.equipmentDefinitionIds, null, altField + " equipmentDefinitionIds");
        if (!equipmentIds.size) fail(altField + " must require at least one equipment definition.");
        equipmentIds.forEach(id => {
          if (!equipmentById.has(id)) fail(altField + " references an unknown equipment definition.");
        });
        if (!Array.isArray(alternative.configurationConstraints)) fail(altField + " configurationConstraints must be an array.");
        alternative.configurationConstraints.forEach((constraint, constraintIndex) => {
          validateConfigurationConstraint(constraint, equipmentIds, equipmentById, vocab,
            altField + " configurationConstraints[" + constraintIndex + "]");
        });
      });
    });
  }
  async function validateMovementDemandProfile(profile, vocab, equipmentById, field) {
    if (!isRecord(profile)) fail(field + " is required.");
    const status = requiredString(profile.reviewStatus, field + " reviewStatus");
    if (status !== "complete" && status !== "incomplete") fail(field + " reviewStatus is unsupported.");
    if (!isRecord(profile.coverage)) fail(field + " coverage is required.");
    if (status === "complete") {
      V2_COVERAGE_ARRAYS.forEach(key => {
        if (!hasOwn(profile.coverage, key) || !Array.isArray(profile.coverage[key])) {
          fail(field + " complete profile is missing coverage array " + key + ".");
        }
      });
      await validateReviewBinding(profile, profile.reviewBinding, field);
    } else if (profile.reviewBinding) {
      fail(field + " incomplete profile cannot carry an approval binding.");
    }
    ["primaryInvolvement", "secondaryInvolvement", "otherRelevantInvolvement"].forEach(key => {
      if (hasOwn(profile.coverage, key)) validateInvolvement(profile.coverage[key], vocab, field + " " + key);
      else if (status === "complete") fail(field + " complete profile is missing " + key + ".");
    });
    Object.entries(V2_COVERAGE_VOCABULARY).forEach(([key, vocabularyKey]) => {
      if (hasOwn(profile.coverage, key)) uniqueIdArray(profile.coverage[key], vocab[vocabularyKey], field + " " + key);
      else if (status === "complete") fail(field + " complete profile is missing " + key + ".");
    });
    if (hasOwn(profile.coverage, "equipmentConfigurationConstraints")) {
      if (!Array.isArray(profile.coverage.equipmentConfigurationConstraints)) fail(field + " equipmentConfigurationConstraints must be an array.");
      profile.coverage.equipmentConfigurationConstraints.forEach((constraint, index) => {
        if (!isRecord(constraint)) fail(field + " equipmentConfigurationConstraints[" + index + "] is invalid.");
        const equipmentId = requiredString(constraint.equipmentDefinitionId, field + " equipment configuration equipmentDefinitionId");
        const equipment = equipmentById.get(equipmentId);
        if (!equipment) fail(field + " equipment configuration references an unknown equipment definition.");
        const attribute = requiredString(constraint.attribute, field + " equipment configuration attribute");
        if (!V2_CONFIGURATION_VOCABULARY[attribute]) fail(field + " equipment configuration attribute is unsupported.");
        const valueId = requiredString(constraint.valueId, field + " equipment configuration valueId");
        if (!vocab[V2_CONFIGURATION_VOCABULARY[attribute]].has(valueId)) {
          fail(field + " equipment configuration valueId is unknown.");
        }
        if (!equipment[attribute].includes(valueId)) fail(field + " equipment configuration valueId is not supported by the referenced equipment definition.");
      });
    } else if (status === "complete") {
      fail(field + " complete profile is missing equipmentConfigurationConstraints.");
    }
  }
  async function validateV2Payload(document, manifest, definitionIds, variationIds) {
    if (!Array.isArray(document.equipmentDefinitions) ||
        document.equipmentDefinitions.length !== manifest.equipmentDefinitionCount) {
      fail("equipment-definition count does not match the v2 manifest.");
    }
    if (!isRecord(document.controlledVocabularies) ||
        !Number.isInteger(document.controlledVocabularies.version) || document.controlledVocabularies.version < 1) {
      fail("controlledVocabularies version is invalid.");
    }
    const allowedVocabularyKeys = new Set(["version", ...V2_VOCABULARY_KEYS]);
    if (Object.keys(document.controlledVocabularies).some(key => !allowedVocabularyKeys.has(key))) {
      fail("controlledVocabularies contains an unsupported category.");
    }
    const vocab = Object.create(null);
    let vocabularyEntryCount = 0;
    const allVocabularyIds = new Set();
    for (const key of V2_VOCABULARY_KEYS) {
      if (!Array.isArray(document.controlledVocabularies[key])) fail("controlledVocabularies." + key + " must be an array.");
      const ids = new Set();
      for (const item of document.controlledVocabularies[key]) {
        if (!isRecord(item)) fail("controlledVocabularies." + key + " item is invalid.");
        const id = requiredString(item.id, "controlled vocabulary ID");
        requiredString(item.label, "controlled vocabulary label");
        if (ids.has(id) || allVocabularyIds.has(id)) fail("controlled vocabulary IDs must be unique across categories.");
        ids.add(id);
        allVocabularyIds.add(id);
        vocabularyEntryCount += 1;
      }
      vocab[key] = ids;
    }
    if (vocabularyEntryCount !== manifest.vocabularyEntryCount) fail("controlled-vocabulary count does not match the v2 manifest.");
    await validateReviewBinding(document.controlledVocabularies,
      document.controlledVocabulariesReviewBinding, "controlled vocabularies");
    const equipmentIds = new Set();
    const equipmentById = new Map();
    for (const equipment of document.equipmentDefinitions) {
      if (!isRecord(equipment)) fail("equipment definition record is invalid.");
      const id = requiredString(equipment.id, "equipment definition ID");
      requiredString(equipment.canonicalName, "equipment canonicalName");
      if (equipmentIds.has(id) || definitionIds.has(id) || variationIds.has(id)) {
        fail("equipment, exercise definition and variation IDs must be unique across record types.");
      }
      equipmentIds.add(id);
      if (!vocab.equipmentFamilies.has(requiredString(equipment.familyId, "equipment familyId"))) {
        fail("equipment definition references an unknown equipment family.");
      }
      if (equipment.reviewStatus !== "approved") fail("equipment definitions must have approved review status.");
      for (const fieldName of V2_CONFIGURATION_FIELDS) {
        const references = uniqueIdArray(equipment[fieldName], vocab[V2_CONFIGURATION_VOCABULARY[fieldName]],
          "equipment definition " + fieldName);
        if (references.size !== equipment[fieldName].length) fail("equipment definition configuration values are invalid.");
      }
      if (!Array.isArray(equipment.sourceRefs) || !equipment.sourceRefs.length) fail("equipment definition sourceRefs must not be empty.");
      equipment.sourceRefs.forEach((reference, index) => requiredString(reference, "equipment source reference " + index));
      await validateReviewBinding(equipment, equipment.reviewBinding, "equipment definition " + id);
      equipmentById.set(id, equipment);
    }
    for (const definition of document.definitions) {
      if (hasOwn(definition, "requiredEquipmentDefinitionIds")) fail("v2 definitions must use structured equipmentRequirements, not flat equipment ID lists.");
      await validateEquipmentRequirements(definition.equipmentRequirements, equipmentById, vocab,
        "exercise definition " + definition.id + " equipmentRequirements");
      await validateMovementDemandProfile(definition.movementDemandProfile, vocab, equipmentById,
        "exercise definition " + definition.id + " movementDemandProfile");
    }
    for (const variation of document.variations) {
      if (hasOwn(variation, "requiredEquipmentDefinitionIds")) fail("v2 variations must use structured equipmentRequirements, not flat equipment ID lists.");
      await validateEquipmentRequirements(variation.equipmentRequirements, equipmentById, vocab,
        "exercise variation " + variation.id + " equipmentRequirements");
      await validateMovementDemandProfile(variation.movementDemandProfile, vocab, equipmentById,
        "exercise variation " + variation.id + " movementDemandProfile");
    }
  }
  async function parseAndValidate(manifest, bytes) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (bytes.byteLength !== manifest.byteLength) fail("asset byte length does not match the manifest.");
    const checksum = await sha256(bytes);
    if (checksum !== manifest.checksum) fail("asset SHA-256 does not match the manifest.");
    let document;
    try { document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch (error) { fail("asset is not valid UTF-8 JSON."); }
    if (!isRecord(document)) fail("payload must be an object.");
    if (document.catalogueId !== manifest.catalogueId || document.releaseId !== manifest.releaseId ||
        document.version !== manifest.version || document.schemaVersion !== manifest.schemaVersion) {
      fail("payload identity does not match the manifest.");
    }
    if (!Array.isArray(document.definitions) || document.definitions.length !== manifest.entryCount) fail("definition count does not match the manifest.");
    const variations = document.variations === undefined ? [] : document.variations;
    if (!Array.isArray(variations)) fail("variations must be an array.");
    if (manifest.variationCount !== undefined && variations.length !== manifest.variationCount) fail("variation count does not match the manifest.");
    const definitionIds = new Set();
    for (const definition of document.definitions) {
      if (!isRecord(definition)) fail("definition record is invalid.");
      requiredString(definition.id, "definition ID");
      requiredString(definition.canonicalName, "canonicalName");
      if (definitionIds.has(definition.id)) fail("definition IDs must be unique.");
      definitionIds.add(definition.id);
      if (definition.kind && definition.kind !== "system") fail("release definitions must have kind system.");
      if (definition.requiredEquipmentDefinitionIds !== undefined &&
          (!Array.isArray(definition.requiredEquipmentDefinitionIds) || definition.requiredEquipmentDefinitionIds.some(id => typeof id !== "string" || !id))) {
        fail("required equipment references are invalid.");
      }
    }
    const variationIds = new Set();
    for (const variation of variations) {
      if (!isRecord(variation)) fail("variation record is invalid.");
      requiredString(variation.id, "variation ID");
      requiredString(variation.exerciseDefinitionId, "variation parent ID");
      requiredString(variation.name, "variation name");
      if (variationIds.has(variation.id) || definitionIds.has(variation.id)) fail("definition and variation IDs must be unique across record types.");
      if (!definitionIds.has(variation.exerciseDefinitionId)) fail("variation parent does not exist in this release.");
      variationIds.add(variation.id);
    }
    if (manifest.schemaVersion === PAYLOAD_SCHEMA_V2) {
      await validateV2Payload(document, manifest, definitionIds, variationIds);
    }
    return { document, bytes };
  }
  function cacheName(manifest) {
    return CACHE_PREFIX + encodeURIComponent(manifest.catalogueId) + "-" +
      encodeURIComponent(manifest.releaseId) + "-" + manifest.checksum.slice(7);
  }
  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
    });
  }
  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error || new Error("Catalogue activation transaction aborted; previous release remains active."));
      transaction.onerror = () => reject(transaction.error || new Error("Catalogue activation transaction failed."));
    });
  }
  function stableJson(value) {
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
    return JSON.stringify(value);
  }
  async function getVerifiedBytes(manifest, suppliedBytes) {
    if (!global.caches || typeof global.caches.open !== "function") fail("CacheStorage is unavailable; verified offline delivery cannot be enabled.");
    const cache = await global.caches.open(cacheName(manifest));
    const assetRequestUrl = new URL(manifest.assetUrl, global.location.href).href;
    const cached = await cache.match(assetRequestUrl);
    if (cached) {
      try {
        const cachedType = (cached.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (cachedType !== "application/json") fail("cached asset has an unexpected content type.");
        const cachedBytes = new Uint8Array(await cached.arrayBuffer());
        await parseAndValidate(manifest, cachedBytes);
        if (suppliedBytes === undefined) return cachedBytes;
      } catch (error) {
        await cache.delete(assetRequestUrl);
      }
    }
    let bytes;
    if (suppliedBytes !== undefined) {
      bytes = suppliedBytes instanceof Uint8Array ? suppliedBytes : new Uint8Array(suppliedBytes);
    } else {
      if (typeof global.fetch !== "function") fail("asset is not cached and fetch is unavailable.");
      let response;
      try { response = await global.fetch(manifest.assetUrl, { cache: "no-store", credentials: "same-origin" }); }
      catch (error) { fail("asset is unavailable online and no verified cached copy exists."); }
      if (!response || !response.ok) fail("asset request failed with status " + (response && response.status));
      const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (contentType !== "application/json") fail("server returned an unexpected content type.");
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    await parseAndValidate(manifest, bytes);
    await cache.put(assetRequestUrl, new Response(bytes, { status: 200, headers: { "content-type": "application/json" } }));
    const reread = await cache.match(assetRequestUrl);
    if (!reread) fail("verified asset could not be read back from CacheStorage.");
    const rereadType = (reread.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (rereadType !== "application/json") fail("cached asset read-back has an unexpected content type.");
    const rereadBytes = new Uint8Array(await reread.arrayBuffer());
    await parseAndValidate(manifest, rereadBytes);
    return rereadBytes;
  }
  async function commitMaterialisation(manifest, document) {
    const dbApi = global.ProjectComebackDB;
    if (!dbApi) fail("database.js must be loaded before catalogue delivery.");
    const db = await dbApi.open();
    try {
      if (db.version < 6) fail("the existing V6 identity stores are required; no schema upgrade is attempted.");
      const names = ["catalogueReleases", "exerciseDefinitions", "exerciseVariations", "metadata"];
      const tx = db.transaction(names, "readwrite");
      const done = transactionDone(tx);
      const releaseStore = tx.objectStore("catalogueReleases");
      const definitionStore = tx.objectStore("exerciseDefinitions");
      const variationStore = tx.objectStore("exerciseVariations");
      const metadataStore = tx.objectStore("metadata");
      const existingRelease = await requestResult(releaseStore.get(manifest.releaseId));
      if (existingRelease) {
        const existingCore = Object.assign({}, existingRelease);
        delete existingCore.assetVerificationStatus;
        delete existingCore.assetVerifiedAt;
        delete existingCore.createdAt;
        delete existingCore.updatedAt;
        if (stableJson(existingCore) !== stableJson(manifest) || existingRelease.assetVerificationStatus !== "verified") {
          tx.abort();
          await done.catch(() => {});
          fail("release ID is immutable; unverified metadata cannot be promoted into a verified release.");
        }
      }
      const allReleases = await requestResult(releaseStore.getAll());
      const latestVersion = allReleases.filter(item => item.catalogueId === manifest.catalogueId)
        .reduce((latest, item) => Math.max(latest, Number(item.version) || 0), 0);
      const activeRecord = await requestResult(metadataStore.get(ACTIVE_POINTER_ID));
      if ((!existingRelease && manifest.version <= latestVersion) || (existingRelease && manifest.version < latestVersion)) {
        tx.abort();
        await done.catch(() => {});
        fail("release versions must increase monotonically.");
      }
      if (existingRelease && activeRecord && activeRecord.value && activeRecord.value.releaseId !== manifest.releaseId) {
        tx.abort();
        await done.catch(() => {});
        fail("an installed historical release cannot be reactivated over a newer active release.");
      }
      const existingDefinitions = await requestResult(definitionStore.getAll());
      const existingVariations = await requestResult(variationStore.getAll());
      const incomingDefinitionIds = new Set(document.definitions.map(item => item.id));
      const incomingVariationIds = new Set(document.variations.map(item => item.id));
      for (const incoming of document.definitions) {
        const collision = existingDefinitions.find(item => item.id === incoming.id &&
          (item.kind !== "system" || item.sourceCatalogueId !== manifest.catalogueId));
        if (collision) {
          tx.abort(); await done.catch(() => {});
          fail("catalogue definition ID collides with a profile-owned definition.");
        }
      }
      for (const incoming of document.variations) {
        const collision = existingVariations.find(item => item.id === incoming.id &&
          item.sourceCatalogueId !== manifest.catalogueId);
        if (collision) {
          tx.abort(); await done.catch(() => {});
          fail("catalogue variation ID collides with a record outside this catalogue.");
        }
      }
      for (const previous of existingDefinitions) {
        if (previous.kind === "system" && previous.sourceCatalogueId === manifest.catalogueId &&
            !incomingDefinitionIds.has(previous.id)) {
          definitionStore.put(Object.assign({}, previous, { status: "retired" }));
        }
      }
      for (const previous of existingVariations) {
        if (previous.sourceCatalogueId === manifest.catalogueId && !incomingVariationIds.has(previous.id)) {
          variationStore.put(Object.assign({}, previous, { status: "retired" }));
        }
      }
      for (const definition of document.definitions) {
        definitionStore.put(Object.assign({}, definition, {
          kind: "system", status: "active", sourceCatalogueId: manifest.catalogueId,
          sourceCatalogueReleaseId: manifest.releaseId
        }));
      }
      for (const variation of document.variations) {
        variationStore.put(Object.assign({}, variation, {
          status: "active", sourceCatalogueId: manifest.catalogueId,
          sourceCatalogueReleaseId: manifest.releaseId
        }));
      }
      if (!existingRelease) releaseStore.add(Object.assign({}, manifest, {
        assetVerificationStatus: "verified", assetVerifiedAt: new Date().toISOString()
      }));
      metadataStore.put({
        id: ACTIVE_POINTER_ID,
        type: "active-catalogue-release",
        value: {
          catalogueId: manifest.catalogueId, releaseId: manifest.releaseId,
          version: manifest.version, checksum: manifest.checksum,
          entryCount: manifest.entryCount, variationCount: document.variations.length,
          schemaVersion: manifest.schemaVersion,
          equipmentDefinitionCount: manifest.equipmentDefinitionCount || 0,
          vocabularyEntryCount: manifest.vocabularyEntryCount || 0,
          verifiedAt: new Date().toISOString()
        }
      });
      await done;
      return { status: "active", releaseId: manifest.releaseId, version: manifest.version };
    } finally {
      db.close();
    }
  }
  async function installRelease(input, suppliedBytes) {
    const manifest = validateManifest(input);
    const bytes = await getVerifiedBytes(manifest, suppliedBytes);
    const verified = await parseAndValidate(manifest, bytes);
    return commitMaterialisation(manifest, verified.document);
  }
  async function getStatus() {
    const db = global.ProjectComebackDB;
    if (!db) fail("database.js must be loaded before catalogue status can be read.");
    const pointer = await db.getMeta(ACTIVE_POINTER_ID);
    if (!pointer || !pointer.value) return { status: "unavailable", reason: "not-seeded" };
    const release = await db.get("catalogueReleases", pointer.value.releaseId);
    if (!release || release.assetVerificationStatus !== "verified" ||
        release.checksum !== pointer.value.checksum || release.version !== pointer.value.version) {
      return { status: "unavailable", reason: "active-release-manifest-mismatch" };
    }
    return { status: "active", release: pointer.value };
  }
  async function lookup(query) {
    const status = await getStatus();
    if (status.status !== "active") fail("no verified catalogue release is installed on this device.");
    const db = global.ProjectComebackDB;
    const releaseId = status.release.releaseId;
    const [definitions, variations] = await Promise.all([
      db.getAll("exerciseDefinitions"), db.getAll("exerciseVariations")
    ]);
    const localDefinitions = definitions.filter(item => item.sourceCatalogueReleaseId === releaseId && item.status === "active");
    const localVariations = variations.filter(item => item.sourceCatalogueReleaseId === releaseId && item.status === "active");
    if (localDefinitions.length !== status.release.entryCount || localVariations.length !== status.release.variationCount) {
      fail("local catalogue materialisation is incomplete or stale.");
    }
    const term = String(query || "").trim().toLocaleLowerCase();
    return localDefinitions.filter(item => !term || item.canonicalName.toLocaleLowerCase().includes(term))
      .map(item => Object.assign({}, item, {
        variations: localVariations.filter(variation => variation.exerciseDefinitionId === item.id)
      }));
  }

  async function lookupEquipment(query) {
    const status = await getStatus();
    if (status.status !== "active") fail("no verified catalogue release is installed on this device.");
    const db = global.ProjectComebackDB;
    const storedManifest = await db.get("catalogueReleases", status.release.releaseId);
    if (!storedManifest || storedManifest.assetVerificationStatus !== "verified") {
      fail("equipment definitions are unavailable because the active release is not verified.");
    }
    const manifest = validateManifest(storedManifest);
    if (manifest.schemaVersion !== PAYLOAD_SCHEMA_V2) {
      fail("equipment definitions are unavailable for a schema v1 catalogue release.");
    }
    if (manifest.checksum !== status.release.checksum || manifest.version !== status.release.version ||
        manifest.schemaVersion !== status.release.schemaVersion ||
        (manifest.schemaVersion === PAYLOAD_SCHEMA_V2 &&
          (manifest.equipmentDefinitionCount !== status.release.equipmentDefinitionCount ||
           manifest.vocabularyEntryCount !== status.release.vocabularyEntryCount))) {
      fail("equipment definitions are unavailable because the active release manifest does not match.");
    }
    const bytes = await getVerifiedBytes(manifest);
    const verified = await parseAndValidate(manifest, bytes);
    const term = String(query || "").trim().toLocaleLowerCase();
    return verified.document.equipmentDefinitions.filter(item =>
      !term || item.canonicalName.toLocaleLowerCase().includes(term) || item.familyId.toLocaleLowerCase().includes(term)
    );
  }

  global.ProjectComebackCatalogueDelivery = Object.freeze({
    catalogueId: CATALOGUE_ID,
    cachePrefix: CACHE_PREFIX,
    validateManifest,
    installRelease,
    getStatus,
    lookup,
    lookupEquipment
  });
})(window);
