/**
 * Firebase Realtime Sync Service for MedWard Pro
 * ===============================================
 * Handles realtime listeners for instant multi-device sync
 */

import {
    db,
    doc,
    getDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot
} from './firebase.config.js';
import { getCurrentUser } from './firebase.auth.js';

// Active listeners (for cleanup)
const activeListeners = new Map();

// Sync status
let syncStatus = 'disconnected';
let syncStatusListeners = [];

// ============================================
// REALTIME LISTENERS
// ============================================

/**
 * Subscribe to realtime patient updates for a unit
 * @param {string} unitId - Unit ID to watch
 * @param {function} onUpdate - Callback with (patients[]) on changes
 * @param {function} onError - Callback on error
 * @returns {function} Unsubscribe function
 */
export function subscribeToPatients(unitId, onUpdate, onError = console.error) {
    // Unsubscribe from existing listener for this unit
    const existingKey = `patients_${unitId}`;
    if (activeListeners.has(existingKey)) {
        activeListeners.get(existingKey)();
        activeListeners.delete(existingKey);
    }

    const q = query(
        collection(db, 'patients'),
        where('unitId', '==', unitId),
        where('deletedAt', '==', null),
        orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const patients = [];
            snapshot.forEach(doc => {
                patients.push({ id: doc.id, ...doc.data() });
            });

            // Track changes for logging
            const changes = {
                added: snapshot.docChanges().filter(c => c.type === 'added').length,
                modified: snapshot.docChanges().filter(c => c.type === 'modified').length,
                removed: snapshot.docChanges().filter(c => c.type === 'removed').length
            };

            if (changes.added || changes.modified || changes.removed) {
                console.log('[Sync] Patients updated:', changes);
            }

            // Mark as connected - Firebase is reachable
            markFirebaseConnected();
            onUpdate(patients);
        },
        (error) => {
            console.error('[Sync] Patient subscription error:', error);
            markFirebaseDisconnected();
            onError(error);
        }
    );

    activeListeners.set(existingKey, unsubscribe);
    console.log('[Sync] Subscribed to patients for unit:', unitId);

    return unsubscribe;
}

/**
 * Subscribe to realtime unit updates for current user
 * @param {function} onUpdate - Callback with (units[]) on changes
 * @param {function} onError - Callback on error
 * @returns {function} Unsubscribe function
 */
export function subscribeToUnits(onUpdate, onError = console.error) {
    const user = getCurrentUser();
    if (!user) {
        console.warn('[Sync] Cannot subscribe to units: no user logged in');
        return () => {};
    }

    // Unsubscribe from existing listener
    if (activeListeners.has('units')) {
        activeListeners.get('units')();
        activeListeners.delete('units');
    }

    const q = query(
        collection(db, 'units'),
        where('members', 'array-contains', user.uid),
        orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const units = [];
            snapshot.forEach(doc => {
                units.push({ id: doc.id, ...doc.data() });
            });

            console.log('[Sync] Units updated:', units.length, 'units');
            markFirebaseConnected();
            onUpdate(units);
        },
        (error) => {
            console.error('[Sync] Units subscription error:', error);
            markFirebaseDisconnected();
            onError(error);
        }
    );

    activeListeners.set('units', unsubscribe);
    console.log('[Sync] Subscribed to units for user:', user.uid);

    return unsubscribe;
}

/**
 * Subscribe to a single patient's realtime updates
 * @param {string} patientId - Patient ID to watch
 * @param {function} onUpdate - Callback with (patient) on changes
 * @param {function} onError - Callback on error
 * @returns {function} Unsubscribe function
 */
export function subscribeToPatient(patientId, onUpdate, onError = console.error) {
    const existingKey = `patient_${patientId}`;
    if (activeListeners.has(existingKey)) {
        activeListeners.get(existingKey)();
        activeListeners.delete(existingKey);
    }

    const docRef = doc(db, 'patients', patientId);

    const unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
            if (docSnap.exists()) {
                const patient = { id: docSnap.id, ...docSnap.data() };
                console.log('[Sync] Patient updated:', patientId);
                onUpdate(patient);
            } else {
                console.log('[Sync] Patient deleted:', patientId);
                onUpdate(null);
            }
            markFirebaseConnected();
        },
        (error) => {
            console.error('[Sync] Patient subscription error:', error);
            markFirebaseDisconnected();
            onError(error);
        }
    );

    activeListeners.set(existingKey, unsubscribe);
    return unsubscribe;
}

/**
 * Subscribe to deleted patients (trash) for a unit
 * @param {string} unitId - Unit ID
 * @param {function} onUpdate - Callback with (patients[])
 * @returns {function} Unsubscribe function
 */
export function subscribeToTrash(unitId, onUpdate, onError = console.error) {
    const existingKey = `trash_${unitId}`;
    if (activeListeners.has(existingKey)) {
        activeListeners.get(existingKey)();
        activeListeners.delete(existingKey);
    }

    const q = query(
        collection(db, 'patients'),
        where('unitId', '==', unitId),
        where('deletedAt', '!=', null),
        orderBy('deletedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const patients = [];
            snapshot.forEach(doc => {
                patients.push({ id: doc.id, ...doc.data() });
            });

            console.log('[Sync] Trash updated:', patients.length, 'deleted patients');
            onUpdate(patients);
        },
        (error) => {
            console.error('[Sync] Trash subscription error:', error);
            onError(error);
        }
    );

    activeListeners.set(existingKey, unsubscribe);
    return unsubscribe;
}

// ============================================
// SYNC STATUS
// ============================================

/**
 * Get current sync status
 * @returns {string} 'connected' | 'disconnected' | 'error'
 */
export function getSyncStatus() {
    return syncStatus;
}

/**
 * Subscribe to sync status changes
 * @param {function} callback - Called with (status) on change
 * @returns {function} Unsubscribe function
 */
export function onSyncStatusChange(callback) {
    syncStatusListeners.push(callback);
    // Immediately call with current status
    callback(syncStatus);

    return () => {
        syncStatusListeners = syncStatusListeners.filter(cb => cb !== callback);
    };
}

/**
 * Set sync status and notify listeners
 * @param {string} status - New status
 */
function setSyncStatus(status) {
    if (syncStatus !== status) {
        syncStatus = status;
        console.log('[Sync] Status changed:', status);
        syncStatusListeners.forEach(cb => cb(status));
    }
}

// ============================================
// CLEANUP
// ============================================

/**
 * Unsubscribe from all active listeners
 */
export function unsubscribeAll() {
    console.log('[Sync] Unsubscribing from all listeners:', activeListeners.size);

    activeListeners.forEach((unsubscribe, key) => {
        try {
            unsubscribe();
        } catch (e) {
            console.warn('[Sync] Error unsubscribing from', key, e);
        }
    });

    activeListeners.clear();
    setSyncStatus('disconnected');
}

/**
 * Unsubscribe from a specific listener by key
 * @param {string} key - Listener key (e.g., 'patients_unit123')
 */
export function unsubscribe(key) {
    if (activeListeners.has(key)) {
        activeListeners.get(key)();
        activeListeners.delete(key);
        console.log('[Sync] Unsubscribed from:', key);
    }
}

/**
 * Get list of active listener keys
 * @returns {string[]} Array of active listener keys
 */
export function getActiveListeners() {
    return Array.from(activeListeners.keys());
}

// ============================================
// CONNECTION MONITORING
// ============================================

/**
 * Firebase connectivity state
 * IMPORTANT: navigator.onLine is unreliable - we use actual Firebase connectivity
 */
let firebaseConnected = false;
let connectivityCheckInterval = null;
let lastSuccessfulPing = null;

/**
 * Mark Firebase as connected (called by successful listener callbacks)
 */
function markFirebaseConnected() {
    if (!firebaseConnected) {
        firebaseConnected = true;
        lastSuccessfulPing = Date.now();
        console.log('[Sync] Firebase connectivity: CONNECTED');
        setSyncStatus('connected');
    }
}

/**
 * Mark Firebase as disconnected (called by failed listener callbacks)
 */
function markFirebaseDisconnected() {
    if (firebaseConnected) {
        firebaseConnected = false;
        console.log('[Sync] Firebase connectivity: DISCONNECTED');
        setSyncStatus('disconnected');
    }
}

/**
 * Test Firebase connectivity by attempting a lightweight Firestore operation
 * @returns {Promise<boolean>} True if Firebase is reachable
 */
async function testFirebaseConnectivity() {
    try {
        const user = getCurrentUser();
        if (!user) {
            // Not authenticated - can't test Firestore access
            // But we can assume offline for unauthenticated state
            return false;
        }

        // Attempt to read user's profile (lightweight operation)
        const userDocRef = doc(db, 'users', user.uid);

        // Set a short timeout for the connectivity test
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const docSnap = await getDoc(userDocRef);
        clearTimeout(timeoutId);

        lastSuccessfulPing = Date.now();
        return true;

    } catch (error) {
        console.warn('[Sync] Firebase connectivity test failed:', error.code || error.message);
        return false;
    }
}

/**
 * Update connectivity status based on Firebase reachability
 */
async function updateFirebaseConnectivity() {
    const isConnected = await testFirebaseConnectivity();

    if (isConnected !== firebaseConnected) {
        firebaseConnected = isConnected;
        console.log(`[Sync] Firebase connectivity changed: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
        setSyncStatus(isConnected ? 'connected' : 'disconnected');
    }
}

/**
 * Monitor online/offline status using REAL Firebase connectivity
 * FIXED: No longer relies on navigator.onLine which is unreliable
 */
export function initConnectionMonitor() {
    // Listen to browser events as hints (not truth)
    window.addEventListener('online', async () => {
        console.log('[Sync] Browser reports online - verifying Firebase connectivity...');
        await updateFirebaseConnectivity();
    });

    window.addEventListener('offline', () => {
        console.log('[Sync] Browser reports offline');
        firebaseConnected = false;
        setSyncStatus('disconnected');
    });

    // Start with disconnected state - let Firebase listeners update this
    setSyncStatus('disconnected');

    // Perform initial connectivity test
    updateFirebaseConnectivity();

    // Start periodic connectivity heartbeat (every 15 seconds)
    if (connectivityCheckInterval) {
        clearInterval(connectivityCheckInterval);
    }
    connectivityCheckInterval = setInterval(() => {
        // Only run heartbeat if we think we're disconnected
        // If connected, the onSnapshot listeners will tell us if we lose connection
        if (!firebaseConnected) {
            updateFirebaseConnectivity();
        }
    }, 15000);
}

// Auto-initialize connection monitor
if (typeof window !== 'undefined') {
    initConnectionMonitor();
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick setup for dashboard - subscribes to patients for current unit
 * @param {string} unitId - Current unit ID
 * @param {function} onPatientsUpdate - Callback for patient updates
 * @param {function} onStatusUpdate - Callback for sync status updates
 * @returns {function} Cleanup function
 */
export function setupDashboardSync(unitId, onPatientsUpdate, onStatusUpdate = () => {}) {
    // Subscribe to sync status
    const unsubStatus = onSyncStatusChange(onStatusUpdate);

    // Subscribe to patients
    const unsubPatients = subscribeToPatients(unitId, onPatientsUpdate);

    // Return combined cleanup function
    return () => {
        unsubStatus();
        unsubPatients();
    };
}

/**
 * Quick setup for landing page - subscribes to units for current user
 * @param {function} onUnitsUpdate - Callback for unit updates
 * @returns {function} Cleanup function
 */
export function setupLandingSync(onUnitsUpdate) {
    return subscribeToUnits(onUnitsUpdate);
}
