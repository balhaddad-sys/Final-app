/**
 * IndexedDB Database Setup
 */
const DB_NAME = 'MedWardPro';
const DB_VERSION = 1;

let db = null;

export async function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Patients store
      if (!database.objectStoreNames.contains('patients')) {
        const patientsStore = database.createObjectStore('patients', { keyPath: 'id' });
        patientsStore.createIndex('by_unit', 'unitId');
        patientsStore.createIndex('by_status', 'status');
        patientsStore.createIndex('by_updated', 'updatedAt');
      }

      // Tasks store
      if (!database.objectStoreNames.contains('tasks')) {
        const tasksStore = database.createObjectStore('tasks', { keyPath: 'id' });
        tasksStore.createIndex('by_patient', 'patientId');
        tasksStore.createIndex('by_completed', 'completed');
      }

      // Units store
      if (!database.objectStoreNames.contains('units')) {
        database.createObjectStore('units', { keyPath: 'id' });
      }

      // WAL (Write-Ahead Log) for offline queue
      if (!database.objectStoreNames.contains('wal')) {
        const walStore = database.createObjectStore('wal', { keyPath: 'id' });
        walStore.createIndex('by_status', 'status');
        walStore.createIndex('by_timestamp', 'timestamp');
      }

      // Metadata store
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
    };
  });
}

export function getDatabase() {
  return db;
}
