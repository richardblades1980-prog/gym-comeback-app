/* Project Comeback V21.2A — verified immutable catalogue delivery. */
(function (global) {
  "use strict";

  const CATALOGUE_ID = "exercise-catalogue";
  const ACTIVE_POINTER_ID = "active-exercise-catalogue-release";
  const CACHE_PREFIX = "project-comeback-v21-2a-catalogue-";
  const MANIFEST_SCHEMA_VERSION = 1;

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
    if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) fail("unsupported manifest schema version.");
    if (manifest.contentType !== "application/json") fail("content type must be application/json.");
    if (!Number.isInteger(manifest.byteLength) || manifest.byteLength < 2) fail("byteLength is invalid.");
    if (!Number.isInteger(manifest.entryCount) || manifest.entryCount < 0) fail("entryCount is invalid.");
    if (manifest.variationCount !== undefined && (!Number.isInteger(manifest.variationCount) || manifest.variationCount < 0)) fail("variationCount is invalid.");
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
  function parseAndValidate(manifest, bytes) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (bytes.byteLength !== manifest.byteLength) fail("asset byte length does not match the manifest.");
    return sha256(bytes).then(checksum => {
      if (checksum !== manifest.checksum) fail("asset SHA-256 does not match the manifest.");
      let document;
      try { document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
      catch (error) { fail("asset is not valid UTF-8 JSON."); }
      if (!document || typeof document !== "object" || Array.isArray(document)) fail("payload must be an object.");
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
        if (!definition || typeof definition !== "object" || Array.isArray(definition)) fail("definition record is invalid.");
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
        if (!variation || typeof variation !== "object" || Array.isArray(variation)) fail("variation record is invalid.");
        requiredString(variation.id, "variation ID");
        requiredString(variation.exerciseDefinitionId, "variation parent ID");
        requiredString(variation.name, "variation name");
        if (variationIds.has(variation.id)) fail("variation IDs must be unique.");
        if (!definitionIds.has(variation.exerciseDefinitionId)) fail("variation parent does not exist in this release.");
        variationIds.add(variation.id);
      }
      return { document, bytes };
    });
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

  global.ProjectComebackCatalogueDelivery = Object.freeze({
    catalogueId: CATALOGUE_ID,
    cachePrefix: CACHE_PREFIX,
    validateManifest,
    installRelease,
    getStatus,
    lookup
  });
})(window);
