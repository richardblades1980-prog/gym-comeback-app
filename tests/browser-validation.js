"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
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
  try {
    const context = await browser.newContext();
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

    const offline = await context.newPage();
    await offline.goto(base + "/tests/fixtures/offline/");
    await offline.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
    await offline.reload();
    await offline.evaluate(() => new Promise(resolve => {
      if (navigator.serviceWorker.controller) resolve();
      else navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
    }));
    await context.setOffline(true);
    await offline.reload();
    const shell = await offline.locator("#shell").textContent();
    const loaded = await offline.locator("html").getAttribute("data-shell-loaded");
    if (!shell.includes("offline shell ready") || loaded !== "true") {
      throw new Error("Offline app shell did not load from the scoped cache.");
    }

    console.log("PASS offline app shell served from /tests/fixtures/offline/ service-worker scope");

    const phoneProfile = fs.mkdtempSync(path.join(os.tmpdir(), "project-comeback-phone-profile-"));
    let appContext = await chromium.launchPersistentContext(phoneProfile, { headless: true, acceptDownloads: true });
    const app = await appContext.newPage();
    app.on("pageerror", error => console.error("V21.2 APP PAGE ERROR:", error.message));
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
      const focus = getComputedStyle(input);
      const inputStyle = getComputedStyle(input);
      const panelStyle = getComputedStyle(panel);
      const secondaryStyle = getComputedStyle(secondary);
      const root = getComputedStyle(document.documentElement);
      return {
        inputBoundary: ratio(inputStyle.borderTopColor, inputStyle.backgroundColor),
        panelBoundary: ratio(panelStyle.borderTopColor, root.getPropertyValue('--panel').trim()),
        secondaryBoundary: ratio(secondaryStyle.borderTopColor, root.getPropertyValue('--panel2').trim()),
        focusIndicator: ratio(root.getPropertyValue('--accent').trim(), root.getPropertyValue('--bg').trim())
      };
    });
    for (const [name, value] of Object.entries(contrastAudit)) {
      if (value < 3) throw new Error(name + " contrast is below 3:1: " + value.toFixed(2));
    }
    console.log("PASS control-boundary and focus-indicator contrast (3:1 minimum): " + JSON.stringify(contrastAudit));
    if (await app.locator(".skip-link").count() !== 1 || await app.locator("#main-content").getAttribute("tabindex") !== "-1") throw new Error("Keyboard skip navigation is missing.");
    await app.keyboard.press("Tab");
    if (await app.evaluate(() => document.activeElement?.classList.contains("skip-link")) !== true) throw new Error("Skip link is not the first keyboard focus target.");
    await app.keyboard.press("Enter");
    if (await app.evaluate(() => document.activeElement?.id) !== "main-content") throw new Error("Skip link did not move focus to the main landmark.");
    const labelledControls = await app.evaluate(() => [...document.querySelectorAll("#view-hiking input, #view-hiking textarea, #view-schedule input, #view-schedule select")]
      .filter(control => control.type !== "hidden" && !control.labels?.length && !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby"))
      .map(control => control.outerHTML));
    if (labelledControls.length) throw new Error("Form controls without accessible labels: " + labelledControls.join("\\n"));
    await app.setViewportSize({ width: 375, height: 812 });
    const narrowLayout = await app.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    if (narrowLayout.page > narrowLayout.viewport) throw new Error("V21.2 layout has horizontal page overflow at 375px: " + JSON.stringify(narrowLayout));
    await app.setViewportSize({ width: 1280, height: 900 });
    if (await app.locator('[data-view="overview"]').getAttribute("aria-current") !== "page") throw new Error("Initial navigation state is not exposed accessibly.");
    await app.locator('[data-view="hiking"]').click();
    if (await app.locator('[data-view="hiking"]').getAttribute("aria-current") !== "page" || await app.locator('[data-view="overview"]').getAttribute("aria-current") !== null) throw new Error("Active navigation state did not update accessibly.");
    await app.locator('[data-view="overview"]').click();
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

    await app.locator('[data-view="data"]').click();
    const snapshotDownloadPromise = app.waitForEvent("download");
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
    if (migrated.sessions.length !== 1 || migrated.hikes.length !== 1 ||
        migrated.marker.value.status !== "complete" || !migrated.source) {
      throw new Error("Real V21.2 app migration or module data checks failed.");
    }

    const backupDownloadPromise = app.waitForEvent("download");
    await app.locator("#backup-download").click();
    const backupDownload = await backupDownloadPromise;
    if (!backupDownload.suggestedFilename().includes("Full-Backup")) {
      throw new Error("Full backup download did not start.");
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
    await appContext.setOffline(true);
    await app.reload();
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    if (!(await app.locator("h1").textContent()).includes("Build your comeback")) {
      throw new Error("Actual V21.2 application did not reload from its own offline cache.");
    }
    await appContext.close();

    // A page reload is not a browser restart. Reopen the same persistent profile
    // in a fresh browser process and prove IndexedDB records survive a cold start.
    appContext = await chromium.launchPersistentContext(phoneProfile, { headless: true });
    const reopened = await appContext.newPage();
    reopened.on("pageerror", error => console.error("V21.2 REOPEN PAGE ERROR:", error.message));
    await reopened.goto(base + "/v21.2/");
    await reopened.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
    const afterColdStart = await reopened.evaluate(() => ({
      gym: document.querySelector("#gym-count").textContent,
      hikes: document.querySelector("#hiking-count").textContent,
      schedule: document.querySelector("#schedule-count").textContent
    }));
    if (afterColdStart.gym !== "1" || afterColdStart.hikes !== "1" || afterColdStart.schedule !== "1") {
      throw new Error("V21.2 records did not survive a full browser close/reopen with the same profile: " + JSON.stringify(afterColdStart));
    }
    console.log("PASS V21.2 IndexedDB data survives browser process close and reopen with the same profile");
    console.log("PASS real V21.2 app: no automatic migration, manual Gym migration, hiking/schedule writes, backup, reload and offline shell");
    await appContext.close();
    fs.rmSync(phoneProfile, { recursive: true, force: true });
  } finally {
    await browser.close();
    await new Promise(resolve => httpServer.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
