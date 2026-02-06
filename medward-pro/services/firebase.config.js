// services/firebase.config.js
// Firebase initialization and configuration

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { Config } from '../core/config.js';

// Get Firebase config from environment
const firebaseConfig = Config.getFirebaseConfig();

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
// Initialize Firestore with persistent cache (replaces enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const functions = getFunctions(app);

// Connect to emulators in development
if (Config.useEmulators) {
  try {
    connectAuthEmulator(auth, `http://localhost:${Config.EMULATOR_PORTS.auth}`, {
      disableWarnings: true
    });
    connectFirestoreEmulator(db, 'localhost', Config.EMULATOR_PORTS.firestore);
    connectFunctionsEmulator(functions, 'localhost', Config.EMULATOR_PORTS.functions);
    console.log('[Firebase] Connected to emulators');
  } catch (e) {
    console.warn('[Firebase] Failed to connect to emulators:', e.message);
  }
}

export default app;

// Export for debugging
if (Config.isDev) {
  window.__FIREBASE__ = { app, auth, db, functions };
}
