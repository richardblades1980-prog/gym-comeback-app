"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const STEP_TIMEOUT_MS = 20000;
console.log("[browser] Starting Chromium validation");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif" };
const testServerState = { serveGuideWorkerV2: false, failGuideAsset: false };
function server() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (pathname === "/v21.2/sw.js" && testServerState.serveGuideWorkerV2) {
      fs.readFile(path.join(root, "v21.2/sw.js"), "utf8", (err, source) => {
        if (err) { res.writeHead(500).end("Unable to read service worker"); return; }
        const updated = source
          .replace('const GUIDE_CACHE_NAME=GUIDE_CACHE_PREFIX+"v1";', 'const GUIDE_CACHE_NAME=GUIDE_CACHE_PREFIX+"v2";')
          .replace("// Guide artwork and its manifest are served only from their dedicated verified cache.",
            "// Forced test update: new immutable guide cache version.");
        res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" });
        res.end(updated);
      });
      return;
    }
    if (testServerState.failGuideAsset &&
        pathname === "/v21.2/assets/guides/v1/equipment/equipment-bands.svg") {
      res.writeHead(503, { "content-type": "text/plain", "cache-control": "no-store" }).end("Intentional failed-update fixture");
      return;
    }
    const file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    fs.stat(file, (err, stat) => {
      const target = !err && stat.isDirectory() ? path.join(file, "index.html") : file;
      fs.readFile(target, (readErr, data) => {
        if (readErr) { res.writeHead(404).end("Not found"); return; }
        res.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream", "cache-control": "no-store" });
        res.end(data);
      });
    });
  });
}
(async () => {
  const httpServer = server();
  await new Promise(resolve => httpServer.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + httpServer.address().port;
  const browser = await chromium.launch({ headless: true });
  browser.on("disconnected", () => console.error("[browser] Chromium disconnected"));
  let appContext = null;
  let phoneProfile = null;
  try {
    const context = await browser.newContext();
    context.setDefaultTimeout(STEP_TIMEOUT_MS);
    context.setDefaultNavigationTimeout(STEP_TIMEOUT_MS);
    console.log("[browser] Migration fixture");
    const page = await context.newPage();
    page.on("pageerror", error => console.error("BROWSER PAGE ERROR:", error.message));
    page.on("console", message => { if (message.type() === "error") console.error("BROWSER CONSOLE:", message.text()); });
    page.on("requestfailed", request => console.error("BROWSER REQUEST FAILED:", request.url(), request.failure()?.errorText));
    await page.addInitScript(() => {
      localStorage.setItem("gym-comeback-profile", JSON.stringify({ goal: "strength", age: 45 }));
      localStorage.setItem("gym-comeback-w1-d1", JSON.stringify({
        date: "2026-11-15", sessionTime: "42", exercises: [
          { name: "Goblet squat", setCount: 2, sets: [{ weight: "12", reps: "10" }, { weight: "12", reps: "10" }] }
        ]
      }));
      localStorage.setItem("gym-comeback-set-status-v1-1-1-2026-11-15-sessionA",
        JSON.stringify({ "Goblet squat::1": "complete", "Goblet squat::2": "complete" }));
    });
    await page.goto(base + "/tests/fixtures/browser-migration.html");
    try {
      await page.waitForFunction(() => {
        const text = document.querySelector("#result").textContent;
        if (!text.startsWith("{")) return false;
        try {
          const result = JSON.parse(text);
          return Boolean(result.error || result.firstStatus);
        } catch (_) {
          return false;
        }
      }, null, { timeout: 15000 });
    } catch (error) {
      throw new Error("Migration fixture did not finish. DOM result: " + await page.locator("#result").textContent());
    }
    const first = JSON.parse(await page.locator("#result").textContent());
    if (first.error) throw new Error("Browser migration failed: " + first.error);
    if (first.firstStatus !== "complete" || first.secondStatus !== "already-complete" ||
        first.sessions !== 1 || first.profile !== 1 || first.raw !== 3 ||
        first.markerStatus !== "complete" || !first.originalWorkout || !first.originalProfile) {
      throw new Error("Unexpected migration result: " + JSON.stringify(first));
    }
    await page.reload();
    await page.waitForFunction(() => document.querySelector("#result").textContent.includes('"markerStatus":"complete"'));
    const reload = JSON.parse(await page.locator("#result").textContent());
    if (reload.firstStatus !== "already-complete" || reload.sessions !== 1) {
      throw new Error("Reload/retry was not idempotent: " + JSON.stringify(reload));
    }
    console.log("PASS browser migration, IndexedDB persistence, localStorage preservation, retry and reload");

    console.log("[browser] Offline fixture");
    const offline = await context.newPage();
    await offline.goto(base + "/tests/fixtures/offline/");
    await offline.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
    await offline.reload();
    await offline.evaluate(() => new Promise((resolve, reject) => {
      if (navigator.serviceWorker.controller) return resolve();
      const timer = setTimeout(() => reject(new Error("Offline fixture controllerchange timeout")), 15000);
      navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once: true });
    }));
    await context.setOffline(true);
    await offline.reload();
    const shell = await offline.locator("#shell").textContent();
    const loaded = await offline.locator("html").getAttribute("data-shell-loaded");
    if (!shell.includes("offline shell ready") || loaded !== "true") {
      throw new Error("Offline app shell did not load from the scoped cache.");
    }

    console.log("PASS offline app shell served from /tests/fixtures/offline/ service-worker scope");

    console.log("[browser] Real V21.2 application");
    phoneProfile = fs.mkdtempSync(path.join(os.tmpdir(), "project-comeback-phone-profile-"));
    appContext = await chromium.launchPersistentContext(phoneProfile, { headless: true, acceptDownloads: true });
    appContext.setDefaultTimeout(STEP_TIMEOUT_MS);
    appContext.setDefaultNavigationTimeout(STEP_TIMEOUT_MS);
    const app = await appContext.newPage();
    const appPageErrors = [];
    app.on("pageerror", error => { appPageErrors.push(error.message); console.error("V21.2 APP PAGE ERROR:", error.stack || error.message); });
    app.on("console", message => { if (message.type() === "error") console.error("V21.2 CONSOLE:", message.text()); });
    await app.addInitScript(() => {
      localStorage.setItem("gym-comeback-profile", JSON.stringify({ goal: "strength", age: 45 }));
      localStorage.setItem("gym-comeback-w1-d1", JSON.stringify({
        date: "2026-11-16", sessionTime: "42", exercises: [
          { name: "Goblet squat", setCount: 2, sets: [{ weight: "12", reps: "10" }, { weight: "12", reps: "10" }] }
        ]
      }));
      localStorage.setItem("gym-comeback-set-status-v1-1-1-2026-11-16-sessionA",
        JSON.stringify({ "Goblet squat::1": "complete", "Goblet squat::2": "complete" }));
    });
    await app.goto(base + "/v21.2/");
    const testDates = await app.evaluate(() => {
      const iso = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
      const today = new Date();
      const addDays = days => {
        const date = new Date(today);
        date.setDate(date.getDate() + days);
        return iso(date);
      };
      return {
        today: iso(today),
        future: addDays(1),
        afterTomorrow: addDays(2),
        celebrationDay1: addDays(20),
        celebrationDay2: addDays(21),
        celebrationDay3: addDays(22)
      };
    });
    if (await app.locator('[data-view="overview"]').getAttribute("aria-current") !== "page") {
      throw new Error("Initial navigation state is not exposed accessibly.");
    }
    console.log("[browser] Keyboard skip navigation");
    if (await app.locator(".skip-link").count() !== 1 ||
        await app.locator("#main-content").getAttribute("tabindex") !== "-1") {
      throw new Error("Keyboard skip navigation is missing.");
    }
    await app.keyboard.press("Tab");
    if (await app.evaluate(() => document.activeElement?.classList.contains("skip-link")) !== true) {
      throw new Error("Skip link is not the first keyboard focus target.");
    }
    await app.keyboard.press("Enter");
    if (await app.evaluate(() => document.activeElement?.id) !== "main-content") {
      throw new Error("Skip link did not move focus to the main landmark.");
    }
    console.log("PASS skip link is first keyboard target and moves focus to main content");
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    const identityOfflineAsset = await app.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const assetUrl = new URL("./assets/exercise-identity.js", location.href).href;
      const names = await caches.keys();
      let cached = false;
      for (const name of names) {
        const response = await (await caches.open(name)).match(assetUrl);
        if (response) { cached = true; break; }
      }
      return { loaded: typeof ProjectComebackIdentity === "object", cached };
    });
    if (!identityOfflineAsset.loaded || !identityOfflineAsset.cached) {
      throw new Error("Canonical identity service was not loaded and retained in the real V21.2 offline app shell: " + JSON.stringify(identityOfflineAsset));
    }
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    if (!(await app.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
      throw new Error("The real V21.2 app was not controlled by its service worker before offline validation.");
    }
    await appContext.setOffline(true);
    const offlineGuideFetch = await app.evaluate(async () => {
      const urls = ["./assets/guides/v1/equipment/equipment-bands.svg","./assets/celebrations/v1/celebration-day1.gif"];
      const results = [];
      for (const url of urls) {
        const response = await fetch(url);
        results.push({ ok: response.ok, bytes: (await response.arrayBuffer()).byteLength });
      }
      return results;
    });
    if (offlineGuideFetch.length !== 2 || offlineGuideFetch.some(item => !item.ok || item.bytes < 1000)) {
      throw new Error("Guide artwork was not served from the dedicated cache while offline: " + JSON.stringify(offlineGuideFetch));
    }
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    const identityOfflineReload = await app.evaluate(() => ({
      loaded: typeof ProjectComebackIdentity === "object",
      title: document.title
    }));
    await appContext.setOffline(false);
    if (!identityOfflineReload.loaded || !identityOfflineReload.title.includes("V21.2")) {
      throw new Error("The real V21.2 app could not cold-start its canonical identity service offline: " + JSON.stringify(identityOfflineReload));
    }
    console.log("PASS canonical identity service is cached and the real V21.2 app cold-starts offline");

    const baseProgrammeAsset = await app.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const assetUrl = new URL("./assets/gym-base-programme.js", location.href).href;
      const names = await caches.keys();
      let cached = false;
      for (const name of names) {
        const response = await (await caches.open(name)).match(assetUrl);
        if (response) { cached = true; break; }
      }
      const validation = ProjectComebackGymBaseProgramme.validate();
      return { loaded: typeof ProjectComebackGymBaseProgramme === "object", cached, validation };
    });
    if (!baseProgrammeAsset.loaded || !baseProgrammeAsset.cached ||
        baseProgrammeAsset.validation.slotCount !== 32 ||
        baseProgrammeAsset.validation.dayCount !== 5) {
      throw new Error("Source-preserved Gym programme is not loaded and cached: " + JSON.stringify(baseProgrammeAsset));
    }
    console.log("PASS five-day Gym programme loads in the app and is available in the offline shell cache");

    console.log("[browser] Gym programme plan controls, sequential day lock and manual beta override");
    await app.locator('[data-view="gym"]').click();
    const planControls = await app.evaluate(() => ({
      weeks: [...document.querySelector("#gym-programme-weeks").options].map(option => option.value),
      weekOptions: [...document.querySelector("#gym-workout-week").options].map(option => option.value),
      daysPerWeek: document.querySelector("#gym-days-per-week").value,
      startDisabled: document.querySelector("#gym-workout-start").disabled
    }));
    if (planControls.weeks.join(",") !== "4,8,12" || planControls.weekOptions.join(",") !== "1,2,3,4" ||
        planControls.daysPerWeek !== "2" || planControls.startDisabled !== false) {
      throw new Error("Gym progression controls do not match the legacy plan defaults: " + JSON.stringify(planControls));
    }
    await app.locator("#gym-workout-day").selectOption("2");
    await app.waitForFunction(() => document.querySelector("#gym-workout-start").disabled);
    await app.locator("#gym-progression-override").click();
    await app.waitForFunction(() => !document.querySelector("#gym-workout-start").disabled);
    await app.locator("#gym-progression-override").click();
    await app.waitForFunction(() => document.querySelector("#gym-workout-start").disabled);
    await app.locator("#gym-workout-day").selectOption("1");
    await app.locator("#gym-workout-date").fill(testDates.today);
    console.log("PASS default 4-week/2-day plan, Day 2 locked until Day 1 completion, manual unlock and relock");

    console.log("[browser] Start, enter and resume a real Gym workout");
    await app.locator("#gym-workout-start").click();
    await app.waitForFunction(() => !document.querySelector("#gym-workout-active").hidden);
    const workoutGraph = await app.evaluate(async date => ({
      title: document.querySelector("#gym-workout-title").textContent,
      week: document.querySelector("#gym-workout-week").value,
      storedWeek: (await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", date])).find(session => session.status === "in-progress")?.week,
      historyText: document.querySelector("#gym-records .gym-history-entry")?.textContent || "",
      historyResumeButtons: document.querySelectorAll("#gym-records [data-history-resume]").length,
      exercises: document.querySelectorAll("#gym-workout-exercises .gym-exercise-card").length,
      sets: document.querySelectorAll("#gym-workout-exercises .gym-set-row").length,
      firstName: document.querySelector("#gym-workout-exercises .gym-exercise-card h3").textContent
    }), testDates.today);
    if (workoutGraph.week !== "1" || workoutGraph.storedWeek !== 1 || !workoutGraph.historyText.includes("Week 1 · Day 1") || !workoutGraph.historyText.includes("In progress") || workoutGraph.historyResumeButtons !== 1 || workoutGraph.exercises !== 7 || workoutGraph.sets !== 21 || workoutGraph.firstName !== "Chest Press Machine") {
      throw new Error("The Gym day 1 workout did not create the expected 7-exercise / 21-set graph: " + JSON.stringify(workoutGraph));
    }
    console.log("[browser] Manual exercise swap, equipment status, restore, and persisted source-slot identity");
    const firstCard = app.locator("#gym-workout-exercises .gym-exercise-card").first();
    await firstCard.locator("[data-gym-swap-name]").fill("Dumbbell Floor Press");
    await firstCard.locator("[data-gym-swap-equipment]").selectOption("available");
    await firstCard.locator('[data-gym-action="swap-save"]').click();
    await app.waitForFunction(() => document.querySelector("#gym-workout-exercises .gym-exercise-card h3").textContent === "Dumbbell Floor Press");
    const swapPersisted = await app.evaluate(async () => {
      const id = document.querySelector("[data-gym-swap-name]").dataset.exerciseId;
      const exercise = await ProjectComebackDB.get("exerciseRecords", id);
      return { name: exercise.name, performed: exercise.performedExerciseName, source: exercise.sourceExerciseLabel,
        slot: exercise.programmeSlotId, equipment: exercise.substitution && exercise.substitution.equipmentStatus,
        setCount: await ProjectComebackDB.getAllByIndex("setRecords", "by_exercise", id).then(items => items.length) };
    });
    if (swapPersisted.name !== "Chest Press Machine" || swapPersisted.performed !== "Dumbbell Floor Press" ||
        swapPersisted.source !== "Chest Press Machine" || swapPersisted.slot !== "legacy-base-day-01-slot-01" ||
        swapPersisted.equipment !== "available" || swapPersisted.setCount !== 3) {
      throw new Error("Manual swap changed source identity or failed to persist: " + JSON.stringify(swapPersisted));
    }
    await firstCard.locator('[data-gym-action="swap-restore"]').click();
    await app.waitForFunction(() => document.querySelector("#gym-workout-exercises .gym-exercise-card h3").textContent === "Chest Press Machine");
    console.log("PASS swap persisted as performed exercise, original source slot remained intact, and restore worked");

    // Exercise the timed-repetition UI against the real IndexedDB-backed workout record.
    await app.evaluate(async () => {
      const exerciseId = document.querySelector('[data-gym-field="weight"]').dataset.exerciseId;
      const exercise = await ProjectComebackDB.get("exerciseRecords", exerciseId);
      exercise.recordingMode = "timed-reps";
      await ProjectComebackDB.put("exerciseRecords", exercise);
    });
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    await app.locator('[data-view="gym"]').click();
    await app.locator("#gym-workout-day").selectOption("1");
    await app.locator("#gym-workout-date").fill(testDates.today);
    await app.waitForFunction(() => !document.querySelector("#gym-workout-active").hidden);
    const firstExercise = app.locator("#gym-workout-exercises .gym-exercise-card").first();
    await firstExercise.locator('[data-gym-action="timer-start"]').first().click();
    await app.waitForTimeout(1200);
    const runningBeforeReload = await app.evaluate(() => ({
      startedAt: Number(document.querySelector("[data-stopwatch-display]").dataset.stopwatchStartedAt),
      display: document.querySelector("[data-stopwatch-display]").textContent
    }));
    if (!Number.isFinite(runningBeforeReload.startedAt) || runningBeforeReload.startedAt <= 0) {
      throw new Error("Timed-set stopwatch did not persist its absolute start timestamp.");
    }
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    await app.locator('[data-view="gym"]').click();
    await app.locator("#gym-workout-day").selectOption("1");
    await app.locator("#gym-workout-date").fill(testDates.today);
    await app.waitForFunction(() => !document.querySelector("#gym-workout-active").hidden);
    const recovered = await app.evaluate(() => ({
      startedAt: Number(document.querySelector("[data-stopwatch-display]").dataset.stopwatchStartedAt),
      display: document.querySelector("[data-stopwatch-display]").textContent
    }));
    if (recovered.startedAt !== runningBeforeReload.startedAt || recovered.display === "00:00") {
      throw new Error("Running stopwatch did not recover after app reload: " + JSON.stringify({ runningBeforeReload, recovered }));
    }
    await app.locator('[data-gym-action="timer-stop"]').first().click();
    await app.waitForFunction(() => Number(document.querySelector('[data-gym-field="duration"]')?.value) >= 1);
    const stoppedDuration = await app.locator('[data-gym-field="duration"]').first().inputValue();
    if (Number(stoppedDuration) < 1) throw new Error("Stopping the stopwatch did not save elapsed seconds.");
    await app.locator('[data-gym-field="duration"]').first().fill("7");
    await app.locator('[data-gym-field="duration"]').first().dispatchEvent("change");
    await app.waitForFunction(() => document.querySelector('[data-gym-field="duration"]').value === "7");
    await app.waitForFunction(async () => {
      const exerciseId = document.querySelector('[data-gym-field="duration"]').dataset.exerciseId;
      const exercise = await ProjectComebackDB.get("exerciseRecords", exerciseId);
      const sets = await ProjectComebackDB.getAllByIndex("setRecords", "by_session", exercise.sessionId);
      return sets.some(set => set.exerciseRecordId === exerciseId && set.setNumber === 1 && set.duration === "7");
    });
    await app.locator('[data-gym-action="timer-reset"]').first().click();
    await app.waitForFunction(() => document.querySelector('[data-gym-field="duration"]').value === "");
    if (await app.locator('[data-gym-field="duration"]').first().inputValue() !== "") {
      throw new Error("Reset did not clear the stopwatch result.");
    }
    await firstExercise.locator('[data-gym-field="weight"]').first().fill("15");
    await firstExercise.locator('[data-gym-field="weight"]').first().dispatchEvent("change");
    await firstExercise.locator('[data-gym-field="reps"]').first().fill("12");
    await firstExercise.locator('[data-gym-field="reps"]').first().dispatchEvent("change");
    // Starting the stopwatch correctly marks this set in progress, so complete it directly.
    await firstExercise.locator('[data-gym-action="complete"]').first().click();
    await firstExercise.locator('[data-gym-action="undo"]').first().waitFor();
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    await app.locator('[data-view="gym"]').click();
    await app.locator("#gym-workout-day").selectOption("1");
    await app.locator("#gym-workout-date").fill(testDates.today);
    await app.waitForFunction(() => !document.querySelector("#gym-workout-active").hidden);
    const resumedWorkout = await app.evaluate(() => ({
      weight: document.querySelector('[data-gym-field="weight"]').value,
      reps: document.querySelector('[data-gym-field="reps"]').value,
      firstStatus: document.querySelector("#gym-workout-exercises .gym-set-row .gym-set-state").textContent,
      nextSetState: document.querySelectorAll("#gym-workout-exercises .gym-set-row")[1].querySelector(".gym-set-state").textContent,
      nextSetEnabled: !document.querySelectorAll("#gym-workout-exercises .gym-set-row")[1].querySelector("input").disabled,
      thirdSetLocked: document.querySelectorAll("#gym-workout-exercises .gym-set-row")[2].querySelector("input").disabled
    }));
    if (resumedWorkout.weight !== "15" || resumedWorkout.reps !== "12" ||
        !resumedWorkout.firstStatus.includes("completed") || !resumedWorkout.nextSetState.includes("not started") ||
        !resumedWorkout.nextSetEnabled || !resumedWorkout.thirdSetLocked) {
      throw new Error("Workout values or set state did not survive reload/resume: " + JSON.stringify(resumedWorkout));
    }
    console.log("[browser] Smart rest timer recovery and controls");
    await app.waitForFunction(() => !document.querySelector("#gym-rest-timer").hidden);
    const initialEnd = await app.evaluate(async date => (await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", date])).find(item => item.status === "in-progress")?.restEndAt, testDates.today);
    await app.locator('[data-gym-action="rest-add"]').click();
    await app.waitForFunction(() => document.querySelector("#gym-rest-timer").hidden === false);
    const extendedEnd = await app.evaluate(async date => {
      const session = await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", date]);
      return session.find(item => item.status === "in-progress")?.restEndAt;
    }, testDates.today);
    if (!Number.isFinite(extendedEnd) || extendedEnd < initialEnd + 15000) throw new Error("Rest timer end timestamp was not extended and persisted after +15: "+JSON.stringify({initialEnd,extendedEnd}));
    await app.locator('[data-gym-action="rest-skip"]').click();
    await app.waitForFunction(() => document.querySelector("#gym-rest-timer").hidden);
    await app.locator("#gym-rest-alert-mode").selectOption("visual");
    if (await app.evaluate(() => localStorage.getItem("gym-comeback-rest-alert")) !== "visual") throw new Error("Rest alert preference did not persist locally.");
    const restPreset = app.locator('[data-gym-field="restSeconds"]').first();
    await restPreset.selectOption("120");
    await app.waitForFunction(async () => {
      const exerciseId = document.querySelector('[data-gym-field="restSeconds"]').dataset.exerciseId;
      return (await ProjectComebackDB.get("exerciseRecords", exerciseId)).restSeconds === 120;
    });
    const secondSetRow = firstExercise.locator(".gym-set-row").nth(1);
    await secondSetRow.locator('[data-gym-action="start"]').click();
    await secondSetRow.locator('[data-gym-action="complete"]').click();
    await app.waitForFunction(() => !document.querySelector("#gym-rest-timer").hidden);
    const timerLabel = await app.locator("#gym-rest-label").textContent();
    if (!timerLabel.includes("after set 2")) throw new Error("Rest timer did not identify the completed set: " + timerLabel);
    const undoButton = secondSetRow.locator('[data-gym-action="undo"]');
    const undoTarget = {
      exerciseId: await undoButton.getAttribute("data-exercise-id"),
      setNumber: await undoButton.getAttribute("data-set-number")
    };
    if (undoTarget.setNumber !== "2") throw new Error("Browser undo control is not targeting set 2: " + JSON.stringify(undoTarget));
    await undoButton.click();
    await app.waitForFunction(() => document.querySelector("#gym-rest-timer").hidden);
    const undoRestState = await app.evaluate(async ({ date, exerciseId }) => {
      const session = (await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", date])).find(item => item.status === "in-progress");
      const exercise = await ProjectComebackDB.get("exerciseRecords", exerciseId);
      const sets = await ProjectComebackDB.getAllByIndex("setRecords", "by_session", session.id);
      return { restEndAt: session.restEndAt, exerciseStatus: exercise.status,
        setStatuses: sets.filter(set => set.exerciseRecordId === exerciseId).map(set => ({ setNumber: set.setNumber, status: set.status })) };
    }, { date: testDates.today, exerciseId: undoTarget.exerciseId });
    const undoneSecondSet = undoRestState.setStatuses.find(set => set.setNumber === 2);
    if (undoRestState.restEndAt !== undefined || !undoneSecondSet || undoneSecondSet.status !== "in-progress") {
      throw new Error("Undoing a completed set did not clear its rest state: " + JSON.stringify({undoTarget,undoRestState}));
    }
    await secondSetRow.locator('[data-gym-action="complete"]').click();
    await app.waitForFunction(() => !document.querySelector("#gym-rest-timer").hidden);
    await app.locator('[data-gym-action="rest-cancel"]').click();
    await app.waitForFunction(() => document.querySelector("#gym-rest-timer").hidden);
    console.log("PASS persisted rest countdown, +15, skip/cancel, undo cleanup, and per-exercise rest override");
    console.log("PASS Gym day 1 starts, persists entered weight/reps, enforces set order and resumes after reload");

    console.log("[browser] Save-first six-second celebration, Skip/Dismiss and saved-record preservation");
    const originalCelebrationProfile = await app.evaluate(() => ProjectComebackDB.get("profile", "gym-profile"));
    const originalGymPlanBeforeCelebration = await app.evaluate(() => ProjectComebackGymProgression.getPlan());
    const originalGymCountBeforeCelebration = await app.evaluate(() => ProjectComebackDB.count("sessions"));
    const seedCompletedWorkoutForCelebration = async (day, date) => {
      const fixture = await app.evaluate(async ({ day, date }) => {
        const sessions = await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", date]);
        const session = sessions.find(item => item.day === day && item.status === "in-progress");
        if (!session) throw new Error("No in-progress workout fixture exists for celebration test: " + JSON.stringify({ day, date }));
        const [exercises, sets] = await Promise.all([
          ProjectComebackDB.getAllByIndex("exerciseRecords", "by_session", session.id),
          ProjectComebackDB.getAllByIndex("setRecords", "by_session", session.id)
        ]);
        const completedAt = new Date().toISOString();
        const completedExercises = exercises.map(exercise => Object.assign({}, exercise, { status: "completed" }));
        const completedSets = sets.map(set => {
          const completed = Object.assign({}, set, { status: "completed", completedAt });
          delete completed.stopwatchStartedAt;
          return completed;
        });
        const completedSession = Object.assign({}, session);
        delete completedSession.restEndAt;
        delete completedSession.restDurationSeconds;
        delete completedSession.restExerciseId;
        delete completedSession.restSetNumber;
        await ProjectComebackDB.updateGymWorkoutBundle({
          sessionId: session.id,
          session: completedSession,
          exerciseRecords: completedExercises,
          setRecords: completedSets
        });
        return { sessionId: session.id, exerciseCount: exercises.length, setCount: sets.length };
      }, { day, date });
      await app.reload();
      await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
      await app.locator('[data-view="gym"]').click();
      await app.locator("#gym-workout-day").selectOption(String(day));
      await app.locator("#gym-workout-date").fill(date);
      await app.waitForFunction(() => !document.querySelector("#gym-workout-active").hidden &&
        !document.querySelector("#gym-workout-finish").disabled);
      return fixture;
    };
    const startCelebrationWorkout = async (day, date) => {
      await app.locator("#gym-workout-day").selectOption(String(day));
      await app.locator("#gym-workout-date").fill(date);
      await app.waitForFunction(({ day, date }) =>
        document.querySelector("#gym-workout-day").value === String(day) &&
        document.querySelector("#gym-workout-date").value === date &&
        document.querySelector("#gym-workout-active").hidden,
      { day, date });
      await app.locator("#gym-workout-start").click();
      await app.waitForFunction(async ({ day, date }) => {
        const sessions = await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", date]);
        return sessions.some(session => session.day === day && session.status === "in-progress");
      }, { day, date });
      await app.waitForFunction(() => !document.querySelector("#gym-workout-active").hidden);
    };
    const savedCelebrationState = async (day, date) => app.evaluate(async ({ day, date }) => {
      const session = (await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", date]))
        .find(item => item.day === day);
      return session ? { id: session.id, status: session.status, completedAt: session.completedAt, updatedAt: session.updatedAt } : null;
    }, { day, date });

    await startCelebrationWorkout(1, testDates.celebrationDay1);
    const firstCelebrationFixture = await seedCompletedWorkoutForCelebration(1, testDates.celebrationDay1);
    await app.evaluate(() => {
      const original = window.ProjectComebackDB;
      window.__gymCelebrationOriginalDb = original;
      window.ProjectComebackDB = Object.assign({}, original, {
        updateGymWorkoutBundle: async bundle => {
          if (bundle.session && bundle.session.status === "completed") {
            throw new Error("Intentional browser finish write failure");
          }
          return original.updateGymWorkoutBundle(bundle);
        }
      });
    });
    await app.locator("#gym-workout-finish").click();
    await app.waitForFunction(() => document.querySelector("#notice").textContent.includes("Intentional browser finish write failure"));
    const failedFinishState = await app.evaluate(async date => {
      const session = (await window.__gymCelebrationOriginalDb.getAllByIndex("sessions", "by_module_date", ["gym", date])).find(item => item.day === 1);
      return { dialogOpen: document.querySelector("#gym-celebration-dialog").open,
        workoutVisible: !document.querySelector("#gym-workout-active").hidden,
        finishEnabled: !document.querySelector("#gym-workout-finish").disabled,
        sessionStatus: session.status, completedAt: session.completedAt };
    }, testDates.celebrationDay1);
    if (failedFinishState.dialogOpen || !failedFinishState.workoutVisible || !failedFinishState.finishEnabled ||
        failedFinishState.sessionStatus !== "in-progress" || failedFinishState.completedAt !== undefined) {
      throw new Error("A failed finish write opened the celebration or stranded the live workout: " + JSON.stringify(failedFinishState));
    }
    await app.evaluate(() => { window.ProjectComebackDB = window.__gymCelebrationOriginalDb; delete window.__gymCelebrationOriginalDb; });
    await app.locator("#gym-workout-finish").click();
    await app.waitForFunction(() => document.querySelector("#gym-celebration-dialog").open);
    await app.waitForFunction(() => {
      const image = document.querySelector("#gym-celebration-image");
      return image.complete && image.naturalWidth > 0;
    });
    const firstCelebration = await app.evaluate(async date => {
      const session = (await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", date])).find(item => item.day === 1);
      const image = document.querySelector("#gym-celebration-image");
      const historyEntry = [...document.querySelectorAll("#gym-records .gym-history-entry")].find(item => item.textContent.includes("Week 1 · Day 1"));
      return { sessionStatus: session.status, completedAt: session.completedAt, image: image.getAttribute("src"), alt: image.alt, historyStatus: historyEntry?.textContent || "" };
    }, testDates.celebrationDay1);
    if (firstCelebrationFixture.exerciseCount !== 7 || firstCelebrationFixture.setCount !== 21 ||
        firstCelebration.sessionStatus !== "completed" || !firstCelebration.completedAt ||
        firstCelebration.image !== "./assets/celebrations/v1/celebration-day1.gif" ||
        !firstCelebration.alt.includes("hero") || !firstCelebration.historyStatus.includes("Completed")) {
      throw new Error("Day 1 celebration opened before its session was saved or selected the wrong verified GIF: " + JSON.stringify({ firstCelebrationFixture, firstCelebration }));
    }
    const firstSavedState = await savedCelebrationState(1, testDates.celebrationDay1);
    await app.locator("#gym-celebration-skip").click();
    await app.waitForFunction(() => !document.querySelector("#gym-celebration-dialog").open);
    const afterSkip = await savedCelebrationState(1, testDates.celebrationDay1);
    if (!afterSkip || afterSkip.status !== "completed" || afterSkip.completedAt !== firstSavedState.completedAt ||
        afterSkip.updatedAt !== firstSavedState.updatedAt) {
      throw new Error("Skipping the celebration changed the already-saved Day 1 workout: " + JSON.stringify({ firstSavedState, afterSkip }));
    }

    await app.evaluate(async () => ProjectComebackDB.put("profile", {
      id: "gym-profile", value: { gender: "female" }, legacyKey: "browser-celebration-profile",
      legacyRawValue: JSON.stringify({ gender: "female" })
    }));
    await startCelebrationWorkout(2, testDates.celebrationDay2);
    const secondCelebrationFixture = await seedCompletedWorkoutForCelebration(2, testDates.celebrationDay2);
    await app.locator("#gym-workout-finish").click();
    await app.waitForFunction(() => document.querySelector("#gym-celebration-dialog").open);
    await app.waitForFunction(() => {
      const image = document.querySelector("#gym-celebration-image");
      return image.complete && image.naturalWidth > 0;
    });
    const secondCelebration = await app.evaluate(async date => {
      const session = (await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", date])).find(item => item.day === 2);
      return { sessionStatus: session.status, src: document.querySelector("#gym-celebration-image").getAttribute("src") };
    }, testDates.celebrationDay2);
    if (secondCelebrationFixture.exerciseCount !== 7 || secondCelebrationFixture.setCount !== 21 ||
        secondCelebration.sessionStatus !== "completed" ||
        secondCelebration.src !== "./assets/celebrations/v1/female-celebration.gif") {
      throw new Error("Saved female hero preference was not respected for the Day 2 celebration: " + JSON.stringify({ secondCelebrationFixture, secondCelebration }));
    }
    const secondSavedState = await savedCelebrationState(2, testDates.celebrationDay2);
    await app.locator("#gym-celebration-dismiss").click();
    await app.waitForFunction(() => !document.querySelector("#gym-celebration-dialog").open);
    const afterDismiss = await savedCelebrationState(2, testDates.celebrationDay2);
    if (!afterDismiss || afterDismiss.status !== "completed" || afterDismiss.completedAt !== secondSavedState.completedAt ||
        afterDismiss.updatedAt !== secondSavedState.updatedAt) {
      throw new Error("Dismissing the celebration changed the already-saved Day 2 workout: " + JSON.stringify({ secondSavedState, afterDismiss }));
    }

    await app.evaluate(async () => ProjectComebackDB.put("profile", {
      id: "gym-profile", value: { gender: "male" }, legacyKey: "browser-celebration-profile",
      legacyRawValue: JSON.stringify({ gender: "male" })
    }));
    await app.locator("#gym-days-per-week").selectOption("5");
    await app.waitForFunction(() => !document.querySelector("#gym-workout-day option[value=\"3\"]").disabled);
    await startCelebrationWorkout(3, testDates.celebrationDay3);
    const thirdCelebrationFixture = await seedCompletedWorkoutForCelebration(3, testDates.celebrationDay3);
    await app.locator("#gym-workout-finish").click();
    await app.waitForFunction(() => document.querySelector("#gym-celebration-dialog").open);
    await app.waitForFunction(() => {
      const image = document.querySelector("#gym-celebration-image");
      return image.complete && image.naturalWidth > 0;
    });
    const thirdCelebration = await app.evaluate(async date => {
      const session = (await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", date])).find(item => item.day === 3);
      return { sessionStatus: session.status, src: document.querySelector("#gym-celebration-image").getAttribute("src") };
    }, testDates.celebrationDay3);
    if (thirdCelebrationFixture.exerciseCount !== 6 || thirdCelebrationFixture.setCount !== 18 ||
        thirdCelebration.sessionStatus !== "completed" ||
        thirdCelebration.src !== "./assets/celebrations/v1/celebration-day2.gif") {
      throw new Error("Day 3 celebration did not use the legacy male/default day-2 artwork rule: " + JSON.stringify({ thirdCelebrationFixture, thirdCelebration }));
    }
    const thirdSavedState = await savedCelebrationState(3, testDates.celebrationDay3);
    const autoCloseStarted = Date.now();
    await app.waitForFunction(() => !document.querySelector("#gym-celebration-dialog").open, null, { timeout: 10000 });
    const autoCloseElapsed = Date.now() - autoCloseStarted;
    const afterAutoClose = await savedCelebrationState(3, testDates.celebrationDay3);
    if (autoCloseElapsed < 5500 || autoCloseElapsed > 8500 ||
        !afterAutoClose || afterAutoClose.status !== "completed" ||
        afterAutoClose.completedAt !== thirdSavedState.completedAt || afterAutoClose.updatedAt !== thirdSavedState.updatedAt) {
      throw new Error("The celebration did not auto-close at six seconds or changed the completed session: " +
        JSON.stringify({ autoCloseElapsed, thirdSavedState, afterAutoClose }));
    }

    await app.evaluate(async ({ sessionSpecs, originalProfile, originalPlan }) => {
      for (const spec of sessionSpecs) {
        const sessions = await ProjectComebackDB.getAllByIndex("sessions", "by_module_date", ["gym", spec.date]);
        const session = sessions.find(item => item.day === spec.day);
        if (!session) continue;
        const exercises = await ProjectComebackDB.getAllByIndex("exerciseRecords", "by_session", session.id);
        const sets = await ProjectComebackDB.getAllByIndex("setRecords", "by_session", session.id);
        for (const record of sets) await ProjectComebackDB.remove("setRecords", record.id);
        for (const record of exercises) await ProjectComebackDB.remove("exerciseRecords", record.id);
        await ProjectComebackDB.remove("sessions", session.id);
      }
      if (originalProfile) await ProjectComebackDB.put("profile", originalProfile);
      else await ProjectComebackDB.remove("profile", "gym-profile");
      await ProjectComebackGymProgression.savePlan(originalPlan);
    }, {
      sessionSpecs: [
        { day: 1, date: testDates.celebrationDay1 },
        { day: 2, date: testDates.celebrationDay2 },
        { day: 3, date: testDates.celebrationDay3 }
      ],
      originalProfile: originalCelebrationProfile,
      originalPlan: originalGymPlanBeforeCelebration
    });
    const gymCountAfterCelebrationCleanup = await app.evaluate(() => ProjectComebackDB.count("sessions"));
    if (gymCountAfterCelebrationCleanup !== originalGymCountBeforeCelebration) {
      throw new Error("Celebration browser fixture cleanup changed pre-existing Gym sessions: " +
        JSON.stringify({ before: originalGymCountBeforeCelebration, after: gymCountAfterCelebrationCleanup }));
    }
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    console.log("PASS saved state is committed before celebration, Day 1/Day 2/female hero selection, Skip/Dismiss, six-second auto-close, and no post-close data mutation");

    console.log("[browser] Failed guide-cache update preserves the active offline version");
    testServerState.serveGuideWorkerV2 = true;
    testServerState.failGuideAsset = true;
    const failedUpdate = await app.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active) throw new Error("No active service worker before failed-update test.");
      const activeScriptBefore = registration.active.scriptURL;
      const outcome = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => resolve({ timedOut: true }), 30000);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) { clearTimeout(timeout); resolve({ missingInstallingWorker: true }); return; }
          installing.addEventListener("statechange", () => {
            if (installing.state === "redundant" || installing.state === "activated") {
              clearTimeout(timeout);
              resolve({ state: installing.state });
            }
          });
        }, { once: true });
        registration.update().catch(error => { clearTimeout(timeout); reject(error); });
      });
      return { ...outcome, activeScriptBefore, activeScriptAfter: registration.active?.scriptURL,
        controllerScript: navigator.serviceWorker.controller?.scriptURL };
    });
    testServerState.serveGuideWorkerV2 = false;
    testServerState.failGuideAsset = false;
    if (failedUpdate.timedOut || failedUpdate.state !== "redundant" ||
        failedUpdate.activeScriptAfter !== failedUpdate.activeScriptBefore ||
        failedUpdate.controllerScript !== failedUpdate.activeScriptBefore) {
      throw new Error("A failed guide-cache update replaced or stalled the active worker: " + JSON.stringify(failedUpdate));
    }
    const preservedGuideCache = await app.evaluate(async () => {
      const cacheName = "project-comeback-v21-2a-guides-v1";
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      const manifest = await cache.match(new URL("./assets/guides/manifest.v1.json", location.href).href);
      const names = await caches.keys();
      return { entries: keys.length, hasManifest: Boolean(manifest),
        hasV2: names.includes("project-comeback-v21-2a-guides-v2") };
    });
    if (preservedGuideCache.entries !== 42 || !preservedGuideCache.hasManifest || preservedGuideCache.hasV2) {
      throw new Error("Failed update did not preserve the previous immutable guide cache: " + JSON.stringify(preservedGuideCache));
    }
    await appContext.setOffline(true);
    const preservedOfflineAsset = await app.evaluate(async () => {
      const response = await fetch("./assets/guides/v1/equipment/equipment-bands.svg");
      return { ok: response.ok, bytes: (await response.arrayBuffer()).byteLength };
    });
    await appContext.setOffline(false);
    if (!preservedOfflineAsset.ok || preservedOfflineAsset.bytes < 1000) {
      throw new Error("The previous guide artwork could not be retrieved offline after a failed update: " + JSON.stringify(preservedOfflineAsset));
    }
    console.log("PASS failed v2 install leaves v1 cache complete and usable offline");
    const emptyComparisonText = await app.locator("#assessment-comparison").textContent();
    if (!emptyComparisonText.includes("Save your original baseline") ||
        !emptyComparisonText.includes("add a follow-up assessment")) {
      throw new Error("Empty assessment comparison state did not explain how to begin: " + emptyComparisonText);
    }
    const emptyJourneyText = await app.locator("#assessment-journey").textContent();
    if (!emptyJourneyText.includes("Complete your original baseline assessment")) {
      throw new Error("Progress journey did not explain how to start without assessments: " + emptyJourneyText);
    }
    console.log("PASS comparison panel and progress journey explain how to begin when no assessments exist");
    const followUpGateBeforeBaseline = await app.evaluate(() => ({
      status: document.querySelector("#followup-status").textContent,
      controlsDisabled: [...document.querySelectorAll("#followup-form input,#followup-form textarea,#followup-form button")].every(control => control.disabled)
    }));
    if (!followUpGateBeforeBaseline.controlsDisabled ||
        !followUpGateBeforeBaseline.status.includes("Save your original baseline")) {
      throw new Error("Follow-up form was not clearly locked before the original baseline: " + JSON.stringify(followUpGateBeforeBaseline));
    }
    console.log("PASS follow-up form is unavailable until the original baseline is saved");

    console.log("[browser] Baseline and assessment history");
    const assessmentCheck = await app.evaluate(async () => {
      const service = ProjectComebackAssessments;
      let followUpWithoutBaselineRejected = false;
      try {
        await service.addFollowUp({ date: "2026-11-14", measures: { stepUpsReps: 6 } });
      } catch (error) {
        followUpWithoutBaselineRejected = /Save the original baseline/.test(error.message);
      }
      const baseline = await service.createBaseline({
        date: "2026-11-15",
        measures: { comfortableWalkMinutes: 12, stepUpsReps: 8, singleLegBalanceSeconds: 5 }
      });
      let earlierDateRejected = false;
      try {
        await service.addFollowUp({ date: "2026-11-14", measures: { stepUpsReps: 7 } });
      } catch (error) {
        earlierDateRejected = /cannot be earlier than the original baseline date/.test(error.message);
      }
      let sameDayAccepted = false;
      try {
        const sameDay = await service.addFollowUp({
          id: "assessment-same-day-allowed",
          date: "2026-11-15",
          measures: { stepUpsReps: 9 }
        });
        sameDayAccepted = sameDay.date === baseline.date;
        await ProjectComebackDB.remove("assessments", sameDay.id);
      } catch (_) {}
      let overwriteRejected = false;
      try {
        await service.createBaseline({ date: "2026-11-17", measures: { stepUpsReps: 99 } });
      } catch (error) { overwriteRejected = /cannot be overwritten/.test(error.message); }
      return {
        baselineId: baseline.id,
        historyCount: (await service.listHistory()).length,
        overwriteRejected,
        followUpWithoutBaselineRejected,
        earlierDateRejected,
        sameDayAccepted,
        storedBaseline: await service.getBaseline()
      };
    });
    if (assessmentCheck.baselineId !== "original-baseline" ||
        assessmentCheck.historyCount !== 1 ||
        !assessmentCheck.overwriteRejected ||
        !assessmentCheck.followUpWithoutBaselineRejected ||
        !assessmentCheck.earlierDateRejected ||
        !assessmentCheck.sameDayAccepted ||
        assessmentCheck.storedBaseline.measures.stepUpsReps !== 8) {
      throw new Error("Baseline sequencing/date rule or baseline protection failed: " + JSON.stringify(assessmentCheck));
    }
    console.log("PASS original baseline protection, baseline-first sequencing, same-day follow-ups and date ordering");
        console.log("[browser] Assessment screens and Before & Now UI");
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    await app.locator('[data-view="assessments"]').click();
    const baselineJourneyText = await app.locator("#assessment-journey").textContent();
    if (!baselineJourneyText.includes("ORIGINAL BASELINE") ||
        !baselineJourneyText.includes("15 Nov 2026") ||
        !baselineJourneyText.includes("12 minutes") ||
        !baselineJourneyText.includes("Your starting point is saved")) {
      throw new Error("Progress journey did not show the one-record baseline state correctly: " + baselineJourneyText);
    }
    if (!(await app.locator("#baseline-status").textContent()).includes("Saved") ||
        !(await app.locator("#baseline-save").isDisabled()) ||
        !(await app.locator("#assessment-history").textContent()).includes("Original baseline")) {
      throw new Error("Assessment UI did not show and protect the existing original baseline.");
    }
    const oneAssessmentMessage = await app.locator("#assessment-comparison").textContent();
    if (!oneAssessmentMessage.includes("Your original starting point is saved") ||
        !oneAssessmentMessage.includes("Add a follow-up assessment")) {
      throw new Error("Single-assessment comparison state did not explain the next step: " + oneAssessmentMessage);
    }
    console.log("PASS comparison panel explains what to do when only the original baseline exists");
    if (!(await app.locator('#followup-form button[type="submit"]').isEnabled()) ||
        await app.locator('#followup-form [name="date"]').getAttribute("min") !== "2026-11-15" ||
        !(await app.locator("#followup-status").textContent()).includes("on or after")) {
      throw new Error("Saving the baseline did not unlock follow-ups with the correct minimum date.");
    }
    await app.locator('#followup-form [name="date"]').fill("2026-11-17");
    await app.locator('#followup-form [name="comfortableWalkMinutes"]').fill("21");
    await app.locator('#followup-form [name="stepUpsReps"]').fill("14");
    await app.locator('#followup-form button[type="submit"]').click();
    await app.waitForFunction(() => document.querySelector("#assessment-history").textContent.includes("17 Nov"));
    await app.locator("#compare-first").selectOption("original-baseline");
    const followupOption = await app.locator("#compare-second option").evaluateAll(options => options.find(option => option.textContent.includes("17 Nov"))?.value);
    if (!followupOption) throw new Error("New follow-up assessment was not offered in the comparison selector.");
    await app.locator("#compare-second").selectOption(followupOption);
    const journeyText = await app.locator("#assessment-journey").textContent();
    if (!journeyText.includes("ORIGINAL BASELINE") ||
        !journeyText.includes("FOLLOW-UP ASSESSMENT") ||
        !journeyText.includes("15 Nov 2026") ||
        !journeyText.includes("17 Nov 2026") ||
        !journeyText.includes("Change from baseline: +9 minutes") ||
        !journeyText.includes("Change from baseline: +6 repetitions") ||
        !journeyText.includes("Not comparable to baseline")) {
      throw new Error("Visual progress journey did not show actual assessment milestones and baseline changes: " + journeyText);
    }
    const comparisonText = await app.locator("#assessment-comparison").textContent();
    if (!comparisonText.includes("+9 minutes") || !comparisonText.includes("+6 repetitions") ||
        !comparisonText.includes("Not comparable")) {
      throw new Error("Before & Now UI comparison did not show expected changes and missing-value handling: " + comparisonText);
    }
    const postFollowUpCheck = await app.evaluate(async () => {
      const service = ProjectComebackAssessments;
      const history = await service.listHistory();
      const baseline = await service.getBaseline();
      const followUp = history.find(item => item.kind === "follow-up");
      let duplicateIdRejected = false;
      try {
        await service.addFollowUp({ id: followUp.id, date: "2026-11-18", measures: { stepUpsReps: 99 } });
      } catch (_) { duplicateIdRejected = true; }
      const comparison = service.compare(baseline, followUp);
      const latest = await service.compareBaselineToLatest();
      return {
        historyCount: history.length,
        duplicateIdRejected,
        walkDifference: comparison.measures.comfortableWalkMinutes.difference,
        missingBalanceDifference: comparison.measures.singleLegBalanceSeconds.difference,
        latestDate: latest && latest.second.date
      };
    });
    if (postFollowUpCheck.historyCount !== 2 || !postFollowUpCheck.duplicateIdRejected ||
        postFollowUpCheck.walkDifference !== 9 ||
        postFollowUpCheck.missingBalanceDifference !== null ||
        postFollowUpCheck.latestDate !== "2026-11-17") {
      throw new Error("Follow-up history, duplicate ID or comparison service checks failed: " + JSON.stringify(postFollowUpCheck));
    }
    await app.waitForTimeout(50);
    if (appPageErrors.length) throw new Error("Expected duplicate-ID rejection produced an unhandled application page error: " + appPageErrors.join(" | "));
    console.log("PASS assessment UI: immutable baseline, follow-up entry, history, selectable comparisons and duplicate ID protection without unhandled page errors");

    const assessmentCountBeforeRapidSubmit = await app.evaluate(async () => (await ProjectComebackAssessments.listHistory()).length);
    await app.locator('#followup-form [name="date"]').fill("2026-11-17");
    await app.locator('#followup-form [name="singleLegBalanceSeconds"]').fill("6");
    await app.locator("#followup-form").evaluate(form => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await app.waitForTimeout(250);
    const assessmentCountAfterRapidSubmit = await app.evaluate(async () => (await ProjectComebackAssessments.listHistory()).length);
    if (assessmentCountAfterRapidSubmit !== assessmentCountBeforeRapidSubmit + 1) {
      throw new Error("Rapid repeated follow-up submission created an unexpected number of records: " +
        JSON.stringify({ before: assessmentCountBeforeRapidSubmit, after: assessmentCountAfterRapidSubmit }));
    }
    if (!(await app.locator('#followup-form button[type="submit"]').isEnabled())) {
      throw new Error("Follow-up submit button was not re-enabled after saving.");
    }
    console.log("PASS follow-up form locks during save and prevents duplicate records from rapid repeated submission");

    const contrastAudit = await app.evaluate(() => {
      const rgb = value => {
        const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        const parts = hex
          ? (hex[1].length === 3 ? [...hex[1]].map(x => parseInt(x + x, 16)) : hex[1].match(/../g).map(x => parseInt(x, 16)))
          : value.match(/[0-9.]+/g).map(Number);
        return parts.slice(0, 3).map(v => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
      };
      const luminance = value => {
        const [r, g, b] = rgb(value);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a, b) => {
        const x = luminance(a), y = luminance(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      };
      const input = document.querySelector('#hiking-form input');
      const panel = document.querySelector('.panel');
      const secondary = document.querySelector('.secondary');
      const inputStyle = getComputedStyle(input);
      const panelStyle = getComputedStyle(panel);
      const secondaryStyle = getComputedStyle(secondary);
      const root = getComputedStyle(document.documentElement);
      const variable = name => root.getPropertyValue(name).trim();
      const muted = getComputedStyle(document.querySelector('.muted')).color;
      const footer = getComputedStyle(document.querySelector('footer')).color;
      const eyebrow = getComputedStyle(document.querySelector('.eyebrow')).color;
      const label = getComputedStyle(document.querySelector('#hiking-form label')).color;
      const buttonText = getComputedStyle(document.querySelector('.primary')).color;
      return {
        textPrimary: ratio(variable('--text'), variable('--bg')),
        textMutedOnPage: ratio(muted, variable('--bg')),
        textMutedOnPanel: ratio(muted, variable('--panel')),
        footerText: ratio(footer, variable('--bg')),
        accentText: ratio(eyebrow, variable('--bg')),
        formLabelText: ratio(label, variable('--panel')),
        primaryButtonText: ratio(buttonText, variable('--accent')),
        inputText: ratio(inputStyle.color, inputStyle.backgroundColor),
        inputBoundary: ratio(inputStyle.borderTopColor, inputStyle.backgroundColor),
        panelBoundary: ratio(panelStyle.borderTopColor, variable('--panel')),
        secondaryBoundary: ratio(secondaryStyle.borderTopColor, variable('--panel2')),
        focusIndicator: ratio(variable('--accent'), variable('--bg'))
      };
    });
    const textChecks = ["textPrimary","textMutedOnPage","textMutedOnPanel","footerText","accentText","formLabelText","primaryButtonText","inputText"];
    const controlChecks = ["inputBoundary","panelBoundary","secondaryBoundary","focusIndicator"];
    for (const name of textChecks) {
      if (contrastAudit[name] < 4.5) throw new Error(name + " text contrast is below 4.5:1: " + contrastAudit[name].toFixed(2));
    }
    for (const name of controlChecks) {
      if (contrastAudit[name] < 3) throw new Error(name + " contrast is below 3:1: " + contrastAudit[name].toFixed(2));
    }
    console.log("PASS text contrast (4.5:1) and control/focus contrast (3:1): " + JSON.stringify(contrastAudit));
    const labelledControls = await app.evaluate(() => [...document.querySelectorAll("#view-hiking input, #view-hiking textarea, #view-schedule input, #view-schedule select")]
      .filter(control => control.type !== "hidden" && !control.labels?.length && !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby"))
      .map(control => control.outerHTML));
    if (labelledControls.length) throw new Error("Form controls without accessible labels: " + labelledControls.join("\\n"));
    await app.setViewportSize({ width: 375, height: 812 });
    const narrowLayout = await app.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    if (narrowLayout.page > narrowLayout.viewport) throw new Error("V21.2 layout has horizontal page overflow at 375px: " + JSON.stringify(narrowLayout));
    await app.setViewportSize({ width: 1280, height: 900 });
    if (await app.locator('[data-view="assessments"]').getAttribute("aria-current") !== "page") {
      throw new Error("Active assessment navigation state is not exposed accessibly.");
    }
    await app.locator('[data-view="hiking"]').click();
    if (await app.locator('[data-view="hiking"]').getAttribute("aria-current") !== "page" ||
        await app.locator('[data-view="assessments"]').getAttribute("aria-current") !== null) {
      throw new Error("Active navigation state did not update accessibly.");
    }
    await app.locator('[data-view="overview"]').click();
    if (await app.locator('[data-view="overview"]').getAttribute("aria-current") !== "page") {
      throw new Error("Navigation did not restore the Overview active state.");
    }
    const manifest = await app.evaluate(async () => { const link = document.querySelector('link[rel="manifest"]'); const response = await fetch(link.href); return response.json(); });
    if (!manifest.icons || !manifest.icons.some(icon => icon.src === "./icon.svg" && icon.purpose.includes("maskable"))) throw new Error("PWA manifest icon metadata is missing.");
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    const localDateCheck = await app.evaluate(() => {
      const now = new Date();
      const expected = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
      return { expected, hikeDate: document.querySelector('#hiking-form [name="date"]').value, scheduleDate: document.querySelector('#schedule-form [name="date"]').value };
    });
    if (localDateCheck.hikeDate !== localDateCheck.expected || localDateCheck.scheduleDate !== localDateCheck.expected) {
      throw new Error("Hiking and Schedule defaults must use the phone local calendar date: " + JSON.stringify(localDateCheck));
    }
    const beforeMigration = await app.evaluate(async () => ({
      rawCount: await ProjectComebackDB.count("legacyRecords"),
      typedMarker: await ProjectComebackDB.getMeta("migration-v21.2a-typed-projection-v1"),
      legacyWorkout: localStorage.getItem("gym-comeback-w1-d1")
    }));
    if (beforeMigration.rawCount !== 0 || beforeMigration.typedMarker || !beforeMigration.legacyWorkout) {
      throw new Error("V21.2 app migrated data automatically or changed original storage.");
    }

    await app.locator('[data-view="hiking"]').click();
    await app.locator('#hiking-form [name="title"]').fill("Browser test hike");
    await app.locator('#hiking-form [name="date"]').fill("2026-11-16");
    await app.locator('#hiking-form [name="distanceKm"]').fill("0");
    await app.locator('#hiking-form button[type="submit"]').click();
    if (await app.locator("#hiking-count").textContent() !== "0") {
      throw new Error("Hiking form accepted a zero distance measurement.");
    }
    await app.locator('#hiking-form [name="distanceKm"]').fill("4.25");
    await app.locator('#hiking-form [name="routeName"]').fill("East-West Walk");
    await app.locator('#hiking-form [name="durationMinutes"]').fill("95");
    await app.locator('#hiking-form [name="elevationGainM"]').fill("320");
    await app.locator('#hiking-form button[type="submit"]').click();
    await app.waitForFunction(() => document.querySelector("#hiking-count").textContent === "1");
    const hikeRecord = await app.evaluate(async () => (await ProjectComebackDB.getAllByIndex("hikingRecords", "by_module", "hiking"))[0]);
    if (hikeRecord.distanceKm !== 4.25 || hikeRecord.routeName !== "East-West Walk") {
      throw new Error("Hiking measurement or route name was not saved correctly.");
    }
    await app.locator('[data-view="schedule"]').click();
    await app.locator('#schedule-form [name="title"]').fill("Browser test gym session");
    await app.locator('#schedule-form [name="date"]').fill(testDates.future);
    await app.locator('#schedule-form button[type="submit"]').click();
    try {
      await app.waitForFunction(() => document.querySelector("#schedule-count").textContent === "1", null, { timeout: 8000 });
    } catch (error) {
      const diagnostics = await app.evaluate(async () => ({
        notice: document.querySelector("#notice").textContent,
        scheduleCount: document.querySelector("#schedule-count").textContent,
        schedules: await ProjectComebackDB.getAll("schedules"),
        modules: await ProjectComebackDB.getAll("modules")
      }));
      console.error("SCHEDULE FORM DIAGNOSTICS:", JSON.stringify(diagnostics));
      throw error;
    }

    const workloadDate = await app.evaluate(() => {
      const now = new Date();
      return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    });
    await app.evaluate(async date => {
      await ProjectComebackModules.putOwnedRecord("gym", "sessions", {
        id: "browser-workload-gym", moduleId: "gym", date,
        title: "Browser workload Gym record", status: "completed", durationMinutes: 17
      });
      await ProjectComebackModules.putOwnedRecord("hiking", "hikingRecords", {
        id: "browser-workload-hike", moduleId: "hiking", date,
        title: "Browser workload Hiking record", status: "completed"
      });
      await ProjectComebackModules.putOwnedRecord("gym", "exerciseRecords", {
        id: "browser-journey-exercise", moduleId: "gym", sessionId: "browser-workload-gym",
        name: "Test squat", setCount: 3, progressionFocus: "repetitions"
      });
      // Historical names that differ only by case, punctuation or spacing
      // must remain separate until an explicit alias map is approved.
      for (const [id, name] of [
        ["browser-name-case-a", "Bench Press"],
        ["browser-name-case-b", "bench press"],
        ["browser-name-punctuation-a", "RDL (DB)"],
        ["browser-name-punctuation-b", "RDL DB"]
      ]) {
        await ProjectComebackModules.putOwnedRecord("gym", "exerciseRecords", {
          id, moduleId: "gym", sessionId: "browser-workload-gym", name, setCount: 1
        });
      }
      await ProjectComebackModules.putOwnedRecord("gym", "setRecords", {
        id: "browser-journey-set-1", moduleId: "gym", sessionId: "browser-workload-gym",
        exerciseRecordId: "browser-journey-exercise", setNumber: 1, weight: "20", reps: "8"
      });
      await ProjectComebackModules.putOwnedRecord("gym", "setRecords", {
        id: "browser-journey-set-2", moduleId: "gym", sessionId: "browser-workload-gym",
        exerciseRecordId: "browser-journey-exercise", setNumber: 2, weight: "20", reps: "10"
      });
      await ProjectComebackModules.putOwnedRecord("gym", "setRecords", {
        id: "browser-journey-set-3", moduleId: "gym", sessionId: "browser-workload-gym",
        exerciseRecordId: "browser-journey-exercise", setNumber: 3, weight: "20", reps: ""
      });
      const previous = new Date(date + "T12:00:00");
      previous.setDate(previous.getDate() - 7);
      const previousDate = [previous.getFullYear(), String(previous.getMonth()+1).padStart(2,"0"), String(previous.getDate()).padStart(2,"0")].join("-");
      await ProjectComebackModules.putOwnedRecord("gym", "sessions", {
        id: "browser-history-gym-older", moduleId: "gym", date: previousDate,
        title: "Earlier squat session", status: "completed"
      });
      await ProjectComebackModules.putOwnedRecord("gym", "exerciseRecords", {
        id: "browser-history-exercise-older", moduleId: "gym", sessionId: "browser-history-gym-older",
        name: "Test squat", setCount: 1
      });
      await ProjectComebackModules.putOwnedRecord("gym", "setRecords", {
        id: "browser-history-set-older", moduleId: "gym", sessionId: "browser-history-gym-older",
        exerciseRecordId: "browser-history-exercise-older", setNumber: 1, weight: "15", reps: "6"
      });
      await ProjectComebackModules.putOwnedRecord("gym", "sessions", {
        id: "browser-incomplete-gym", moduleId: "gym", date,
        title: "Incomplete Gym record", status: "incomplete"
      });
      await ProjectComebackModules.putOwnedRecord("gym", "exerciseRecords", {
        id: "browser-incomplete-exercise", moduleId: "gym", sessionId: "browser-incomplete-gym",
        name: "Excluded exercise", setCount: 1
      });
      await ProjectComebackModules.putOwnedRecord("gym", "setRecords", {
        id: "browser-incomplete-set", moduleId: "gym", sessionId: "browser-incomplete-gym",
        exerciseRecordId: "browser-incomplete-exercise", setNumber: 1, weight: "999", reps: "99"
      });
      // Load-trend edge cases: same-day consolidation, undated/missing/invalid
      // values, a single dated point, and explicitly recorded bodyweight resistance.
      const addLoadRecord = async (suffix, name, dateValue, weights, recordingMode) => {
        const sessionId = "browser-load-" + suffix;
        const exerciseId = "browser-load-exercise-" + suffix;
        await ProjectComebackModules.putOwnedRecord("gym", "sessions", {
          id: sessionId, moduleId: "gym", date: dateValue,
          title: "Load edge " + suffix, status: "completed"
        });
        await ProjectComebackModules.putOwnedRecord("gym", "exerciseRecords", {
          id: exerciseId, moduleId: "gym", sessionId, name,
          setCount: weights.length, recordingMode: recordingMode || "standard"
        });
        for (let index = 0; index < weights.length; index++) {
          await ProjectComebackModules.putOwnedRecord("gym", "setRecords", {
            id: "browser-load-set-" + suffix + "-" + index,
            moduleId: "gym", sessionId, exerciseRecordId: exerciseId,
            setNumber: index + 1, weight: weights[index], reps: ""
          });
        }
      };
      const sameDay = new Date(date + "T12:00:00");
      sameDay.setFullYear(2026, 5, 12);
      const sameDayDate = [sameDay.getFullYear(), String(sameDay.getMonth()+1).padStart(2,"0"), String(sameDay.getDate()).padStart(2,"0")].join("-");
      await addLoadRecord("same-a", "Load same-day check", sameDayDate, ["10"]);
      await addLoadRecord("same-b", "Load same-day check", sameDayDate, ["15"]);
      await addLoadRecord("same-later", "Load same-day check", "2026-06-15", ["12"]);
      await addLoadRecord("single", "Load single-point check", "2026-06-15", ["7.5"]);
      await addLoadRecord("invalid", "Load invalid-only check", "2026-06-15", ["", "0", "-5", "not-a-number"]);
      await addLoadRecord("undated", "Load invalid-only check", "", ["30"]);
      await addLoadRecord("bodyweight", "Load bodyweight check", "2026-06-15", ["5"], "bodyweight");
    }, workloadDate);
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    await app.locator('[data-view="overview"]').click();
    await app.waitForFunction(() => document.querySelector("#upcoming-overview").textContent.includes("Browser test gym session"));
    const gymJourneyCheck = await app.locator("#gym-journey").textContent();
    if (!gymJourneyCheck.includes("Completed sessions9") || !gymJourneyCheck.includes("24") ||
        !gymJourneyCheck.includes("3 of 14 sets include a numeric repetition count") ||
        !gymJourneyCheck.includes("Manual substitutions are displayed with the performed exercise and recorded values") || !gymJourneyCheck.includes("excluded from the original programme exercise progression trend")) {
      throw new Error("Gym journey did not summarize completed-session set data or exclude missing repetitions: " + gymJourneyCheck);
    }
    const gymHistoryCheck = await app.locator("#gym-journey").textContent();
    const exerciseHistoryNames = await app.locator("#gym-journey .gym-exercise-history h4").allTextContents();
    for (const expectedName of ["Bench Press", "bench press", "RDL (DB)", "RDL DB"]) {
      if (!exerciseHistoryNames.includes(expectedName)) {
        throw new Error("Gym history merged or lost an exact exercise-name variant: " + expectedName + " / " + JSON.stringify(exerciseHistoryNames));
      }
    }
    if (!gymHistoryCheck.includes("Recorded exercise history") || !gymHistoryCheck.includes("Test squat") ||
        !gymHistoryCheck.includes("15") || !gymHistoryCheck.includes("6 reps") ||
        !gymHistoryCheck.includes("20") || !gymHistoryCheck.includes("10 reps") ||
        !gymHistoryCheck.includes("2 original-exercise sessions") ||
        !gymHistoryCheck.includes("first 15 kg") || !gymHistoryCheck.includes("latest 20 kg") ||
        !gymHistoryCheck.includes("recorded change +5 kg") || !gymHistoryCheck.includes("not a one-rep maximum")) {
      throw new Error("Gym exercise history did not show dated saved set entries: " + gymHistoryCheck);
    }
    const loadEdgeChecks = await app.evaluate(() => {
      const sections = [...document.querySelectorAll("#gym-journey .gym-exercise-history")];
      const section = name => sections.find(item => item.querySelector("h4")?.textContent === name)?.textContent || "";
      return {
        sameDay: section("Load same-day check"),
        single: section("Load single-point check"),
        invalid: section("Load invalid-only check"),
        bodyweight: section("Load bodyweight check")
      };
    });
    if (!loadEdgeChecks.sameDay.includes("2 dated sessions") ||
        !loadEdgeChecks.sameDay.includes("first 15 kg") ||
        !loadEdgeChecks.sameDay.includes("latest 12 kg") ||
        !loadEdgeChecks.sameDay.includes("recorded change -3 kg")) {
      throw new Error("Same-day loads were not consolidated to the heaviest value before dated comparison: " + JSON.stringify(loadEdgeChecks));
    }
    if (!loadEdgeChecks.single.includes("One dated heaviest recorded load: 7.5 kg") ||
        loadEdgeChecks.single.includes("change")) {
      throw new Error("A single dated load was presented as a comparison: " + JSON.stringify(loadEdgeChecks));
    }
    if (!loadEdgeChecks.invalid.includes("No dated positive load entries to compare yet.") ||
        !loadEdgeChecks.invalid.includes("Date not recorded")) {
      throw new Error("Missing, undated, zero or invalid weights were included in the load trend or hidden from raw history: " + JSON.stringify(loadEdgeChecks));
    }
    if (!loadEdgeChecks.bodyweight.includes("One dated heaviest recorded load: 5 kg")) {
      throw new Error("Explicitly saved bodyweight resistance was not treated as a recorded load: " + JSON.stringify(loadEdgeChecks));
    }
    const hikingJourneyCheck = await app.locator("#hiking-journey").textContent();
    if (!hikingJourneyCheck.includes("2") || !hikingJourneyCheck.includes("4.25 km") ||
        !hikingJourneyCheck.includes("320 m") || !hikingJourneyCheck.includes("95 min") ||
        !hikingJourneyCheck.includes("1 of 2 hikes include distance")) {
      throw new Error("Hiking journey did not summarize saved values or identify missing measurements: " + hikingJourneyCheck);
    }
    const overviewCheck = await app.evaluate(() => ({
      upcoming: document.querySelector("#upcoming-overview").textContent,
      completed: document.querySelector("#completed-overview").textContent
    }));
    if (!overviewCheck.completed.includes("Gym") || !overviewCheck.completed.includes("Hiking") ||
        !overviewCheck.completed.includes("2 records in the last 30 days")) {
      throw new Error("Training overview did not show separate Gym and Hiking completed summaries: " + JSON.stringify(overviewCheck));
    }
    const workloadCards = await app.locator("#completed-overview .workload-weeks").count();
    if (workloadCards !== 2 || !overviewCheck.completed.includes("Week of") ||
        !overviewCheck.completed.includes("17 min recorded") ||
        !overviewCheck.completed.includes("without duration")) {
      throw new Error("Weekly workload view did not show separate recorded Gym duration and missing Hiking duration: " + JSON.stringify({ workloadCards, completed: overviewCheck.completed }));
    }
    await app.locator('[data-view="schedule"]').click();
    await app.waitForFunction(() => document.querySelector("#schedule-range-overview").textContent.includes("Browser test gym session"));
    const planningOutlook = await app.evaluate(() => ({
      gym: document.querySelector("#schedule-range-summary").textContent,
      entries: document.querySelector("#schedule-range-overview").textContent
    }));
    if (!planningOutlook.gym.includes("1") || !planningOutlook.entries.includes("Gym") ||
        !planningOutlook.entries.includes("Browser test gym session")) {
      throw new Error("30-day planning outlook did not show the scheduled Gym activity and separate module summary: " + JSON.stringify(planningOutlook));
    }
    await app.evaluate(async () => {
      await ProjectComebackDB.remove("sessions", "browser-workload-gym");
      await ProjectComebackDB.remove("hikingRecords", "browser-workload-hike");
      await ProjectComebackDB.remove("sessions", "browser-incomplete-gym");
      await ProjectComebackDB.remove("sessions", "browser-history-gym-older");
      for (const suffix of ["same-a","same-b","same-later","single","invalid","undated","bodyweight"]) {
        await ProjectComebackDB.remove("sessions", "browser-load-" + suffix);
        await ProjectComebackDB.remove("exerciseRecords", "browser-load-exercise-" + suffix);
        for (let index = 0; index < (suffix === "invalid" ? 4 : 1); index++) {
          await ProjectComebackDB.remove("setRecords", "browser-load-set-" + suffix + "-" + index);
        }
      }
      await ProjectComebackDB.remove("exerciseRecords", "browser-history-exercise-older");
      await ProjectComebackDB.remove("setRecords", "browser-history-set-older");
      await ProjectComebackDB.remove("exerciseRecords", "browser-journey-exercise");
      await ProjectComebackDB.remove("exerciseRecords", "browser-incomplete-exercise");
      for (const id of ["browser-journey-set-1","browser-journey-set-2","browser-journey-set-3","browser-incomplete-set"]) {
        await ProjectComebackDB.remove("setRecords", id);
      }
    });
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    await app.locator('[data-view="overview"]').click();
    console.log("PASS dashboard shows upcoming schedule and separate Gym/Hiking completed summaries");
    console.log("PASS weekly workload rows show recorded duration and missing-duration counts without combining modules");
    console.log("PASS 30-day planning outlook shows scheduled activities with separate Gym/Hiking totals");

    console.log("[browser] Module pause, preservation and re-enable");
    await app.locator('[data-view="overview"]').click();
    const hikingBeforePause = await app.evaluate(async () => ProjectComebackDB.count("hikingRecords"));
    await app.locator('[data-module-id="hiking"]').click();
    await app.waitForFunction(() => document.querySelector('[data-module-id="hiking"]')?.textContent.includes("Enable module"));
    const hikingPaused = await app.evaluate(async () => ({
      module: await ProjectComebackModules.get("hiking"),
      records: await ProjectComebackDB.count("hikingRecords"),
      hikeControlsDisabled: [...document.querySelectorAll("#hiking-form input,#hiking-form textarea,#hiking-form button")].every(control => control.disabled),
      hikingScheduleDisabled: document.querySelector('#schedule-form [name="moduleId"] option[value="hiking"]').disabled
    }));
    if (hikingPaused.module.enabled || hikingPaused.records !== hikingBeforePause ||
        !hikingPaused.hikeControlsDisabled || !hikingPaused.hikingScheduleDisabled) {
      throw new Error("Pausing Hiking did not preserve records and block new entries/scheduling: " + JSON.stringify(hikingPaused));
    }
    await app.locator('[data-module-id="hiking"]').click();
    await app.waitForFunction(() => document.querySelector('[data-module-id="hiking"]')?.textContent.includes("Pause module"));
    const hikingReenabled = await app.evaluate(async () => ({
      module: await ProjectComebackModules.get("hiking"),
      records: await ProjectComebackDB.count("hikingRecords"),
      hikeControlsEnabled: [...document.querySelectorAll("#hiking-form input,#hiking-form textarea,#hiking-form button")].every(control => !control.disabled),
      hikingScheduleEnabled: !document.querySelector('#schedule-form [name="moduleId"] option[value="hiking"]').disabled
    }));
    if (!hikingReenabled.module.enabled || hikingReenabled.records !== hikingBeforePause ||
        !hikingReenabled.hikeControlsEnabled || !hikingReenabled.hikingScheduleEnabled) {
      throw new Error("Re-enabling Hiking did not restore entry/scheduling while retaining records: " + JSON.stringify(hikingReenabled));
    }
    // The app has not migrated legacy Gym data yet. Seed a Gym-owned session
    // so this browser test can verify pause preserves an existing record.
    await app.evaluate(async () => ProjectComebackModules.putOwnedRecord("gym", "sessions", {
      id: "browser-test-gym-session", moduleId: "gym", date: "2026-11-16",
      title: "Browser preservation session", status: "completed", durationMinutes: 42
    }));
    const gymRecordsBeforePause = await app.evaluate(() => ProjectComebackDB.count("sessions"));
    await app.locator('[data-module-id="gym"]').click();
    await app.waitForFunction(() => document.querySelector('[data-module-id="gym"]')?.textContent.includes("Enable module"));
    const gymPaused = await app.evaluate(async () => ({
      module: await ProjectComebackModules.get("gym"),
      records: await ProjectComebackDB.count("sessions"),
      preserved: await ProjectComebackDB.get("sessions", "browser-test-gym-session"),
      gymScheduleDisabled: document.querySelector('#schedule-form [name="moduleId"] option[value="gym"]').disabled
    }));
    if (gymPaused.module.enabled || gymPaused.records !== gymRecordsBeforePause ||
        gymPaused.preserved?.title !== "Browser preservation session" || !gymPaused.gymScheduleDisabled) {
      throw new Error("Pausing Gym did not preserve history and block scheduling: " + JSON.stringify(gymPaused));
    }
    await app.locator('[data-module-id="gym"]').click();
    await app.waitForFunction(() => document.querySelector('[data-module-id="gym"]')?.textContent.includes("Pause module"));
    console.log("PASS module pause/re-enable preserves records and blocks new module activity while paused");

        console.log("[browser] Migration safety snapshot and manual migration");
    await app.locator('[data-view="data"]').click();
    const snapshotDownloadPromise = app.waitForEvent("download", { timeout: STEP_TIMEOUT_MS });
    await app.locator("#legacy-snapshot").click();
    const snapshotDownload = await snapshotDownloadPromise;
    const snapshotName = snapshotDownload.suggestedFilename();
    if (!snapshotName.endsWith(".json")) throw new Error("Legacy safety snapshot was not downloaded.");
    await app.locator("#migration-confirm").check();
    await app.locator("#migration-run").click();
    try {
      await app.waitForFunction(() => document.querySelector("#migration-result").textContent.includes("Migration status: complete"), null, { timeout: 10000 });
    } catch (error) {
      const diagnostics = await app.evaluate(async () => ({
        notice: document.querySelector("#notice").textContent,
        result: document.querySelector("#migration-result").textContent,
        confirmChecked: document.querySelector("#migration-confirm").checked,
        confirmDisabled: document.querySelector("#migration-confirm").disabled,
        runDisabled: document.querySelector("#migration-run").disabled,
        rawRecords: await ProjectComebackDB.getAll("legacyRecords"),
        marker: await ProjectComebackDB.getMeta("migration-v21.2a-typed-projection-v1")
      }));
      console.error("MIGRATION FORM DIAGNOSTICS:", JSON.stringify(diagnostics));
      throw error;
    }
    const migrated = await app.evaluate(async () => ({
      sessions: await ProjectComebackDB.getAllByIndex("sessions", "by_module", "gym"),
      hikes: await ProjectComebackDB.getAllByIndex("hikingRecords", "by_module", "hiking"),
      marker: await ProjectComebackDB.getMeta("migration-v21.2a-typed-projection-v1"),
      source: localStorage.getItem("gym-comeback-w1-d1")
    }));
    if (!migrated.sessions.some(session => session.id === "browser-test-gym-session") ||
        !migrated.sessions.some(session => session.date === "2026-11-16") ||
        migrated.hikes.length !== 1 ||
        migrated.marker.value.status !== "complete" || !migrated.source) {
      throw new Error("Real V21.2 app migration or module data checks failed: " + JSON.stringify({
        sessionIds: migrated.sessions.map(session => session.id),
        sessionDates: migrated.sessions.map(session => session.date),
        hikes: migrated.hikes.length,
        marker: migrated.marker,
        sourcePreserved: Boolean(migrated.source)
      }));
    }

    console.log("[browser] Backup-first canonical identity schema upgrade");
    const identitySafetyDownloadPromise = app.waitForEvent("download", { timeout: STEP_TIMEOUT_MS });
    await app.locator("#identity-upgrade-backup").click();
    const identitySafetyDownload = await identitySafetyDownloadPromise;
    if (!identitySafetyDownload.suggestedFilename().includes("Pre-Identity-Upgrade-v1")) {
      throw new Error("Pre-identity V1 safety backup did not download.");
    }
    await app.locator("#identity-upgrade-confirm").check();
    await app.locator("#identity-upgrade-run").click();
    await app.waitForFunction(() => document.querySelector("#identity-upgrade-status").textContent.includes("round trip is verified"), null, { timeout: 15000 });
    const identityUpgradeCheck = await app.evaluate(async () => ({
      version: await ProjectComebackDB.getVersion(),
      reviewStore: await ProjectComebackDB.count("identityReviewEvents"),
      safety: await ProjectComebackDB.get("metadata", "identity-upgrade-v6-safety-snapshot"),
      identityServiceLoaded: typeof ProjectComebackIdentity === "object"
    }));
    if (identityUpgradeCheck.version !== 6 || identityUpgradeCheck.reviewStore !== 0 ||
        identityUpgradeCheck.safety?.verificationStatus !== "complete" || !identityUpgradeCheck.identityServiceLoaded) {
      throw new Error("Backup-first V6 identity upgrade or post-upgrade restore verification failed: " + JSON.stringify(identityUpgradeCheck));
    }
    console.log("PASS explicit V1 safety backup, additive V5→V6 upgrade, V2 backup/restore verification and retained safety snapshot");

    console.log("[browser] Full backup and invalid/valid restore");
    console.log("[browser] Full backup download");
    const backupDownloadPromise = app.waitForEvent("download", { timeout: STEP_TIMEOUT_MS });
    await app.locator("#backup-download").click();
    const backupDownload = await backupDownloadPromise;
    if (!backupDownload.suggestedFilename().includes("Full-Backup")) {
      throw new Error("Full backup download did not start.");
    }
    const backupPath = await backupDownload.path();
    if (!backupPath) throw new Error("Downloaded full backup file is unavailable for restore validation.");
    console.log("[browser] Invalid backup rejection and valid restore");
    const invalidBackupPath = path.join(phoneProfile, "invalid-backup.json");
    fs.writeFileSync(invalidBackupPath, "{ definitely not valid JSON");
    await app.locator('#restore-file').setInputFiles(invalidBackupPath);
    await app.waitForFunction(() => !document.querySelector("#restore-preview").hidden &&
      document.querySelector("#restore-preview").textContent.length > 0);
    if (await app.locator("#restore-apply").isEnabled() ||
        await app.locator("#restore-confirm-wrap").isVisible()) {
      throw new Error("Invalid backup file exposed an enabled restore action or confirmation control.");
    }
    await app.locator('#restore-file').setInputFiles(backupPath);
    await app.waitForFunction(() => !document.querySelector("#restore-preview").hidden &&
      document.querySelector("#restore-preview").textContent.includes("Valid backup"));
    if (await app.locator("#restore-apply").isEnabled()) {
      throw new Error("Restore became enabled before explicit confirmation.");
    }
    await app.locator("#restore-confirm").check();
    if (!(await app.locator("#restore-apply").isEnabled())) {
      throw new Error("Restore did not enable after explicit confirmation.");
    }
    await app.locator("#restore-apply").click();
    await app.waitForFunction(() => document.querySelector("#notice").textContent.includes("Restore completed"));
    const restoreVerification = await app.evaluate(async () => ({
      profileCount: await ProjectComebackDB.count("profile"),
      hikeCount: await ProjectComebackDB.count("hikingRecords"),
      scheduleCount: await ProjectComebackDB.count("schedules"),
      assessmentCount: await ProjectComebackDB.count("assessments"),
      safetySnapshots: (await ProjectComebackDB.getAll("metadata")).filter(item => item.type === "pre-restore-safety-snapshot").length
    }));
    if (restoreVerification.hikeCount !== 1 || restoreVerification.scheduleCount !== 1 || restoreVerification.assessmentCount !== assessmentCountAfterRapidSubmit ||
        restoreVerification.safetySnapshots < 1) {
      throw new Error("Full backup restore UI did not preserve records or create a pre-restore snapshot: " + JSON.stringify(restoreVerification));
    }
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    const persisted = await app.locator("#hiking-count").textContent();
    if (persisted !== "1") throw new Error("V21.2 application data did not persist after reload.");
    await app.evaluate(() => new Promise((resolve, reject) => {
      if (navigator.serviceWorker.controller) resolve();
      else {
        const timer = setTimeout(() => reject(new Error("V21.2 service worker did not take control.")), 15000);
        navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once: true });
      }
    }));
    console.log("[browser] Verified dedicated guide artwork cache");
    const guideCacheCheck = await app.evaluate(async () => {
      const cacheName = "project-comeback-v21-2a-guides-v1";
      const cache = await caches.open(cacheName);
      const manifestResponse = await cache.match(new URL("./assets/guides/manifest.v1.json", location.href).href);
      if (!manifestResponse) throw new Error("Guide manifest is missing from its dedicated cache.");
      const manifest = await manifestResponse.json();
      const assets = await Promise.all(manifest.assets.map(asset =>
        cache.match(new URL(asset.path, location.href).href)));
      const shellCache = await caches.open("project-comeback-v21-2a-shell-v22");
      const shellKeys = await shellCache.keys();
      const names = await caches.keys();
      return { manifestId: manifest.manifestId, count: assets.filter(Boolean).length,
        expected: manifest.assets.length,
        shellHasGuideFiles: shellKeys.some(request => request.url.includes("/assets/guides/") || request.url.includes("/assets/celebrations/")),
        guideCaches: names.filter(name => name.startsWith("project-comeback-v21-2a-guides-")) };
    });
    if (guideCacheCheck.manifestId !== "gym-guide-artwork-v1" || guideCacheCheck.count !== 41 ||
        guideCacheCheck.expected !== 41 || guideCacheCheck.shellHasGuideFiles ||
        guideCacheCheck.guideCaches.length !== 1 || guideCacheCheck.guideCaches[0] !== "project-comeback-v21-2a-guides-v1") {
      throw new Error("Guide assets were not installed into an isolated, complete cache: " + JSON.stringify(guideCacheCheck));
    }
    console.log("PASS 41 guide/celebration assets verified and cached separately from shell and catalogue");

    console.log("[browser] Verified catalogue materialisation and offline lookup");
    const catalogueOnlineCheck = await app.evaluate(async () => {
      const beforeSeed = await ProjectComebackCatalogueDelivery.getStatus();
      let lookupUnavailable = false;
      try { await ProjectComebackCatalogueDelivery.lookup(""); }
      catch (error) { lookupUnavailable = /no verified catalogue release/.test(error.message); }
      if (beforeSeed.status !== "unavailable" || !lookupUnavailable) {
        throw new Error("An unseeded device must report catalogue unavailable, not an empty valid catalogue.");
      }
      const payload = {
        catalogueId: "exercise-catalogue",
        releaseId: "browser-catalogue-r1",
        version: 1,
        schemaVersion: 1,
        definitions: [{ id: "exd_browser_catalogue_test_0001", kind: "system", canonicalName: "Browser Test Squat" }],
        variations: []
      };
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const checksum = "sha256:" + [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
      const manifest = {
        id: payload.releaseId, catalogueId: payload.catalogueId, releaseId: payload.releaseId,
        version: payload.version, schemaVersion: payload.schemaVersion,
        assetUrl: "./catalogues/exercise/" + payload.releaseId + "/" + checksum.slice(7) + ".json",
        contentType: "application/json", byteLength: bytes.byteLength, checksum,
        entryCount: payload.definitions.length, variationCount: payload.variations.length
      };
      const installed = await ProjectComebackCatalogueDelivery.installRelease(manifest, bytes);
      const matches = await ProjectComebackCatalogueDelivery.lookup("Browser Test Squat");
      const cacheNames = await caches.keys();
      return {
        installed, matchCount: matches.length, canonicalName: matches[0]?.canonicalName,
        catalogueCaches: cacheNames.filter(name => name.startsWith(ProjectComebackCatalogueDelivery.cachePrefix))
      };
    });
    if (catalogueOnlineCheck.installed.status !== "active" || catalogueOnlineCheck.matchCount !== 1 ||
        catalogueOnlineCheck.canonicalName !== "Browser Test Squat" || catalogueOnlineCheck.catalogueCaches.length !== 1) {
      throw new Error("Verified catalogue release did not materialise or become queryable: " + JSON.stringify(catalogueOnlineCheck));
    }
    console.log("[browser] Real app offline reload");
    console.log("[browser] V21.2 offline shell reload");
    await appContext.setOffline(true);
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    if (!(await app.locator("h1").textContent()).includes("Build your comeback")) {
      throw new Error("Actual V21.2 application did not reload from its own offline cache.");
    }
    const offlineCatalogueCheck = await app.evaluate(async () => {
      const status = await ProjectComebackCatalogueDelivery.getStatus();
      const matches = await ProjectComebackCatalogueDelivery.lookup("Browser Test Squat");
      const names = await caches.keys();
      return {
        status: status.status, releaseId: status.release?.releaseId,
        matchCount: matches.length, canonicalName: matches[0]?.canonicalName,
        releaseCacheSurvived: names.some(name => name.startsWith(ProjectComebackCatalogueDelivery.cachePrefix))
      };
    });
    if (offlineCatalogueCheck.status !== "active" || offlineCatalogueCheck.releaseId !== "browser-catalogue-r1" ||
        offlineCatalogueCheck.matchCount !== 1 || offlineCatalogueCheck.canonicalName !== "Browser Test Squat" ||
        !offlineCatalogueCheck.releaseCacheSurvived) {
      throw new Error("Verified catalogue lookup or release cache did not survive a real offline app reload: " + JSON.stringify(offlineCatalogueCheck));
    }
    console.log("PASS verified catalogue materialisation, lookup and separate release cache survive offline reload");

    await appContext.close();
    appContext = null;

    // A page reload is not a browser restart. Reopen the same persistent profile
    // in a fresh browser process and prove IndexedDB records survive a cold start.
    console.log("[browser] Cold-start persistence");
    console.log("[browser] Cold browser-process restart and persistence check");
    appContext = await chromium.launchPersistentContext(phoneProfile, { headless: true });
    appContext.setDefaultTimeout(STEP_TIMEOUT_MS);
    appContext.setDefaultNavigationTimeout(STEP_TIMEOUT_MS);
    const reopened = await appContext.newPage();
    reopened.on("pageerror", error => console.error("V21.2 REOPEN PAGE ERROR:", error.message));
    await reopened.goto(base + "/v21.2/");
    await reopened.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    const afterColdStart = await reopened.evaluate(async () => ({
      gym: document.querySelector("#gym-count").textContent,
      hikes: document.querySelector("#hiking-count").textContent,
      schedule: document.querySelector("#schedule-count").textContent,
      storedGym: await ProjectComebackDB.count("sessions"),
      storedHikes: await ProjectComebackDB.count("hikingRecords"),
      storedSchedule: await ProjectComebackDB.count("schedules"),
      assessments: await ProjectComebackDB.count("assessments")
    }));
    if (afterColdStart.gym !== "3" || afterColdStart.hikes !== "1" || afterColdStart.schedule !== "1" ||
        afterColdStart.storedGym !== 3 || afterColdStart.storedHikes !== 1 || afterColdStart.storedSchedule !== 1 ||
        afterColdStart.assessments !== assessmentCountAfterRapidSubmit) {
      throw new Error("V21.2 records did not survive a full browser close/reopen with the same profile: " + JSON.stringify(afterColdStart));
    }
    console.log("PASS V21.2 IndexedDB data survives browser process close and reopen with the same profile");
    console.log("PASS real V21.2 app: no automatic migration, manual Gym migration, hiking/schedule writes, backup, reload and offline shell");
    await appContext.close();
    appContext = null;
  } finally {
    // The persistent context is launched separately from `browser`; close it on
    // every failure path as well so assertion failures exit promptly with logs.
    if (appContext) {
      try { await appContext.close(); }
      catch (error) { console.error("[browser] Persistent context cleanup failed:", error.message); }
    }
    try { await browser.close(); }
    catch (error) { console.error("[browser] Browser cleanup failed:", error.message); }
    await new Promise(resolve => httpServer.close(resolve));
    if (phoneProfile) fs.rmSync(phoneProfile, { recursive: true, force: true });
  }
})().catch(error => { console.error("[browser] FAILED:", error && error.stack || error); process.exitCode = 1; });
