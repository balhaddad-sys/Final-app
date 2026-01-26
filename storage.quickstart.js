// storage.quickstart.js
// Quick-start helper for integrating IndexedDB into existing MedWard Pro
// Drop-in replacement functions for easy migration
// Version: 1.0.0 (2026-01-26)

import StorageAdapter from './storage.adapter.js';

// ==================== Configuration ====================

const CONFIG = {
  ENABLE_FALLBACK: true,     // Fall back to localStorage if IndexedDB fails
  LOG_OPERATIONS: true,      // Log all storage operations
  AUTO_CLEANUP: true,        // Auto-cleanup old patches
  CLEANUP_INTERVAL_MS: 300000 // 5 minutes
};

let initialized = false;
let useFallback = false;

// ==================== Quick Start API ====================

/**
 * Initialize storage (call once on app boot)
 * Replaces your existing initSyncEngine() or storage init
 */
export async function initStorage({ build = 'dev', sync = null } = {}) {
  try {
    window.monitor?.emit('QUICKSTART', 'INFO', 'Initializing storage', { build });

    const result = await StorageAdapter.initStorageAdapter({ build });

    if (result.success) {
      initialized = true;
      useFallback = false;

      window.monitor?.emit('QUICKSTART', 'SUCCESS', 'IndexedDB initialized', {
        deviceId: result.deviceId,
        migrated: result.migrationResult?.migrated
      });

      // Load sync metadata into sync object if provided
      if (sync) {
        const metadata = await StorageAdapter.getSyncMetadata([
          'clientRev',
          'clientChecksum',
          'deviceId'
        ]);

        sync.deviceId = metadata.deviceId || result.deviceId;
        sync.clientRev = parseInt(metadata.clientRev || '0', 10);
        sync.clientChecksum = metadata.clientChecksum || null;

        window.monitor?.emit('QUICKSTART', 'INFO', 'Sync metadata loaded', {
          deviceId: sync.deviceId,
          rev: sync.clientRev
        });
      }

      // Start auto-cleanup if enabled
      if (CONFIG.AUTO_CLEANUP) {
        startAutoCleanup();
      }

      return {
        success: true,
        deviceId: result.deviceId,
        mode: 'indexeddb'
      };

    } else {
      throw new Error('IndexedDB init failed');
    }

  } catch (error) {
    window.monitor?.emit('QUICKSTART', 'ERROR', 'IndexedDB init failed, using fallback', {
      error: error.message
    });

    if (CONFIG.ENABLE_FALLBACK) {
      useFallback = true;
      initialized = true;

      return {
        success: true,
        mode: 'localStorage',
        warning: 'Running in fallback mode'
      };
    } else {
      throw error;
    }
  }
}

/**
 * Load state from storage
 * Replaces: JSON.parse(localStorage.getItem('medward_pro_v12'))
 */
export async function loadState() {
  if (useFallback) {
    const raw = localStorage.getItem('medward_pro_v12');
    return raw ? JSON.parse(raw) : null;
  }

  return await StorageAdapter.loadStateFromDB();
}

/**
 * Save state to storage
 * Replaces: localStorage.setItem('medward_pro_v12', JSON.stringify(state))
 */
export async function saveState(state) {
  if (useFallback) {
    localStorage.setItem('medward_pro_v12', JSON.stringify(state));
    return true;
  }

  return await StorageAdapter.saveStateToDB(state);
}

/**
 * Save a patient (optimized single-patient save)
 * Use this instead of full state save for individual patient updates
 */
export async function savePatient(patient, { unitId, correlationId } = {}) {
  if (useFallback) {
    // Fallback: do nothing (caller should update state and call saveState)
    return patient;
  }

  return await StorageAdapter.updatePatientInDB(patient, { correlationId });
}

/**
 * Delete a patient (soft delete)
 */
export async function deletePatient(patientId, { correlationId } = {}) {
  if (useFallback) {
    // Fallback: do nothing (caller should update state and call saveState)
    return true;
  }

  return await StorageAdapter.deletePatientFromDB(patientId, { correlationId });
}

/**
 * Get all patients for a unit (fast indexed query)
 */
export async function getPatientsByUnit(unitId) {
  if (useFallback) {
    const state = await loadState();
    return (state?.patients || []).filter(p => p.unitId === unitId && !p.deletedAt);
  }

  return await StorageAdapter.getPatientsByUnitFromDB(unitId);
}

/**
 * Load patch queue
 * Replaces: JSON.parse(localStorage.getItem('MW_PATCH_QUEUE_V3'))
 */
export async function loadPatches({ maxAge = 24 * 60 * 60 * 1000 } = {}) {
  if (useFallback) {
    const raw = localStorage.getItem('MW_PATCH_QUEUE_V3');
    if (!raw) return [];

    const patches = JSON.parse(raw);
    const cutoff = Date.now() - maxAge;
    return patches.filter(p => p.ts >= cutoff);
  }

  return await StorageAdapter.loadPatchQueueFromDB({ maxAge });
}

/**
 * Save a single patch to queue
 * Replaces: sync.patchQueue.push(...); localStorage.setItem(...)
 */
export async function savePatch(patch) {
  if (useFallback) {
    // Load queue, add patch, save
    const patches = await loadPatches();
    patches.push(patch);
    localStorage.setItem('MW_PATCH_QUEUE_V3', JSON.stringify(patches));
    return true;
  }

  return await StorageAdapter.savePatchToQueue(patch);
}

/**
 * Acknowledge patches (mark as synced)
 */
export async function acknowledgePatches(patchIds) {
  if (useFallback) {
    // In fallback mode, remove from queue
    const patches = await loadPatches();
    const remaining = patches.filter(p => !patchIds.includes(p.id));
    localStorage.setItem('MW_PATCH_QUEUE_V3', JSON.stringify(remaining));
    return true;
  }

  return await StorageAdapter.acknowledgePatchesInDB(patchIds);
}

/**
 * Get/set sync metadata
 */
export async function getSyncMeta(key) {
  if (useFallback) {
    const value = localStorage.getItem(`MW_${key.toUpperCase()}_V3`);
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return await StorageAdapter.getSyncMetadata(key);
}

export async function setSyncMeta(key, value) {
  if (useFallback) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(`MW_${key.toUpperCase()}_V3`, serialized);
    return true;
  }

  return await StorageAdapter.setSyncMetadata(key, value);
}

/**
 * Get trash contents
 */
export async function getTrash({ type = null } = {}) {
  if (useFallback) {
    const state = await loadState();
    if (!state?.trash) return [];

    if (type === 'patient') return state.trash.patients || [];
    if (type === 'unit') return state.trash.units || [];

    return [
      ...(state.trash.patients || []),
      ...(state.trash.units || [])
    ];
  }

  return await StorageAdapter.getTrashFromDB({ type });
}

/**
 * Restore from trash
 */
export async function restoreFromTrash(patientId) {
  if (useFallback) {
    // Caller should handle state update
    return true;
  }

  return await StorageAdapter.restorePatientFromTrashDB(patientId);
}

/**
 * Get storage statistics
 */
export async function getStorageStats() {
  if (useFallback) {
    // Estimate localStorage usage
    let bytes = 0;
    for (let key in localStorage) {
      if (key.startsWith('MW_') || key.startsWith('medward')) {
        bytes += localStorage[key].length;
      }
    }

    return {
      mode: 'localStorage',
      estimatedBytes: bytes,
      patients: 'N/A',
      units: 'N/A',
      pendingPatches: 'N/A'
    };
  }

  const stats = await StorageAdapter.getStorageStatsFromDB();
  return { ...stats, mode: 'indexeddb' };
}

// ==================== Auto-Cleanup ====================

let cleanupTimer = null;

function startAutoCleanup() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(async () => {
    try {
      if (useFallback) return;

      // Clear old acknowledged patches (older than 1 hour)
      await StorageAdapter.clearAcknowledgedPatchesFromDB({ olderThanMs: 3600000 });

      window.monitor?.emit('QUICKSTART', 'INFO', 'Auto-cleanup completed');

    } catch (error) {
      window.monitor?.emit('QUICKSTART', 'WARN', 'Auto-cleanup failed', {
        error: error.message
      });
    }
  }, CONFIG.CLEANUP_INTERVAL_MS);

  window.monitor?.emit('QUICKSTART', 'INFO', 'Auto-cleanup started', {
    intervalMs: CONFIG.CLEANUP_INTERVAL_MS
  });
}

function stopAutoCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

// ==================== Diagnostics ====================

/**
 * Export diagnostic info for debugging
 */
export async function exportDiagnostics() {
  const stats = await getStorageStats();
  const patches = await loadPatches();

  return {
    initialized,
    mode: useFallback ? 'localStorage' : 'indexeddb',
    stats,
    patchCount: patches.length,
    config: CONFIG,
    timestamp: Date.now()
  };
}

/**
 * Force IndexedDB mode (for testing)
 */
export function forceIndexedDB() {
  useFallback = false;
}

/**
 * Force localStorage fallback mode (for testing)
 */
export function forceFallback() {
  useFallback = true;
}

// ==================== Exports ====================

export default {
  // Initialization
  initStorage,

  // State operations
  loadState,
  saveState,

  // Patient operations
  savePatient,
  deletePatient,
  getPatientsByUnit,

  // Patch queue operations
  loadPatches,
  savePatch,
  acknowledgePatches,

  // Sync metadata
  getSyncMeta,
  setSyncMeta,

  // Trash operations
  getTrash,
  restoreFromTrash,

  // Diagnostics
  getStorageStats,
  exportDiagnostics,

  // Testing
  forceIndexedDB,
  forceFallback,

  // Cleanup
  stopAutoCleanup
};

// ==================== Global Export (for easy integration) ====================

if (typeof window !== 'undefined') {
  window.QuickStorage = {
    init: initStorage,
    load: loadState,
    save: saveState,
    savePatient,
    deletePatient,
    getPatientsByUnit,
    loadPatches,
    savePatch,
    ack: acknowledgePatches,
    getMeta: getSyncMeta,
    setMeta: setSyncMeta,
    getTrash,
    restore: restoreFromTrash,
    stats: getStorageStats,
    diagnostics: exportDiagnostics
  };
}
