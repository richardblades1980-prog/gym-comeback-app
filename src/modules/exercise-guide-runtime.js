/* Project Comeback V21.2 — fail-closed async exercise guide runtime. */
(function(g){
"use strict";
const REGISTRY_URL="./assets/exercise-guide-registry.v2.json";
let registryPromise=null;
function sourcePayload(base){
 const source=base.source,days=base.listDays();
 return {
  snapshotId:source.snapshotId,
  sourceNamespace:source.sourceNamespace,
  sourceFile:source.sourceFile,
  sourceGitBlobSha:source.sourceGitBlobSha,
  status:source.status,
  days:days.map(day=>({
   dayNumber:day.dayNumber,
   title:day.title,
   sourceTip:day.sourceTip,
   slots:day.slots.map(slot=>({
    slotId:slot.slotId,
    position:slot.position,
    sourceExerciseLabel:slot.sourceExerciseLabel,
    sourceDescription:slot.sourceDescription,
    sourceGroupKey:slot.sourceGroupKey,
    sourceMuscleKeys:slot.sourceMuscleKeys,
    defaultSetCount:slot.defaultSetCount,
    defaultProgressionFocus:slot.defaultProgressionFocus,
    defaultRecordingMode:slot.defaultRecordingMode,
    identityLinkStatus:slot.identityLinkStatus
   }))
  }))
 };
}
function loadRegistry(url){
 if(!registryPromise)registryPromise=fetch(url||REGISTRY_URL).then(r=>{if(!r.ok)throw new Error("Exercise guide registry is unavailable.");return r.json();}).catch(e=>{registryPromise=null;throw e;});
 return registryPromise;
}
async function verifyLocalAssets(manifest,cacheStorage,baseUrl,cryptoProvider){
 if(!manifest||manifest.manifestId!=="gym-guide-artwork-v1"||manifest.schemaVersion!==1||manifest.version!==1||manifest.status!=="verified-offline-cache-v1"||!Array.isArray(manifest.assets)||manifest.assets.length!==manifest.packagedAssetCount)throw new Error("Guide asset manifest identity or inventory is invalid.");
 if(!cacheStorage||typeof cacheStorage.match!=="function")throw new Error("Verified local guide cache is unavailable.");
 const ids=new Set(),paths=new Set();let total=0;const cryptoApi=g.ProjectComebackExerciseGuideCrypto;
 if(!cryptoApi)throw new Error("Guide cryptographic validator is unavailable.");
 for(const asset of manifest.assets){
  if(!asset||typeof asset.assetId!=="string"||!asset.assetId.trim()||ids.has(asset.assetId)||typeof asset.path!=="string"||paths.has(asset.path)||!(asset.path.startsWith("./assets/guides/")||asset.path.startsWith("./assets/celebrations/"))||asset.path.includes("..")||!Number.isSafeInteger(asset.byteLength)||asset.byteLength<1||!/^sha256:[0-9a-f]{64}$/.test(asset.sha256)||typeof asset.mimeType!=="string"||!asset.mimeType)throw new Error("Guide asset manifest contains an invalid or duplicate entry.");
  ids.add(asset.assetId);paths.add(asset.path);total+=asset.byteLength;
  const response=await cacheStorage.match(new URL(asset.path,baseUrl).href);
  if(!response||!response.ok||response.type==="opaque")throw new Error("Verified local guide artwork is missing: "+asset.assetId);
  const mime=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(mime!==asset.mimeType.toLowerCase())throw new Error("Local guide artwork MIME mismatch: "+asset.assetId);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==asset.byteLength)throw new Error("Local guide artwork byte length mismatch: "+asset.assetId);
  if(await cryptoApi.sha256Bytes(bytes,cryptoProvider)!==asset.sha256)throw new Error("Local guide artwork SHA-256 mismatch: "+asset.assetId);
 }
 if(total!==manifest.totalByteLength)throw new Error("Guide asset manifest byte total is invalid.");
 return ids;
}
async function validate(base,manifest,registry,cryptoProvider,verifiedAssetIds){
 if(!base||!base.source||typeof base.listDays!=="function")throw new Error("Current source programme is unavailable.");
 if(!manifest||!Array.isArray(manifest.assets))throw new Error("Verified local artwork manifest is unavailable.");
 const cryptoApi=g.ProjectComebackExerciseGuideCrypto,validator=g.ProjectComebackExerciseGuideRegistry;
 if(!cryptoApi||!validator)throw new Error("Guide cryptographic validator is unavailable.");
 const payload=sourcePayload(base),snapshotDigest=await cryptoApi.digestCanonical(payload,"PC-GUIDE-CANONICAL-v1",cryptoProvider);
 if(registry.sourceSnapshotId!==base.source.snapshotId)throw new Error("Guide registry source snapshot is stale.");
 const input={registry,programmeSlots:payload.days.flatMap(day=>day.slots.map(slot=>({slotId:slot.slotId}))),sourceSnapshotId:base.source.snapshotId,sourceSnapshotDigest:snapshotDigest,assetIds:verifiedAssetIds||new Set(manifest.assets.map(a=>a.assetId))};
 const result=await validator.validateRegistry(input,cryptoProvider);
 if(!result.valid)throw new Error("Guide registry verification failed: "+result.errors.join(" "));
 return result;
}
function createRequestGate(){let generation=0;return Object.freeze({begin(){return ++generation;},invalidate(){generation++;},isCurrent(token){return token===generation;}});}
g.ProjectComebackExerciseGuideRuntime=Object.freeze({REGISTRY_URL,sourcePayload,loadRegistry,verifyLocalAssets,validate,createRequestGate});
})(typeof window!=="undefined"?window:globalThis);
