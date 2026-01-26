/**
 * Firebase Firestore Data Service for MedWard Pro
 * ================================================
 * CRUD operations for patients and units
 */

import {
    db,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from './firebase.config.js';
import { getCurrentUser } from './firebase.auth.js';

// Collection references
const COLLECTIONS = {
    PATIENTS: 'patients',
    UNITS: 'units',
    USERS: 'users'
};

// ============================================
// PATIENTS
// ============================================

/**
 * Create a new patient
 * @param {object} patientData - Patient data
 * @returns {Promise<object>} Created patient with ID
 */
export async function createPatient(patientData) {
    try {
        const user = getCurrentUser();
        const patientId = patientData.id || generateId();

        const patient = {
            ...patientData,
            id: patientId,
            createdBy: user?.uid || 'anonymous',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            deletedAt: null
        };

        await setDoc(doc(db, COLLECTIONS.PATIENTS, patientId), patient);
        console.log('[Store] Patient created:', patientId);

        return { success: true, patient: { ...patient, id: patientId } };

    } catch (error) {
        console.error('[Store] Error creating patient:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get a single patient by ID
 * @param {string} patientId - Patient ID
 * @returns {Promise<object|null>} Patient or null
 */
export async function getPatient(patientId) {
    try {
        const docSnap = await getDoc(doc(db, COLLECTIONS.PATIENTS, patientId));
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error('[Store] Error fetching patient:', error);
        return null;
    }
}

/**
 * Get all patients for a unit
 * @param {string} unitId - Unit ID
 * @param {boolean} includeDeleted - Include soft-deleted patients
 * @returns {Promise<array>} Array of patients
 */
export async function getPatientsByUnit(unitId, includeDeleted = false) {
    try {
        let q;

        if (includeDeleted) {
            q = query(
                collection(db, COLLECTIONS.PATIENTS),
                where('unitId', '==', unitId),
                orderBy('updatedAt', 'desc')
            );
        } else {
            q = query(
                collection(db, COLLECTIONS.PATIENTS),
                where('unitId', '==', unitId),
                where('deletedAt', '==', null),
                orderBy('updatedAt', 'desc')
            );
        }

        const snapshot = await getDocs(q);
        const patients = [];
        snapshot.forEach(doc => {
            patients.push({ id: doc.id, ...doc.data() });
        });

        console.log('[Store] Fetched', patients.length, 'patients for unit', unitId);
        return patients;

    } catch (error) {
        console.error('[Store] Error fetching patients:', error);
        return [];
    }
}

/**
 * Update a patient
 * @param {string} patientId - Patient ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Result
 */
export async function updatePatient(patientId, updates) {
    try {
        const updateData = {
            ...updates,
            updatedAt: serverTimestamp()
        };

        // Remove id from updates if present
        delete updateData.id;

        await updateDoc(doc(db, COLLECTIONS.PATIENTS, patientId), updateData);
        console.log('[Store] Patient updated:', patientId);

        return { success: true };

    } catch (error) {
        console.error('[Store] Error updating patient:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Soft delete a patient
 * @param {string} patientId - Patient ID
 * @returns {Promise<object>} Result
 */
export async function deletePatient(patientId) {
    try {
        await updateDoc(doc(db, COLLECTIONS.PATIENTS, patientId), {
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log('[Store] Patient soft-deleted:', patientId);

        return { success: true };

    } catch (error) {
        console.error('[Store] Error deleting patient:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Restore a soft-deleted patient
 * @param {string} patientId - Patient ID
 * @returns {Promise<object>} Result
 */
export async function restorePatient(patientId) {
    try {
        await updateDoc(doc(db, COLLECTIONS.PATIENTS, patientId), {
            deletedAt: null,
            updatedAt: serverTimestamp()
        });
        console.log('[Store] Patient restored:', patientId);

        return { success: true };

    } catch (error) {
        console.error('[Store] Error restoring patient:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Permanently delete a patient
 * @param {string} patientId - Patient ID
 * @returns {Promise<object>} Result
 */
export async function hardDeletePatient(patientId) {
    try {
        await deleteDoc(doc(db, COLLECTIONS.PATIENTS, patientId));
        console.log('[Store] Patient permanently deleted:', patientId);

        return { success: true };

    } catch (error) {
        console.error('[Store] Error permanently deleting patient:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// UNITS
// ============================================

/**
 * Create a new unit
 * @param {object} unitData - Unit data
 * @returns {Promise<object>} Created unit
 */
export async function createUnit(unitData) {
    try {
        const user = getCurrentUser();
        const unitId = unitData.id || generateId();

        const unit = {
            ...unitData,
            id: unitId,
            members: [user?.uid].filter(Boolean),
            admins: [user?.uid].filter(Boolean),
            createdBy: user?.uid || 'anonymous',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, COLLECTIONS.UNITS, unitId), unit);
        console.log('[Store] Unit created:', unitId);

        return { success: true, unit: { ...unit, id: unitId } };

    } catch (error) {
        console.error('[Store] Error creating unit:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get a single unit by ID
 * @param {string} unitId - Unit ID
 * @returns {Promise<object|null>} Unit or null
 */
export async function getUnit(unitId) {
    try {
        const docSnap = await getDoc(doc(db, COLLECTIONS.UNITS, unitId));
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error('[Store] Error fetching unit:', error);
        return null;
    }
}

/**
 * Get all units for current user
 * @returns {Promise<array>} Array of units
 */
export async function getUnitsForUser() {
    try {
        const user = getCurrentUser();
        if (!user) {
            console.warn('[Store] No user logged in');
            return [];
        }

        const q = query(
            collection(db, COLLECTIONS.UNITS),
            where('members', 'array-contains', user.uid),
            orderBy('name', 'asc')
        );

        const snapshot = await getDocs(q);
        const units = [];
        snapshot.forEach(doc => {
            units.push({ id: doc.id, ...doc.data() });
        });

        console.log('[Store] Fetched', units.length, 'units for user');
        return units;

    } catch (error) {
        console.error('[Store] Error fetching units:', error);
        return [];
    }
}

/**
 * Get all units (for migration/admin purposes)
 * @returns {Promise<array>} Array of all units
 */
export async function getAllUnits() {
    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.UNITS));
        const units = [];
        snapshot.forEach(doc => {
            units.push({ id: doc.id, ...doc.data() });
        });
        return units;
    } catch (error) {
        console.error('[Store] Error fetching all units:', error);
        return [];
    }
}

/**
 * Update a unit
 * @param {string} unitId - Unit ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Result
 */
export async function updateUnit(unitId, updates) {
    try {
        const updateData = {
            ...updates,
            updatedAt: serverTimestamp()
        };

        delete updateData.id;

        await updateDoc(doc(db, COLLECTIONS.UNITS, unitId), updateData);
        console.log('[Store] Unit updated:', unitId);

        return { success: true };

    } catch (error) {
        console.error('[Store] Error updating unit:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a unit
 * @param {string} unitId - Unit ID
 * @returns {Promise<object>} Result
 */
export async function deleteUnit(unitId) {
    try {
        await deleteDoc(doc(db, COLLECTIONS.UNITS, unitId));
        console.log('[Store] Unit deleted:', unitId);

        return { success: true };

    } catch (error) {
        console.error('[Store] Error deleting unit:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Add a member to a unit
 * @param {string} unitId - Unit ID
 * @param {string} userId - User ID to add
 * @returns {Promise<object>} Result
 */
export async function addUnitMember(unitId, userId) {
    try {
        const unit = await getUnit(unitId);
        if (!unit) {
            return { success: false, error: 'Unit not found' };
        }

        const members = unit.members || [];
        if (!members.includes(userId)) {
            members.push(userId);
            await updateUnit(unitId, { members });
        }

        return { success: true };

    } catch (error) {
        console.error('[Store] Error adding unit member:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Remove a member from a unit
 * @param {string} unitId - Unit ID
 * @param {string} userId - User ID to remove
 * @returns {Promise<object>} Result
 */
export async function removeUnitMember(unitId, userId) {
    try {
        const unit = await getUnit(unitId);
        if (!unit) {
            return { success: false, error: 'Unit not found' };
        }

        const members = (unit.members || []).filter(id => id !== userId);
        await updateUnit(unitId, { members });

        return { success: true };

    } catch (error) {
        console.error('[Store] Error removing unit member:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// UTILITIES
// ============================================

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Batch create patients (for migration)
 * @param {array} patients - Array of patient objects
 * @param {string} unitId - Target unit ID
 * @returns {Promise<object>} Result with count
 */
export async function batchCreatePatients(patients, unitId) {
    let created = 0;
    let failed = 0;

    for (const patient of patients) {
        const result = await createPatient({
            ...patient,
            unitId
        });

        if (result.success) {
            created++;
        } else {
            failed++;
        }
    }

    console.log('[Store] Batch create complete:', created, 'created,', failed, 'failed');
    return { success: true, created, failed };
}

/**
 * Batch create units (for migration)
 * @param {array} units - Array of unit objects
 * @returns {Promise<object>} Result with count
 */
export async function batchCreateUnits(units) {
    let created = 0;
    let failed = 0;

    for (const unit of units) {
        const result = await createUnit(unit);

        if (result.success) {
            created++;
        } else {
            failed++;
        }
    }

    console.log('[Store] Batch create units complete:', created, 'created,', failed, 'failed');
    return { success: true, created, failed };
}
