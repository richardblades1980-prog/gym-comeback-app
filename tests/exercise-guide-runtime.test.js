"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),{webcrypto}=require("node:crypto");
const root=require("node:path").resolve(__dirname,".."),s={TextEncoder,URL,crypto:webcrypto};s.window=s;
for(const f of ["exercise-guide-crypto.js","exercise-guide-digests.js","exercise-guide-registry.js","exercise-guide-runtime.js","../data/gym-base-programme.js"])vm.runInNewContext(fs.readFileSync(root+"/src/modules/"+f,"utf8"),s);
const runtime=s.ProjectComebackExerciseGuideRuntime,base=s.ProjectComebackGymBaseProgramme,registry=JSON.parse(fs.readFileSync(root+"/v21.2/assets/exercise-guide-registry.v2.json","utf8")),manifest=JSON.parse(fs.readFileSync(root+"/v21.2/assets/guides/manifest.v1.json","utf8"));
test("production empty registry validates and every source slot resolves unavailable",async()=>{const result=await runtime.validate(base,manifest,registry,webcrypto);assert.equal(result.valid,true);const slots=base.listDays().flatMap(d=>d.slots);assert.equal(Object.keys(result.resolutions).length,slots.length);assert.ok(slots.every(slot=>result.resolutions[slot.slotId].status==="unavailable"));});
test("source payload binds all ordered source programme fields",()=>{const payload=runtime.sourcePayload(base);assert.equal(payload.snapshotId,base.source.snapshotId);assert.equal(payload.days.length,5);assert.equal(payload.days.flatMap(d=>d.slots).length,32);assert.equal(payload.days[0].slots[0].slotId,base.listDays()[0].slots[0].slotId);});
test("stale registry source snapshot rejects before resolution",async()=>{const stale={...registry,sourceSnapshotId:"stale"};await assert.rejects(runtime.validate(base,manifest,stale,webcrypto),/source snapshot is stale/);});
test("request gate prevents late asynchronous result from current rendering",()=>{const gate=runtime.createRequestGate(),first=gate.begin();assert.equal(gate.isCurrent(first),true);gate.invalidate();assert.equal(gate.isCurrent(first),false);const second=gate.begin();assert.equal(gate.isCurrent(second),true);assert.equal(gate.isCurrent(first),false);});
test("registry loader caches successful reads and retries failed fetch",async()=>{let calls=0;const sandbox={fetch:async()=>{calls++;if(calls===1)throw Error("offline");return {ok:true,json:async()=>registry};}};vm.runInNewContext(fs.readFileSync(root+"/src/modules/exercise-guide-runtime.js","utf8"),sandbox);const api=sandbox.ProjectComebackExerciseGuideRuntime;await assert.rejects(api.loadRegistry("test-url"),/offline/);const loaded=await api.loadRegistry("test-url");assert.equal(loaded.schemaVersion,2);assert.equal(calls,2);const again=await api.loadRegistry("test-url");assert.equal(again,loaded);assert.equal(calls,2);});

test("local artwork verification requires exact cached bytes and never falls back to network",async()=>{
 const asset=manifest.assets[0],bytes=new TextEncoder().encode("wrong bytes");
 const response={ok:true,type:"basic",headers:{get:()=>asset.mimeType},arrayBuffer:async()=>bytes.buffer};
 await assert.rejects(runtime.verifyLocalAssets(manifest,{match:async()=>response},"https://example.test/v21.2/",webcrypto),/byte length mismatch|SHA-256 mismatch/);
 await assert.rejects(runtime.verifyLocalAssets(manifest,{match:async()=>undefined},"https://example.test/v21.2/",webcrypto),/missing/);
});
test("local artwork verifier rejects malformed manifest before cache access",async()=>{
 let reads=0;const bad={...manifest,assets:[]};
 await assert.rejects(runtime.verifyLocalAssets(bad,{match:async()=>{reads++;}},"https://example.test/",webcrypto),/identity or inventory/);
 assert.equal(reads,0);
});
test("verified asset IDs are the only IDs accepted by registry resolution",async()=>{
 const result=await runtime.validate(base,manifest,registry,webcrypto,new Set());
 assert.equal(result.valid,true);
 assert.ok(Object.values(result.resolutions).every(item=>item.status==="unavailable"));
});
