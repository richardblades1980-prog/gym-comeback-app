const CACHE_PREFIX="project-comeback-v21-2a-shell-";
const CACHE_NAME=CACHE_PREFIX+"v17";
const GUIDE_CACHE_PREFIX="project-comeback-v21-2a-guides-";
const GUIDE_CACHE_NAME=GUIDE_CACHE_PREFIX+"v1";
const GUIDE_STAGE_CACHE=GUIDE_CACHE_NAME+"-staging";
const GUIDE_MANIFEST_URL="./assets/guides/manifest.v1.json";
const GUIDE_MANIFEST_ID="gym-guide-artwork-v1";
const GUIDE_ASSET_COUNT=41;
const GUIDE_TOTAL_BYTES=2984584;
const SHELL=["./","./index.html","./app.css","./app.js","./register.js","./manifest.webmanifest","./icon.svg","./assets/database.js","./assets/exercise-identity.js","./assets/gym-base-programme.js","./assets/catalogue-delivery.js","./assets/gym-migration.js","./assets/shared-migration.js","./assets/migration.js","./assets/module-registry.js","./assets/backup.js","./assets/programme-manager.js","./assets/workload-summary.js","./assets/assessment-manager.js"];

function guideHex(bytes){
 return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,"0")).join("");
}
async function guideDigest(bytes){
 return "sha256:"+guideHex(await crypto.subtle.digest("SHA-256",bytes));
}
function guideMime(path){
 const lower=path.toLowerCase();
 if(lower.endsWith(".svg"))return "image/svg+xml";
 if(lower.endsWith(".jpg")||lower.endsWith(".jpeg"))return "image/jpeg";
 if(lower.endsWith(".gif"))return "image/gif";
 return "";
}
function validateGuideManifest(manifest){
 if(!manifest||manifest.manifestId!==GUIDE_MANIFEST_ID||manifest.schemaVersion!==1||manifest.version!==1||
    manifest.status!=="verified-offline-cache-v1"||
    !Array.isArray(manifest.assets)||manifest.assets.length!==GUIDE_ASSET_COUNT||
    manifest.packagedAssetCount!==GUIDE_ASSET_COUNT||manifest.totalByteLength!==GUIDE_TOTAL_BYTES)
  throw new Error("Guide asset manifest identity, schema or inventory is invalid.");
 const ids=new Set(),paths=new Set();let total=0;
 for(const asset of manifest.assets){
  if(!asset||typeof asset.assetId!=="string"||ids.has(asset.assetId)||typeof asset.path!=="string"||
     paths.has(asset.path)||!asset.path.startsWith("./assets/")||asset.path.includes("..")||
     !["equipment-illustration","equipment-reference","muscle-illustration","celebration"].includes(asset.role)||
     !Number.isSafeInteger(asset.byteLength)||asset.byteLength<1||
     !/^sha256:[0-9a-f]{64}$/.test(asset.sha256)||asset.mimeType!==guideMime(asset.path))
   throw new Error("Guide asset manifest contains an invalid or duplicate entry.");
  if(!(asset.path.startsWith("./assets/guides/")||asset.path.startsWith("./assets/celebrations/")))
   throw new Error("Guide asset path is outside the dedicated local asset roots.");
  ids.add(asset.assetId);paths.add(asset.path);total+=asset.byteLength;
 }
 if(total!==GUIDE_TOTAL_BYTES)throw new Error("Guide asset manifest byte total is invalid.");
 return manifest.assets;
}
async function verifyGuideResponse(response,asset){
 if(!response||!response.ok||response.type==="opaque")throw new Error("Guide asset fetch failed: "+asset.assetId);
 const mime=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
 if(mime!==asset.mimeType)throw new Error("Guide asset MIME mismatch: "+asset.assetId);
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==asset.byteLength)throw new Error("Guide asset byte length mismatch: "+asset.assetId);
 if(await guideDigest(bytes)!==asset.sha256)throw new Error("Guide asset SHA-256 mismatch: "+asset.assetId);
 return bytes;
}
async function installGuideAssets(){
 await caches.delete(GUIDE_STAGE_CACHE);
 let createdPublishedCache=false;
 let publishedCacheExisted=false;
 try{
  const manifestResponse=await fetch(GUIDE_MANIFEST_URL,{cache:"no-store"});
  if(!manifestResponse.ok||manifestResponse.type==="opaque")throw new Error("Guide asset manifest fetch failed.");
  const manifestBytes=await manifestResponse.clone().arrayBuffer();
  const manifestText=new TextDecoder("utf-8",{fatal:true}).decode(manifestBytes);
  const manifest=JSON.parse(manifestText);
  const assets=validateGuideManifest(manifest);
  const verified=[];
  for(const asset of assets){
   const response=await fetch(asset.path,{cache:"no-store"});
   const bytes=await verifyGuideResponse(response,asset);
   verified.push({asset,bytes});
  }
  const stage=await caches.open(GUIDE_STAGE_CACHE);
  const manifestUrl=new URL(GUIDE_MANIFEST_URL,self.location).href;
  await stage.put(manifestUrl,new Response(manifestBytes,{headers:{"content-type":"application/json"}}));
  for(const item of verified){
   await stage.put(new URL(item.asset.path,self.location).href,new Response(item.bytes,{headers:{"content-type":item.asset.mimeType}}));
  }
  for(const item of verified){
   const cached=await stage.match(new URL(item.asset.path,self.location).href);
   await verifyGuideResponse(cached,item.asset);
  }
  if((await stage.keys()).length!==GUIDE_ASSET_COUNT+1)throw new Error("Guide staging cache inventory is incomplete.");
  const cacheNames=await caches.keys();
  publishedCacheExisted=cacheNames.includes(GUIDE_CACHE_NAME);
  if(publishedCacheExisted){
   // A published version is immutable. Never repair or overwrite a cache that an older active worker may still use.
   const existing=await caches.open(GUIDE_CACHE_NAME);
   const existingManifest=await existing.match(manifestUrl);
   if(!existingManifest)throw new Error("Existing guide cache is incomplete; publish a new guide cache version.");
   if(await guideDigest(await existingManifest.arrayBuffer())!==await guideDigest(manifestBytes))
    throw new Error("Existing guide cache manifest differs; publish a new guide cache version.");
   for(const item of verified){
    const cached=await existing.match(new URL(item.asset.path,self.location).href);
    await verifyGuideResponse(cached,item.asset);
   }
   if((await existing.keys()).length!==GUIDE_ASSET_COUNT+1)
    throw new Error("Existing guide cache inventory is incomplete; publish a new guide cache version.");
  }else{
   // The new cache name is not referenced by the currently active worker. Populate it only after all staged bytes pass verification.
   const published=await caches.open(GUIDE_CACHE_NAME);
   createdPublishedCache=true;
   for(const request of await stage.keys()){
    const response=await stage.match(request);
    await published.put(request,response);
   }
   for(const item of verified){
    const cached=await published.match(new URL(item.asset.path,self.location).href);
    await verifyGuideResponse(cached,item.asset);
   }
   const publishedManifest=await published.match(manifestUrl);
   if(!publishedManifest||await guideDigest(await publishedManifest.arrayBuffer())!==await guideDigest(manifestBytes))
    throw new Error("Guide manifest cache read-back failed.");
   if((await published.keys()).length!==GUIDE_ASSET_COUNT+1)
    throw new Error("Published guide cache inventory is incomplete.");
  }
 }catch(error){
  // Delete only a cache newly created by this failed install. Never touch a cache an active worker could be using.
  if(createdPublishedCache&&!publishedCacheExisted)await caches.delete(GUIDE_CACHE_NAME);
  throw error;
 }finally{
  await caches.delete(GUIDE_STAGE_CACHE);
 }
}

self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  await caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL));
  await installGuideAssets();
  await self.skipWaiting();
 })());
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>
  (key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME)||(key.startsWith(GUIDE_CACHE_PREFIX)&&key!==GUIDE_CACHE_NAME)
 ).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const request=event.request;if(request.method!=="GET")return;
 const url=new URL(request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith(new URL("./",self.location).pathname))return;
 // Guide artwork and its manifest are served only from their dedicated verified cache.
 if(url.pathname.includes("/assets/guides/")||url.pathname.includes("/assets/celebrations/")){
  event.respondWith(caches.open(GUIDE_CACHE_NAME).then(cache=>cache.match(request).then(cached=>cached||fetch(request))).catch(()=>Response.error()));
  return;
 }
 // Catalogue release assets are cached only by the verified release loader in their own immutable namespace.
 if(url.pathname.includes("/catalogues/exercise/"))return;
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
  if(response.ok&&response.type==="basic"){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}return response;
 }).catch(()=>request.mode==="navigate"?caches.match("./index.html"):Response.error())));
});
