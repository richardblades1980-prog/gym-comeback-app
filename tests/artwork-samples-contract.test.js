"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "v21.2/assets/artwork-samples/v1/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

test("artwork sample manifest is explicitly review-only", () => {
  assert.equal(manifest.sampleManifestId, "gym-artwork-sample-set-v1");
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.status, "review-only-not-for-production");
  assert.equal(manifest.samples.length, 2);
  const ids = manifest.samples.map(sample => sample.sampleId);
  const paths = manifest.samples.map(sample => sample.path);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(paths).size, paths.length);
  for (const sample of manifest.samples) {
    assert.equal(sample.reviewStatus, "pending");
    assert.match(sample.sampleId, /^sample\.[a-z]+\.[a-z0-9-]+$/);
    assert.equal(sample.mimeType, "image/svg+xml");
    assert.ok(sample.path.startsWith("./"));
    assert.ok(!sample.path.includes(".."));
  }
});

test("equipment sample follows 3:2 technical SVG contract", () => {
  validateSvg(manifest.samples.find(sample => sample.role === "equipment-illustration"), "0 0 1200 800", "3:2");
});

test("muscle sample follows 3:4 portrait SVG contract", () => {
  validateSvg(manifest.samples.find(sample => sample.role === "muscle-illustration"), "0 0 1200 1600", "3:4");
});

test("review samples are not part of the production guide release", () => {
  const production = JSON.parse(fs.readFileSync(path.join(root, "v21.2/assets/guides/manifest.v1.json"), "utf8"));
  assert.equal(production.assets.some(asset => String(asset.path).includes("artwork-samples")), false);
});

function validateSvg(sample, expectedViewBox, expectedRatio) {
  assert.ok(sample, "sample role must exist");
  assert.equal(sample.viewBox, expectedViewBox);
  assert.equal(sample.aspectRatio, expectedRatio);
  assert.match(sample.path, /^\.\/(equipment|muscles)\/[a-z0-9-]+\.svg$/);

  const absolute = path.resolve(path.dirname(manifestPath), sample.path);
  assert.ok(absolute.startsWith(path.join(root, "v21.2/assets/artwork-samples/v1") + path.sep));
  const source = fs.readFileSync(absolute, "utf8");
  assert.match(source, /^<svg\b/);
  assert.match(source, /<\/svg>\s*$/);
  assert.match(source, new RegExp('viewBox="' + expectedViewBox.replace(/ /g, "\\s+") + '"'));
  assert.match(source, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(source, /role="img"/);
  assert.match(source, /aria-labelledby="title desc"/);
  assert.match(source, /<title id="title">/);
  assert.match(source, /<desc id="desc">/);
  assert.doesNotMatch(source, /<script\b|<foreignObject\b|<text\b|\b(?:href|src)=["']https?:/i, "samples must have no script, baked-in text or external resource");
  assert.doesNotMatch(source, /<rect\b[^>]*\bfill="#(?:fff|ffffff|ffffff)"/i, "sample background must remain transparent");

  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, "SVG IDs must be unique");
  const references = [
    ...[...source.matchAll(/url\(#([^)]+)\)/g)].map(match => match[1]),
    ...[...source.matchAll(/aria-labelledby="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/))
  ];
  for (const id of references) assert.ok(ids.includes(id), "missing local SVG reference: " + id);

  assert.ok(source.length > 1000, "sample should contain a substantive vector illustration");
  const sha256 = crypto.createHash("sha256").update(Buffer.from(source, "utf8")).digest("hex");
  assert.match(sha256, /^[a-f0-9]{64}$/);
}
