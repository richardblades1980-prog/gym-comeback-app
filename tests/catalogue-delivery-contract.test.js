const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const identitySource = read("src/data/exercise-identity.js");
const deliverySource = read("src/data/catalogue-delivery.js");
const bundledDeliverySource = read("v21.2/assets/catalogue-delivery.js");
const databaseSource = read("src/data/database.js");
const htmlSource = read("v21.2/index.html");
const swSource = read("v21.2/sw.js");
const backupSource = read("src/data/backup.js");
const browserSource = read("tests/browser-validation.js");

function digest(bytes) {
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}
function payload(releaseId, version, definitions) {
  return Buffer.from(JSON.stringify({ catalogueId:"exercise-catalogue", releaseId, version, schemaVersion:1, definitions }), "utf8");
}
function manifest(releaseId, version, bytes, entryCount) {
  const checksum = digest(bytes);
  return Object.freeze({
    catalogueId:"exercise-catalogue", releaseId, version, schemaVersion:1,
    checksum, byteLength:bytes.length, contentType:"application/json",
    assetUrl:"./catalogues/exercise/"+releaseId+"/"+checksum.slice(7)+".json", entryCount
  });
}
function verifyBytes(m, bytes) {
  assert.equal(m.contentType, "application/json");
  assert.equal(m.byteLength, bytes.length);
  assert.equal(m.checksum, digest(bytes), "digest must cover exact UTF-8 bytes");
  const doc = JSON.parse(bytes.toString("utf8"));
  assert.equal(doc.catalogueId, m.catalogueId);
  assert.equal(doc.releaseId, m.releaseId);
  assert.equal(doc.version, m.version);
  assert.equal(doc.schemaVersion, m.schemaVersion);
  assert.ok(Array.isArray(doc.definitions));
  assert.equal(doc.definitions.length, m.entryCount);
  const ids = doc.definitions.map(x => x.id);
  assert.ok(ids.every(x => typeof x === "string" && x.length));
  assert.equal(new Set(ids).size, ids.length, "definition IDs must be unique");
  return doc;
}
// Pure model only: no production loader, CacheStorage or IndexedDB activation is implemented here.
function stage(state, m, bytes, failure = {}) {
  const existing = state.releases[m.releaseId];
  if (existing) {
    assert.deepEqual(existing, m, "release ID cannot be rebound");
    return state;
  }
  const latest = Object.values(state.releases).filter(x => x.catalogueId === m.catalogueId)
    .reduce((n, x) => Math.max(n, x.version), 0);
  assert.ok(m.version > latest, "release versions must increase");
  verifyBytes(m, bytes);
  const stagedCache = { ...state.releaseCache, [m.releaseId]: Buffer.from(bytes) };
  if (failure.interrupted) throw new Error("interrupted before activation");
  if (failure.databaseAbort) throw new Error("IndexedDB transaction aborted");
  return {
    releases:{ ...state.releases, [m.releaseId]:m },
    releaseCache:stagedCache,
    activeReleaseId:m.releaseId,
    materializedReleaseId:m.releaseId,
    materializationVerified:true
  };
}
function retained({versions=[], slots=[], sessions=[], events=[]}) {
  const ids = new Set();
  versions.forEach(x => { if(x.status==="published" && x.catalogueReleaseId) ids.add(x.catalogueReleaseId); });
  slots.forEach(x => { if(x.catalogueReleaseId) ids.add(x.catalogueReleaseId); });
  sessions.forEach(x => { if(x.catalogueReleaseId && !["cancelled","deleted"].includes(x.status)) ids.add(x.catalogueReleaseId); });
  events.forEach(x => { if(x.catalogueReleaseId) ids.add(x.catalogueReleaseId); });
  return ids;
}
test("source characterization: release registration stores checksum metadata but does not verify asset bytes", () => {
  const start=identitySource.indexOf("async function storeCatalogueRelease");
  const end=identitySource.indexOf("async function getCatalogueReleaseReferences",start);
  assert.ok(start>=0 && end>start);
  const body=identitySource.slice(start,end);
  assert.match(body,/requiredString\(input\.checksum/);
  assert.doesNotMatch(body,/crypto\.subtle|createHash|digest\(|fetch\(/);
});
test("source characterization: production service worker precaches shell, not catalogue release assets", () => {
  assert.match(swSource,/project-comeback-v21-2a-shell-/);
  const shell=swSource.match(/const SHELL=\[(.*?)\];/s)?.[1]||"";
  assert.match(shell,/assets\/exercise-identity\.js/);
  assert.doesNotMatch(shell,/catalogues\/exercise/i);
  assert.match(swSource,/key\.startsWith\(CACHE_PREFIX\)&&key!==CACHE_NAME/);
  assert.ok(swSource.includes("cacheResponseBestEffort(CACHE_NAME,request,copy)"));
  assert.ok(swSource.includes("function cacheResponseBestEffort(cacheName,request,response)"));
  assert.ok(swSource.includes(".catch(()=>undefined)"));
  assert.match(swSource,/catalogues\/exercise/);
  assert.match(swSource,/if\(url\.pathname\.includes\("\/catalogues\/exercise\/"\)\)return/);
});
test("production delivery service verifies immutable assets and exposes offline lookup", () => {
  assert.match(deliverySource,/crypto\.subtle\.digest\("SHA-256"/);
  assert.match(deliverySource,/byteLength/);
  assert.match(deliverySource,/release versions must increase monotonically/);
  assert.match(deliverySource,/project-comeback-v21-2a-catalogue-/);
  assert.match(deliverySource,/async function installRelease/);
  assert.match(deliverySource,/async function lookup/);
  assert.match(deliverySource,/const PAYLOAD_SCHEMA_V2 = 2/);
  assert.match(deliverySource,/const PAYLOAD_SCHEMA_V3 = 3/);
  assert.match(deliverySource,/validateV3Descriptions/);
  assert.match(deliverySource,/descriptionReviewBinding/);
  assert.match(deliverySource,/descriptionCount/);
  assert.match(deliverySource,/async function lookupEquipment/);
  assert.match(deliverySource,/controlledVocabulariesReviewBinding/);
  assert.match(deliverySource,/equipmentDefinitionCount/);
  assert.match(deliverySource,/vocabularyEntryCount/);
  assert.match(deliverySource,/movementDemandProfile/);
  assert.match(deliverySource,/review target digest does not match/);
  assert.match(deliverySource,/catalogueReleases.*exerciseDefinitions.*exerciseVariations.*metadata/s);
  assert.match(deliverySource,/active-exercise-catalogue-release/);
  assert.match(deliverySource,/assetVerificationStatus: "verified"/);
  assert.match(deliverySource,/release\.assetVerificationStatus !== "verified"/);
  assert.match(deliverySource,/local catalogue materialisation is incomplete or stale/);
  assert.equal(bundledDeliverySource, deliverySource, "the app shell must load the same reviewed delivery implementation");
  assert.match(htmlSource,/assets\/catalogue-delivery\.js/);
  assert.match(swSource,/assets\/catalogue-delivery\.js/);
  assert.match(deliverySource,/new URL\(manifest\.assetUrl, global\.location\.href\)/);
  assert.match(deliverySource,/metadataStore\.put\(/);
  assert.match(databaseSource,/const DB_VERSION = 6;/, "catalogue delivery must not require a schema change");
});
test("real browser validation seeds a verified fixture and checks offline catalogue lookup", () => {
  assert.match(browserSource,/ProjectComebackCatalogueDelivery\.installRelease/);
  assert.match(browserSource,/ProjectComebackCatalogueDelivery\.lookup/);
  assert.match(browserSource,/ProjectComebackCatalogueDelivery\.lookupEquipment/);
  assert.match(browserSource,/browser-catalogue-v2-r2/);
  assert.match(browserSource,/Verified catalogue lookup or release cache did not survive a real offline app reload/);
});
test("source characterization: V2 backup retains release metadata and snapshots, not system asset bytes", () => {
  assert.match(backupSource,/"catalogueReleases"/);
  // Backup copies whole session/programme records, so display snapshots are
  // preserved as ordinary record fields rather than a special backup field.
  assert.match(backupSource,/"sessions"/);
  assert.match(backupSource,/readStores\(db, names\)/);
  assert.match(backupSource,/typeof release\.checksum !== "string" \|\| !release\.checksum/);
  assert.doesNotMatch(backupSource,/catalogueAssetBytes|cataloguePayloadBytes|embeddedCatalogueAsset/);
});
test("release manifest verifies exact bytes, size, payload identity, schema, count and unique IDs", () => {
  const bytes=payload("r1",1,[{id:"exd_squat"},{id:"exd_press"}]);
  const m=manifest("r1",1,bytes,2);
  assert.equal(verifyBytes(m,bytes).definitions.length,2);
  const corrupt=Buffer.from(bytes); corrupt[corrupt.length-2]^=1;
  assert.throws(()=>verifyBytes(m,corrupt),/exact UTF-8 bytes/);
  const duplicate=payload("r2",2,[{id:"same"},{id:"same"}]);
  assert.throws(()=>verifyBytes(manifest("r2",2,duplicate,2),duplicate),/definition IDs must be unique/);
});
test("release IDs are immutable and catalogue versions monotonically increase", () => {
  const b1=payload("r1",1,[{id:"a"}]), m1=manifest("r1",1,b1,1);
  const first=stage({releases:{},releaseCache:{},activeReleaseId:null},m1,b1);
  assert.equal(first.activeReleaseId,"r1");
  assert.deepEqual(stage(first,m1,b1),first);
  assert.throws(()=>stage(first,{...m1,checksum:"sha256:"+"0".repeat(64)},b1),/cannot be rebound/);
  const b2=payload("r2",1,[{id:"b"}]);
  assert.throws(()=>stage(first,manifest("r2",1,b2,1),b2),/versions must increase/);
});
test("interrupted staging or IndexedDB abort leaves the previous release active", () => {
  const b1=payload("r1",1,[{id:"a"}]), m1=manifest("r1",1,b1,1);
  const state=stage({releases:{},releaseCache:{},activeReleaseId:null},m1,b1);
  const b2=payload("r2",2,[{id:"b"}]), m2=manifest("r2",2,b2,1);
  assert.throws(()=>stage(state,m2,b2,{interrupted:true}),/interrupted/);
  assert.throws(()=>stage(state,m2,b2,{databaseAbort:true}),/transaction aborted/);
  assert.equal(state.activeReleaseId,"r1");
  assert.equal(state.releaseCache.r2,undefined);
});
test("corrupt asset is rejected before cache publication or active-pointer change", () => {
  const bytes=payload("r1",1,[{id:"a"}]), m=manifest("r1",1,bytes,1), bad=Buffer.from(bytes);
  bad[0]^=1;
  const state={releases:{},releaseCache:{},activeReleaseId:null};
  assert.throws(()=>stage(state,m,bad),/exact UTF-8 bytes/);
  assert.equal(state.activeReleaseId,null);
  assert.equal(Object.keys(state.releaseCache).length,0);
});
test("offline lookup requires a verified materialisation matching the active release", () => {
  const canLookup=s=>Boolean(s.activeReleaseId && s.materializedReleaseId===s.activeReleaseId && s.materializationVerified===true);
  assert.equal(canLookup({activeReleaseId:null,materializedReleaseId:null,materializationVerified:false}),false);
  assert.equal(canLookup({activeReleaseId:"r2",materializedReleaseId:"r1",materializationVerified:true}),false);
  assert.equal(canLookup({activeReleaseId:"r2",materializedReleaseId:"r2",materializationVerified:true}),true);
});
test("restore on a device without old asset keeps snapshot readable and does not silently rebind pin", () => {
  const historical={catalogueReleaseId:"old",name:"  RDL (DB)  ",rawValue:"{name:'  RDL (DB)  '}",
    canonicalDisplaySnapshot:{snapshotSchemaVersion:1,locale:"en-AU",canonicalName:"Dumbbell Romanian Deadlift",variationName:"B-stance",equipmentLabels:["Dumbbell"]}};
  const assets=new Set(["current"]);
  assert.equal(assets.has(historical.catalogueReleaseId),false);
  assert.equal(historical.canonicalDisplaySnapshot.canonicalName,"Dumbbell Romanian Deadlift");
  assert.equal(historical.catalogueReleaseId,"old");
  assert.equal(historical.name,"  RDL (DB)  ");
  assert.equal(historical.rawValue,"{name:'  RDL (DB)  '}");
});
test("retention includes published versions, direct slot pins, non-terminal sessions and review events", () => {
  assert.match(identitySource,/db\.getAll\("programmeSlots"\)/);
  assert.match(identitySource,/type: "programmeSlot"/);
  const ids=retained({
    versions:[{status:"published",catalogueReleaseId:"v"},{status:"draft",catalogueReleaseId:"draft"}],
    slots:[{catalogueReleaseId:"slot"}],
    sessions:[{status:"completed",catalogueReleaseId:"done"},{status:"active",catalogueReleaseId:"active"},{status:"cancelled",catalogueReleaseId:"cancel"},{status:"deleted",catalogueReleaseId:"delete"}],
    events:[{catalogueReleaseId:"audit"}]
  });
  assert.deepEqual([...ids].sort(),["active","audit","done","slot","v"]);
});
test("catalogue release cache namespace survives shell-cache activation cleanup", () => {
  const shellPrefix="project-comeback-v21-2a-shell-", cataloguePrefix="project-comeback-v21-2a-catalogue-";
  const deletes=name=>name.startsWith(shellPrefix)&&name!==shellPrefix+"v16";
  assert.equal(deletes(shellPrefix+"v15"),true);
  assert.equal(deletes(cataloguePrefix+"r1-sha256abc"),false);
  assert.equal(deletes(cataloguePrefix+"r2-sha256def"),false);
});
