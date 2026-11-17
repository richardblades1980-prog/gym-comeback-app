const CACHE_PREFIX="project-comeback-v21-2a-shell-";
const CACHE_NAME=CACHE_PREFIX+"v13";
const SHELL=["./","./index.html","./app.css","./app.js","./register.js","./manifest.webmanifest","./icon.svg","./assets/database.js","./assets/gym-migration.js","./assets/shared-migration.js","./assets/migration.js","./assets/module-registry.js","./assets/backup.js","./assets/programme-manager.js","./assets/workload-summary.js","./assets/assessment-manager.js"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
 const request=event.request;if(request.method!=="GET")return;
 const url=new URL(request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith(new URL("./",self.location).pathname))return;
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
  if(response.ok&&response.type==="basic"){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}return response;
 }).catch(()=>request.mode==="navigate"?caches.match("./index.html"):Response.error())));
});