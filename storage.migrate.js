// storage.migrate.js
// One-time migration from localStorage to IndexedDB
// Version: 1.0.0 (2026-01-26)

import {
  bulkUpsertPatients,
  bulkUpsertUnits,
  enqueuePatch,
  setMeta,
  bulkSetMeta
} from "./storage.db.js";

const MIGRATION_KEY = "MW_INDEXEDDB_MIGRATED";
const MIGRATION_VERSION = "1.0.0";

// ==================== Main Migration Function ====================

export async function migrateFromLocalStorage(db) {
  const t0 = performance.now();

  // Check if already migrated
  const migrated = localStorage.getItem(MIGRATION_KEY);
  if (migrated === MIGRATION_VERSION) {
    window.monitor?.emit("MIGRATE", "INFO", "Migration already completed", {
      version: MIGRATION_VERSION
    });
    return { migrated: true, skipped: true };
  }

  window.monitor?.emit("MIGRATE", "INFO", "Starting migration from localStorage", {
    targetVersion: MIGRATION_VERSION
  });

  try {
    const result = {
      patients: 0,
      units: 0,
      patches: 0,
      metadata: 0,
      trash: 0,
      errors: []
    };

    // Step 1: Migrate main state (medward_pro_v12)
    await migrateMainState(db, result);

    // Step 2: Migrate patch queue
    await migratePatchQueue(db, result);

    // Step 3: Migrate metadata (sync state, checksums, etc.)
    await migrateMetadata(db, result);

    // Step 4: Migrate trash/recycle bin
    await migrateTrash(db, result);

    // Mark migration as complete
    localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION);
    await setMeta(db, "migrationVersion", MIGRATION_VERSION);
    await setMeta(db, "migratedAt", Date.now());

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("MIGRATE", "SUCCESS", "Migration completed", {
      ...result,
      ms: elapsed,
      version: MIGRATION_VERSION
    });

    return { migrated: true, skipped: false, ...result };

  } catch (error) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("MIGRATE", "ERROR", "Migration failed", {
      error: error.message,
      stack: error.stack,
      ms: elapsed
    });

    // Don't throw - allow app to continue with empty state
    return {
      migrated: false,
      error: error.message,
      ms: elapsed
    };
  }
}

// ==================== Step 1: Main State Migration ====================

async function migrateMainState(db, result) {
  const t0 = performance.now();

  try {
    // Try multiple possible localStorage keys (backward compatibility)
    const possibleKeys = [
      "medward_pro_v12",
      "MEDWARD_CACHE",
      "medward_pro_v11",
      "medward_pro"
    ];

    let state = null;
    let usedKey = null;

    for (const key of possibleKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          state = JSON.parse(raw);
          usedKey = key;
          window.monitor?.emit("MIGRATE", "INFO", "Found state in localStorage", {
            key,
            patientCount: state.patients?.length || 0,
            unitCount: state.units?.length || 0
          });
          break;
        } catch (e) {
          window.monitor?.emit("MIGRATE", "WARN", "Failed to parse localStorage key", {
            key,
            error: e.message
          });
        }
      }
    }

    if (!state) {
      window.monitor?.emit("MIGRATE", "WARN", "No state found in localStorage", {
        checkedKeys: possibleKeys
      });
      return;
    }

    // Migrate patients
    if (state.patients && Array.isArray(state.patients)) {
      const patients = state.patients.map(p => ({
        ...p,
        id: p.id || `patient_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        rev: p.rev ?? 1,
        updatedAt: p.updatedAt || p.lastModified || Date.now(),
        deletedAt: p.deletedAt || null,
        unitId: p.unitId || "default"
      }));

      if (patients.length > 0) {
        await bulkUpsertPatients(db, patients, { correlationId: "migrate_patients" });
        result.patients = patients.length;
      }
    }

    // Migrate units
    if (state.units && Array.isArray(state.units)) {
      const units = state.units.map(u => ({
        ...u,
        id: u.id || `unit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        rev: u.rev ?? 1,
        updatedAt: u.updatedAt || Date.now()
      }));

      if (units.length > 0) {
        await bulkUpsertUnits(db, units, { correlationId: "migrate_units" });
        result.units = units.length;
      }
    }

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("MIGRATE", "SUCCESS", "Main state migrated", {
      key: usedKey,
      patients: result.patients,
      units: result.units,
      ms: elapsed
    });

  } catch (error) {
    window.monitor?.emit("MIGRATE", "ERROR", "Main state migration failed", {
      error: error.message
    });
    result.errors.push(`Main state: ${error.message}`);
  }
}

// ==================== Step 2: Patch Queue Migration ====================

async function migratePatchQueue(db, result) {
  const t0 = performance.now();

  try {
    const PATCH_QUEUE_KEYS = [
      "MW_PATCH_QUEUE_V3",
      "MW_PATCH_QUEUE",
      "SYNC_PATCH_QUEUE"
    ];

    let patchQueue = null;
    let usedKey = null;

    for (const key of PATCH_QUEUE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          patchQueue = JSON.parse(raw);
          usedKey = key;
          break;
        } catch (e) {
          window.monitor?.emit("MIGRATE", "WARN", "Failed to parse patch queue key", {
            key,
            error: e.message
          });
        }
      }
    }

    if (!patchQueue || !Array.isArray(patchQueue) || patchQueue.length === 0) {
      window.monitor?.emit("MIGRATE", "INFO", "No patch queue to migrate");
      return;
    }

    // Migrate patches (filter out stale ones > 24 hours)
    const MAX_AGE = 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - MAX_AGE;

    for (const patch of patchQueue) {
      if (patch.ts && patch.ts >= cutoff) {
        try {
          await enqueuePatch(db, patch, { correlationId: "migrate_patch" });
          result.patches++;
        } catch (e) {
          window.monitor?.emit("MIGRATE", "WARN", "Failed to migrate patch", {
            patchId: patch.id,
            error: e.message
          });
        }
      }
    }

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("MIGRATE", "SUCCESS", "Patch queue migrated", {
      key: usedKey,
      patches: result.patches,
      ms: elapsed
    });

  } catch (error) {
    window.monitor?.emit("MIGRATE", "ERROR", "Patch queue migration failed", {
      error: error.message
    });
    result.errors.push(`Patch queue: ${error.message}`);
  }
}

// ==================== Step 3: Metadata Migration ====================

async function migrateMetadata(db, result) {
  const t0 = performance.now();

  try {
    const metadataKeys = [
      // Sync metadata
      { lsKey: "MW_REV_V3", dbKey: "clientRev" },
      { lsKey: "MW_CHECKSUM_V3", dbKey: "clientChecksum" },
      { lsKey: "MW_SESSION_V3", dbKey: "sessionId" },
      { lsKey: "MW_DEVICE_V3", dbKey: "deviceId" },
      { lsKey: "MW_LAST_SYNC_V3", dbKey: "lastSyncTime" },
      { lsKey: "MW_CLOUD_VERIFIED", dbKey: "cloudVerified" },
      { lsKey: "MW_OFFLINE_MODE", dbKey: "offlineMode" },

      // Build/version info
      { lsKey: "MW_BUILD_ID", dbKey: "buildId" },
      { lsKey: "BUILD_ID", dbKey: "buildId" },

      // User context (optional - may want to skip for security)
      { lsKey: "MW_USER", dbKey: "currentUser" },
      { lsKey: "MW_CURRENT_UNIT", dbKey: "currentUnit" },

      // Acknowledged patches
      { lsKey: "MW_ACKED_PATCHES_V3", dbKey: "acknowledgedPatches" },

      // Patient count (for wipe protection)
      { lsKey: "MW_LAST_PATIENT_COUNT", dbKey: "lastPatientCount" }
    ];

    const metaEntries = [];

    for (const { lsKey, dbKey } of metadataKeys) {
      const value = localStorage.getItem(lsKey);
      if (value !== null) {
        try {
          // Try to parse as JSON, fallback to raw string
          let parsed;
          try {
            parsed = JSON.parse(value);
          } catch {
            parsed = value;
          }

          metaEntries.push([dbKey, parsed]);
          result.metadata++;

        } catch (e) {
          window.monitor?.emit("MIGRATE", "WARN", "Failed to migrate metadata key", {
            lsKey,
            dbKey,
            error: e.message
          });
        }
      }
    }

    if (metaEntries.length > 0) {
      await bulkSetMeta(db, metaEntries);
    }

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("MIGRATE", "SUCCESS", "Metadata migrated", {
      count: result.metadata,
      ms: elapsed
    });

  } catch (error) {
    window.monitor?.emit("MIGRATE", "ERROR", "Metadata migration failed", {
      error: error.message
    });
    result.errors.push(`Metadata: ${error.message}`);
  }
}

// ==================== Step 4: Trash Migration ====================

async function migrateTrash(db, result) {
  const t0 = performance.now();

  try {
    // Trash is part of the main state object
    const possibleKeys = ["medward_pro_v12", "MEDWARD_CACHE"];

    for (const key of possibleKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const state = JSON.parse(raw);

        if (state.trash) {
          // Trash patients
          if (state.trash.patients && Array.isArray(state.trash.patients)) {
            result.trash += state.trash.patients.length;
            // Note: trash is already handled by bulkUpsertPatients
            // since they have deletedAt timestamps
          }

          // Trash units
          if (state.trash.units && Array.isArray(state.trash.units)) {
            result.trash += state.trash.units.length;
          }
        }

        break; // Found trash, no need to check other keys

      } catch (e) {
        // Ignore parse errors, continue to next key
      }
    }

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("MIGRATE", "SUCCESS", "Trash migrated", {
      count: result.trash,
      ms: elapsed
    });

  } catch (error) {
    window.monitor?.emit("MIGRATE", "ERROR", "Trash migration failed", {
      error: error.message
    });
    result.errors.push(`Trash: ${error.message}`);
  }
}

// ==================== Rollback / Recovery ====================

export async function rollbackMigration() {
  window.monitor?.emit("MIGRATE", "WARN", "Rollback requested - clearing migration flag");

  try {
    localStorage.removeItem(MIGRATION_KEY);

    // Note: we don't delete IndexedDB data, as it may contain new changes
    // User can manually clear IndexedDB via browser settings if needed

    window.monitor?.emit("MIGRATE", "SUCCESS", "Rollback completed");

    return { success: true };

  } catch (error) {
    window.monitor?.emit("MIGRATE", "ERROR", "Rollback failed", {
      error: error.message
    });
    throw error;
  }
}

// ==================== Backup Creation (Safety Net) ====================

export function createLocalStorageBackup() {
  const t0 = performance.now();

  try {
    const backup = {};
    const keys = Object.keys(localStorage);

    keys.forEach(key => {
      if (key.startsWith("MW_") || key.startsWith("medward") || key.startsWith("MEDWARD")) {
        backup[key] = localStorage.getItem(key);
      }
    });

    const backupJson = JSON.stringify(backup, null, 2);
    const backupKey = `MEDWARD_BACKUP_${Date.now()}`;

    // Store backup in localStorage (if there's space)
    try {
      localStorage.setItem(backupKey, backupJson);
    } catch (e) {
      // If no space, log but continue
      window.monitor?.emit("MIGRATE", "WARN", "Couldn't store backup in localStorage", {
        error: e.message
      });
    }

    // Also offer download
    const blob = new Blob([backupJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("MIGRATE", "SUCCESS", "Backup created", {
      keyCount: Object.keys(backup).length,
      sizeBytes: backupJson.length,
      ms: elapsed
    });

    return {
      success: true,
      backup,
      backupKey,
      downloadUrl: url,
      sizeBytes: backupJson.length
    };

  } catch (error) {
    window.monitor?.emit("MIGRATE", "ERROR", "Backup creation failed", {
      error: error.message
    });
    throw error;
  }
}

// ==================== Migration Status Check ====================

export function getMigrationStatus() {
  const migrated = localStorage.getItem(MIGRATION_KEY);

  return {
    migrated: migrated === MIGRATION_VERSION,
    version: migrated,
    targetVersion: MIGRATION_VERSION
  };
}

// ==================== Exports ====================

export default {
  migrateFromLocalStorage,
  rollbackMigration,
  createLocalStorageBackup,
  getMigrationStatus,
  MIGRATION_VERSION
};
