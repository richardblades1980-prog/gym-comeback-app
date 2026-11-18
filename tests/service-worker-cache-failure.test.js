"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const workers = [
  { path: "../sw.js", scope: "https://gym.example/" },
  { path: "../v21.2/sw.js", scope: "https://gym.example/v21.2/" }
];

async function runFetchWithCacheFailure(worker, failure, mode) {
  const listeners = {};
  const cacheCalls = [];
  const caches = {
    match: async () => undefined,
    open: async name => {
      cacheCalls.push(name);
      if (failure === "open") throw new Error("simulated CacheStorage open failure");
      return { put: async () => {
        if (failure === "put") throw new Error("simulated cache.put failure");
        return undefined;
      }};
    },
    keys: async () => []
  };
  const self = {
    location: { origin: "https://gym.example", pathname: worker.scope === "https://gym.example/" ? "/" : "/v21.2/" },
    addEventListener: (name, handler) => { listeners[name] = handler; },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined }
  };
  const context = {
    self, caches, URL, Response,
    fetch: async request => new Response("network-response", { status: 200, headers: { "content-type": "text/plain" } }),
    console
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, worker.path), "utf8"), context);
  const requestUrl = worker.scope === "https://gym.example/"
    ? "https://gym.example/assets/runtime.js"
    : "https://gym.example/v21.2/assets/runtime.js";
  let responsePromise;
  listeners.fetch({
    request: { method: "GET", mode, url: requestUrl },
    respondWith: promise => { responsePromise = promise; }
  });
  const response = await responsePromise;
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "network-response");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(cacheCalls.length >= 1, "worker attempted a cache write");
}

for (const worker of workers) {
  for (const failure of ["open", "put"]) {
    test(worker.path + " returns network response when CacheStorage " + failure + " fails", async () => {
      await runFetchWithCacheFailure(worker, failure);
    });
  }
}
