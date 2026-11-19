"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appRoot = path.join(root, "v21.2");
const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, "manifest.webmanifest"), "utf8"));
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(appRoot, "sw.js"), "utf8");

function pngDimensions(file) {
  const bytes = fs.readFileSync(path.join(appRoot, file));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], file + " must be a PNG");
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR", file + " must start with a PNG IHDR chunk");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length };
}

test("manifest has a stable same-origin identity and standard PNG install icons", () => {
  assert.equal(manifest.id, "./");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  const icons = new Map(manifest.icons.map(icon => [icon.src, icon]));
  for (const [src, size, purpose] of [
    ["./icon-192.png", "192x192", "any"],
    ["./icon-512.png", "512x512", "any"],
    ["./icon-maskable-512.png", "512x512", "maskable"]
  ]) {
    const icon = icons.get(src);
    assert.ok(icon, "missing manifest icon " + src);
    assert.equal(icon.sizes, size);
    assert.equal(icon.type, "image/png");
    assert.equal(icon.purpose, purpose);
    const dimensions = pngDimensions(src.replace(/^\.\//, ""));
    const expected = Number(size.split("x")[0]);
    assert.equal(dimensions.width, expected);
    assert.equal(dimensions.height, expected);
    assert.ok(dimensions.bytes > 100);
  }
  assert.ok(icons.has("./icon.svg"), "retain the scalable SVG icon");
  assert.equal(icons.get("./icon.svg").purpose, "any maskable");
});

test("iOS Home Screen metadata references a real 180px PNG touch icon", () => {
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/apple-touch-icon\.png" sizes="180x180">/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  const dimensions = pngDimensions("apple-touch-icon.png");
  assert.deepEqual([dimensions.width, dimensions.height], [180, 180]);
  assert.ok(dimensions.bytes > 100);
});

test("all PWA icons are included in the versioned V21.2 offline shell", () => {
  for (const asset of [
    "./icon.svg", "./icon-192.png", "./icon-512.png",
    "./icon-maskable-512.png", "./apple-touch-icon.png"
  ]) {
    assert.ok(sw.includes('"' + asset + '"'), "service worker shell must precache " + asset);
  }
  assert.match(sw, /const CACHE_NAME=CACHE_PREFIX\+"v30"/);
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
});
