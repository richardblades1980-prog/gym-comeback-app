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
      await page.waitForFunction(() => document.querySelector("#result").textContent.startsWith("{") &&
        !document.querySelector("#result").textContent.includes("ready"), null, { timeout: 15000 });
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
  } finally {
    await browser.close();
    await new Promise(resolve => httpServer.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
