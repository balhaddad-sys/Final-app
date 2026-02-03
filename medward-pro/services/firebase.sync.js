/**
 * Firebase Sync Service - Real-time listeners + offline sync
 */
import { db } from './firebase.config.js';
import {
  collection, doc, setDoc, deleteDoc, updateDoc, getDocs,
  onSnapshot, query, where, serverTimestamp
} from 'firebase/firestore';
import { Storage } from './storage.adapter.js';
import { Store } from '../core/store.js';
import { EventBus, Events } from '../core/events.js';

let _isSyncing = false;
let _unsubscribers = [];
let _syncInterval = null;

const SYNC_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_COUNT = 5;

export const Sync = {
  /**
   * Initialize sync service
   */
  init() {
    // Listen for browser coming online
    window.addEventListener('online', () => {
      console.log('[Sync] Online - Flushing outbox...');
      EventBus.emit(Events.SYNC_STATUS, 'syncing');
      this.flushOutbox();
    });

    window.addEventListener('offline', () => {
      console.log('[Sync] Offline');
      EventBus.emit(Events.SYNC_STATUS, 'disconnected');
    });

    // Background flush interval
    _syncInterval = setInterval(() => this.flushOutbox(), SYNC_INTERVAL);

    // Initial flush on startup
    setTimeout(() => this.flushOutbox(), 1000);

    // Periodic WAL cleanup
    setInterval(() => Storage.wal.clearSynced(), 60 * 60 * 1000);

    console.log('[Sync] Service initialized');
  },

  /**
   * Destroy sync service
   */
  destroy() {
    if (_syncInterval) {
      clearInterval(_syncInterval);
      _syncInterval = null;
    }
    this.unsubscribeAll();
  },

  /**
   * Flush pending operations to cloud
   */
  async flushOutbox() {
    if (_isSyncing || !navigator.onLine) return;

    _isSyncing = true;

    try {
      const pendingOps = await Storage.wal.getPending();

      if (pendingOps.length === 0) {
        _isSyncing = false;
        return;
      }

      console.log(`[Sync] Processing ${pendingOps.length} pending operations`);

      const sortedOps = pendingOps.sort((a, b) => a.timestamp - b.timestamp);

      for (const op of sortedOps) {
        if (op.retryCount >= MAX_RETRY_COUNT) {
          await Storage.wal.updateStatus(op.id, 'failed_fatal');
          console.log(`[Sync] Marked as failed (max retries): ${op.id}`);
          continue;
        }

        try {
          await this.push(op);
          await Storage.wal.updateStatus(op.id, 'synced');
          console.log(`[Sync] Synced: ${op.collection}/${op.docId}`);
        } catch (e) {
          console.warn(`[Sync] Failed op ${op.id}:`, e.message);
          await Storage.wal.incrementRetry(op.id);
        }
      }

      EventBus.emit(Events.SYNC_STATUS, 'connected');

    } catch (error) {
      console.error('[Sync] Flush failed:', error);
    } finally {
      _isSyncing = false;
    }
  },

  /**
   * Push single mutation to cloud
   */
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

  /**
   * Load units for the current user
   */
  async loadUnits() {
    try {
      const user = Store.get('user');
      if (!user) return [];

      const q = query(
        collection(db, 'units'),
        where('members', 'array-contains', user.uid)
      );

      const snapshot = await getDocs(q);
      const units = [];
      snapshot.forEach(d => units.push({ id: d.id, ...d.data() }));

      Store.set({ units });

      // Cache locally
      for (const unit of units) {
        await Storage.put('units', unit);
      }

      return units;
    } catch (error) {
      console.error('[Sync] Failed to load units:', error);

      // Fallback to local cache
      const cached = await Storage.getAll('units');
      if (cached.length > 0) {
        Store.set({ units: cached });
      }

      return cached;
    }
  },

  /**
   * Subscribe to real-time updates for a unit
   */
  subscribeToUnit(unitId) {
    if (!unitId) {
      console.warn('[Sync] Cannot subscribe without unitId');
      return;
    }

    // Clear existing listeners
    this.unsubscribeAll();

    console.log(`[Sync] Subscribing to unit: ${unitId}`);

    // Patients listener
    const patientsQuery = query(
      collection(db, 'patients'),
      where('unitId', '==', unitId)
    );

    const unsubPatients = onSnapshot(patientsQuery,
      (snapshot) => {
        const patients = [];
        snapshot.forEach(d => patients.push({ id: d.id, ...d.data() }));

        Store.set({ patients });

        // Cache locally (non-blocking)
        patients.forEach(p => Storage.put('patients', p));

        console.log(`[Sync] Received ${patients.length} patients`);
      },
      (error) => {
        console.error('[Sync] Patients listener error:', error);
        EventBus.emit(Events.SYNC_STATUS, 'error');
      }
    );

    _unsubscribers.push(unsubPatients);

    // Tasks listener
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('unitId', '==', unitId)
    );

    const unsubTasks = onSnapshot(tasksQuery,
      (snapshot) => {
        const tasks = [];
        snapshot.forEach(d => tasks.push({ id: d.id, ...d.data() }));

        Store.set({ tasks });

        tasks.forEach(t => Storage.put('tasks', t));

        console.log(`[Sync] Received ${tasks.length} tasks`);
      },
      (error) => {
        console.error('[Sync] Tasks listener error:', error);
      }
    );

    _unsubscribers.push(unsubTasks);

    EventBus.emit(Events.SYNC_STATUS, 'connected');
  },

  /**
   * Unsubscribe from all listeners
   */
  unsubscribeAll() {
    _unsubscribers.forEach(unsub => {
      try { unsub(); } catch (e) { /* ignore */ }
    });
    _unsubscribers = [];
  },

  get isOnline() {
    return navigator.onLine;
  },

  get isSyncing() {
    return _isSyncing;
  }
};
