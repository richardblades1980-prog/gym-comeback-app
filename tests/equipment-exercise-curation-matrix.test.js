"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const matrixPath = path.join(__dirname, "..", "docs", "V21.2-EQUIPMENT-EXERCISE-CURATION-MATRIX.md");
const source = fs.readFileSync(matrixPath, "utf8");

function sectionBetween(startHeading, endHeading) {
  const start = source.indexOf(startHeading);
  assert.notEqual(start, -1, "missing section: " + startHeading);
  const end = endHeading ? source.indexOf(endHeading, start + startHeading.length) : source.length;
  assert.ok(end > start, "missing section boundary after: " + startHeading);
  return source.slice(start, end);
}
function tableRows(section, predicate) {
  return section.split("\n").filter(line => line.startsWith("| ") && predicate(line));
}

test("curation matrix is pinned to the protected source and does not assign production IDs", () => {
  assert.match(source, /e3eb0093648cc6c5d706bb5b1008b58ec01a5576/);
  assert.match(source, /No canonical exercise IDs, variation IDs, equipment-definition IDs/);
  assert.match(source, /All rows have status \*\*UNREVIEWED\*\*/);
  assert.match(source, /All assignments remain \*\*UNASSIGNED\*\*/);
});

test("all 44 exact legacy equipment-selector choices are represented once", () => {
  const section = sectionBetween("## 2. Equipment definition candidate inventory", "## 3. Optional exercise-library curation matrix");
  const rows = tableRows(section, line => /^\| \d+ \|/.test(line));
  assert.equal(rows.length, 44);
  const labels = rows.map(line => line.split("|")[3].trim());
  assert.equal(new Set(labels).size, 44);
  assert.ok(labels.includes("Chest press machine"));
  assert.ok(labels.includes("Leg press machine"));
  assert.ok(labels.includes("Bodyweight only — no equipment"));
  assert.ok(labels.includes("Sled / farmer carry handles"));
  assert.ok(rows.every(line => !/\bAPPROVED\b/.test(line)));
});

test("all 42 optional-library entries retain unique source labels", () => {
  const section = sectionBetween("## 3. Optional exercise-library curation matrix", "## 4. Original five-day programme");
  const rows = tableRows(section, line => /^\| \d+ \|/.test(line));
  assert.equal(rows.length, 42);
  assert.equal(new Set(rows.map(line => line.split("|")[2].trim())).size, 42);
  assert.ok(rows.some(line => line.includes("High Knees (low-impact option available)")));
  assert.ok(rows.some(line => line.includes("Superman / Back Extension")));
  assert.ok(rows.some(line => line.includes("Hip / Ankle Mobility")));
});

test("all 32 original programme slots retain unique IDs and stay unassigned", () => {
  const section = sectionBetween("## 4. Original five-day programme", "## 5. Injury-aware metadata");
  const rows = tableRows(section, line => line.includes("legacy-base-day-"));
  assert.equal(rows.length, 32);
  const ids = rows.map(line => line.split("|")[1].trim());
  assert.equal(new Set(ids).size, 32);
  assert.ok(ids.includes("legacy-base-day-01-slot-01"));
  assert.ok(ids.includes("legacy-base-day-05-slot-06"));
  assert.ok(rows.every(line => line.trimEnd().endsWith("| UNASSIGNED |")));
});

test("catalogue and injury safety boundaries are explicit", () => {
  assert.match(source, /does not carry or resolve a system equipment-definition collection/);
  assert.match(source, /Do not write system catalogue definitions into it/);
  assert.match(source, /Unknown or unreviewed fields mean \*\*not assessed\*\*/);
  assert.match(source, /direct and secondary loading/);
  assert.match(source, /readiness result must never silently clear it/);
  assert.match(source, /existing catalogue-delivery approval did not create equipment definitions/);
});
