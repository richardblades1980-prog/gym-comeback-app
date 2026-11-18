"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
const ROOT_WORKER_URL = "https://gym.example/gym-comeback-app/sw.js";

function loadWorker(cacheNames = []) {
  const listeners = {};
  const deleted = [];
  const opened = [];
  const caches = {
    keys: async () => [...cacheNames],
    delete: async name => { deleted.push(name); return true; },
    match: async () => undefined,
    open: async name => {
      opened.push(name);
      return { put: async () => undefined };
    }
  };
  class TestResponse {
    constructor(body, options = {}) {
      this.body = body;
      this.status = options.status || 200;
      this.ok = this.status >= 200 && this.status < 300;
    }
    clone() { return new TestResponse(this.body, { status: this.status }); }
  }
  const self = {
    location: new URL(ROOT_WORKER_URL),
    addEventListener: (name, handler) => { listeners[name] = handler; },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined
  };
  const context = {
    self, caches, URL, Response: TestResponse,
    fetch: async () => new TestResponse("network")
  };
  vm.runInNewContext(source, context);
  return { listeners, caches, deleted, opened };
}

test("V21.1 root worker ignores the V21.2 project subdirectory", () => {
  const { listeners } = loadWorker();
  for (const pathname of [
    "/gym-comeback-app/v21.2",
    "/gym-comeback-app/v21.2/",
    "/gym-comeback-app/v21.2/index.html",
    "/gym-comeback-app/v21.2/assets/app.js"
  ]) {
    let intercepted = false;
    listeners.fetch({
      request: { method: "GET", url: "https://gym.example" + pathname, mode: "navigate" },
      respondWith: () => { intercepted = true; }
    });
    assert.equal(intercepted, false, "V21.2 request must pass through unchanged: " + pathname);
  }
});

test("V21.1 root worker still handles its own path and does not exempt lookalike paths", () => {
  const { listeners } = loadWorker();
  for (const pathname of ["/gym-comeback-app/", "/gym-comeback-app/index.html", "/gym-comeback-app/v21.20/"]) {
    let intercepted = false;
    listeners.fetch({
      request: { method: "GET", url: "https://gym.example" + pathname, mode: "navigate" },
      respondWith: () => { intercepted = true; }
    });
    assert.equal(intercepted, true, "Root worker should continue to handle its own route: " + pathname);
  }
  let crossOriginIntercepted = false;
  listeners.fetch({
    request: { method: "GET", url: "https://other.example/gym-comeback-app/v21.2/", mode: "navigate" },
    respondWith: () => { crossOriginIntercepted = true; }
  });
  assert.equal(crossOriginIntercepted, false, "Root worker must not intercept cross-origin requests");
});

test("V21.1 activation deletes only old caches in its owned namespace", async () => {
  const names = [
    "gym-comeback-v21-1b-1-legacy",
    "gym-comeback-v21-1b-2-1-timed-repetition-stopwatch-reset",
    "project-comeback-v21-2a-shell-v27",
    "project-comeback-v21-2a-guides-v1",
    "unrelated-app-cache"
  ];
  const worker = loadWorker(names);
  let activation;
  worker.listeners.activate({ waitUntil: promise => { activation = promise; } });
  await activation;
  assert.deepEqual(worker.deleted, ["gym-comeback-v21-1b-1-legacy"]);
  assert.ok(!worker.deleted.some(name => name.startsWith("project-comeback-v21-2a-")));
  assert.ok(!worker.deleted.includes("unrelated-app-cache"));
});

test("V21.1 root install precaches its own index for update-safe offline startup", () => {
  assert.match(source, /const ASSETS=\['\.\/index\.html','\.\/manifest\.webmanifest'/);
  assert.match(source, /const V21_2_PATH=new URL\('\.\/v21\.2\/',self\.location\)\.pathname/);
  assert.match(source, /key\.startsWith\(OWNED_CACHE_PREFIX\)&&key!==CACHE/);
});

test("V21.2 keeps its service worker and manifest scoped beneath its app directory", () => {
  const registration = fs.readFileSync(path.join(__dirname, "..", "v21.2", "register.js"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "v21.2", "manifest.webmanifest"), "utf8"));
  assert.match(registration, /register\("\.\/sw\.js"\)/);
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./");
});
