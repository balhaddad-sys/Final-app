// core/app.data.js
// CRITICAL FILE: This is the ONLY interface the UI should use for data operations.

import { Store } from './store.js';
import { Storage } from '../services/storage.adapter.js';
import { Sync } from '../services/firebase.sync.js';
import { EventBus } from './core.events.js';
import { Monitor } from '../monitor/monitor.core.js';

export const Data = {
  // ========================================
  // CENTRALIZED STATE ACCESS
  // ========================================

  get state() {
    return Store.getSnapshot();
  },

  get patients() {
    return Store.patients;
  },

  get tasks() {
    return Store.tasks;
  },

  get units() {
    return Store.units;
  },

  // ========================================
  // CORE MUTATION HANDLER (THE "BRAIN")
  // ========================================

  async _mutate(collection, operation, payload, docId) {
    const mutationId = crypto.randomUUID();
    const timestamp = Date.now();

    // 1. SNAPSHOT FOR ROLLBACK (Critical: capture BEFORE mutation)
    const previousState = Store.getClone(collection, docId);

    try {
      // 2. OPTIMISTIC UPDATE (In-Memory)
      // UI reflects change immediately
      Store.apply(collection, operation, payload, docId);

      // 3. PERSIST TO WAL (IndexedDB)
      // Survives browser crash/refresh
      const mutationRecord = {
        id: mutationId,
        collection,
        operation,
        docId,
        payload,
        timestamp,
        status: 'pending'
      };

      await Storage.wal.add(mutationRecord);

      // 4. PERSIST TO LOCAL STORE
      // Mirror the change in IndexedDB
      if (collection === 'patients') {
        if (operation === 'add' || operation === 'update') {
          await Storage.patients.upsert({ id: docId, ...payload });
        } else if (operation === 'delete') {
          await Storage.patients.softDelete(docId);
        }
      } else if (collection === 'tasks') {
        if (operation === 'add' || operation === 'update') {
          await Storage.tasks.upsert({ id: docId, ...payload });
        } else if (operation === 'delete') {
          await Storage.tasks.delete(docId);
        }
      } else if (collection === 'units') {
        if (operation === 'add' || operation === 'update') {
          await Storage.units.upsert({ id: docId, ...payload });
        } else if (operation === 'delete') {
          await Storage.units.delete(docId);
        }
      }

      // 5. SYNC TO CLOUD (non-blocking)
      // Don't await - let UI remain responsive
      this._syncToCloud(mutationRecord, previousState);

      Monitor.log('DATA', `${operation} ${collection}/${docId}`, { mutationId });

      return { success: true, id: docId };

    } catch (error) {
      // CRITICAL: System error (IDB full, memory error)
      console.error('[Data] Critical mutation error:', error);
      Monitor.logError('DATA_MUTATION_FAIL', error);

      // Rollback UI immediately
      if (previousState !== undefined) {
        Store.restore(collection, docId, previousState);
      }

      throw error;
    }
  },

  // ========================================
  // SYNC TO CLOUD WITH ROLLBACK
  // ========================================

  async _syncToCloud(mutation, previousState) {
    try {
      // Offline? Leave in WAL for background sync
      if (!navigator.onLine) {
        console.log(`[Data] Offline. Queued: ${mutation.id}`);
        EventBus.emit('sync:status', 'offline');
        return;
      }

      EventBus.emit('sync:status', 'syncing');

      // Try sending to Firebase
      await Sync.push(mutation);

      // Success! Mark WAL as synced
      await Storage.wal.updateStatus(mutation.id, 'synced');

      EventBus.emit('sync:status', 'connected');

    } catch (networkError) {
      // Identify FATAL vs TRANSIENT errors
      const isFatal =
        networkError.code === 'permission-denied' ||
        networkError.code === 'invalid-argument' ||
        networkError.type === 'validation';

      if (isFatal) {
        // SERVER REJECTED - Rollback UI
        Monitor.logError('DATA_SYNC_REJECTED', networkError);

        Store.restore(mutation.collection, mutation.docId, previousState);

        EventBus.emit('toast:error', `Save failed: ${networkError.message}`);

        await Storage.wal.updateStatus(mutation.id, 'failed_fatal');

      } else {
        // TRANSIENT - Leave pending, sync loop will retry
        console.warn(`[Data] Transient sync error. Will retry: ${mutation.id}`);
        await Storage.wal.incrementRetry(mutation.id);
      }
    }
  },

  // ========================================
  // PUBLIC API: PATIENTS
  // ========================================

  Patients: {
    get(unitId) {
      // Always return local data instantly
      const localData = Store.select('patients', p =>
        p.unitId === unitId && !p.deleted
      );

      // Background revalidation (Stale-While-Revalidate)
      if (Sync.shouldRefetch('patients', unitId)) {
        Sync.pull('patients', unitId).catch(console.warn);
      }

      return localData;
    },

    getAll() {
      return Store.select('patients', p => !p.deleted);
    },

    getById(id) {
      return Store.selectOne('patients', id);
    },

    getByStatus(status) {
      return Store.select('patients', p => p.status === status && !p.deleted);
    },

    async add(patientData) {
      // Validation
      if (!patientData.name?.trim()) {
        throw new Error('Patient name is required');
      }

      const id = patientData.id || crypto.randomUUID();
      const patient = {
        id,
        name: patientData.name.trim(),
        mrn: patientData.mrn || '',
        bed: patientData.bed || '',
        diagnosis: patientData.diagnosis || '',
        notes: patientData.notes || '',
        unitId: patientData.unitId || Store.currentUnit?.id,
        status: patientData.status || 'active',
        deleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      return Data._mutate('patients', 'add', patient, id);
    },

    async update(id, patches) {
      const updates = {
        ...patches,
        updatedAt: Date.now()
      };
      return Data._mutate('patients', 'update', updates, id);
    },

    async discharge(id) {
      return Data._mutate('patients', 'update', {
        status: 'discharged',
        dischargedAt: Date.now(),
        updatedAt: Date.now()
      }, id);
    },

    async archive(id) {
      return Data._mutate('patients', 'update', {
        status: 'archived',
        archivedAt: Date.now(),
        updatedAt: Date.now()
      }, id);
    },

    async delete(id) {
      // Soft delete
      return Data._mutate('patients', 'update', {
        deleted: true,
        deletedAt: Date.now(),
        updatedAt: Date.now()
      }, id);
    },

    async restore(id) {
      return Data._mutate('patients', 'update', {
        deleted: false,
        deletedAt: null,
        updatedAt: Date.now()
      }, id);
    },

    async permanentDelete(id) {
      return Data._mutate('patients', 'delete', {}, id);
    }
  },

  // ========================================
  // PUBLIC API: TASKS
  // ========================================

  Tasks: {
    getByPatient(patientId) {
      return Store.select('tasks', t => t.patientId === patientId && !t.deleted);
    },

    getAll() {
      return Store.select('tasks', t => !t.deleted);
    },

    getById(id) {
      return Store.selectOne('tasks', id);
    },

    getPending() {
      return Store.select('tasks', t => !t.completed && !t.deleted);
    },

    getCompleted() {
      return Store.select('tasks', t => t.completed && !t.deleted);
    },

    async add(patientId, text, category = 'general') {
      if (!text?.trim()) {
        throw new Error('Task text is required');
      }

      const id = crypto.randomUUID();
      const task = {
        id,
        patientId,
        text: text.trim(),
        category,
        completed: false,
        deleted: false,
        priority: 'routine',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      return Data._mutate('tasks', 'add', task, id);
    },

    async addWithDetails(taskData) {
      if (!taskData.text?.trim()) {
        throw new Error('Task text is required');
      }
      if (!taskData.patientId) {
        throw new Error('Patient ID is required');
      }

      const id = taskData.id || crypto.randomUUID();
      const task = {
        id,
        patientId: taskData.patientId,
        text: taskData.text.trim(),
        category: taskData.category || 'general',
        completed: false,
        deleted: false,
        priority: taskData.priority || 'routine',
        dueDate: taskData.dueDate || null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      return Data._mutate('tasks', 'add', task, id);
    },

    async toggle(taskId, completed) {
      return Data._mutate('tasks', 'update', {
        completed,
        completedAt: completed ? Date.now() : null,
        updatedAt: Date.now()
      }, taskId);
    },

    async update(taskId, patches) {
      return Data._mutate('tasks', 'update', {
        ...patches,
        updatedAt: Date.now()
      }, taskId);
    },

    async delete(taskId) {
      return Data._mutate('tasks', 'update', {
        deleted: true,
        deletedAt: Date.now(),
        updatedAt: Date.now()
      }, taskId);
    },

    async permanentDelete(taskId) {
      return Data._mutate('tasks', 'delete', {}, taskId);
    }
  },

  // ========================================
  // PUBLIC API: UNITS
  // ========================================

  Units: {
    getAll() {
      return Store.units;
    },

    getById(id) {
      return Store.selectOne('units', id);
    },

    async create(name, icon = '') {
      if (!name?.trim()) {
        throw new Error('Unit name is required');
      }

      const id = crypto.randomUUID();
      const unit = {
        id,
        name: name.trim(),
        icon,
        members: [Store.currentUser?.uid].filter(Boolean),
        ownerId: Store.currentUser?.uid,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      return Data._mutate('units', 'add', unit, id);
    },

    async update(id, patches) {
      return Data._mutate('units', 'update', {
        ...patches,
        updatedAt: Date.now()
      }, id);
    },

    async delete(id) {
      return Data._mutate('units', 'delete', {}, id);
    },

    async addMember(unitId, userId) {
      const unit = Store.selectOne('units', unitId);
      if (!unit) throw new Error('Unit not found');

      const members = [...(unit.members || [])];
      if (!members.includes(userId)) {
        members.push(userId);
      }

      return Data._mutate('units', 'update', {
        members,
        updatedAt: Date.now()
      }, unitId);
    },

    async removeMember(unitId, userId) {
      const unit = Store.selectOne('units', unitId);
      if (!unit) throw new Error('Unit not found');

      const members = (unit.members || []).filter(m => m !== userId);

      return Data._mutate('units', 'update', {
        members,
        updatedAt: Date.now()
      }, unitId);
    },

    select(unit) {
      Store.setCurrentUnit(unit);
      Storage.meta.set('lastUnitId', unit?.id);
    },

    getCurrent() {
      return Store.currentUnit;
    }
  },

  // ========================================
  // INITIALIZATION
  // ========================================

  async init() {
    try {
      // Initialize storage
      await Storage.init();

      // Load cached data from IndexedDB into Store
      const [patients, tasks, units] = await Promise.all([
        Storage.patients.getAll(),
        Storage.tasks.getAll(),
        Storage.units.getAll()
      ]);

      Store.replace('patients', patients);
      Store.replace('tasks', tasks);
      Store.replace('units', units);

      // Restore last selected unit
      const lastUnitId = await Storage.meta.get('lastUnitId');
      if (lastUnitId) {
        const unit = units.find(u => u.id === lastUnitId);
        if (unit) {
          Store.setCurrentUnit(unit);
        }
      }

      Monitor.log('DATA', 'Data layer initialized', {
        patients: patients.length,
        tasks: tasks.length,
        units: units.length
      });

      return true;
    } catch (error) {
      Monitor.logError('DATA_INIT_FAIL', error);
      throw error;
    }
  },

  // ========================================
  // EXPORT/IMPORT
  // ========================================

  async exportAll() {
    return Storage.exportAll();
  },

  async importAll(data) {
    const result = await Storage.importAll(data);
    if (result) {
      // Reload into Store
      const [patients, tasks, units] = await Promise.all([
        Storage.patients.getAll(),
        Storage.tasks.getAll(),
        Storage.units.getAll()
      ]);

      Store.replace('patients', patients);
      Store.replace('tasks', tasks);
      Store.replace('units', units);
    }
    return result;
  }
};
