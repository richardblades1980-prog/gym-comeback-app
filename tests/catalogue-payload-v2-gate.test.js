"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "docs", "V21.2-G2-CATALOGUE-PAYLOAD-V2-GATE.md");
const source = fs.readFileSync(file, "utf8");

test("C1 is a G2 HOLD and explicitly requires owner approval", () => {
  assert.match(source, /Classification:\*\* G2/);
  assert.match(source, /Status:\*\* \*\*HOLD/);
  assert.match(source, /Owner decision:\*\* HOLD/);
  assert.match(source, /No implementation is authorised by preparing this gate/);
});

test("v2 extends but does not rewrite the verified v1 catalogue release contract", () => {
  assert.match(source, /current v1 validation path/);
  assert.match(source, /A v1 release does not have structured equipment definitions/);
  assert.match(source, /A client that cannot read v2 must never be directed to a v2 manifest\/asset/);
  assert.match(source, /do not rewrite v1 manifests or release payloads/);
});

test("system equipment definitions remain in verified release bytes without a new DB or backup format", () => {
  assert.match(source, /Keep IndexedDB at schema v6/);
  assert.match(source, /Keep full personal backup at format V2/);
  assert.match(source, /system equipment definitions and controlled vocabularies in the immutable versioned catalogue asset/);
  assert.match(source, /No new IndexedDB store, index, schema version or migration/);
  assert.match(source, /No new personal backup format/);
});

test("equipment requirement groups define AND, OR and bundle semantics", () => {
  assert.match(source, /Across groups = AND/);
  assert.match(source, /Within a group = OR/);
  assert.match(source, /Within one alternative = AND/);
  assert.match(source, /reviewed-none/);
  assert.match(source, /incomplete/);
  assert.match(source, /substring\/name similarity/);
});

test("movement-demand metadata fails closed and is review-bound", () => {
  assert.match(source, /movementDemandReviewStatus/);
  assert.match(source, /Missing, null, stale or incomplete data means \*\*unknown\*\*/);
  assert.match(source, /known conflict/);
  assert.match(source, /unknown\/incomplete/);
  assert.match(source, /reviewed candidate/);
  assert.match(source, /does not authenticate a reviewer or prove professional qualification/);
  assert.match(source, /provide medical clearance/);
});

test("C3 restrictions, UI, production asset, and Adaptive Brain are expressly excluded", () => {
  assert.match(source, /No persistent training restriction store \(C3 is separate\)/);
  assert.match(source, /No exercise-library\/Equipment UI/);
  assert.match(source, /No production catalogue records or IDs/);
  assert.match(source, /does not authorise a production v2 asset/);
  assert.match(source, /Do not bundle C3 into C1/);
});

test("the gate includes failure recovery and exact-SHA evidence requirements", () => {
  assert.match(source, /Wrong digest, byte length or MIME type/);
  assert.match(source, /prior release remains usable/);
  assert.match(source, /real CacheStorage retains catalogue releases/);
  assert.match(source, /full browser and backup workflows on the exact final commit SHA/);
});

test("protected branch and Pages candidate remain outside the gate", () => {
  assert.match(source, /0d0527a6463c3cfd0fbb54d69123316c9a384b42/);
  assert.match(source, /a721d7eab7fd0fa57a9f19a094cbc6c2ac24b4dd/);
});
