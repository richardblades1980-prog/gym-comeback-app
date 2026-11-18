const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/data/integrity.js"), "utf8"), sandbox);
const integrity = sandbox.window.ProjectComebackIntegrity;
function data() {
 const d={}; integrity.stores.forEach(name=>d[name]=[]);
 d.sessions.push({id:"s1",moduleId:"gym",status:"in-progress"});
 d.exerciseRecords.push({id:"e1",sessionId:"s1",moduleId:"gym"});
 d.setRecords.push({id:"set1",sessionId:"s1",exerciseRecordId:"e1",moduleId:"gym"});
 d.exerciseDefinitions.push({id:"def1"});
 d.exerciseVariations.push({id:"var1",exerciseDefinitionId:"def1"});
 d.exerciseRecords[0].exerciseDefinitionId="def1";
 d.exerciseRecords[0].exerciseVariationId="var1";
 d.catalogueReleases.push({id:"release1"});
 d.metadata.push({id:"active-exercise-catalogue-release",value:{releaseId:"release1"}});
 d.programmes.push({id:"programme1"});
 d.programmeVersions.push({id:"version1",programmeId:"programme1",status:"draft"});
 d.programmeDays.push({id:"day1",programmeVersionId:"version1"});
 d.programmeSlots.push({id:"slot1",programmeVersionId:"version1",programmeDayId:"day1"});
 return d;
}
test("clean cross-store graph reports PASS with no findings",()=>{
 const report=integrity.diagnoseData(data());
 assert.equal(report.status,"pass");assert.equal(report.valid,true);assert.equal(report.summary.findings,0);
});
test("reports missing parent and inconsistent set-session graph as errors",()=>{
 const d=data();
 d.exerciseRecords[0].sessionId="missing-session";
 d.setRecords[0].sessionId="different-session";
 const report=integrity.diagnoseData(d);
 const codes=report.findings.map(f=>f.code);
 assert.ok(codes.includes("EXERCISE_SESSION_MISSING"));
 assert.ok(codes.includes("SET_EXERCISE_SESSION_MISMATCH"));
 assert.equal(report.status,"error");
});
test("reports orphaned identity and programme references",()=>{
 const d=data();
 d.exerciseAliases.push({id:"alias1",exerciseDefinitionId:"missing-def"});
 d.programmeSlots[0].programmeDayId="missing-day";
 d.programmeSlots.push({id:"slot2",programmeDayId:"day1",programmeVersionId:"other-version"});
 const codes=integrity.diagnoseData(d).findings.map(f=>f.code);
 assert.ok(codes.includes("ALIAS_DEFINITION_MISSING"));
 assert.ok(codes.includes("PROGRAMME_SLOT_DAY_MISSING"));
 assert.ok(codes.includes("PROGRAMME_SLOT_DAY_VERSION_MISMATCH"));
});
test("missing optional references are ignored; unresolved optional review/config refs are warnings",()=>{
 const d=data();
 d.exerciseRecords[0].exerciseDefinitionId=undefined;
 d.identityReviewEvents.push({id:"event1",catalogueReleaseId:"not-retained"});
 d.exerciseConfigurations.push({id:"config1",profileId:"profile-missing",exerciseDefinitionId:"def1"});
 const report=integrity.diagnoseData(d);
 assert.equal(report.status,"warning");
 assert.equal(report.summary.errors,0);
 assert.ok(report.findings.some(f=>f.code==="REVIEW_RELEASE_MISSING"&&f.severity==="warning"));
 assert.ok(report.findings.some(f=>f.code==="CONFIG_PROFILE_MISSING"&&f.severity==="warning"));
});
test("active catalogue pointer with missing release is an error",()=>{
 const d=data();d.metadata[0].value.releaseId="lost-release";
 assert.ok(integrity.diagnoseData(d).findings.some(f=>f.code==="ACTIVE_CATALOGUE_RELEASE_MISSING"));
});
