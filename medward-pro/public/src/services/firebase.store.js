// services/firebase.store.js
// Firestore operations

import { db } from './firebase.config.js';
import {
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
  limit,
  startAfter,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { Monitor } from '../monitor/monitor.core.js';
import { Store } from '../core/store.js';

export const FirestoreOps = {
  // ========================================
  // GENERIC OPERATIONS
  // ========================================

  async get(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      Monitor.logError('FIRESTORE_GET_FAIL', error, { collectionName, docId });
      throw error;
    }
  },

  async getAll(collectionName, constraints = []) {
    try {
      const collRef = collection(db, collectionName);
      const q = constraints.length > 0
        ? query(collRef, ...constraints)
        : collRef;

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      Monitor.logError('FIRESTORE_GETALL_FAIL', error, { collectionName });
      throw error;
    }
  },

  async set(collectionName, docId, data, merge = true) {
    try {
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, {
        ...data,
        _updatedAt: serverTimestamp()
      }, { merge });

      Monitor.log('FIRESTORE', `Set ${collectionName}/${docId}`);
      return true;
    } catch (error) {
      Monitor.logError('FIRESTORE_SET_FAIL', error, { collectionName, docId });
      throw error;
    }
  },

  async update(collectionName, docId, data) {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        _updatedAt: serverTimestamp()
      });

      Monitor.log('FIRESTORE', `Updated ${collectionName}/${docId}`);
      return true;
    } catch (error) {
      Monitor.logError('FIRESTORE_UPDATE_FAIL', error, { collectionName, docId });
      throw error;
    }
  },

  async delete(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);

      Monitor.log('FIRESTORE', `Deleted ${collectionName}/${docId}`);
      return true;
    } catch (error) {
      Monitor.logError('FIRESTORE_DELETE_FAIL', error, { collectionName, docId });
      throw error;
    }
  },

  // ========================================
  // BATCH OPERATIONS
  // ========================================

  async batchWrite(operations) {
    try {
      const batch = writeBatch(db);

      for (const op of operations) {
        const docRef = doc(db, op.collection, op.docId);

        switch (op.type) {
          case 'set':
            batch.set(docRef, { ...op.data, _updatedAt: serverTimestamp() }, { merge: true });
            break;
          case 'update':
            batch.update(docRef, { ...op.data, _updatedAt: serverTimestamp() });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      }

      await batch.commit();
      Monitor.log('FIRESTORE', `Batch write completed: ${operations.length} operations`);
      return true;
    } catch (error) {
      Monitor.logError('FIRESTORE_BATCH_FAIL', error);
      throw error;
    }
  },

  // ========================================
  // PATIENT-SPECIFIC OPERATIONS
  // ========================================

  patients: {
    async getByUnit(unitId) {
      return FirestoreOps.getAll('patients', [
        where('unitId', '==', unitId),
        where('deleted', '==', false),
        orderBy('updatedAt', 'desc')
      ]);
    },

    async getActive(unitId) {
      return FirestoreOps.getAll('patients', [
        where('unitId', '==', unitId),
        where('deleted', '==', false),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      ]);
    },

    async create(patient) {
      const id = patient.id || crypto.randomUUID();
      await FirestoreOps.set('patients', id, {
        ...patient,
        id,
        _createdAt: serverTimestamp(),
        _createdBy: Store.currentUser?.uid
      });
      return id;
    },

    async update(id, data) {
      return FirestoreOps.update('patients', id, {
        ...data,
        _updatedBy: Store.currentUser?.uid
      });
    },

    async softDelete(id) {
      return FirestoreOps.update('patients', id, {
        deleted: true,
        deletedAt: Date.now(),
        _deletedBy: Store.currentUser?.uid
      });
    }
  },

  // ========================================
  // TASK-SPECIFIC OPERATIONS
  // ========================================

  tasks: {
    async getByPatient(patientId) {
      return FirestoreOps.getAll('tasks', [
        where('patientId', '==', patientId),
        orderBy('createdAt', 'desc')
      ]);
    },

    async create(task) {
      const id = task.id || crypto.randomUUID();
      await FirestoreOps.set('tasks', id, {
        ...task,
        id,
        _createdAt: serverTimestamp(),
        _createdBy: Store.currentUser?.uid
      });
      return id;
    },

    async toggle(id, completed) {
      return FirestoreOps.update('tasks', id, {
        completed,
        completedAt: completed ? Date.now() : null
      });
    }
  },

  // ========================================
  // UNIT-SPECIFIC OPERATIONS
  // ========================================

  units: {
    async getForUser(userId) {
      return FirestoreOps.getAll('units', [
        where('members', 'array-contains', userId)
      ]);
    },

    async create(unit) {
      const id = unit.id || crypto.randomUUID();
      await FirestoreOps.set('units', id, {
        ...unit,
        id,
        ownerId: Store.currentUser?.uid,
        _createdAt: serverTimestamp()
      });
      return id;
    },

    async addMember(unitId, userId) {
      const unit = await FirestoreOps.get('units', unitId);
      if (!unit) throw new Error('Unit not found');

      const members = [...(unit.members || [])];
      if (!members.includes(userId)) {
        members.push(userId);
        await FirestoreOps.update('units', unitId, { members });
      }
      return true;
    },

    async removeMember(unitId, userId) {
      const unit = await FirestoreOps.get('units', unitId);
      if (!unit) throw new Error('Unit not found');

      const members = (unit.members || []).filter(m => m !== userId);
      await FirestoreOps.update('units', unitId, { members });
      return true;
    }
  },

  // ========================================
  // QUERY BUILDERS
  // ========================================

  buildQuery(collectionName, options = {}) {
    const constraints = [];

    if (options.where) {
      for (const [field, operator, value] of options.where) {
        constraints.push(where(field, operator, value));
      }
    }

    if (options.orderBy) {
      for (const [field, direction] of options.orderBy) {
        constraints.push(orderBy(field, direction || 'asc'));
      }
    }

    if (options.limit) {
      constraints.push(limit(options.limit));
    }

    if (options.startAfter) {
      constraints.push(startAfter(options.startAfter));
    }

    return query(collection(db, collectionName), ...constraints);
  }
};
