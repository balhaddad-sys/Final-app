// services/firebase.sync.js
// Real-time sync + listeners

import { db } from './firebase.config.js';
import {
  collection, doc, setDoc, deleteDoc, updateDoc, getDocs,
  onSnapshot, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { Storage } from './storage.adapter.js';
import { Store } from '../core/store.js';
import { EventBus } from '../core/core.events.js';
import { Monitor } from '../monitor/monitor.core.js';
import { Config } from '../core/config.js';

let _isSyncing = false;
let _unsubscribers = [];
let _lastFetch = {};
let _syncInterval = null;

export const Sync = {
  // ========================================
  // INITIALIZATION
  // ========================================

  init() {
    // Listen for browser coming online
    window.addEventListener('online', () => {
      console.log('[Sync] Online - Flushing outbox...');
      EventBus.emit('sync:status', 'syncing');
      this.flushOutbox();
    });

    window.addEventListener('offline', () => {
      console.log('[Sync] Offline');
      EventBus.emit('sync:status', 'offline');
    });

    // Background flush interval
    _syncInterval = setInterval(() => this.flushOutbox(), Config.SYNC_INTERVAL);

    // Initial flush on startup
    setTimeout(() => this.flushOutbox(), 1000);

    // Periodic WAL cleanup
    setInterval(() => Storage.wal.clearSynced(Config.WAL_CLEANUP_AGE), 60 * 60 * 1000);

    Monitor.log('SYNC', 'Sync service initialized');
  },

  destroy() {
    if (_syncInterval) {
      clearInterval(_syncInterval);
      _syncInterval = null;
    }
    this.unsubscribeAll();
  },

  // ========================================
  // OUTBOX PROCESSOR (Local -> Cloud)
  // ========================================

  async flushOutbox() {
    if (_isSyncing || !navigator.onLine) return;

    _isSyncing = true;

    try {
      const pendingOps = await Storage.wal.getPending();

      if (pendingOps.length === 0) {
        _isSyncing = false;
        return;
      }

      Monitor.log('SYNC', `Processing ${pendingOps.length} pending operations`);

      // Process in order (FIFO) for data integrity
      const sortedOps = pendingOps.sort((a, b) => a.timestamp - b.timestamp);

      for (const op of sortedOps) {
        // Skip if too many retries
        if (op.retryCount >= Config.MAX_RETRY_COUNT) {
          await Storage.wal.updateStatus(op.id, 'failed_fatal');
          Monitor.log('SYNC', `Marked as failed (max retries): ${op.id}`);
          continue;
        }

        try {
          await this.push(op);
          await Storage.wal.updateStatus(op.id, 'synced');
          Monitor.log('SYNC', `Synced: ${op.collection}/${op.docId}`);
        } catch (e) {
          console.warn(`[Sync] Failed op ${op.id}:`, e.message);
          await Storage.wal.incrementRetry(op.id);
        }
      }

      EventBus.emit('sync:status', 'connected');

    } catch (error) {
      Monitor.logError('SYNC_FLUSH_FAIL', error);
    } finally {
      _isSyncing = false;
    }
  },

  // ========================================
  // PUSH SINGLE OPERATION
  // ========================================

  async push(mutation) {
    const { collection: collName, operation, docId, payload } = mutation;
    const docRef = doc(db, collName, docId);

    switch (operation) {
      case 'add':
        await setDoc(docRef, {
          ...payload,
          _createdAt: serverTimestamp(),
          _updatedAt: serverTimestamp()
        });
        break;

      case 'update':
        await updateDoc(docRef, {
          ...payload,
          _updatedAt: serverTimestamp()
        });
        break;

      case 'delete':
        await deleteDoc(docRef);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return true;
  },

  // ========================================
  // PULL DATA (Cloud -> Local)
  // ========================================

  async pull(collName, unitId) {
    try {
      Monitor.log('SYNC', `Pulling ${collName} for unit ${unitId || 'all'}`);

      let q;
      if (unitId) {
        q = query(
          collection(db, collName),
          where('unitId', '==', unitId),
          where('deleted', '==', false)
        );
      } else {
        q = collection(db, collName);
      }

      const snapshot = await getDocs(q);
      const items = [];

      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });

      // Update Store
      Store.replace(collName, items);

      // Update local IDB
      for (const item of items) {
        if (collName === 'patients') {
          await Storage.patients.upsert(item);
        } else if (collName === 'tasks') {
          await Storage.tasks.upsert(item);
        } else if (collName === 'units') {
          await Storage.units.upsert(item);
        }
      }

      _lastFetch[`${collName}:${unitId}`] = Date.now();

      Monitor.log('SYNC', `Pulled ${items.length} ${collName}`);
      return items;

    } catch (error) {
      Monitor.logError('SYNC_PULL_FAIL', error);
      throw error;
    }
  },

  // ========================================
  // REAL-TIME LISTENERS
  // ========================================

  subscribeToUnit(unitId) {
    if (!unitId) {
      console.warn('[Sync] Cannot subscribe without unitId');
      return;
    }

    // Clear old listeners
    this.unsubscribeAll();

    Monitor.log('SYNC', `Subscribing to unit: ${unitId}`);

    // Patients listener
    const patientsQuery = query(
      collection(db, 'patients'),
      where('unitId', '==', unitId),
      where('deleted', '==', false)
    );

    const unsubPatients = onSnapshot(patientsQuery,
      (snapshot) => {
        const patients = [];
        snapshot.forEach(doc => patients.push({ id: doc.id, ...doc.data() }));

        // Update in-memory store
        Store.replace('patients', patients);

        // Update local IDB (async, don't await)
        patients.forEach(p => Storage.patients.upsert(p));

        Monitor.log('SYNC', `Received ${patients.length} patients`);
      },
      (error) => {
        Monitor.logError('SYNC_LISTENER_ERROR', error);
        EventBus.emit('sync:status', 'error');
      }
    );

    _unsubscribers.push(unsubPatients);

    // Tasks listener
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('deleted', '==', false)
    );

    const unsubTasks = onSnapshot(tasksQuery,
      (snapshot) => {
        const tasks = [];
        snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
        Store.replace('tasks', tasks);
        tasks.forEach(t => Storage.tasks.upsert(t));
        Monitor.log('SYNC', `Received ${tasks.length} tasks`);
      },
      (error) => Monitor.logError('SYNC_TASKS_ERROR', error)
    );

    _unsubscribers.push(unsubTasks);

    EventBus.emit('sync:status', 'connected');
  },

  subscribeToUnits(userId) {
    if (!userId) return;

    const unitsQuery = query(
      collection(db, 'units'),
      where('members', 'array-contains', userId)
    );

    const unsub = onSnapshot(unitsQuery,
      (snapshot) => {
        const units = [];
        snapshot.forEach(doc => units.push({ id: doc.id, ...doc.data() }));
        Store.replace('units', units);
        units.forEach(u => Storage.units.upsert(u));
        Monitor.log('SYNC', `Received ${units.length} units`);
      },
      (error) => Monitor.logError('SYNC_UNITS_ERROR', error)
    );

    _unsubscribers.push(unsub);
  },

  unsubscribeAll() {
    _unsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (e) {
        console.warn('[Sync] Error unsubscribing:', e);
      }
    });
    _unsubscribers = [];
    Monitor.log('SYNC', 'Unsubscribed from all listeners');
  },

  // ========================================
  // HELPERS
  // ========================================

  shouldRefetch(collName, unitId) {
    const key = `${collName}:${unitId}`;
    const lastFetch = _lastFetch[key] || 0;

    return Date.now() - lastFetch > Config.STALE_TIME;
  },

  get isOnline() {
    return navigator.onLine;
  },

  get isSyncing() {
    return _isSyncing;
  },

  async getStats() {
    const walStats = await Storage.wal.getStats();
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      activeListeners: _unsubscribers.length,
      wal: walStats
    };
  }
};
