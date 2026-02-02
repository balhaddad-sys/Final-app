// services/storage.db.js
// IndexedDB setup for persistent offline storage with WAL support

const DB_NAME = 'MedWardPro';
const DB_VERSION = 1;

export const StorageDB = {
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Patients store
        if (!db.objectStoreNames.contains('patients')) {
          const patients = db.createObjectStore('patients', { keyPath: 'id' });
          patients.createIndex('by_unit', 'unitId', { unique: false });
          patients.createIndex('by_deleted', 'deleted', { unique: false });
          patients.createIndex('by_updated', 'updatedAt', { unique: false });
          patients.createIndex('by_status', 'status', { unique: false });
        }

        // Units store
        if (!db.objectStoreNames.contains('units')) {
          const units = db.createObjectStore('units', { keyPath: 'id' });
          units.createIndex('by_updated', 'updatedAt', { unique: false });
        }

        // Tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const tasks = db.createObjectStore('tasks', { keyPath: 'id' });
          tasks.createIndex('by_patient', 'patientId', { unique: false });
          tasks.createIndex('by_completed', 'completed', { unique: false });
          tasks.createIndex('by_deleted', 'deleted', { unique: false });
        }

        // Trash store
        if (!db.objectStoreNames.contains('trash')) {
          const trash = db.createObjectStore('trash', { keyPath: 'id' });
          trash.createIndex('by_type', 'type', { unique: false });
          trash.createIndex('by_deleted', 'deletedAt', { unique: false });
        }

        // Write-Ahead Log (WAL) - THE CRITICAL STORE
        if (!db.objectStoreNames.contains('wal')) {
          const wal = db.createObjectStore('wal', { keyPath: 'id' });
          wal.createIndex('by_status', 'status', { unique: false });
          wal.createIndex('by_timestamp', 'timestamp', { unique: false });
        }

        // Metadata store
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }

        // Handover inbox store
        if (!db.objectStoreNames.contains('inbox')) {
          const inbox = db.createObjectStore('inbox', { keyPath: 'id' });
          inbox.createIndex('by_status', 'status', { unique: false });
          inbox.createIndex('by_created', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[StorageDB] Initialized successfully');
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[StorageDB] Failed to initialize:', event.target.error);
        reject(event.target.error);
      };
    });
  },

  // Generic transaction helper
  async _tx(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      let result;
      try {
        result = callback(store);
      } catch (e) {
        reject(e);
        return;
      }

      tx.oncomplete = () => resolve(result?.result || result);
      tx.onerror = () => reject(tx.error);
    });
  },

  // CRUD operations
  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).put(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(storeName, 'readonly');
      const index = tx.objectStore(storeName).index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async count(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // Batch operations
  async putMany(storeName, items) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      items.forEach(item => store.put(item));

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteMany(storeName, keys) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      keys.forEach(key => store.delete(key));

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  // Check if database is ready
  isReady() {
    return this.db !== null;
  },

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
};
