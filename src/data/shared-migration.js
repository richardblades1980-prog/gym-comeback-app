/* Project Comeback V21.2A — pure normalisation of V21.1 shared Gym setup data.
 * Typed records are convenience projections; every source key and raw string remains
 * in legacyRecords and is also attached to its projected record for auditability.
 */
(function (global) {
  "use strict";

  function parse(raw, key, warnings) {
    if (raw === null || raw === undefined || raw === "") return null;
    try { return JSON.parse(raw); }
    catch (error) {
      warnings.push({ key, reason: "Invalid JSON; retained only in legacyRecords." });
      return null;
    }
  }

  function record(id, value, key, raw, extra) {
    return Object.assign({
      id,
      value,
      legacyKey: key,
      legacyRawValue: raw
    }, extra || {});
  }

  function normaliseSharedSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new Error("A legacy snapshot object is required.");
    }
    const profile = [];
    const equipment = [];
    const readiness = [];
    const weighIns = [];
    const preferences = [];
    const warnings = [];

    for (const key of Object.keys(snapshot).sort()) {
      const raw = snapshot[key];
      if (key === "gym-comeback-profile") {
        const warningCount = warnings.length;
        const value = parse(raw, key, warnings);
        if (value && typeof value === "object" && !Array.isArray(value)) {
          profile.push(record("gym-profile", value, key, raw, { scope: "gym-legacy-profile" }));
        } else if (raw !== null && warnings.length === warningCount) warnings.push({ key, reason: "Profile is not an object; retained only in legacyRecords." });
        continue;
      }

      if (key === "gym-comeback-gear" || key === "gym-comeback-custom-gear") {
        const warningCount = warnings.length;
        const value = parse(raw, key, warnings);
        if (value && typeof value === "object" && !Array.isArray(value)) {
          equipment.push(record(key.endsWith("custom-gear") ? "gym-custom-equipment" : "gym-equipment",
            value, key, raw, { moduleId: "gym", equipmentKind: key.endsWith("custom-gear") ? "custom" : "selected" }));
        } else if (raw !== null && warnings.length === warningCount) warnings.push({ key, reason: "Equipment data is not an object; retained only in legacyRecords." });
        continue;
      }

      if (key === "gym-comeback-weigh-ins") {
        const warningCount = warnings.length;
        const value = parse(raw, key, warnings);
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (!item || typeof item !== "object" || typeof item.date !== "string") {
              warnings.push({ key, reason: "A weigh-in entry has an unsupported shape; original retained." });
              return;
            }
            const weight = Number(item.weight);
            if (!Number.isFinite(weight) || weight <= 0) {
              warnings.push({ key, reason: "A weigh-in has an invalid weight; original retained." });
              return;
            }
            weighIns.push({
              id: "gym-weigh-in-" + item.date,
              date: item.date,
              weight,
              moduleId: "gym",
              legacyKey: key,
              legacyRawValue: JSON.stringify(item),
              legacyIndex: index
            });
          });
        } else if (raw !== null && warnings.length === warningCount) warnings.push({ key, reason: "Weigh-ins are not an array; retained only in legacyRecords." });
        continue;
      }

      if (key === "gym-comeback-readiness") {
        const warningCount = warnings.length;
        const value = parse(raw, key, warnings);
        if (value && typeof value === "object" && !Array.isArray(value)) {
          Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, item]) => {
            readiness.push({
              id: "gym-readiness-" + date,
              date,
              moduleId: "gym",
              value: item,
              legacyKey: key,
              legacyRawValue: JSON.stringify(item)
            });
          });
        } else if (raw !== null && warnings.length === warningCount) warnings.push({ key, reason: "Readiness data is not a date-keyed object; retained only in legacyRecords." });
        continue;
      }

      // Workout logs and their per-session status snapshots are normalised by the
      // Gym migration service; do not duplicate them as generic preferences.
      if (/^gym-comeback-w\d+-d\d+$/.test(key) ||
          /^gym-comeback-set-status-v1-/.test(key) ||
          /^gym-comeback-active-session-v1-/.test(key)) continue;

      // Preserve every remaining recognised setting as an independently addressable
      // preference record. This includes plan length, display preferences, rest timer
      // settings, day selections, swaps, extras, exercise configs and day unlocks.
      if (key.startsWith("gym-comeback-")) {
        const value = parse(raw, key, warnings);
        preferences.push(record("legacy:" + key, value === null ? raw : value, key, raw, {
          moduleId: "gym",
          preferenceKind: classifyPreference(key),
          rawIsJson: value !== null
        }));
      }
    }

    return {
      profile,
      equipment,
      readiness,
      weighIns,
      preferences,
      warnings,
      counts: {
        profiles: profile.length,
        equipment: equipment.length,
        readiness: readiness.length,
        weighIns: weighIns.length,
        preferences: preferences.length
      }
    };
  }

  function classifyPreference(key) {
    if (key.includes("swaps-day")) return "exercise-swaps";
    if (key.includes("extras-day")) return "exercise-extras";
    if (key.includes("ex-config-v1-")) return "exercise-configuration";
    if (key.includes("day-unlock-v1-")) return "day-unlock";
    if (key.includes("adapted-day")) return "adapted-day";
    if (key.startsWith("gym-comeback-pref-")) return "display-preference";
    if (key.includes("rest-")) return "rest-timer";
    if (key.includes("landing-page") || key.includes("preferred-day") || key.includes("max-weeks")) return "programme-preference";
    return "legacy-setting";
  }

  global.ProjectComebackSharedMigration = Object.freeze({
    normaliseSnapshot: normaliseSharedSnapshot
  });
})(window);
