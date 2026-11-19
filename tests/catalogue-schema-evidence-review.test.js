"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "docs", "V21.2-CATALOGUE-SCHEMA-EVIDENCE-REVIEW.md");
const source = fs.readFileSync(file, "utf8");

test("catalogue schema review matches the live V6/V2/v1 architecture baseline", () => {
  assert.match(source, /IndexedDB schema v6, full backup format V2, catalogue manifest\/payload schema v1/);
  assert.match(source, /does not carry or resolve a system equipment-definition collection/);
  assert.match(source, /only by_module index/);
  assert.match(source, /preferred progression focus and recording-mode override/);
});

test("system equipment definitions remain separate from the personal equipment store", () => {
  assert.match(source, /Keep system definitions in the verified release bytes/);
  assert.match(source, /Do not store system equipment definitions in the current equipment store/);
  assert.match(source, /dedicated release-specific CacheStorage namespace/i);
  assert.match(source, /equipmentDefinitions IndexedDB store is proposed/);
});

test("equipment requirement alternatives have explicit OR-of-AND semantics", () => {
  assert.match(source, /Every requirement group must be satisfied/);
  assert.match(source, /within one group, the user may satisfy any one complete alternative/i);
  assert.match(source, /Every equipment ID within a chosen alternative must be available/);
  assert.match(source, /reviewed “no equipment required” declaration is different from an absent\/unknown requirements field/);
});

test("injury metadata uses fail-closed three-state candidate screening", () => {
  assert.match(source, /Known conflict/);
  assert.match(source, /Unknown \/ incomplete/);
  assert.match(source, /Reviewed candidate/);
  assert.match(source, /An absent body-region entry by itself is never proof/);
  assert.match(source, /must never clear a restriction/);
  assert.match(source, /not medical clearance/);
});

test("persistent restrictions have a separate schema and backup approval gate", () => {
  assert.match(source, /dedicated trainingRestrictions store/);
  assert.match(source, /new version and require a backup format/);
  assert.match(source, /No schema or backup change is approved here/);
  assert.match(source, /The restriction store \(C3\) is a separate approval/);
});

test("the design creates no real IDs or production data", () => {
  assert.match(source, /No catalogue payload, production IDs, equipment definitions, movement metadata/);
  assert.match(source, /This review is design only/);
});
