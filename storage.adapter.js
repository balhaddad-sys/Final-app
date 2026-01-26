// storage.adapter.js
// Integration adapter for existing MedWard Pro sync engine
// Replaces localStorage with IndexedDB while maintaining API compatibility
// Version: 1.0.0 (2026-01-26)

import DB from "./storage.db.js";
import { migrateFromLocalStorage } from "./storage.migrate.js";

// ==================== Global State ====================

let dbInstance = null;
let isReady = false;
let readyPromise = null;

// ==================== Initialization ====================

/**
 * Initialize the storage adapter - call this on dashboard boot
 * Replaces the localStorage init logic
 */
export async function initStorageAdapter({ build = "dev", onProgress = null } = {}) {
  const t0 = performance.now();

  window.monitor?.emit("ADAPTER", "INFO", "Storage adapter init started", { build });

  try {
    // Step 1: Open IndexedDB
    if (onProgress) onProgress("Opening IndexedDB...");
    const { db, deviceId } = await DB.initStorage({ build });
    dbInstance = db;

    window.monitor?.emit("ADAPTER", "SUCCESS", "IndexedDB opened", { deviceId });

    // Step 2: Migration from localStorage (if needed)
    if (onProgress) onProgress("Checking migration...");
    const migrationResult = await migrateFromLocalStorage(db);

    if (migrationResult.migrated && !migrationResult.skipped) {
      window.monitor?.emit("ADAPTER", "SUCCESS", "Migration completed", migrationResult);
    }

    // Step 3: Mark as ready
    isReady = true;

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("ADAPTER", "SUCCESS", "Storage adapter ready", {
      deviceId,
      migrated: migrationResult.migrated,
      ms: elapsed
    });

    return {
      success: true,
      db,
      deviceId,
      migrationResult,
      ms: elapsed
    };

  } catch (error) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("ADAPTER", "ERROR", "Storage adapter init failed", {
      error: error.message,
      ms: elapsed
    });

    // Fallback to localStorage if IndexedDB fails
    console.error("IndexedDB init failed, falling back to localStorage:", error);
    return {
      success: false,
      fallbackMode: true,
      error: error.message
    };
  }
}

/**
 * Get ready promise - useful for waiting on adapter initialization
 */
export function whenReady() {
  if (isReady) return Promise.resolve(dbInstance);

  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      const check = setInterval(() => {
        if (isReady) {
          clearInterval(check);
          resolve(dbInstance);
        }
      }, 50);
    });
  }

  return readyPromise;
}

/**
 * Get database instance (throws if not ready)
 */
export function getDB() {
  if (!dbInstance) {
    throw new Error("Storage adapter not initialized - call initStorageAdapter() first");
  }
  return dbInstance;
}

// ==================== State Management Adapter ====================

/**
 * Load full state from IndexedDB
 * Replaces: JSON.parse(localStorage.getItem('medward_pro_v12'))
 */
export async function loadStateFromDB(correlationId = null) {
  const opId = correlationId || crypto.randomUUID?.() || String(Date.now());
  const t0 = performance.now();

  window.monitor?.emit("ADAPTER", "INFO", "loadStateFromDB started", { opId });

  try {
    const db = await whenReady();
    const fullState = await DB.exportFullState(db);

    // Transform to match existing state structure
    const state = {
      patients: fullState.patients || [],
      units: fullState.units || [],
      trash: {
        patients: fullState.trash?.patients || [],
        units: fullState.trash?.units || []
      },
      // Preserve other state fields (set by caller)
      settings: {},
      currentUnit: null,
      currentUser: null,
      currentPatient: null,
      selectedUnitId: null,
      editingUnitId: null,
      importImage: null,
      importPatients: [],
      currentFilter: 'all',
      unitRequests: [],
      selectedRequestId: null,
      selectedIcon: '🏥',
      sessionId: null
    };

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("ADAPTER", "SUCCESS", "loadStateFromDB completed", {
      opId,
      patientCount: state.patients.length,
      unitCount: state.units.length,
      ms: elapsed
    });

    return state;

  } catch (error) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("ADAPTER", "ERROR", "loadStateFromDB failed", {
      opId,
      error: error.message,
      ms: elapsed
    });
    throw error;
  }
}

/**
 * Save full state to IndexedDB
 * Replaces: localStorage.setItem('medward_pro_v12', JSON.stringify(state))
 */
export async function saveStateToDBfunction(state, correlationId = null) {
  const opId = correlationId || crypto.randomUUID?.() || String(Date.now());
  const t0 = performance.now();

  window.monitor?.emit("ADAPTER", "INFO", "saveStateToDB started", {
    opId,
    patientCount: state.patients?.length || 0,
    unitCount: state.units?.length || 0
  });

  try {
    const db = await whenReady();

    // Import full state
    await DB.importFullState(db, {
      patients: state.patients || [],
      units: state.units || [],
      trash: state.trash || { patients: [], units: [] },
      meta: {} // Metadata is handled separately
    }, { correlationId: opId });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("ADAPTER", "SUCCESS", "saveStateToDB completed", {
      opId,
      ms: elapsed
    });

    return true;

  } catch (error) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("ADAPTER", "ERROR", "saveStateToDB failed", {
      opId,
      error: error.message,
      ms: elapsed
    });
    throw error;
  }
}

// ==================== Patient Operations ====================

/**
 * Add patient to database (with patch queue)
 */
export async function addPatientToDB(patient, { unitId, correlationId } = {}) {
  const db = await whenReady();
  return await DB.upsertPatient(db, patient, { unitId, correlationId });
}

/**
 * Update patient in database (with patch queue)
 */
export async function updatePatientInDB(patient, { correlationId } = {}) {
  const db = await whenReady();
  return await DB.upsertPatient(db, patient, { correlationId });
}

/**
 * Delete patient (soft delete with trash)
 */
export async function deletePatientFromDB(patientId, { correlationId } = {}) {
  const db = await whenReady();
  return await DB.softDeletePatient(db, patientId, { correlationId });
}

/**
 * Get all patients for a unit
 */
export async function getPatientsByUnitFromDB(unitId) {
  const db = await whenReady();
  return await DB.listPatientsByUnit(db, unitId);
}

/**
 * Get all patients (active only by default)
 */
export async function getAllPatientsFromDB({ includeDeleted = false } = {}) {
  const db = await whenReady();
  return await DB.listAllPatients(db, { includeDeleted });
}

// ==================== Unit Operations ====================

/**
 * Add unit to database
 */
export async function addUnitToDB(unit, { correlationId } = {}) {
  const db = await whenReady();
  return await DB.upsertUnit(db, unit, { correlationId });
}

/**
 * Update unit in database
 */
export async function updateUnitInDB(unit, { correlationId } = {}) {
  const db = await whenReady();
  return await DB.upsertUnit(db, unit, { correlationId });
}

/**
 * Get all units
 */
export async function getAllUnitsFromDB() {
  const db = await whenReady();
  return await DB.listUnits(db);
}

// ==================== Patch Queue Operations (Sync Engine Integration) ====================

/**
 * Load patch queue from IndexedDB
 * Replaces: JSON.parse(localStorage.getItem('MW_PATCH_QUEUE_V3'))
 */
export async function loadPatchQueueFromDB({ maxAge = 24 * 60 * 60 * 1000, correlationId } = {}) {
  try {
    const db = await whenReady();
    const patches = await DB.listPendingPatches(db, { maxAge });

    window.monitor?.emit("ADAPTER", "SUCCESS", "loadPatchQueueFromDB", {
      correlationId,
      count: patches.length
    });

    return patches;

  } catch (error) {
    window.monitor?.emit("ADAPTER", "ERROR", "loadPatchQueueFromDB failed", {
      correlationId,
      error: error.message
    });
    return [];
  }
}

/**
 * Save a single patch to IndexedDB queue
 * Replaces: sync.patchQueue.push(...); localStorage.setItem(...)
 */
export async function savePatchToQueue(patch, { correlationId } = {}) {
  const db = await whenReady();
  return await DB.enqueuePatch(db, patch, { correlationId });
}

/**
 * Bulk save patches to queue
 */
export async function savePatchQueueToDB(patches, { correlationId } = {}) {
  const db = await whenReady();

  for (const patch of patches) {
    await DB.enqueuePatch(db, patch, { correlationId });
  }

  window.monitor?.emit("ADAPTER", "SUCCESS", "savePatchQueueToDB", {
    correlationId,
    count: patches.length
  });

  return true;
}

/**
 * Acknowledge patches (mark as synced)
 * Replaces: sync.acknowledgedPatches.add(patchId)
 */
export async function acknowledgePatchesInDB(patchIds, { correlationId } = {}) {
  const db = await whenReady();

  if (Array.isArray(patchIds)) {
    return await DB.bulkAcknowledgePatches(db, patchIds, { correlationId });
  } else {
    return await DB.acknowledgePatch(db, patchIds, { correlationId });
  }
}

/**
 * Clear old acknowledged patches
 */
export async function clearAcknowledgedPatchesFromDB({ olderThanMs = 60000, correlationId } = {}) {
  const db = await whenReady();
  return await DB.clearAcknowledgedPatches(db, { olderThanMs, correlationId });
}

// ==================== Metadata Operations (Sync State) ====================

/**
 * Get sync metadata
 * Replaces: localStorage.getItem('MW_REV_V3'), etc.
 */
export async function getSyncMetadata(keys) {
  const db = await whenReady();

  if (Array.isArray(keys)) {
    const results = {};
    for (const key of keys) {
      results[key] = await DB.getMeta(db, key);
    }
    return results;
  } else {
    return await DB.getMeta(db, keys);
  }
}

/**
 * Set sync metadata
 * Replaces: localStorage.setItem('MW_REV_V3', ...)
 */
export async function setSyncMetadata(key, value) {
  const db = await whenReady();
  return await DB.setMeta(db, key, value);
}

/**
 * Bulk set metadata
 */
export async function bulkSetSyncMetadata(entries) {
  const db = await whenReady();
  return await DB.bulkSetMeta(db, entries);
}

// ==================== Trash/Recycle Bin Operations ====================

/**
 * Get trash contents
 */
export async function getTrashFromDB({ type = null } = {}) {
  const db = await whenReady();
  return await DB.listTrash(db, { type });
}

/**
 * Restore patient from trash
 */
export async function restorePatientFromTrashDB(patientId, { correlationId } = {}) {
  const db = await whenReady();
  return await DB.restorePatientFromTrash(db, patientId, { correlationId });
}

/**
 * Empty trash
 */
export async function emptyTrashDB({ olderThanDays = null, correlationId } = {}) {
  const db = await whenReady();
  return await DB.emptyTrash(db, { olderThanDays, correlationId });
}

// ==================== Statistics & Diagnostics ====================

/**
 * Get storage statistics for monitoring/debug UI
 */
export async function getStorageStatsFromDB() {
  const db = await whenReady();
  return await DB.getStorageStats(db);
}

// ==================== Export for Testing/Debug ====================

export { DB as rawDB };

export default {
  // Initialization
  initStorageAdapter,
  whenReady,
  getDB,

  // State management
  loadStateFromDB,
  saveStateToDB: saveStateToDBfunction,

  // Patient operations
  addPatientToDB,
  updatePatientInDB,
  deletePatientFromDB,
  getPatientsByUnitFromDB,
  getAllPatientsFromDB,

  // Unit operations
  addUnitToDB,
  updateUnitInDB,
  getAllUnitsFromDB,

  // Patch queue (sync integration)
  loadPatchQueueFromDB,
  savePatchToQueue,
  savePatchQueueToDB,
  acknowledgePatchesInDB,
  clearAcknowledgedPatchesFromDB,

  // Metadata (sync state)
  getSyncMetadata,
  setSyncMetadata,
  bulkSetSyncMetadata,

  // Trash
  getTrashFromDB,
  restorePatientFromTrashDB,
  emptyTrashDB,

  // Diagnostics
  getStorageStatsFromDB
};
