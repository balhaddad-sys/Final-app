// core/config.js
// Environment configuration

export const Config = {
  // App metadata
  APP_NAME: 'MedWard Pro',
  APP_VERSION: '1.0.0',

  // Sync settings
  SYNC_INTERVAL: 30000, // 30 seconds
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  MAX_RETRY_COUNT: 5,

  // WAL settings
  WAL_CLEANUP_AGE: 24 * 60 * 60 * 1000, // 24 hours

  // UI settings
  TOAST_DURATION: 4000,
  LONG_PRESS_DURATION: 500,

  // Typeahead settings
  TYPEAHEAD_MIN_CHARS: 2,
  TYPEAHEAD_MAX_RESULTS: 8,

  // Validation limits
  MAX_PATIENT_NAME_LENGTH: 200,
  MAX_DIAGNOSIS_LENGTH: 500,
  MAX_TASK_TEXT_LENGTH: 500,
  MAX_MRN_LENGTH: 50,
  MAX_BED_LENGTH: 20,

  // Monitor settings
  MAX_MONITOR_EVENTS: 2500,

  // Firebase emulator ports (for development)
  EMULATOR_PORTS: {
    auth: 9099,
    firestore: 8080,
    functions: 5001,
    hosting: 5000,
    ui: 4000
  },

  // Check if using emulators
  get useEmulators() {
    return import.meta.env?.VITE_USE_EMULATORS === 'true';
  },

  // Check if in development mode
  get isDev() {
    return import.meta.env?.DEV || false;
  },

  // Get Firebase config from environment
  getFirebaseConfig() {
    return {
      apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || '',
      authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env?.VITE_FIREBASE_APP_ID || '',
      measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || ''
    };
  }
};
