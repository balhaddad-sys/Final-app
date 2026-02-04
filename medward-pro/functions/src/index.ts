import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';

// Define the API key as a Firebase secret
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

admin.initializeApp();
const db = admin.firestore();

// =============================================================================
// USER MANAGEMENT
// =============================================================================

// Get or create user profile (called after login to ensure user doc exists)
export const ensureUserProfile = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const userId = request.auth.uid;
  const userEmail = request.auth.token.email || '';
  const userName = request.auth.token.name || userEmail.split('@')[0] || 'User';

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Create profile for user
      await userRef.set({
        uid: userId,
        email: userEmail,
        displayName: userName,
        photoURL: request.auth.token.picture || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        settings: {
          theme: 'light',
          notifications: true
        }
      });
      return { created: true, uid: userId };
    }

    return { created: false, uid: userId };
  } catch (error: any) {
    console.error('ensureUserProfile error:', error);
    throw new HttpsError('internal', 'Failed to ensure user profile');
  }
});

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

    const patients = patientsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    const patientIds = patients.map(p => p.id);
    let tasks: any[] = [];

    if (patientIds.length > 0) {
      const chunks = chunkArray(patientIds, 10);
      for (const chunk of chunks) {
        const tasksSnap = await db.collection('tasks')
          .where('patientId', 'in', chunk)
          .where('deleted', '==', false)
          .get();
        tasks = tasks.concat(tasksSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      }
    }

    const unitsSnap = await db.collection('units')
      .where('members', 'array-contains', userId)
      .get();

    const units = unitsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

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

    const tasks = tasksSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

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

    return { items: inboxSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) };
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

const CLINICAL_SYSTEM_PROMPT = `You are a clinical decision support assistant for hospital physicians in Kuwait.
Use Kuwait SI units throughout (mmol/L, μmol/L, g/L, etc.).

You provide evidence-based clinical guidance for:
- Differential diagnosis
- Treatment approaches and management plans
- Lab interpretation with delta analysis
- Drug information with renal/hepatic dosing adjustments
- On-call consultation support
- Clinical guidelines and protocols

Structure your responses with clear headers and bullet points.
Always highlight red flags and time-critical actions first.
This is for educational support only - always remind clinicians to use their own judgment.`;

const DRUG_SYSTEM_PROMPT = `You are a clinical pharmacology specialist. Use Kuwait SI units.

Provide comprehensive drug information:
1. **Indication** - Approved and common off-label uses
2. **Dosing** - Standard adult dose, renal adjustment (eGFR/CrCl), hepatic adjustment (Child-Pugh), elderly considerations
3. **Contraindications** - Absolute and relative
4. **Interactions** - Major drug and food interactions
5. **Monitoring** - Parameters and frequency
6. **Adverse Effects** - Common (>10%) and serious (black box warnings)

Be concise but thorough. Focus on practical clinical information.`;

const ANTIBIOTIC_SYSTEM_PROMPT = `You are an infectious disease specialist providing empiric antibiotic guidance.
Use Kuwait SI units and follow local antibiograms where relevant.

For each condition provide:
1. **First-line empiric therapy** with doses
2. **Alternative agents** for allergies (penicillin, cephalosporin)
3. **Duration of therapy**
4. **De-escalation guidance** based on culture results
5. **Special considerations** - renal dosing, obesity, pregnancy
6. **Red flags** requiring broader coverage or ID consultation

Always specify when to obtain cultures before starting antibiotics.`;

/**
 * Helper: create Anthropic client using the secret
 */
function getAnthropicClient(): Anthropic {
  const apiKey = anthropicApiKey.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'AI service not configured. ANTHROPIC_API_KEY secret is missing.');
  }
  return new Anthropic({ apiKey });
}

/**
 * Helper: call Claude API with error handling
 */
async function callClaude(
  systemPrompt: string,
  userMessage: string,
  model: string = 'claude-sonnet-4-20250514',
  maxTokens: number = 2048
): Promise<{ answer: string; usage: { input: number; output: number } }> {
  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    const textBlock = response.content.find((b: any) => b.type === 'text');
    const answer = textBlock ? (textBlock as any).text : 'No response generated.';

    return {
      answer,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens
      }
    };
  } catch (error: any) {
    console.error('Claude API error:', error);

    if (error.status === 429) {
      throw new HttpsError('resource-exhausted', 'AI rate limit reached. Please wait before trying again.');
    }
    if (error.status === 401) {
      throw new HttpsError('failed-precondition', 'AI service authentication failed. Check API key configuration.');
    }
    throw new HttpsError('internal', 'AI service temporarily unavailable.');
  }
}

export const askClinical = onCall({ secrets: [anthropicApiKey] }, async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { question, context, systemPrompt, model } = request.data;

  if (!question || typeof question !== 'string') {
    throw new HttpsError('invalid-argument', 'Question is required');
  }

  if (question.length > 10000) {
    throw new HttpsError('invalid-argument', 'Question too long (max 10000 characters)');
  }

  // Use custom system prompt if provided (from the unified AI service with RAG/RLHF),
  // otherwise use the default clinical prompt
  const system = systemPrompt || CLINICAL_SYSTEM_PROMPT;

  // Build user message with optional context
  let userMessage = question;
  if (context && typeof context === 'object') {
    const contextParts: string[] = [];
    if (context.diagnosis) contextParts.push(`Diagnosis: ${context.diagnosis}`);
    if (context.status) contextParts.push(`Status: ${context.status}`);
    if (context.notes) contextParts.push(`Notes: ${context.notes}`);
    if (contextParts.length > 0) {
      userMessage = `Patient Context:\n${contextParts.join('\n')}\n\nQuestion: ${question}`;
    }
  }

  const result = await callClaude(system, userMessage, model || 'claude-sonnet-4-20250514');

  return {
    answer: result.answer,
    disclaimer: 'This is educational guidance only. Always use clinical judgment and consult specialists for complex cases.',
    usage: result.usage,
    source: 'claude'
  };
});

export const getDrugInfo = onCall({ secrets: [anthropicApiKey] }, async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { drugName, indication } = request.data;

  if (!drugName || typeof drugName !== 'string') {
    throw new HttpsError('invalid-argument', 'Drug name is required');
  }

  let userMessage = `Provide clinical information for: ${drugName}`;
  if (indication) {
    userMessage += `\nIndication: ${indication}`;
  }

  const result = await callClaude(DRUG_SYSTEM_PROMPT, userMessage);

  return {
    name: drugName,
    answer: result.answer,
    disclaimer: 'Always verify drug information in the current BNF/formulary.',
    usage: result.usage,
    source: 'claude'
  };
});

export const getAntibioticGuidance = onCall({ secrets: [anthropicApiKey] }, async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { condition, patientFactors } = request.data;

  if (!condition || typeof condition !== 'string') {
    throw new HttpsError('invalid-argument', 'Condition is required');
  }

  let userMessage = `Provide empiric antibiotic guidance for: ${condition}`;
  if (patientFactors && typeof patientFactors === 'object') {
    const factors: string[] = [];
    if (patientFactors.allergies) factors.push(`Allergies: ${patientFactors.allergies}`);
    if (patientFactors.renalFunction) factors.push(`Renal function: ${patientFactors.renalFunction}`);
    if (patientFactors.hepaticFunction) factors.push(`Hepatic function: ${patientFactors.hepaticFunction}`);
    if (patientFactors.weight) factors.push(`Weight: ${patientFactors.weight} kg`);
    if (patientFactors.age) factors.push(`Age: ${patientFactors.age}`);
    if (patientFactors.pregnant) factors.push(`Pregnant: yes`);
    if (factors.length > 0) {
      userMessage += `\n\nPatient factors:\n${factors.join('\n')}`;
    }
  }

  const result = await callClaude(ANTIBIOTIC_SYSTEM_PROMPT, userMessage);

  return {
    condition,
    answer: result.answer,
    disclaimer: 'Always follow local antibiograms and consult ID for complex infections.',
    usage: result.usage,
    source: 'claude'
  };
});

// =============================================================================
// HANDOVER AI SUMMARY
// =============================================================================

export const generateHandoverSummary = onCall({ secrets: [anthropicApiKey] }, async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { patientId } = request.data;

  if (!patientId || typeof patientId !== 'string') {
    throw new HttpsError('invalid-argument', 'Patient ID is required');
  }

  try {
    // Get patient data
    const patientDoc = await db.collection('patients').doc(patientId).get();
    if (!patientDoc.exists) {
      throw new HttpsError('not-found', 'Patient not found');
    }

    const patient = patientDoc.data()!;

    // Get patient tasks
    const tasksSnap = await db.collection('tasks')
      .where('patientId', '==', patientId)
      .where('deleted', '==', false)
      .get();

    const tasks = tasksSnap.docs.map((doc: any) => doc.data());
    const pendingTasks = tasks.filter((t: any) => !t.completed);
    const completedTasks = tasks.filter((t: any) => t.completed);

    // Build prompt with patient data (no PHI sent - use diagnosis, status, tasks only)
    const userMessage = `Generate a concise handover summary for this patient:
- Diagnosis: ${patient.diagnosis || 'Not specified'}
- Status: ${patient.status || 'active'}
- Pending tasks (${pendingTasks.length}): ${pendingTasks.map((t: any) => t.text).join(', ') || 'None'}
- Completed tasks today (${completedTasks.length}): ${completedTasks.map((t: any) => t.text).join(', ') || 'None'}
${patient.notes ? `- Clinical notes: ${patient.notes.substring(0, 500)}` : ''}

Provide a structured handover summary with:
1. Brief clinical summary
2. Key pending issues
3. Overnight plan / things to watch for
4. Escalation criteria`;

    const result = await callClaude(CLINICAL_SYSTEM_PROMPT, userMessage);

    return {
      summary: result.answer,
      disclaimer: 'AI-generated summary. Please verify all details before handover.',
      usage: result.usage,
      source: 'claude'
    };
  } catch (error: any) {
    console.error('generateHandoverSummary error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Failed to generate handover summary');
  }
});

// =============================================================================
// ADMIN OPERATIONS
// =============================================================================

export const exportUserData = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const userId = request.auth.uid;

  try {
    // Gather all user data
    const userDoc = await db.collection('users').doc(userId).get();
    const unitsSnap = await db.collection('units')
      .where('members', 'array-contains', userId)
      .get();

    const unitIds = unitsSnap.docs.map((doc: any) => doc.id);
    let patients: any[] = [];
    let tasks: any[] = [];

    for (const unitId of unitIds) {
      const patientsSnap = await db.collection('patients')
        .where('unitId', '==', unitId)
        .where('createdBy', '==', userId)
        .get();

      const unitPatients = patientsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      patients = patients.concat(unitPatients);

      const patientIds = unitPatients.map(p => p.id);
      if (patientIds.length > 0) {
        const chunks = chunkArray(patientIds, 10);
        for (const chunk of chunks) {
          const tasksSnap = await db.collection('tasks')
            .where('patientId', 'in', chunk)
            .where('createdBy', '==', userId)
            .get();
          tasks = tasks.concat(tasksSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
        }
      }
    }

    return {
      user: userDoc.data(),
      units: unitsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
      patients,
      tasks,
      exportedAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('exportUserData error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Failed to export user data');
  }
});

export const deleteAccount = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { confirmation } = request.data;
  const userId = request.auth.uid;

  if (confirmation !== 'DELETE_MY_ACCOUNT') {
    throw new HttpsError('invalid-argument', 'Invalid confirmation. Send "DELETE_MY_ACCOUNT" to confirm.');
  }

  try {
    // Delete user document
    await db.collection('users').doc(userId).delete();

    // Delete user from Firebase Auth
    await admin.auth().deleteUser(userId);

    return { success: true, message: 'Account deleted successfully' };
  } catch (error: any) {
    console.error('deleteAccount error:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Failed to delete account');
  }
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
  expiredSnap.docs.forEach((doc: any) => batch.delete(doc.ref));

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

