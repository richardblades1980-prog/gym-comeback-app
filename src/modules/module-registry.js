/* Project Comeback V21.2A — module registry and ownership boundaries.
 * Disabling a module never deletes or rewrites its stored records.
 */
(function (global) {
  "use strict";

  const DEFAULT_MODULES = [
    { id: "gym", name: "Gym Comeback", enabled: true, status: "active", moduleVersion: 1 },
    { id: "hiking", name: "Hiking Preparation", enabled: true, status: "active", moduleVersion: 1 }
  ];

  const OWNED_STORES = Object.freeze({
    gym: Object.freeze(["sessions", "exerciseRecords", "setRecords", "progression"]),
    hiking: Object.freeze(["hikingRecords"])
  });

  function dbApi() {
    if (!global.ProjectComebackDB) throw new Error("Load database.js before modules.js.");
    return global.ProjectComebackDB;
  }

  function validateModuleId(moduleId) {
    if (!Object.prototype.hasOwnProperty.call(OWNED_STORES, moduleId)) {
      throw new Error("Unknown Project Comeback module: " + moduleId);
    }
  }

  async function initialise() {
    const db = dbApi();
    const created = [];
    for (const module of DEFAULT_MODULES) {
      const existing = await db.get("modules", module.id);
      if (!existing) {
        await db.put("modules", Object.assign({}, module, {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        created.push(module.id);
      }
    }
    return { modules: await list(), created };
  }

  async function list() {
    return dbApi().getAll("modules");
  }

  async function get(moduleId) {
    validateModuleId(moduleId);
    return dbApi().get("modules", moduleId);
  }

  async function setEnabled(moduleId, enabled) {
    validateModuleId(moduleId);
    if (typeof enabled !== "boolean") throw new Error("Module enabled state must be true or false.");
    const db = dbApi();
    const current = await db.get("modules", moduleId);
    if (!current) throw new Error("Module registry is not initialised. Run initialise() first.");
    const updated = Object.assign({}, current, {
      enabled,
      status: enabled ? "active" : "disabled",
      updatedAt: new Date().toISOString()
    });
    await db.put("modules", updated);
    return updated;
  }

  async function putOwnedRecord(moduleId, storeName, record) {
    validateModuleId(moduleId);
    if (!OWNED_STORES[moduleId].includes(storeName)) {
      throw new Error("Module " + moduleId + " cannot write to store " + storeName + ".");
    }
    if (!record || record.moduleId !== moduleId) {
      throw new Error("Module-owned records must carry the matching moduleId.");
    }
    const module = await get(moduleId);
    if (!module) throw new Error("Module registry is not initialised.");
    if (!module.enabled) throw new Error("Module " + moduleId + " is disabled; existing records remain readable.");
    return dbApi().put(storeName, record);
  }

  async function getOwnedRecords(moduleId, storeName) {
    validateModuleId(moduleId);
    if (!OWNED_STORES[moduleId].includes(storeName)) {
      throw new Error("Module " + moduleId + " cannot read from store " + storeName + ".");
    }
    return dbApi().getAll(storeName, IDBKeyRange.only(moduleId));
  }

  global.ProjectComebackModules = Object.freeze({
    defaults: DEFAULT_MODULES,
    ownedStores: OWNED_STORES,
    initialise,
    list,
    get,
    setEnabled,
    putOwnedRecord,
    getOwnedRecords
  });
})(window);
