const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Characterization tests for the protected V21.1 source. These deliberately
// record the existing collision behaviour; they do not endorse it as the
// identity policy for future code. Keep index.html read-only on this branch.
const legacySource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

function extractFunction(name) {
  const start = legacySource.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "V21.1 source must contain " + name);
  const next = legacySource.indexOf("\nfunction ", start + 1);
  return legacySource.slice(start, next === -1 ? undefined : next);
}

function makeLegacyContext(overrides = {}) {
  const elements = {
    week: { value: "3" },
    day: { value: "1" },
    weekPrefillNotice: { textContent: "" },
    e0s1w: { value: "", dataset: {} },
    e0s1r: { value: "", dataset: {} }
  };
  const values = new Map();
  const context = {
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); }
    },
    $(id) { return elements[id] || null; },
    activeExercises() { return [["Bench Press"]]; },
    getExerciseConfig() { return { setCount: 1 }; },
    allLogs() { return []; },
    ...overrides
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunction("normaliseExerciseName"),
    extractFunction("exerciseConfigKey"),
    extractFunction("prefillFromPreviousWeek"),
    extractFunction("exerciseHistoryForDay")
  ].join("\n"), context);
  return { context, elements, values };
}

test("V21.1 exercise configuration keys collide for punctuation variants", () => {
  const { context } = makeLegacyContext();
  assert.equal(
    context.exerciseConfigKey(1, "Bench-Press"),
    context.exerciseConfigKey(1, "Bench Press")
  );
  assert.equal(
    context.exerciseConfigKey(1, "RDL (DB)"),
    context.exerciseConfigKey(1, "RDL DB")
  );
});

test("V21.1 previous-week prefill can select the first normalised collision, not the exact name", () => {
  const { context, elements, values } = makeLegacyContext();
  values.set("gym-comeback-w2-d1", JSON.stringify({
    exercises: [
      { name: "Bench-Press", sets: [{ weight: "100", reps: "1" }] },
      { name: "Bench Press", sets: [{ weight: "20", reps: "10" }] }
    ]
  }));

  assert.equal(context.prefillFromPreviousWeek(), true);
  // The active exercise is exactly "Bench Press", but .find() takes the
  // earlier "Bench-Press" record because both names normalise identically.
  assert.equal(elements.e0s1w.value, "100");
  assert.equal(elements.e0s1r.value, "1");
});

test("V21.1 history lookup can attribute the first normalised collision to another name", () => {
  const log = {
    week: 2,
    day: 1,
    date: "2026-11-10",
    exercises: [
      { name: "Bench-Press", sets: [{ weight: "100", reps: "1", duration: "" }] },
      { name: "Bench Press", sets: [{ weight: "20", reps: "10", duration: "" }] }
    ]
  };
  const { context } = makeLegacyContext({ allLogs: () => [log] });

  const history = context.exerciseHistoryForDay(1, "Bench Press");
  assert.equal(history.length, 1);
  assert.equal(history[0].maxWeight, 100);
  assert.equal(history[0].maxReps, 1);
});
