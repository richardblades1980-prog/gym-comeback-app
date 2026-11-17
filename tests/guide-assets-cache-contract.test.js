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
  assert.match(sw, /verifyGuideResponse\(cached,item\.asset\)/);
  assert.match(sw, /GUIDE_TOTAL_BYTES=2984584/);
  assert.match(sw, /await installGuideAssets\(\)/);
  assert.match(sw, /GUIDE_ASSET_COUNT\+1/);
});

test("published cache versions are immutable and failed installs preserve caches used by older workers", () => {
  assert.match(sw, /publishedCacheExisted=cacheNames\.includes\(GUIDE_CACHE_NAME\)/);
  assert.match(sw, /if\(createdPublishedCache&&!publishedCacheExisted\)await caches\.delete\(GUIDE_CACHE_NAME\)/);
  assert.match(sw, /Existing guide cache is incomplete; publish a new guide cache version/);
  assert.match(sw, /Never touch a cache an active worker could be using/);
  assert.doesNotMatch(sw, /^\s*await caches\.delete\(GUIDE_CACHE_NAME\);/m);
  assert.match(sw, /finally\{\s*await caches\.delete\(GUIDE_STAGE_CACHE\);\s*\}/);
  assert.ok(sw.indexOf("await installGuideAssets()") < sw.indexOf("await self.skipWaiting()"));
});

test("guide artwork requests bypass generic shell caching", () => {
  assert.match(sw, /url\.pathname\.includes\("\/assets\/guides\/"\)\|\|url\.pathname\.includes\("\/assets\/celebrations\/"\)/);
  assert.match(sw, /caches\.open\(GUIDE_CACHE_NAME\).*?cache\.match\(request\).*?fetch\(request\)/s);
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
  assert.match(browser, /project-comeback-v21-2a-guides-v1/);
});
