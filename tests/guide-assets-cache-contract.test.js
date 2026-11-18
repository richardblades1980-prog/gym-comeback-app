"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const sw = fs.readFileSync(path.join(root, "v21.2/sw.js"), "utf8");
const browser = fs.readFileSync(path.join(root, "tests/browser-validation.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "v21.2/assets/guides/manifest.v1.json"), "utf8"));

test("guide cache is separately versioned and isolated from shell and catalogue namespaces", () => {
  assert.match(sw, /GUIDE_CACHE_NAME=GUIDE_CACHE_PREFIX\+"v1"/);
  assert.match(sw, /project-comeback-v21-2a-shell-/);
  assert.doesNotMatch(sw, /project-comeback-v21-2a-catalogue-/);
  assert.match(sw, /Catalogue release assets are cached only by the verified release loader/);
  assert.match(sw, /key\.startsWith\(GUIDE_CACHE_PREFIX\)&&key!==GUIDE_CACHE_NAME/);
  assert.match(sw, /assets\/guides\//);
  assert.match(sw, /assets\/celebrations\//);
});

test("manifest and every exact asset byte, MIME and checksum are verified before publication", () => {
  assert.equal(manifest.status, "verified-offline-cache-v1");
  assert.equal(manifest.assets.length, 41);
  assert.match(sw, /validateGuideManifest\(manifest\)/);
  assert.match(sw, /asset\.byteLength/);
  assert.match(sw, /asset\.mimeType!==guideMime\(asset\.path\)/);
  assert.match(sw, /guideDigest\(bytes\)/);
  assert.match(sw, /verifyGuideResponse\(cached,asset\)/);
  assert.match(sw, /GUIDE_TOTAL_BYTES=2984584/);
  assert.match(sw, /await installGuideAssets\(\)/);
  assert.match(sw, /GUIDE_ASSET_COUNT\+1/);
});

test("published guide cache is reused only after full offline verification", () => {
  assert.match(sw, /if\(cacheNames\.includes\(GUIDE_CACHE_NAME\)\)/);
  assert.match(sw, /await verifyPublishedGuideCache\(existing\)/);
  assert.match(sw, /for\(const asset of assets\)/);
  assert.match(sw, /verifyGuideResponse\(cached,asset\)/);
  assert.match(sw, /Existing guide cache inventory is incomplete/);
  assert.ok(sw.indexOf("await installGuideAssets()") < sw.indexOf("await self.skipWaiting()"));
});
test("new guide cache publication rolls back only its own incomplete namespace", () => {
  assert.match(sw, /if\(createdPublishedCache\)await caches\.delete\(GUIDE_CACHE_NAME\)/);
  assert.match(sw, /finally\{\s*await caches\.delete\(GUIDE_STAGE_CACHE\);\s*\}/);
  assert.match(sw, /await verifyPublishedGuideCache\(published\)/);
});
test("activation claims clients before retiring prior immutable cache namespaces", () => {
  const activation = sw.slice(sw.indexOf('self.addEventListener("activate"'), sw.indexOf('self.addEventListener("fetch"'));
  assert.ok(activation.indexOf("await self.clients.claim()") < activation.indexOf("await Promise.all"));
  assert.match(activation, /key\.startsWith\(GUIDE_CACHE_PREFIX\)&&key!==GUIDE_CACHE_NAME/);
});

test("empty guide registry is cached in the shell, not the dedicated artwork cache", () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, "v21.2/assets/exercise-guide-registry.v2.json"), "utf8"));
  assert.equal(registry.schemaVersion, 2);
  assert.deepEqual(registry.guides, []);
  assert.ok(sw.includes("./assets/exercise-guide-registry.v2.json"));
  assert.ok(sw.includes('const CACHE_NAME=CACHE_PREFIX+"v28";'));
});

test("guide artwork requests bypass generic shell caching", () => {
  assert.match(sw, /url\.pathname\.includes\("\/assets\/guides\/"\)\|\|url\.pathname\.includes\("\/assets\/celebrations\/"\)/);
  assert.match(sw, /caches\.open\(GUIDE_CACHE_NAME\).*?cache\.match\(request\).*?new Response/s);
  assert.match(browser, /Verified dedicated guide artwork cache/);
  assert.match(browser, /shellHasGuideFiles/);
});

test("browser test server supplies exact MIME types for guide artwork", () => {
  assert.match(browser, /"\.svg": "image\/svg\+xml"/);
  assert.match(browser, /"\.jpg": "image\/jpeg"/);
  assert.match(browser, /"\.jpeg": "image\/jpeg"/);
  assert.match(browser, /"\.gif": "image\/gif"/);
});

test("browser validation confirms all 41 guide assets and serves guide artwork offline", () => {
  assert.match(browser, /guideCacheCheck\.count !== 41/);
  assert.match(browser, /guideCacheCheck\.shellHasGuideFiles/);
  assert.match(browser, /offlineGuideFetch/);
  assert.match(browser, /exercise-guide-registry\.v2\.json/);
  assert.match(browser, /project-comeback-v21-2a-guides-v1/);
  assert.match(browser, /serveGuideWorkerV2/);
  assert.match(browser, /failGuideAsset/);
  assert.match(browser, /state !== "redundant"/);
  assert.match(browser, /preservedGuideCache\.entries !== 42/);
  assert.match(browser, /preservedOfflineAsset/);
});

test("guide artwork fetch handler is cache-only and returns 404 when verified bytes are absent",()=>{
 const route=sw.slice(sw.indexOf('if(url.pathname.includes("/assets/guides/")'),sw.indexOf("// Catalogue release assets"));
 assert.match(route,/cached\|\|new Response/);
 assert.doesNotMatch(route,/fetch\(/);
});
test("app verifies exact cached artwork bytes before registry resolution",()=>{
 const app=fs.readFileSync(path.join(root,"v21.2/app.js"),"utf8");
 assert.match(app,/verifyLocalAssets\(manifest,caches,location\.href\)/);
 assert.match(app,/verifiedAssetIds/);
});
