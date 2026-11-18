"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function extractBalanced(source, marker, opener) {
  const markerAt = source.indexOf(marker);
  assert.notEqual(markerAt, -1, "Missing source marker: " + marker);
  const start = source.indexOf(opener, markerAt);
  assert.notEqual(start, -1, "Missing container after source marker: " + marker);
  const closer = opener === "[" ? "]" : "}";
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index++) {
    const current = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (current === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (current === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (current === "\\") {
        escaped = true;
        continue;
      }
      if (current === quote) quote = null;
      continue;
    }
    if (current === "/" && next === "/") {
      lineComment = true;
      index++;
      continue;
    }
    if (current === "/" && next === "*") {
      blockComment = true;
      index++;
      continue;
    }
    if (current === "'" || current === '"' || current === "\x60") {
      quote = current;
      continue;
    }
    if (current === opener) depth++;
    if (current === closer) {
      depth--;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("Unterminated source container after marker: " + marker);
}

function readQuoted(source, start) {
  const quote = source[start];
  let value = "";
  for (let index = start + 1; index < source.length; index++) {
    const current = source[index];
    if (current === "\\") {
      value += source[index + 1];
      index++;
    } else if (current === quote) {
      return { value, next: index + 1 };
    } else {
      value += current;
    }
  }
  throw new Error("Unterminated source string.");
}

function topLevelArrayRowNames(arraySource) {
  const names = [];
  let depth = 0;
  for (let index = 0; index < arraySource.length; index++) {
    const current = arraySource[index];
    if (current === "'" || current === '"' || current === "\x60") {
      index = readQuoted(arraySource, index).next - 1;
      continue;
    }
    if (current === "[") {
      if (depth === 1) {
        let first = index + 1;
        while (/\s/.test(arraySource[first] || "")) first++;
        if (arraySource[first] === "'" || arraySource[first] === '"') {
          names.push(readQuoted(arraySource, first).value);
        }
      }
      depth++;
    } else if (current === "]") {
      depth--;
    }
  }
  return names;
}

function tableCells(line) {
  return line.split("|").slice(1, -1).map(cell => cell.trim());
}

const legacySource = read("index.html");
const librarySource = extractBalanced(legacySource, "const bodyExerciseLibrary", "[");
const descriptionsSource = extractBalanced(legacySource, "const machineDescriptions", "{");
const optionalNames = topLevelArrayRowNames(librarySource);
const descriptionNames = [...descriptionsSource.matchAll(/['"]([^'"]+)['"]\s*:\s*\[/g)].map(match => match[1]);
const draftDocument = read("docs/V21.2-EXERCISE-GUIDE-CONTENT-DRAFT.md");
const draftNames = draftDocument.split(/\r?\n/).filter(line => /^#### /.test(line)).map(line => line.slice(5));
const readinessDocument = read("docs/V21.2-EXERCISE-GUIDE-REVIEW-READINESS.md");
const queueLines = readinessDocument.split(/\r?\n/).filter(line => /^\| (Existing|Draft) \|/.test(line));
const queueRows = queueLines.map(line => {
  const cells = tableCells(line);
  return { set: cells[0], name: cells[1], status: cells[2] };
});
const programmeSource = read("src/data/gym-base-programme.js");
const programmeSlots = [...programmeSource.matchAll(/slot\((\d+),\s*(\d+),\s*"([^"]+)"/g)].map(match => ({
  day: Number(match[1]),
  position: Number(match[2]),
  label: match[3],
  slotId: "legacy-base-day-" + String(Number(match[1])).padStart(2, "0") +
    "-slot-" + String(Number(match[2])).padStart(2, "0")
}));
const assignmentLines = readinessDocument.split(/\r?\n/).filter(line => /^\| legacy-base-day-/.test(line));
const assignmentRows = assignmentLines.map(line => {
  const cells = tableCells(line);
  return { slotId: cells[0], label: cells[2], assignment: cells[4] };
});
const registry = JSON.parse(read("v21.2/assets/exercise-guide-registry.v2.json"));

test("live source inventory counts and exact intersections are reconciled", () => {
  assert.equal(optionalNames.length, 42);
  assert.equal(new Set(optionalNames).size, 42);
  assert.equal(descriptionNames.length, 25);
  assert.equal(new Set(descriptionNames).size, 25);
  assert.equal(optionalNames.filter(name => descriptionNames.includes(name)).length, 15);
  assert.equal(optionalNames.filter(name => !descriptionNames.includes(name)).length, 27);
});

test("all 27 draft guides exactly cover generic-fallback optional-library rows", () => {
  const genericFallbackNames = optionalNames.filter(name => !descriptionNames.includes(name));
  assert.equal(draftNames.length, 27);
  assert.equal(new Set(draftNames).size, 27);
  assert.deepEqual([...draftNames].sort(), [...genericFallbackNames].sort());
});

test("review queue covers all 25 existing descriptions and 27 drafts exactly once", () => {
  assert.equal(queueRows.length, 52);
  const existingRows = queueRows.filter(row => row.set === "Existing");
  const draftRows = queueRows.filter(row => row.set === "Draft");
  assert.deepEqual(existingRows.map(row => row.name).sort(), [...descriptionNames].sort());
  assert.deepEqual(draftRows.map(row => row.name).sort(), [...draftNames].sort());

  const counts = queueRows.reduce((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, {
    "Ready for qualified review": 35,
    "Needs clarification": 15,
    "Hold": 2
  });
  for (const name of ["Hip / Ankle Mobility", "Superman / Back Extension"]) {
    assert.equal(draftRows.find(row => row.name === name).status, "Hold");
  }
  for (const name of [
    "Dumbbell Shoulder Press",
    "Machine Chest Press",
    "Machine Shoulder Press",
    "Leg Press Machine",
    "Leg Extension Machine",
    "Leg Curl Machine",
    "Abdominal Crunch Machine"
  ]) {
    assert.equal(draftRows.find(row => row.name === name).status, "Needs clarification");
  }
});

test("all 32 source programme slots have exact unassigned queue rows", () => {
  assert.equal(programmeSlots.length, 32);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(day => programmeSlots.filter(slot => slot.day === day).length),
    [7, 7, 6, 6, 6]
  );
  assert.equal(new Set(programmeSlots.map(slot => slot.slotId)).size, 32);
  assert.equal(assignmentRows.length, 32);
  assert.deepEqual(assignmentRows.map(row => row.slotId), programmeSlots.map(slot => slot.slotId));
  assert.deepEqual(assignmentRows.map(row => row.label), programmeSlots.map(slot => slot.label));
  assert.ok(assignmentRows.every(row => row.assignment === "UNASSIGNED"));
});

test("production registry remains empty and reviews remain human evidence", () => {
  assert.equal(registry.schemaVersion, 2);
  assert.deepEqual(registry.guides, []);
  assert.deepEqual(registry.assetSets, []);
  assert.deepEqual(registry.reviews, []);
  assert.deepEqual(registry.assignments, []);
  assert.match(readinessDocument, /qualification\/credential type/);
  assert.match(readinessDocument, /qualification-evidence reference/);
  assert.match(readinessDocument, /content digest/);
  assert.match(readinessDocument, /Asset-set approval and programme-slot assignment approval are separate/);
  assert.match(readinessDocument, /Any change to title, setup, steps\/order, cues, safety notes/);
  assert.match(readinessDocument, /re-evaluate every assignment against the new snapshot/);
});
