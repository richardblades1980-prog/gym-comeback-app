const CACHE='gym-comeback-v20-1-2-set-count-correction';
const ASSETS=['./manifest.webmanifest','./cover-art.jpg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./celebration-day1.gif','./celebration-day2.gif','./female-celebration.gif','./assets/machine-benches.jpg','./assets/machine-cables.jpg','./assets/machine-cardio.jpg','./assets/machine-core.jpg','./assets/machine-dumbbells.jpg','./assets/machine-hamstrings.jpg','./assets/machine-home-gym.jpg','./assets/machine-leg-press.jpg','./assets/machine-selectorised.jpg','./assets/machine-shoulder-press.jpg','./assets/muscle-abs.jpg','./assets/muscle-back.jpg','./assets/muscle-biceps.jpg','./assets/muscle-calves.jpg','./assets/muscle-chest.jpg','./assets/muscle-forearms.jpg','./assets/muscle-glutes.jpg','./assets/muscle-hamstrings.jpg','./assets/muscle-inner_thighs.jpg','./assets/muscle-lats.jpg','./assets/muscle-outer_thighs.jpg','./assets/muscle-quads.jpg','./assets/muscle-rear_shoulders.jpg','./assets/muscle-shoulders.jpg','./assets/muscle-traps.jpg','./assets/muscle-triceps.jpg','./assets/equipment-bands.svg','./assets/equipment-bench.svg','./assets/equipment-bike.svg','./assets/equipment-bodyweight.svg','./assets/equipment-cable-row.svg','./assets/equipment-chest-press.svg','./assets/equipment-dumbbells.svg','./assets/equipment-home-gym.svg','./assets/equipment-lat-pulldown.svg','./assets/equipment-leg-extension.svg','./assets/equipment-leg-press.svg','./assets/equipment-rower.svg','./assets/equipment-shoulder-press.svg','./assets/equipment-squat-rack.svg','./assets/equipment-treadmill.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 const isPage=event.request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/');
 if(isPage){
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}return response;}).catch(()=>caches.match('./index.html')));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match('./index.html'))));
});
