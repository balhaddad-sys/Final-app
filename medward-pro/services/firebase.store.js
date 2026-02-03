/**
 * Firestore Operations - Direct database operations
 */
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
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.config.js';

export const FirestoreOps = {
  /**
   * Get a single document
   */
  async get(collectionName, docId) {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  },

  /**
   * Query documents
   */
  async query(collectionName, conditions = [], orderByField = null, limitCount = null) {
    let q = collection(db, collectionName);
    const constraints = [];

    for (const [field, op, value] of conditions) {
      constraints.push(where(field, op, value));
    }

    if (orderByField) {
      constraints.push(orderBy(orderByField));
    }

    if (limitCount) {
      constraints.push(limit(limitCount));
    }

    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    const snapshot = await getDocs(q);
    const items = [];
    snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
    return items;
  },

  /**
   * Create or overwrite a document
   */
  async set(collectionName, docId, data) {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      _createdAt: serverTimestamp(),
      _updatedAt: serverTimestamp()
    });
  },

  /**
   * Update a document
   */
  async update(collectionName, docId, data) {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      _updatedAt: serverTimestamp()
    });
  },

  /**
   * Delete a document
   */
  async delete(collectionName, docId) {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  }
};
