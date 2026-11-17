"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const sw = fs.readFileSync(path.join(root, "v21.2/sw.js"), "utf8");
const browser = fs.readFileSync(path.join(root, "tests/browser-validation.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "v21.2/assets/guides/manifest.v1.json"), "utf8"));

test("guide cache is separately versioned and does not share shell or catalogue namespaces", () => {
  assert.match(sw, /project-comeback-v21-2a-guides-v1/);
  assert.match(sw, /project-comeback-v21-2a-shell-/);
  assert.match(sw, /project-comeback-v21-2a-catalogue-/);
  assert.match(sw, /key\.startsWith\(GUIDE_CACHE_PREFIX\)&&key!==GUIDE_CACHE_NAME/);
  assert.match(sw, /assets\/guides\//);
  assert.match(sw, /assets\/celebrations\//);
});

test("manifest is validated before publication and every exact asset byte is verified", () => {
  assert.equal(manifest.status, "verified-offline-cache-v1");
  assert.equal(manifest.assets.length, 41);
  assert.match(sw, /validateGuideManifest\(manifest\)/);
  assert.match(sw, /asset\.byteLength/);
  assert.match(sw, /asset\.mimeType!==guideMime\(asset\.path\)/);
  assert.match(sw, /guideDigest\(bytes\)/);
  assert.match(sw, /verifyGuideResponse\(cached,item\.asset\)/);
  assert.match(sw, /GUIDE_TOTAL_BYTES=2984584/);
  assert.match(sw, /await installGuideAssets\(\)/);
});

test("failed guide installation rejects service-worker install and cleans staging cache", () => {
  assert.match(sw, /await caches\.delete\(GUIDE_STAGE_CACHE\)/);
  assert.match(sw, /catch\(error\)=>\{\s*await caches\.delete\(GUIDE_STAGE_CACHE\);\s*throw error;/);
  assert.match(sw, /await self\.skipWaiting\(\)/);
  assert.ok(sw.indexOf("await installGuideAssets()") < sw.indexOf("await self.skipWaiting()"));
});

test("guide artwork requests bypass generic shell caching", () => {
  assert.match(sw, /assets\/guides\/\")\|\|url\.pathname\.includes\("\/assets\/celebrations\//);
  assert.match(sw, /caches\.open\(GUIDE_CACHE_NAME\).*?cache\.match\(request\).*?fetch\(request\)/s);
  assert.match(browser, /Verified dedicated guide artwork cache/);
  assert.match(browser, /shellHasGuideFiles/);
});

test("browser validation confirms all 41 guide assets exist in dedicated cache before offline reload", () => {
  assert.match(browser, /guideCacheCheck\.count !== 41/);
  assert.match(browser, /guideCacheCheck\.shellHasGuideFiles/);
  assert.match(browser, /project-comeback-v21-2a-guides-v1/);
});
