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
async function validate(base,manifest,registry,cryptoProvider){
 if(!base||!base.source||typeof base.listDays!=="function")throw new Error("Current source programme is unavailable.");
 if(!manifest||!Array.isArray(manifest.assets))throw new Error("Verified local artwork manifest is unavailable.");
 const cryptoApi=g.ProjectComebackExerciseGuideCrypto,validator=g.ProjectComebackExerciseGuideRegistry;
 if(!cryptoApi||!validator)throw new Error("Guide cryptographic validator is unavailable.");
 const payload=sourcePayload(base),snapshotDigest=await cryptoApi.digestCanonical(payload,"PC-GUIDE-CANONICAL-v1",cryptoProvider);
 if(registry.sourceSnapshotId!==base.source.snapshotId)throw new Error("Guide registry source snapshot is stale.");
 const input={registry,programmeSlots:payload.days.flatMap(day=>day.slots.map(slot=>({slotId:slot.slotId}))),sourceSnapshotId:base.source.snapshotId,sourceSnapshotDigest:snapshotDigest,assetIds:new Set(manifest.assets.map(a=>a.assetId))};
 const result=await validator.validateRegistry(input,cryptoProvider);
 if(!result.valid)throw new Error("Guide registry verification failed: "+result.errors.join(" "));
 return result;
}
function createRequestGate(){let generation=0;return Object.freeze({begin(){return ++generation;},invalidate(){generation++;},isCurrent(token){return token===generation;}});}
g.ProjectComebackExerciseGuideRuntime=Object.freeze({REGISTRY_URL,sourcePayload,loadRegistry,validate,createRequestGate});
})(typeof window!=="undefined"?window:globalThis);
