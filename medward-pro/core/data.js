/**
 * Data API - Unified interface for all data operations
 * Implements: Optimistic UI + WAL + Sync + Rollback
 *
 * UI should ONLY call Data.* methods, never touch Firebase/IDB directly
 */
import { Store } from './store.js';
import { EventBus, Events } from './events.js';
import { Storage } from '../services/storage.adapter.js';
import { Sync } from '../services/firebase.sync.js';

export const Data = {
  /**
   * Core mutation handler - handles the full lifecycle
   */
  async _mutate(collection, operation, payload, docId) {
    const mutationId = crypto.randomUUID();
    const timestamp = Date.now();

    // 1. Capture state for potential rollback
    const previousState = Store.getSnapshot(collection, docId);

    try {
      // 2. Optimistic UI update (instant feedback)
      Store.mutate(collection, operation, payload, docId);
      EventBus.emit(Events.DATA_UPDATED, { collection, docId, operation });

      // 3. Write to WAL (survives refresh)
      const mutation = {
        id: mutationId,
        collection,
        operation,
        docId,
        payload,
        timestamp,
        status: 'pending',
        retryCount: 0
      };
      await Storage.wal.add(mutation);

      // 4. Attempt cloud sync (non-blocking)
      this._syncToCloud(mutation, previousState);

      return { success: true, id: docId };

    } catch (error) {
      console.error('[Data] Mutation failed:', error);

      // Rollback on local failure
      if (previousState !== undefined) {
        Store.restore(collection, docId, previousState);
        EventBus.emit(Events.DATA_UPDATED, { collection, docId, operation: 'rollback' });
      }

      throw error;
    }
  },

  /**
   * Sync mutation to cloud with rollback on rejection
   */
  async _syncToCloud(mutation, previousState) {
    try {
      if (!navigator.onLine) {
        console.log('[Data] Offline, queued:', mutation.id);
        return;
      }

      await Sync.push(mutation);
      await Storage.wal.updateStatus(mutation.id, 'synced');

    } catch (error) {
      const isFatal =
        error.code === 'permission-denied' ||
        error.code === 'invalid-argument' ||
        error.type === 'validation';

      if (isFatal) {
        // Server rejected - rollback UI
        console.error('[Data] Server rejected:', error);
        Store.restore(mutation.collection, mutation.docId, previousState);
        EventBus.emit(Events.DATA_UPDATED, {
          collection: mutation.collection,
          docId: mutation.docId,
          operation: 'rollback'
        });
        EventBus.emit(Events.TOAST_SHOW, {
          type: 'error',
          message: `Save failed: ${error.message}`
        });
        await Storage.wal.updateStatus(mutation.id, 'failed_fatal');
      } else {
        // Transient error - leave in queue for retry
        console.warn('[Data] Transient error, will retry:', mutation.id);
      }
    }
  },

  // ===========================
  // PATIENTS
  // ===========================
  patients: {
    /**
     * Get patients for current unit (from local state)
     */
    list(unitId = Store.get('currentUnitId')) {
      return Store.select('patients', p =>
        p.unitId === unitId && !p.deletedAt
      );
    },

    /**
     * Get single patient
     */
    get(id) {
      return Store.find('patients', id);
    },

    /**
     * Add new patient
     */
    async add(patientData) {
      const id = patientData.id || crypto.randomUUID();
      const patient = {
        id,
        unitId: Store.get('currentUnitId'),
        name: patientData.name?.trim(),
        mrn: patientData.mrn?.trim() || null,
        bed: patientData.bed?.trim() || null,
        diagnosis: patientData.diagnosis?.trim() || null,
        age: patientData.age || null,
        status: 'stable', // 'stable' | 'attention' | 'critical'
        notes: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: Store.get('user')?.uid
      };

      if (!patient.name) {
        throw new Error('Patient name is required');
      }

      return Data._mutate('patients', 'add', patient, id);
    },

    /**
     * Update patient
     */
    async update(id, updates) {
      const sanitized = { ...updates, updatedAt: Date.now() };
      delete sanitized.id;
      delete sanitized.createdAt;
      delete sanitized.createdBy;

      return Data._mutate('patients', 'update', sanitized, id);
    },

    /**
     * Discharge patient (soft archive)
     */
    async discharge(id) {
      return this.update(id, {
        dischargedAt: Date.now(),
        status: 'discharged'
      });
    },

    /**
     * Delete patient (soft delete)
     */
    async delete(id) {
      return Data._mutate('patients', 'update', {
        deletedAt: Date.now()
      }, id);
    },

    /**
     * Restore deleted patient
     */
    async restore(id) {
      return Data._mutate('patients', 'update', {
        deletedAt: null
      }, id);
    }
  },

  // ===========================
  // TASKS
  // ===========================
  tasks: {
    /**
     * Get tasks for a patient
     */
    list(patientId) {
      return Store.select('tasks', t => t.patientId === patientId)
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    /**
     * Get pending tasks for patient
     */
    pending(patientId) {
      return this.list(patientId).filter(t => !t.completed);
    },

    /**
     * Add task to patient
     */
    async add(patientId, taskData) {
      const id = crypto.randomUUID();
      const task = {
        id,
        patientId,
        text: taskData.text?.trim(),
        category: taskData.category || 'general',
        priority: taskData.priority || 'normal',
        dueDate: taskData.dueDate || null,
        completed: false,
        completedAt: null,
        completedBy: null,
        createdAt: Date.now(),
        createdBy: Store.get('user')?.uid
      };

      if (!task.text) {
        throw new Error('Task text is required');
      }

      const result = await Data._mutate('tasks', 'add', task, id);
      EventBus.emit(Events.TASK_ADDED, { patientId, task });
      return result;
    },

    /**
     * Toggle task completion
     */
    async toggle(taskId) {
      const task = Store.find('tasks', taskId);
      if (!task) throw new Error('Task not found');

      const updates = task.completed
        ? { completed: false, completedAt: null, completedBy: null }
        : { completed: true, completedAt: Date.now(), completedBy: Store.get('user')?.uid };

      const result = await Data._mutate('tasks', 'update', updates, taskId);

      if (updates.completed) {
        EventBus.emit(Events.TASK_COMPLETED, { taskId, patientId: task.patientId });
      }

      return result;
    },

    /**
     * Delete task
     */
    async delete(taskId) {
      return Data._mutate('tasks', 'delete', null, taskId);
    }
  },

  // ===========================
  // UNITS
  // ===========================
  units: {
    list() {
      return Store.get('units') || [];
    },

    get(id) {
      return Store.find('units', id);
    },

    async create(unitData) {
      const id = crypto.randomUUID();
      const unit = {
        id,
        name: unitData.name?.trim(),
        icon: unitData.icon || '',
        createdAt: Date.now(),
        createdBy: Store.get('user')?.uid,
        members: [Store.get('user')?.uid]
      };

      if (!unit.name) {
        throw new Error('Unit name is required');
      }

      return Data._mutate('units', 'add', unit, id);
    },

    async update(id, updates) {
      return Data._mutate('units', 'update', {
        ...updates,
        updatedAt: Date.now()
      }, id);
    },

    async delete(id) {
      return Data._mutate('units', 'delete', null, id);
    },

    select(unitId) {
      Store.set({ currentUnitId: unitId });
      // Trigger data load for this unit
      Sync.subscribeToUnit(unitId);
    }
  }
};
