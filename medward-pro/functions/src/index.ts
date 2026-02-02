import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// =============================================================================
// DATA OPERATIONS
// =============================================================================

export const loadData = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { unitId } = request.data;
  const userId = request.auth.uid;

  try {
    const unitDoc = await db.collection('units').doc(unitId).get();
    if (!unitDoc.exists) {
      throw new HttpsError('not-found', 'Unit not found');
    }

    const unitData = unitDoc.data();
    if (!unitData?.members?.includes(userId)) {
      throw new HttpsError('permission-denied', 'Not a member of this unit');
    }

    const patientsSnap = await db.collection('patients')
      .where('unitId', '==', unitId)
      .where('deleted', '==', false)
      .get();

    const patients = patientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const patientIds = patients.map(p => p.id);
    let tasks: any[] = [];

    if (patientIds.length > 0) {
      const chunks = chunkArray(patientIds, 10);
      for (const chunk of chunks) {
        const tasksSnap = await db.collection('tasks')
          .where('patientId', 'in', chunk)
          .where('deleted', '==', false)
          .get();
        tasks = tasks.concat(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    }

    const unitsSnap = await db.collection('units')
      .where('members', 'array-contains', userId)
      .get();

    const units = unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { patients, tasks, units };
  } catch (error: any) {
    console.error('loadData error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Failed to load data');
  }
});

export const saveData = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { collection, id, payload, operation } = request.data;
  const userId = request.auth.uid;

  if (!['patients', 'tasks', 'units'].includes(collection)) {
    throw new HttpsError('invalid-argument', 'Invalid collection');
  }

  try {
    const docRef = db.collection(collection).doc(id);

    if (operation === 'create') {
      await docRef.set({
        ...payload,
        createdBy: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        deleted: false
      });
      return { success: true, id };
    } else if (operation === 'update') {
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new HttpsError('not-found', 'Document not found');
      }
      await docRef.update({
        ...payload,
        updatedBy: userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, id };
    } else {
      throw new HttpsError('invalid-argument', 'Invalid operation');
    }
  } catch (error: any) {
    console.error('saveData error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Failed to save data');
  }
});

export const moveToTrash = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { collection, id } = request.data;
  const userId = request.auth.uid;

  if (!['patients', 'tasks'].includes(collection)) {
    throw new HttpsError('invalid-argument', 'Invalid collection');
  }

  try {
    const docRef = db.collection(collection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new HttpsError('not-found', 'Document not found');
    }

    await db.collection('trash').doc(id).set({
      originalCollection: collection,
      originalId: id,
      data: doc.data(),
      deletedBy: userId,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
    });

    await docRef.update({
      deleted: true,
      deletedBy: userId,
      deletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error: any) {
    console.error('moveToTrash error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Failed to delete');
  }
});

export const restoreFromTrash = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { id } = request.data;

  try {
    const trashRef = db.collection('trash').doc(id);
    const trashDoc = await trashRef.get();

    if (!trashDoc.exists) {
      throw new HttpsError('not-found', 'Item not found in trash');
    }

    const trashData = trashDoc.data()!;
    const originalRef = db.collection(trashData.originalCollection).doc(trashData.originalId);

    await originalRef.update({
      deleted: false,
      deletedBy: admin.firestore.FieldValue.delete(),
      deletedAt: admin.firestore.FieldValue.delete(),
      restoredAt: admin.firestore.FieldValue.serverTimestamp(),
      restoredBy: request.auth.uid
    });

    await trashRef.delete();
    return { success: true };
  } catch (error: any) {
    console.error('restoreFromTrash error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Failed to restore');
  }
});

// =============================================================================
// HANDOVER OPERATIONS
// =============================================================================

export const sendPatient = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { recipientEmail, patientId, notes } = request.data;
  const senderId = request.auth.uid;
  const senderEmail = request.auth.token.email;

  try {
    const patientDoc = await db.collection('patients').doc(patientId).get();
    if (!patientDoc.exists) {
      throw new HttpsError('not-found', 'Patient not found');
    }

    const recipientQuery = await db.collection('users')
      .where('email', '==', recipientEmail)
      .limit(1)
      .get();

    if (recipientQuery.empty) {
      throw new HttpsError('not-found', 'Recipient not found');
    }

    const recipientId = recipientQuery.docs[0].id;

    const tasksSnap = await db.collection('tasks')
      .where('patientId', '==', patientId)
      .where('deleted', '==', false)
      .get();

    const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const handoverRef = await db.collection('handovers').add({
      senderId,
      senderEmail,
      recipientId,
      recipientEmail,
      patient: { id: patientId, ...patientDoc.data() },
      tasks,
      notes: notes || '',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, handoverId: handoverRef.id };
  } catch (error: any) {
    console.error('sendPatient error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Failed to send handover');
  }
});

export const checkInbox = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  try {
    const inboxSnap = await db.collection('handovers')
      .where('recipientId', '==', request.auth.uid)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    return { items: inboxSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error: any) {
    console.error('checkInbox error:', error);
    throw new HttpsError('internal', 'Failed to check inbox');
  }
});

export const acceptInboxPatient = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { handoverId, targetUnitId } = request.data;
  const userId = request.auth.uid;

  try {
    const handoverRef = db.collection('handovers').doc(handoverId);
    const handoverDoc = await handoverRef.get();

    if (!handoverDoc.exists) {
      throw new HttpsError('not-found', 'Handover not found');
    }

    const handoverData = handoverDoc.data()!;

    if (handoverData.recipientId !== userId) {
      throw new HttpsError('permission-denied', 'Not authorized');
    }

    if (handoverData.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Handover already processed');
    }

    const unitDoc = await db.collection('units').doc(targetUnitId).get();
    if (!unitDoc.exists || !unitDoc.data()?.members?.includes(userId)) {
      throw new HttpsError('permission-denied', 'Invalid target unit');
    }

    const batch = db.batch();

    const newPatientRef = db.collection('patients').doc();
    batch.set(newPatientRef, {
      ...handoverData.patient,
      id: newPatientRef.id,
      unitId: targetUnitId,
      handoverFrom: handoverData.senderId,
      handoverAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    for (const task of handoverData.tasks || []) {
      const newTaskRef = db.collection('tasks').doc();
      batch.set(newTaskRef, {
        ...task,
        id: newTaskRef.id,
        patientId: newPatientRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    batch.update(handoverRef, {
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      newPatientId: newPatientRef.id
    });

    await batch.commit();
    return { success: true, patientId: newPatientRef.id };
  } catch (error: any) {
    console.error('acceptInboxPatient error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Failed to accept handover');
  }
});

export const declineInboxPatient = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { handoverId, reason } = request.data;

  try {
    const handoverRef = db.collection('handovers').doc(handoverId);
    const handoverDoc = await handoverRef.get();

    if (!handoverDoc.exists) {
      throw new HttpsError('not-found', 'Handover not found');
    }

    if (handoverDoc.data()?.recipientId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Not authorized');
    }

    await handoverRef.update({
      status: 'declined',
      declinedAt: admin.firestore.FieldValue.serverTimestamp(),
      declineReason: reason || ''
    });

    return { success: true };
  } catch (error: any) {
    console.error('declineInboxPatient error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Failed to decline handover');
  }
});

// =============================================================================
// AI OPERATIONS
// =============================================================================

export const askClinical = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { question } = request.data;

  if (!question || typeof question !== 'string') {
    throw new HttpsError('invalid-argument', 'Question is required');
  }

  // Return mock response (AI integration can be added later)
  return {
    answer: generateMockClinicalResponse(question),
    disclaimer: 'This is educational guidance only. Always use clinical judgment.',
    source: 'mock'
  };
});

export const getDrugInfo = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { drugName } = request.data;

  if (!drugName || typeof drugName !== 'string') {
    throw new HttpsError('invalid-argument', 'Drug name is required');
  }

  return {
    name: drugName,
    info: {
      class: 'See BNF for classification',
      indications: 'See BNF for indications',
      dosing: 'See BNF for dosing information'
    },
    disclaimer: 'Always verify drug information in the current BNF.',
    source: 'placeholder'
  };
});

// =============================================================================
// SCHEDULED FUNCTIONS
// =============================================================================

export const cleanupTrash = onSchedule('every 24 hours', async () => {
  const now = admin.firestore.Timestamp.now();
  const expiredSnap = await db.collection('trash')
    .where('expiresAt', '<=', now)
    .limit(500)
    .get();

  const batch = db.batch();
  expiredSnap.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => batch.delete(doc.ref));

  if (expiredSnap.docs.length > 0) {
    await batch.commit();
    console.log(`Cleaned up ${expiredSnap.docs.length} expired trash items`);
  }
});

// =============================================================================
// HELPERS
// =============================================================================

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function generateMockClinicalResponse(question: string): string {
  const lowerQ = question.toLowerCase();

  if (lowerQ.includes('chest pain')) {
    return `### Chest Pain Assessment\n\n**Immediate Actions:**\n1. ECG within 10 minutes\n2. IV access, oxygen if SpO2 <94%\n3. Cardiac monitoring\n\n**Key Differentials:**\n- ACS (STEMI/NSTEMI/UA)\n- PE\n- Aortic dissection`;
  }

  if (lowerQ.includes('sepsis')) {
    return `### Sepsis Management (Sepsis-6)\n\n**Within 1 Hour:**\n1. Oxygen - Target SpO2 >94%\n2. Blood cultures - Before antibiotics\n3. IV antibiotics - Broad spectrum\n4. IV fluids - 30ml/kg if hypotensive\n5. Lactate - Measure and repeat\n6. Urine output - Catheterize`;
  }

  return `### Clinical Guidance\n\nThis question requires clinical assessment. Please consult local guidelines and senior colleagues for specific advice.`;
}
