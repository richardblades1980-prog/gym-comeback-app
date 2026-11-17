"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const pairs = [
  ["src/data/database.js","v21.2/assets/database.js"],
  ["src/data/gym-migration.js","v21.2/assets/gym-migration.js"],
  ["src/data/shared-migration.js","v21.2/assets/shared-migration.js"],
  ["src/data/migration.js","v21.2/assets/migration.js"],
  ["src/modules/module-registry.js","v21.2/assets/module-registry.js"],
  ["src/data/backup.js","v21.2/assets/backup.js"],
  ["src/programme-manager/programme-manager.js","v21.2/assets/programme-manager.js"],
  ["src/shared/workload-summary.js","v21.2/assets/workload-summary.js"],
  ["src/progress/assessment-manager.js","v21.2/assets/assessment-manager.js"]
];
let failed = false;
for (const [source,bundle] of pairs) {
  const a = fs.readFileSync(path.join(root,source),"utf8");
  const b = fs.readFileSync(path.join(root,bundle),"utf8");
  if (a !== b) { console.error("FAIL stale V21.2 browser bundle:",bundle,"does not match",source); failed=true; }
  else console.log("PASS bundle matches",source);
}
if (failed) process.exit(1);
