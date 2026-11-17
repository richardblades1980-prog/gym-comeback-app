"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "v21.2/assets/guides/manifest.v1.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const legacy = fs.readFileSync(path.join(root, "index.html"), "utf8");
const read = p => fs.readFileSync(path.join(root, p));

function gitBlobSha(bytes) {
  return crypto.createHash("sha1")
    .update(Buffer.concat([Buffer.from("blob " + bytes.length + "\0"), bytes]))
    .digest("hex");
}
function sha256(bytes) {
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}
function expectedMime(file) {
  return ({ ".svg":"image/svg+xml", ".jpg":"image/jpeg", ".gif":"image/gif" })[path.extname(file)];
}

test("manifest identity, version and package inventory are stable", () => {
  assert.equal(manifest.manifestId, "gym-guide-artwork-v1");
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.version, 1);
  assert.match(manifest.sourceCommit, /^[0-9a-f]{40}$/);
  assert.equal(manifest.status, "inert-until-service-worker-integration");
  assert.equal(manifest.assets.length, 41);
  assert.equal(manifest.totalByteLength, 2984584);
  const counts = manifest.assets.reduce((out, asset) => {
    out[asset.role] = (out[asset.role] || 0) + 1;
    return out;
  }, {});
  assert.deepEqual(counts, {
    "equipment-illustration":13,
    "equipment-reference":9,
    "muscle-illustration":16,
    "celebration":3
  });
  assert.equal(new Set(manifest.assets.map(x => x.assetId)).size, manifest.assets.length);
  assert.equal(new Set(manifest.assets.map(x => x.path)).size, manifest.assets.length);
});

test("every packaged asset is an exact, checksummed V21.2-local copy of its source", () => {
  let total = 0;
  for (const asset of manifest.assets) {
    assert.match(asset.assetId, /^[a-z0-9][a-z0-9._-]+$/);
    assert.ok(asset.path.startsWith("./assets/"), "asset path must be relative to the V21.2 app");
    assert.ok(!asset.path.includes(".."), "asset path must not traverse directories");
    assert.ok(!/^https?:/i.test(asset.path), "asset path must not be external");
    assert.ok(["equipment-illustration","equipment-reference","muscle-illustration","celebration"].includes(asset.role));
    assert.match(asset.sourceGitBlobSha, /^[0-9a-f]{40}$/);
    assert.ok(asset.sourcePath.startsWith("assets/") || /^(celebration-day1|celebration-day2|female-celebration)\.gif$/.test(asset.sourcePath));

    const relativeTarget = path.normalize(asset.path.replace(/^\.\//, ""));
    const targetPath = path.resolve(root, "v21.2", relativeTarget);
    assert.ok(targetPath.startsWith(path.join(root, "v21.2") + path.sep), "resolved target must remain inside v21.2");
    const target = fs.readFileSync(targetPath);
    const source = read(asset.sourcePath);
    total += target.length;

    assert.equal(target.length, asset.byteLength, asset.assetId + " byte length");
    assert.equal(source.length, asset.byteLength, asset.assetId + " source byte length");
    assert.equal(sha256(target), asset.sha256, asset.assetId + " SHA-256");
    assert.equal(gitBlobSha(target), asset.sourceGitBlobSha, asset.assetId + " destination Git blob SHA");
    assert.equal(gitBlobSha(source), asset.sourceGitBlobSha, asset.assetId + " source Git blob SHA");
    assert.deepEqual(target, source, asset.assetId + " must be copied byte-for-byte");
    assert.equal(asset.mimeType, expectedMime(asset.path), asset.assetId + " MIME type");
  }
  assert.equal(total, manifest.totalByteLength);
});

test("equipment SVG package exactly follows the legacy guide's explicit SVG mapping", () => {
  const start = legacy.indexOf("function equipmentAsset");
  const end = legacy.indexOf("function muscleImageTiles", start);
  assert.ok(start >= 0 && end > start);
  const body = legacy.slice(start, end);
  const sourceNames = [...new Set([...body.matchAll(/'[^']+':'(equipment-[^']+\.svg)'/g)].map(x => x[1]))].sort();
  const packagedNames = manifest.assets
    .filter(x => x.role === "equipment-illustration")
    .map(x => path.basename(x.sourcePath))
    .sort();
  assert.deepEqual(packagedNames, sourceNames);
  assert.equal(sourceNames.length, 13);
  assert.ok(manifest.excludedSourcePaths.includes("assets/equipment-bench.svg"));
  assert.ok(manifest.excludedSourcePaths.includes("assets/equipment-squat-rack.svg"));
});

test("all optional-library muscle keys have one packaged local illustration", () => {
  const start = legacy.indexOf("const bodyExerciseLibrary=[");
  const end = legacy.indexOf("\n];", start);
  assert.ok(start >= 0 && end > start);
  const library = legacy.slice(start, end);
  const keys = new Set([...library.matchAll(/\['[^']+','[^']+','[^']+',\[([^\]]*)\]/g)]
    .flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(x => x[1])));
  const packaged = manifest.assets.filter(x => x.role === "muscle-illustration");
  const used = new Set(packaged.filter(x => x.usedByCurrentOptionalLibrary === true).map(x => x.assetId.slice("muscle.".length)));
  assert.equal(keys.size, 14);
  assert.deepEqual([...used].sort(), [...keys].sort());
  assert.equal(packaged.filter(x => x.usedByCurrentOptionalLibrary === false).length, 2);
  assert.ok(packaged.every(x => typeof x.usedByCurrentOptionalLibrary === "boolean"));
});

test("duplicate legacy machine-reference JPG is represented as a verified source alias", () => {
  const asset = manifest.assets.find(x => x.assetId === "equipment-reference.benches");
  assert.ok(asset);
  assert.deepEqual(asset.sourceAliases, [{
    path:"assets/machine-dumbbells.jpg",
    sourceGitBlobSha:"7537d9ade767d8752f06d263598daa5cdac1eb35",
    byteLength:30172
  }]);
  const alias = read("assets/machine-dumbbells.jpg");
  const canonical = read(asset.sourcePath);
  assert.deepEqual(alias, canonical);
  assert.equal(gitBlobSha(alias), asset.sourceAliases[0].sourceGitBlobSha);
  assert.ok(manifest.excludedSourcePaths.includes("assets/machine-dumbbells.jpg (byte-identical alias of assets/machine-benches.jpg)"));
});

test("all three legacy celebration choices have local package entries", () => {
  const names = manifest.assets.filter(x => x.role === "celebration").map(x => path.basename(x.sourcePath)).sort();
  assert.deepEqual(names, ["celebration-day1.gif","celebration-day2.gif","female-celebration.gif"]);
});
