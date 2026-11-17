"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const STEP_TIMEOUT_MS = 20000;
console.log("[browser] Starting Chromium validation");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
function server() {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
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
    app.on("pageerror", error => { appPageErrors.push(error.message); console.error("V21.2 APP PAGE ERROR:", error.message); });
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
    await app.locator('#schedule-form [name="date"]').fill("2026-11-17");
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
        !gymJourneyCheck.includes("Weight entries below are shown exactly as saved")) {
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
        !gymHistoryCheck.includes("2 completed sessions recorded") ||
        !gymHistoryCheck.includes("first 15 kg") || !gymHistoryCheck.includes("latest 20 kg") ||
        !gymHistoryCheck.includes("change +5 kg") || !gymHistoryCheck.includes("not a one-rep maximum")) {
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
        !loadEdgeChecks.sameDay.includes("change -3 kg")) {
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
    if (migrated.sessions.length !== 2 ||
        !migrated.sessions.some(session => session.id === "browser-test-gym-session") ||
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
    console.log("[browser] Real app offline reload");
    console.log("[browser] V21.2 offline shell reload");
    await appContext.setOffline(true);
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    if (!(await app.locator("h1").textContent()).includes("Build your comeback")) {
      throw new Error("Actual V21.2 application did not reload from its own offline cache.");
    }
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
    if (afterColdStart.gym !== "2" || afterColdStart.hikes !== "1" || afterColdStart.schedule !== "1" ||
        afterColdStart.storedGym !== 2 || afterColdStart.storedHikes !== 1 || afterColdStart.storedSchedule !== 1 ||
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
