// storage.db.js
// Durable IndexedDB storage layer for MedWard Pro
// Hybrid architecture: keeps existing sync engine, upgrades storage primitive
// Version: 1.0.0 (2026-01-26)

const DB_NAME = "medward_pro";
const DB_VERSION = 1;

// ==================== Database Schema ====================

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // Patients - clinical records with soft delete support
      if (!db.objectStoreNames.contains("patients")) {
        const s = db.createObjectStore("patients", { keyPath: "id" });
        s.createIndex("by_unit", "unitId", { unique: false });
        s.createIndex("by_deleted", "deletedAt", { unique: false });
        s.createIndex("by_updated", "updatedAt", { unique: false });
        s.createIndex("by_status", "status", { unique: false });
      }

      // Units - hospital unit configuration
      if (!db.objectStoreNames.contains("units")) {
        const s = db.createObjectStore("units", { keyPath: "id" });
        s.createIndex("by_updated", "updatedAt", { unique: false });
      }

      // Trash - soft-deleted items (matches existing state.trash structure)
      if (!db.objectStoreNames.contains("trash")) {
        const s = db.createObjectStore("trash", { keyPath: "id" });
        s.createIndex("by_type", "type", { unique: false }); // 'patient' | 'unit'
        s.createIndex("by_deleted", "deletedAt", { unique: false });
      }

      // WAL (Write-Ahead Log) - crash-safe operation journal
      if (!db.objectStoreNames.contains("wal")) {
        const s = db.createObjectStore("wal", { keyPath: "opId" });
        s.createIndex("by_status", "status", { unique: false }); // PENDING|COMMITTED|FAILED
        s.createIndex("by_ts", "ts", { unique: false });
      }

      // Patch Queue - integrates with existing sync.patchQueue
      if (!db.objectStoreNames.contains("patches")) {
        const s = db.createObjectStore("patches", { keyPath: "id" });
        s.createIndex("by_ts", "ts", { unique: false });
        s.createIndex("by_acked", "acknowledged", { unique: false });
      }

      // Metadata - versions, checksums, device ID, sync state
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }

      window.monitor?.emit("STORE", "INFO", "IndexedDB schema created", { version: DB_VERSION });
    };

    req.onsuccess = () => {
      window.monitor?.emit("STORE", "SUCCESS", "IndexedDB opened", { version: req.result.version });
      resolve(req.result);
    };

    req.onerror = () => {
      window.monitor?.emit("STORE", "ERROR", "IndexedDB open failed", { error: req.error?.message });
      reject(req.error);
    };
  });
}

// ==================== Transaction Helper ====================

function tx(db, stores, mode, fn) {
  return new Promise((resolve, reject) => {
    try {
      const t = db.transaction(stores, mode);
      const storeObjs = Object.fromEntries(stores.map(n => [n, t.objectStore(n)]));

      let result;
      try {
        result = fn(storeObjs);
      } catch (e) {
        window.monitor?.emit("STORE", "ERROR", "Transaction function error", { error: e.message, stores });
        reject(e);
        return;
      }

      t.oncomplete = () => resolve(result);
      t.onerror = () => {
        window.monitor?.emit("STORE", "ERROR", "Transaction error", { error: t.error?.message, stores });
        reject(t.error);
      };
      t.onabort = () => {
        window.monitor?.emit("STORE", "ERROR", "Transaction aborted", { error: t.error?.message, stores });
        reject(t.error || new Error("Transaction aborted"));
      };
    } catch (e) {
      window.monitor?.emit("STORE", "ERROR", "Transaction creation failed", { error: e.message, stores });
      reject(e);
    }
  });
}

// ==================== Utility Functions ====================

const uid = () =>
  (crypto?.randomUUID?.() || (`${Math.random().toString(36).slice(2)}-${Date.now()}`));

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Metadata Operations ====================

async function getMeta(db, key) {
  return tx(db, ["meta"], "readonly", ({ meta }) =>
    promisifyRequest(meta.get(key)).then(r => r?.value ?? null).catch(() => null)
  );
}

async function setMeta(db, key, value) {
  return tx(db, ["meta"], "readwrite", ({ meta }) =>
    promisifyRequest(meta.put({ key, value, updatedAt: Date.now() }))
  );
}

async function bulkSetMeta(db, entries) {
  return tx(db, ["meta"], "readwrite", ({ meta }) => {
    const ts = Date.now();
    entries.forEach(([key, value]) => {
      meta.put({ key, value, updatedAt: ts });
    });
  });
}

// ==================== Initialization & Migration ====================

export async function initStorage({ build = "dev", deviceId = null } = {}) {
  const t0 = performance.now();
  window.monitor?.emit("STORE", "INFO", "Storage init started", { build });

  try {
    const db = await openDB();

    // Ensure stable device ID
    let storedDeviceId = await getMeta(db, "deviceId");
    if (!storedDeviceId) {
      storedDeviceId = deviceId || uid();
      await setMeta(db, "deviceId", storedDeviceId);
      window.monitor?.emit("STORE", "INFO", "Device ID created", { deviceId: storedDeviceId });
    }

    // Store build version
    const prevBuild = await getMeta(db, "build");
    if (prevBuild !== build) {
      await setMeta(db, "build", build);
      window.monitor?.emit("STORE", "INFO", "Build version updated", { prev: prevBuild, new: build });
    }

    // Crash recovery: replay any PENDING WAL entries
    await replayPendingWal(db);

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "Storage init complete", {
      deviceId: storedDeviceId,
      build,
      ms: elapsed
    });

    return { db, deviceId: storedDeviceId };

  } catch (error) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "ERROR", "Storage init failed", {
      error: error.message,
      ms: elapsed
    });
    throw error;
  }
}

// ==================== WAL (Write-Ahead Log) Operations ====================

async function appendWal(stores, opId, kind, payload, status = "PENDING") {
  const { wal } = stores;
  const entry = {
    opId,
    ts: Date.now(),
    status,
    kind,
    payload
  };
  wal.put(entry);
  return entry;
}

async function commitWal(stores, opId) {
  const { wal } = stores;
  const getReq = wal.get(opId);
  getReq.onsuccess = () => {
    const entry = getReq.result;
    if (entry) {
      entry.status = "COMMITTED";
      entry.committedAt = Date.now();
      wal.put(entry);
    }
  };
}

async function replayPendingWal(db) {
  const t0 = performance.now();

  const pending = await tx(db, ["wal"], "readonly", ({ wal }) =>
    promisifyRequest(wal.index("by_status").getAll("PENDING"))
  ).catch(() => []);

  if (pending && pending.length > 0) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "WARN", "WAL pending entries detected on boot", {
      count: pending.length,
      ms: elapsed,
      operations: pending.map(p => ({ opId: p.opId, kind: p.kind, ts: p.ts }))
    });

    // In future: implement actual replay logic here
    // For now, just log for observability
  }

  return pending || [];
}

// ==================== Patient Operations ====================

export async function upsertPatient(db, patient, { unitId, correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  window.monitor?.emit("STORE", "INFO", "upsertPatient started", {
    opId,
    patientId: patient.id,
    unitId
  });

  try {
    const record = {
      ...patient,
      unitId: unitId ?? patient.unitId ?? "default",
      id: patient.id || uid(),
      rev: (patient.rev ?? 0) + 1,
      updatedAt: Date.now(),
      deletedAt: patient.deletedAt ?? null
    };

    // ACID transaction: WAL → Patient → WAL commit (all-or-nothing)
    await tx(db, ["wal", "patients"], "readwrite", (stores) => {
      appendWal(stores, opId, "UPSERT_PATIENT", record, "PENDING");
      stores.patients.put(record);
      commitWal(stores, opId);
    });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "upsertPatient committed", {
      opId,
      id: record.id,
      unitId: record.unitId,
      rev: record.rev,
      ms: elapsed
    });

    return record;

  } catch (error) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "ERROR", "upsertPatient failed", {
      opId,
      patientId: patient.id,
      error: error.message,
      ms: elapsed
    });
    throw error;
  }
}

export async function getPatient(db, patientId) {
  return tx(db, ["patients"], "readonly", ({ patients }) =>
    promisifyRequest(patients.get(patientId))
  ).then(p => (p && !p.deletedAt) ? p : null);
}

export async function listPatientsByUnit(db, unitId) {
  const t0 = performance.now();

  try {
    const patients = await tx(db, ["patients"], "readonly", ({ patients }) =>
      promisifyRequest(patients.index("by_unit").getAll(unitId))
    );

    // Filter soft-deleted (matches existing behavior)
    const active = (patients || []).filter(p => !p.deletedAt);

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "listPatientsByUnit", {
      unitId,
      count: active.length,
      ms: elapsed
    });

    return active;

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "listPatientsByUnit failed", {
      unitId,
      error: error.message
    });
    throw error;
  }
}

export async function listAllPatients(db, { includeDeleted = false } = {}) {
  const t0 = performance.now();

  try {
    const patients = await tx(db, ["patients"], "readonly", ({ patients }) =>
      promisifyRequest(patients.getAll())
    );

    const filtered = includeDeleted
      ? patients
      : (patients || []).filter(p => !p.deletedAt);

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "listAllPatients", {
      count: filtered.length,
      includeDeleted,
      ms: elapsed
    });

    return filtered;

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "listAllPatients failed", {
      error: error.message
    });
    throw error;
  }
}

export async function softDeletePatient(db, patientId, { correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  window.monitor?.emit("STORE", "INFO", "softDeletePatient started", { opId, patientId });

  try {
    let deletedRecord = null;

    await tx(db, ["wal", "patients", "trash"], "readwrite", (stores) => {
      appendWal(stores, opId, "SOFT_DELETE_PATIENT", { patientId }, "PENDING");

      const getReq = stores.patients.get(patientId);
      getReq.onsuccess = () => {
        const p = getReq.result;
        if (!p) {
          window.monitor?.emit("STORE", "WARN", "softDeletePatient: patient not found", { patientId });
          return;
        }

        const ts = Date.now();
        p.deletedAt = ts;
        p.rev = (p.rev || 0) + 1;
        p.updatedAt = ts;
        stores.patients.put(p);

        // Move to trash store (matches existing state.trash.patients structure)
        stores.trash.put({
          ...p,
          id: `trash_patient_${patientId}_${ts}`,
          originalId: patientId,
          type: "patient",
          deletedAt: ts
        });

        commitWal(stores, opId);
        deletedRecord = p;
      };
    });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "softDeletePatient committed", {
      opId,
      patientId,
      rev: deletedRecord?.rev,
      ms: elapsed
    });

    return deletedRecord;

  } catch (error) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "ERROR", "softDeletePatient failed", {
      opId,
      patientId,
      error: error.message,
      ms: elapsed
    });
    throw error;
  }
}

export async function restorePatientFromTrash(db, patientId, { correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  window.monitor?.emit("STORE", "INFO", "restorePatientFromTrash started", { opId, patientId });

  try {
    await tx(db, ["wal", "patients", "trash"], "readwrite", (stores) => {
      appendWal(stores, opId, "RESTORE_PATIENT", { patientId }, "PENDING");

      const getReq = stores.patients.get(patientId);
      getReq.onsuccess = () => {
        const p = getReq.result;
        if (p) {
          p.deletedAt = null;
          p.rev = (p.rev || 0) + 1;
          p.updatedAt = Date.now();
          stores.patients.put(p);

          // Remove from trash
          const trashIdx = stores.trash.index("by_type");
          const trashReq = trashIdx.getAll("patient");
          trashReq.onsuccess = () => {
            const trashItems = trashReq.result || [];
            trashItems.forEach(item => {
              if (item.originalId === patientId) {
                stores.trash.delete(item.id);
              }
            });
          };

          commitWal(stores, opId);
        }
      };
    });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "restorePatientFromTrash committed", {
      opId,
      patientId,
      ms: elapsed
    });

    return true;

  } catch (error) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "ERROR", "restorePatientFromTrash failed", {
      opId,
      patientId,
      error: error.message,
      ms: elapsed
    });
    throw error;
  }
}

// ==================== Unit Operations ====================

export async function upsertUnit(db, unit, { correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  try {
    const record = {
      ...unit,
      id: unit.id || uid(),
      rev: (unit.rev ?? 0) + 1,
      updatedAt: Date.now()
    };

    await tx(db, ["wal", "units"], "readwrite", (stores) => {
      appendWal(stores, opId, "UPSERT_UNIT", record, "PENDING");
      stores.units.put(record);
      commitWal(stores, opId);
    });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "upsertUnit committed", {
      opId,
      unitId: record.id,
      rev: record.rev,
      ms: elapsed
    });

    return record;

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "upsertUnit failed", {
      opId,
      error: error.message
    });
    throw error;
  }
}

export async function listUnits(db) {
  return tx(db, ["units"], "readonly", ({ units }) =>
    promisifyRequest(units.getAll())
  ).catch(() => []);
}

// ==================== Trash Operations ====================

export async function listTrash(db, { type = null } = {}) {
  const t0 = performance.now();

  try {
    const items = type
      ? await tx(db, ["trash"], "readonly", ({ trash }) =>
          promisifyRequest(trash.index("by_type").getAll(type))
        )
      : await tx(db, ["trash"], "readonly", ({ trash }) =>
          promisifyRequest(trash.getAll())
        );

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "listTrash", {
      type,
      count: items?.length || 0,
      ms: elapsed
    });

    return items || [];

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "listTrash failed", { error: error.message });
    throw error;
  }
}

export async function emptyTrash(db, { olderThanDays = null, correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  window.monitor?.emit("STORE", "INFO", "emptyTrash started", { opId, olderThanDays });

  try {
    const cutoffTs = olderThanDays ? Date.now() - (olderThanDays * 24 * 60 * 60 * 1000) : null;

    let deletedCount = 0;

    await tx(db, ["wal", "trash"], "readwrite", (stores) => {
      appendWal(stores, opId, "EMPTY_TRASH", { olderThanDays }, "PENDING");

      const req = stores.trash.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items.forEach(item => {
          if (!cutoffTs || item.deletedAt < cutoffTs) {
            stores.trash.delete(item.id);
            deletedCount++;
          }
        });
        commitWal(stores, opId);
      };
    });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "emptyTrash committed", {
      opId,
      deletedCount,
      ms: elapsed
    });

    return { deletedCount };

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "emptyTrash failed", {
      opId,
      error: error.message
    });
    throw error;
  }
}

// ==================== Patch Queue Operations (Sync Integration) ====================

export async function enqueuePatch(db, patch, { correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  try {
    const patchRecord = {
      ...patch,
      id: patch.id || `p_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      ts: patch.ts || Date.now(),
      acknowledged: false,
      attempts: 0
    };

    await tx(db, ["patches"], "readwrite", ({ patches }) => {
      patches.put(patchRecord);
    });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "enqueuePatch", {
      opId,
      patchId: patchRecord.id,
      operation: patch.operation,
      ms: elapsed
    });

    return patchRecord;

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "enqueuePatch failed", {
      opId,
      error: error.message
    });
    throw error;
  }
}

export async function listPendingPatches(db, { maxAge = 24 * 60 * 60 * 1000 } = {}) {
  const cutoff = Date.now() - maxAge;

  try {
    const patches = await tx(db, ["patches"], "readonly", ({ patches }) =>
      promisifyRequest(patches.index("by_acked").getAll(false))
    );

    // Filter by age, sort by timestamp
    const filtered = (patches || [])
      .filter(p => p.ts >= cutoff)
      .sort((a, b) => a.ts - b.ts);

    window.monitor?.emit("STORE", "SUCCESS", "listPendingPatches", {
      count: filtered.length
    });

    return filtered;

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "listPendingPatches failed", {
      error: error.message
    });
    return [];
  }
}

export async function acknowledgePatch(db, patchId, { correlationId } = {}) {
  const opId = correlationId || uid();

  try {
    await tx(db, ["patches"], "readwrite", ({ patches }) => {
      const req = patches.get(patchId);
      req.onsuccess = () => {
        const patch = req.result;
        if (patch) {
          patch.acknowledged = true;
          patch.acknowledgedAt = Date.now();
          patches.put(patch);
        }
      };
    });

    window.monitor?.emit("STORE", "SUCCESS", "acknowledgePatch", {
      opId,
      patchId
    });

    return true;

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "acknowledgePatch failed", {
      opId,
      patchId,
      error: error.message
    });
    throw error;
  }
}

export async function bulkAcknowledgePatches(db, patchIds, { correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  try {
    await tx(db, ["patches"], "readwrite", ({ patches }) => {
      const ts = Date.now();
      patchIds.forEach(patchId => {
        const req = patches.get(patchId);
        req.onsuccess = () => {
          const patch = req.result;
          if (patch) {
            patch.acknowledged = true;
            patch.acknowledgedAt = ts;
            patches.put(patch);
          }
        };
      });
    });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "bulkAcknowledgePatches", {
      opId,
      count: patchIds.length,
      ms: elapsed
    });

    return true;

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "bulkAcknowledgePatches failed", {
      opId,
      error: error.message
    });
    throw error;
  }
}

export async function clearAcknowledgedPatches(db, { olderThanMs = 60000, correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  try {
    const cutoff = Date.now() - olderThanMs;
    let deletedCount = 0;

    await tx(db, ["patches"], "readwrite", ({ patches }) => {
      const req = patches.index("by_acked").getAll(true);
      req.onsuccess = () => {
        const acked = req.result || [];
        acked.forEach(patch => {
          if (patch.acknowledgedAt && patch.acknowledgedAt < cutoff) {
            patches.delete(patch.id);
            deletedCount++;
          }
        });
      };
    });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "clearAcknowledgedPatches", {
      opId,
      deletedCount,
      ms: elapsed
    });

    return { deletedCount };

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "clearAcknowledgedPatches failed", {
      opId,
      error: error.message
    });
    throw error;
  }
}

// ==================== Bulk Operations (Cloud Sync) ====================

export async function bulkUpsertPatients(db, patients, { correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  window.monitor?.emit("STORE", "INFO", "bulkUpsertPatients started", {
    opId,
    count: patients.length
  });

  try {
    const ts = Date.now();

    await tx(db, ["wal", "patients"], "readwrite", (stores) => {
      appendWal(stores, opId, "BULK_UPSERT_PATIENTS", { count: patients.length }, "PENDING");

      patients.forEach(patient => {
        const record = {
          ...patient,
          updatedAt: patient.updatedAt || ts,
          rev: patient.rev ?? 1
        };
        stores.patients.put(record);
      });

      commitWal(stores, opId);
    });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "bulkUpsertPatients committed", {
      opId,
      count: patients.length,
      ms: elapsed
    });

    return { count: patients.length };

  } catch (error) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "ERROR", "bulkUpsertPatients failed", {
      opId,
      count: patients.length,
      error: error.message,
      ms: elapsed
    });
    throw error;
  }
}

export async function bulkUpsertUnits(db, units, { correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  try {
    const ts = Date.now();

    await tx(db, ["wal", "units"], "readwrite", (stores) => {
      appendWal(stores, opId, "BULK_UPSERT_UNITS", { count: units.length }, "PENDING");

      units.forEach(unit => {
        const record = {
          ...unit,
          updatedAt: unit.updatedAt || ts,
          rev: unit.rev ?? 1
        };
        stores.units.put(record);
      });

      commitWal(stores, opId);
    });

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "bulkUpsertUnits committed", {
      opId,
      count: units.length,
      ms: elapsed
    });

    return { count: units.length };

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "bulkUpsertUnits failed", {
      opId,
      error: error.message
    });
    throw error;
  }
}

// ==================== Export Full State (for cloud sync) ====================

export async function exportFullState(db) {
  const t0 = performance.now();

  try {
    const [patients, units, trash, meta] = await Promise.all([
      listAllPatients(db, { includeDeleted: true }),
      listUnits(db),
      listTrash(db),
      tx(db, ["meta"], "readonly", ({ meta }) => promisifyRequest(meta.getAll()))
    ]);

    // Convert meta array to object
    const metaObj = {};
    (meta || []).forEach(m => {
      metaObj[m.key] = m.value;
    });

    const state = {
      patients,
      units,
      trash: {
        patients: trash.filter(t => t.type === "patient"),
        units: trash.filter(t => t.type === "unit")
      },
      meta: metaObj
    };

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "exportFullState", {
      patientCount: patients.length,
      unitCount: units.length,
      trashCount: trash.length,
      ms: elapsed
    });

    return state;

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "exportFullState failed", {
      error: error.message
    });
    throw error;
  }
}

// ==================== Import Full State (from cloud) ====================

export async function importFullState(db, state, { correlationId } = {}) {
  const opId = correlationId || uid();
  const t0 = performance.now();

  window.monitor?.emit("STORE", "INFO", "importFullState started", {
    opId,
    patientCount: state.patients?.length || 0,
    unitCount: state.units?.length || 0
  });

  try {
    await tx(db, ["wal", "patients", "units", "trash"], "readwrite", (stores) => {
      appendWal(stores, opId, "IMPORT_FULL_STATE", {
        patientCount: state.patients?.length || 0,
        unitCount: state.units?.length || 0
      }, "PENDING");

      // Clear existing data
      stores.patients.clear();
      stores.units.clear();
      stores.trash.clear();

      // Import patients
      (state.patients || []).forEach(p => stores.patients.put(p));

      // Import units
      (state.units || []).forEach(u => stores.units.put(u));

      // Import trash
      const trashPatients = state.trash?.patients || [];
      const trashUnits = state.trash?.units || [];

      trashPatients.forEach(p => stores.trash.put({
        ...p,
        id: p.id || `trash_patient_${p.originalId}_${p.deletedAt}`,
        type: "patient"
      }));

      trashUnits.forEach(u => stores.trash.put({
        ...u,
        id: u.id || `trash_unit_${u.originalId}_${u.deletedAt}`,
        type: "unit"
      }));

      commitWal(stores, opId);
    });

    // Import metadata separately
    if (state.meta) {
      const metaEntries = Object.entries(state.meta);
      await bulkSetMeta(db, metaEntries);
    }

    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "SUCCESS", "importFullState committed", {
      opId,
      patientCount: state.patients?.length || 0,
      unitCount: state.units?.length || 0,
      ms: elapsed
    });

    return true;

  } catch (error) {
    const elapsed = Math.round(performance.now() - t0);
    window.monitor?.emit("STORE", "ERROR", "importFullState failed", {
      opId,
      error: error.message,
      ms: elapsed
    });
    throw error;
  }
}

// ==================== Statistics & Monitoring ====================

export async function getStorageStats(db) {
  const t0 = performance.now();

  try {
    const [
      patientCount,
      unitCount,
      trashCount,
      pendingPatchCount,
      pendingWalCount
    ] = await Promise.all([
      tx(db, ["patients"], "readonly", ({ patients }) =>
        promisifyRequest(patients.count())),
      tx(db, ["units"], "readonly", ({ units }) =>
        promisifyRequest(units.count())),
      tx(db, ["trash"], "readonly", ({ trash }) =>
        promisifyRequest(trash.count())),
      tx(db, ["patches"], "readonly", ({ patches }) =>
        promisifyRequest(patches.index("by_acked").count(false))),
      tx(db, ["wal"], "readonly", ({ wal }) =>
        promisifyRequest(wal.index("by_status").count("PENDING")))
    ]);

    // Estimate storage size (rough approximation)
    let estimatedBytes = 0;
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      estimatedBytes = estimate.usage || 0;
    }

    const elapsed = Math.round(performance.now() - t0);

    const stats = {
      patients: patientCount,
      units: unitCount,
      trash: trashCount,
      pendingPatches: pendingPatchCount,
      pendingWal: pendingWalCount,
      estimatedBytes,
      ms: elapsed
    };

    window.monitor?.emit("STORE", "SUCCESS", "getStorageStats", stats);

    return stats;

  } catch (error) {
    window.monitor?.emit("STORE", "ERROR", "getStorageStats failed", {
      error: error.message
    });
    throw error;
  }
}

// ==================== Exports ====================

export default {
  initStorage,

  // Patient operations
  upsertPatient,
  getPatient,
  listPatientsByUnit,
  listAllPatients,
  softDeletePatient,
  restorePatientFromTrash,
  bulkUpsertPatients,

  // Unit operations
  upsertUnit,
  listUnits,
  bulkUpsertUnits,

  // Trash operations
  listTrash,
  emptyTrash,

  // Patch queue (sync integration)
  enqueuePatch,
  listPendingPatches,
  acknowledgePatch,
  bulkAcknowledgePatches,
  clearAcknowledgedPatches,

  // State import/export (cloud sync)
  exportFullState,
  importFullState,

  // Metadata
  getMeta,
  setMeta,
  bulkSetMeta,

  // Monitoring
  getStorageStats
};
