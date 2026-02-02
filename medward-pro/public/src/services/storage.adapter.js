// services/storage.adapter.js
// Wraps IndexedDB with Write-Ahead Log for guaranteed durability

import { StorageDB } from './storage.db.js';

export const Storage = {
  db: null,

  async init() {
    this.db = await StorageDB.init();
    return this.db;
  },

  // ========================================
  // WRITE-AHEAD LOG (WAL) OPERATIONS
  // This is the heart of offline reliability
  // ========================================

  wal: {
    async add(mutation) {
      const record = {
        id: mutation.id || crypto.randomUUID(),
        collection: mutation.collection,
        operation: mutation.operation,
        docId: mutation.docId,
        payload: mutation.payload,
        timestamp: mutation.timestamp || Date.now(),
        status: 'pending', // pending | synced | failed_fatal
        retryCount: 0,
        idempotencyKey: `${mutation.collection}:${mutation.docId}:${mutation.operation}:${Date.now()}`
      };

      await StorageDB.put('wal', record);
      return record;
    },

    async getPending() {
      return StorageDB.getByIndex('wal', 'by_status', 'pending');
    },

    async getAll() {
      return StorageDB.getAll('wal');
    },

    async get(id) {
      return StorageDB.get('wal', id);
    },

    async updateStatus(id, status) {
      const record = await StorageDB.get('wal', id);
      if (record) {
        record.status = status;
        record.lastAttempt = Date.now();
        await StorageDB.put('wal', record);
      }
      return record;
    },

    async incrementRetry(id) {
      const record = await StorageDB.get('wal', id);
      if (record) {
        record.retryCount = (record.retryCount || 0) + 1;
        record.lastAttempt = Date.now();
        await StorageDB.put('wal', record);
      }
      return record;
    },

    async clearSynced(olderThan = 24 * 60 * 60 * 1000) {
      const all = await StorageDB.getAll('wal');
      const cutoff = Date.now() - olderThan;
      const toDelete = [];

      for (const record of all) {
        if (record.status === 'synced' && record.timestamp < cutoff) {
          toDelete.push(record.id);
        }
      }

      if (toDelete.length > 0) {
        await StorageDB.deleteMany('wal', toDelete);
      }

      return toDelete.length;
    },

    async getStats() {
      const all = await StorageDB.getAll('wal');
      return {
        pending: all.filter(r => r.status === 'pending').length,
        synced: all.filter(r => r.status === 'synced').length,
        failed: all.filter(r => r.status === 'failed_fatal').length,
        total: all.length
      };
    },

    async clear() {
      return StorageDB.clear('wal');
    }
  },

  // ========================================
  // PATIENT OPERATIONS
  // ========================================

  patients: {
    async upsert(patient) {
      const record = {
        ...patient,
        id: patient.id || crypto.randomUUID(),
        updatedAt: patient.updatedAt || Date.now()
      };
      await StorageDB.put('patients', record);
      return record;
    },

    async get(id) {
      return StorageDB.get('patients', id);
    },

    async getAll() {
      return StorageDB.getAll('patients');
    },

    async getByUnit(unitId) {
      return StorageDB.getByIndex('patients', 'by_unit', unitId);
    },

    async getActive(unitId) {
      const patients = await this.getByUnit(unitId);
      return patients.filter(p => !p.deleted && p.status !== 'archived');
    },

    async getDeleted() {
      return StorageDB.getByIndex('patients', 'by_deleted', true);
    },

    async softDelete(id) {
      const patient = await this.get(id);
      if (patient) {
        patient.deleted = true;
        patient.deletedAt = Date.now();
        await StorageDB.put('patients', patient);
      }
      return patient;
    },

    async restore(id) {
      const patient = await this.get(id);
      if (patient) {
        patient.deleted = false;
        patient.deletedAt = null;
        await StorageDB.put('patients', patient);
      }
      return patient;
    },

    async delete(id) {
      return StorageDB.delete('patients', id);
    },

    async clear() {
      return StorageDB.clear('patients');
    }
  },

  // ========================================
  // TASKS OPERATIONS
  // ========================================

  tasks: {
    async upsert(task) {
      const record = {
        ...task,
        id: task.id || crypto.randomUUID(),
        updatedAt: task.updatedAt || Date.now()
      };
      await StorageDB.put('tasks', record);
      return record;
    },

    async get(id) {
      return StorageDB.get('tasks', id);
    },

    async getAll() {
      return StorageDB.getAll('tasks');
    },

    async getByPatient(patientId) {
      return StorageDB.getByIndex('tasks', 'by_patient', patientId);
    },

    async getCompleted() {
      return StorageDB.getByIndex('tasks', 'by_completed', true);
    },

    async getPending() {
      return StorageDB.getByIndex('tasks', 'by_completed', false);
    },

    async toggleComplete(id, completed) {
      const task = await StorageDB.get('tasks', id);
      if (task) {
        task.completed = completed;
        task.completedAt = completed ? Date.now() : null;
        task.updatedAt = Date.now();
        await StorageDB.put('tasks', task);
      }
      return task;
    },

    async delete(id) {
      return StorageDB.delete('tasks', id);
    },

    async clear() {
      return StorageDB.clear('tasks');
    }
  },

  // ========================================
  // UNITS OPERATIONS
  // ========================================

  units: {
    async upsert(unit) {
      const record = {
        ...unit,
        id: unit.id || crypto.randomUUID(),
        updatedAt: unit.updatedAt || Date.now()
      };
      await StorageDB.put('units', record);
      return record;
    },

    async get(id) {
      return StorageDB.get('units', id);
    },

    async getAll() {
      return StorageDB.getAll('units');
    },

    async delete(id) {
      return StorageDB.delete('units', id);
    },

    async clear() {
      return StorageDB.clear('units');
    }
  },

  // ========================================
  // INBOX OPERATIONS
  // ========================================

  inbox: {
    async add(item) {
      const record = {
        ...item,
        id: item.id || crypto.randomUUID(),
        createdAt: item.createdAt || Date.now(),
        status: item.status || 'pending'
      };
      await StorageDB.put('inbox', record);
      return record;
    },

    async get(id) {
      return StorageDB.get('inbox', id);
    },

    async getAll() {
      return StorageDB.getAll('inbox');
    },

    async getPending() {
      return StorageDB.getByIndex('inbox', 'by_status', 'pending');
    },

    async updateStatus(id, status) {
      const item = await this.get(id);
      if (item) {
        item.status = status;
        item.updatedAt = Date.now();
        await StorageDB.put('inbox', item);
      }
      return item;
    },

    async delete(id) {
      return StorageDB.delete('inbox', id);
    },

    async clear() {
      return StorageDB.clear('inbox');
    }
  },

  // ========================================
  // METADATA OPERATIONS
  // ========================================

  meta: {
    async get(key) {
      const record = await StorageDB.get('meta', key);
      return record?.value;
    },

    async set(key, value) {
      await StorageDB.put('meta', { key, value, updatedAt: Date.now() });
    },

    async delete(key) {
      return StorageDB.delete('meta', key);
    },

    async getAll() {
      const records = await StorageDB.getAll('meta');
      const result = {};
      records.forEach(r => {
        result[r.key] = r.value;
      });
      return result;
    }
  },

  // ========================================
  // TRASH OPERATIONS
  // ========================================

  trash: {
    async add(item, type) {
      const record = {
        ...item,
        id: item.id || crypto.randomUUID(),
        type,
        deletedAt: Date.now()
      };
      await StorageDB.put('trash', record);
      return record;
    },

    async get(id) {
      return StorageDB.get('trash', id);
    },

    async getAll() {
      return StorageDB.getAll('trash');
    },

    async getByType(type) {
      return StorageDB.getByIndex('trash', 'by_type', type);
    },

    async delete(id) {
      return StorageDB.delete('trash', id);
    },

    async clear() {
      return StorageDB.clear('trash');
    }
  },

  // ========================================
  // EXPORT/IMPORT FOR DEBUGGING
  // ========================================

  async exportAll() {
    return {
      patients: await StorageDB.getAll('patients'),
      tasks: await StorageDB.getAll('tasks'),
      units: await StorageDB.getAll('units'),
      wal: await StorageDB.getAll('wal'),
      meta: await StorageDB.getAll('meta'),
      inbox: await StorageDB.getAll('inbox'),
      trash: await StorageDB.getAll('trash'),
      exportedAt: Date.now()
    };
  },

  async importAll(data) {
    // Clear existing data
    await StorageDB.clear('patients');
    await StorageDB.clear('tasks');
    await StorageDB.clear('units');

    // Import new data
    if (data.patients?.length) {
      await StorageDB.putMany('patients', data.patients);
    }
    if (data.tasks?.length) {
      await StorageDB.putMany('tasks', data.tasks);
    }
    if (data.units?.length) {
      await StorageDB.putMany('units', data.units);
    }

    return true;
  },

  // ========================================
  // UTILITY
  // ========================================

  async getStats() {
    return {
      patients: await StorageDB.count('patients'),
      tasks: await StorageDB.count('tasks'),
      units: await StorageDB.count('units'),
      wal: await this.wal.getStats(),
      inbox: await StorageDB.count('inbox'),
      trash: await StorageDB.count('trash')
    };
  },

  isReady() {
    return StorageDB.isReady();
  }
};
