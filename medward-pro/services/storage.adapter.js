/**
 * Storage Adapter - Abstraction over IndexedDB
 */
import { getDatabase } from './storage.db.js';

export const Storage = {
  /**
   * Generic transaction helper
   */
  async _tx(storeName, mode, callback) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      let result;
      try {
        result = callback(store);
      } catch (e) {
        reject(e);
        return;
      }

      tx.oncomplete = () => resolve(result?.result || 'ok');
      tx.onerror = () => reject(tx.error);
    });
  },

  // === Generic CRUD ===

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      if (!db) { reject(new Error('Database not initialized')); return; }
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      if (!db) { reject(new Error('Database not initialized')); return; }
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      if (!db) { reject(new Error('Database not initialized')); return; }
      const tx = db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).put(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      if (!db) { reject(new Error('Database not initialized')); return; }
      const tx = db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      if (!db) { reject(new Error('Database not initialized')); return; }
      const tx = db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // === WAL (Write-Ahead Log) ===

  wal: {
    async add(mutation) {
      return Storage.put('wal', mutation);
    },

    async getPending() {
      return new Promise((resolve, reject) => {
        const db = getDatabase();
        if (!db) { reject(new Error('Database not initialized')); return; }
        const tx = db.transaction('wal', 'readonly');
        const index = tx.objectStore('wal').index('by_status');
        const request = index.getAll('pending');
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    },

    async updateStatus(id, status) {
      const item = await Storage.get('wal', id);
      if (item) {
        item.status = status;
        await Storage.put('wal', item);
      }
    },

    async incrementRetry(id) {
      const item = await Storage.get('wal', id);
      if (item) {
        item.retryCount = (item.retryCount || 0) + 1;
        await Storage.put('wal', item);
      }
    },

    async remove(id) {
      return Storage.delete('wal', id);
    },

    async clearSynced(maxAge = 24 * 60 * 60 * 1000) {
      const all = await Storage.getAll('wal');
      const now = Date.now();
      let cleared = 0;

      for (const m of all) {
        if (m.status === 'synced' || (m.status === 'failed_fatal' && now - m.timestamp > maxAge)) {
          await Storage.delete('wal', m.id);
          cleared++;
        }
      }

      return { cleared };
    },

    async autoCleanup() {
      const all = await Storage.getAll('wal');
      const now = Date.now();
      const MAX_AGE = 24 * 60 * 60 * 1000;
      let cleared = 0;
      let enforced = 0;

      for (const m of all) {
        if (m.status === 'synced') {
          await Storage.delete('wal', m.id);
          cleared++;
        } else if (now - m.timestamp > MAX_AGE && m.status !== 'pending') {
          await Storage.delete('wal', m.id);
          enforced++;
        }
      }

      return { cleared, enforced };
    },

    async getStats() {
      const all = await Storage.getAll('wal');
      return {
        total: all.length,
        pending: all.filter(m => m.status === 'pending').length,
        synced: all.filter(m => m.status === 'synced').length,
        failed: all.filter(m => m.status === 'failed_fatal').length
      };
    }
  },

  // === Metadata ===

  meta: {
    async get(key) {
      const item = await Storage.get('meta', key);
      return item?.value;
    },

    async set(key, value) {
      return Storage.put('meta', { key, value });
    }
  }
};
