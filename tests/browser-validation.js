"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
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

    const appContext = await browser.newContext({ acceptDownloads: true });
    const app = await appContext.newPage();
    app.on("pageerror", error => console.error("V21.2 APP PAGE ERROR:", error.message));
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
    await app.waitForFunction(() => document.querySelector("#connection-state").textContent === "Local database ready");
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
    await app.locator('#hiking-form [name="distanceKm"]').fill("4.25");
    await app.locator('#hiking-form button[type="submit"]').click();
    await app.waitForFunction(() => document.querySelector("#hiking-count").textContent === "1");
    await app.locator('[data-view="schedule"]').click();
    await app.locator('#schedule-form [name="title"]').fill("Browser test gym session");
    await app.locator('#schedule-form [name="date"]').fill("2026-11-17");
    await app.locator('#schedule-form button[type="submit"]').click();
    await app.waitForFunction(() => document.querySelector("#schedule-count").textContent === "1");

    await app.locator('[data-view="data"]').click();
    const snapshotDownload = await app.waitForEvent("download");
    await app.locator("#legacy-snapshot").click();
    const snapshotName = snapshotDownload.suggestedFilename();
    if (!snapshotName.endsWith(".json")) throw new Error("Legacy safety snapshot was not downloaded.");
    await app.locator("#migration-confirm").check();
    await app.locator("#migration-run").click();
    await app.waitForFunction(() => document.querySelector("#migration-result").textContent.includes("Migration status: complete"));
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

    const backupDownload = await app.waitForEvent("download");
    await app.locator("#backup-download").click();
    if (!(await backupDownload).suggestedFilename().includes("Full-Backup")) {
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
    console.log("PASS real V21.2 app: no automatic migration, manual Gym migration, hiking/schedule writes, backup, reload and offline shell");
    await appContext.close();
  } finally {
    await browser.close();
    await new Promise(resolve => httpServer.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
