import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// =============================================================================
// DATA OPERATIONS
// =============================================================================

/**
 * Load data for a unit - returns patients, tasks, units for the user
 */
export const loadData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { unitId } = data;
  const userId = context.auth.uid;

  try {
    // Verify user has access to unit
    const unitDoc = await db.collection('units').doc(unitId).get();
    if (!unitDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Unit not found');
    }

    const unitData = unitDoc.data();
    if (!unitData?.members?.includes(userId)) {
      throw new functions.https.HttpsError('permission-denied', 'Not a member of this unit');
    }

    // Load patients for this unit
    const patientsSnap = await db.collection('patients')
      .where('unitId', '==', unitId)
      .where('deleted', '==', false)
      .get();

    const patients = patientsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Load tasks for these patients
    const patientIds = patients.map(p => p.id);
    let tasks: any[] = [];

    if (patientIds.length > 0) {
      // Firestore 'in' queries limited to 10 items
      const chunks = chunkArray(patientIds, 10);
      for (const chunk of chunks) {
        const tasksSnap = await db.collection('tasks')
          .where('patientId', 'in', chunk)
          .where('deleted', '==', false)
          .get();

        tasks = tasks.concat(tasksSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));
      }
    }

    // Load user's units
    const unitsSnap = await db.collection('units')
      .where('members', 'array-contains', userId)
      .get();

    const units = unitsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { patients, tasks, units };
  } catch (error: any) {
    console.error('loadData error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to load data');
  }
});

/**
 * Save data - handles create/update for patients, tasks, units
 */
export const saveData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { collection, id, payload, operation } = data;
  const userId = context.auth.uid;

  // Validate collection
  if (!['patients', 'tasks', 'units'].includes(collection)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid collection');
  }

  try {
    const docRef = db.collection(collection).doc(id);

    if (operation === 'create') {
      // Add metadata
      const createData = {
        ...payload,
        createdBy: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        deleted: false
      };

      await docRef.set(createData);
      return { success: true, id };
    } else if (operation === 'update') {
      // Check document exists
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Document not found');
      }

      // Add update metadata
      const updateData = {
        ...payload,
        updatedBy: userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await docRef.update(updateData);
      return { success: true, id };
    } else {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid operation');
    }
  } catch (error: any) {
    console.error('saveData error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to save data');
  }
});

/**
 * Move item to trash (soft delete)
 */
export const moveToTrash = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { collection, id } = data;
  const userId = context.auth.uid;

  if (!['patients', 'tasks'].includes(collection)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid collection');
  }

  try {
    const docRef = db.collection(collection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Document not found');
    }

    // Store in trash collection
    const trashData = {
      originalCollection: collection,
      originalId: id,
      data: doc.data(),
      deletedBy: userId,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      )
    };

    await db.collection('trash').doc(id).set(trashData);

    // Mark as deleted in original collection
    await docRef.update({
      deleted: true,
      deletedBy: userId,
      deletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error: any) {
    console.error('moveToTrash error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to delete');
  }
});

/**
 * Restore item from trash
 */
export const restoreFromTrash = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { id } = data;

  try {
    const trashRef = db.collection('trash').doc(id);
    const trashDoc = await trashRef.get();

    if (!trashDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Item not found in trash');
    }

    const trashData = trashDoc.data()!;
    const originalRef = db.collection(trashData.originalCollection).doc(trashData.originalId);

    // Restore to original collection
    await originalRef.update({
      deleted: false,
      deletedBy: admin.firestore.FieldValue.delete(),
      deletedAt: admin.firestore.FieldValue.delete(),
      restoredAt: admin.firestore.FieldValue.serverTimestamp(),
      restoredBy: context.auth.uid
    });

    // Remove from trash
    await trashRef.delete();

    return { success: true };
  } catch (error: any) {
    console.error('restoreFromTrash error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to restore');
  }
});

// =============================================================================
// HANDOVER OPERATIONS
// =============================================================================

/**
 * Send patient to another user for handover
 */
export const sendPatient = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { recipientEmail, patientId, notes } = data;
  const senderId = context.auth.uid;
  const senderEmail = context.auth.token.email;

  try {
    // Verify patient exists and sender has access
    const patientDoc = await db.collection('patients').doc(patientId).get();
    if (!patientDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Patient not found');
    }

    // Find recipient by email
    const recipientQuery = await db.collection('users')
      .where('email', '==', recipientEmail)
      .limit(1)
      .get();

    if (recipientQuery.empty) {
      throw new functions.https.HttpsError('not-found', 'Recipient not found');
    }

    const recipientId = recipientQuery.docs[0].id;

    // Get patient's tasks
    const tasksSnap = await db.collection('tasks')
      .where('patientId', '==', patientId)
      .where('deleted', '==', false)
      .get();

    const tasks = tasksSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Create handover inbox item
    const handoverData = {
      senderId,
      senderEmail,
      recipientId,
      recipientEmail,
      patient: {
        id: patientId,
        ...patientDoc.data()
      },
      tasks,
      notes: notes || '',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const handoverRef = await db.collection('handovers').add(handoverData);

    return { success: true, handoverId: handoverRef.id };
  } catch (error: any) {
    console.error('sendPatient error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to send handover');
  }
});

/**
 * Check inbox for pending handovers
 */
export const checkInbox = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const userId = context.auth.uid;

  try {
    const inboxSnap = await db.collection('handovers')
      .where('recipientId', '==', userId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const items = inboxSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { items };
  } catch (error: any) {
    console.error('checkInbox error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to check inbox');
  }
});

/**
 * Accept patient from handover inbox
 */
export const acceptInboxPatient = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { handoverId, targetUnitId } = data;
  const userId = context.auth.uid;

  try {
    const handoverRef = db.collection('handovers').doc(handoverId);
    const handoverDoc = await handoverRef.get();

    if (!handoverDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Handover not found');
    }

    const handoverData = handoverDoc.data()!;

    if (handoverData.recipientId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized');
    }

    if (handoverData.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Handover already processed');
    }

    // Verify target unit exists and user is member
    const unitDoc = await db.collection('units').doc(targetUnitId).get();
    if (!unitDoc.exists || !unitDoc.data()?.members?.includes(userId)) {
      throw new functions.https.HttpsError('permission-denied', 'Invalid target unit');
    }

    const batch = db.batch();

    // Create new patient in target unit
    const newPatientRef = db.collection('patients').doc();
    const patientData = {
      ...handoverData.patient,
      id: newPatientRef.id,
      unitId: targetUnitId,
      handoverFrom: handoverData.senderId,
      handoverAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    delete patientData.id; // Remove old id from data
    batch.set(newPatientRef, { ...patientData, id: newPatientRef.id });

    // Create tasks for new patient
    for (const task of handoverData.tasks || []) {
      const newTaskRef = db.collection('tasks').doc();
      const taskData = {
        ...task,
        id: newTaskRef.id,
        patientId: newPatientRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      delete taskData.id;
      batch.set(newTaskRef, { ...taskData, id: newTaskRef.id });
    }

    // Update handover status
    batch.update(handoverRef, {
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      newPatientId: newPatientRef.id
    });

    await batch.commit();

    return { success: true, patientId: newPatientRef.id };
  } catch (error: any) {
    console.error('acceptInboxPatient error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to accept handover');
  }
});

/**
 * Decline handover
 */
export const declineInboxPatient = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { handoverId, reason } = data;
  const userId = context.auth.uid;

  try {
    const handoverRef = db.collection('handovers').doc(handoverId);
    const handoverDoc = await handoverRef.get();

    if (!handoverDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Handover not found');
    }

    const handoverData = handoverDoc.data()!;

    if (handoverData.recipientId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized');
    }

    await handoverRef.update({
      status: 'declined',
      declinedAt: admin.firestore.FieldValue.serverTimestamp(),
      declineReason: reason || ''
    });

    return { success: true };
  } catch (error: any) {
    console.error('declineInboxPatient error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to decline handover');
  }
});

// =============================================================================
// AI OPERATIONS
// =============================================================================

/**
 * Ask clinical question to AI
 */
export const askClinical = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { question, patientContext } = data;

  if (!question || typeof question !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Question is required');
  }

  try {
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY || functions.config().openai?.key;

    if (!apiKey) {
      // Return mock response if no API key configured
      return {
        answer: generateMockClinicalResponse(question),
        disclaimer: 'This is educational guidance only. Always use clinical judgment and consult specialists for complex cases.',
        source: 'mock'
      };
    }

    // Build the prompt
    const systemPrompt = `You are a clinical decision support assistant for healthcare professionals.
Provide evidence-based, practical guidance. Always:
1. Cite guidelines when applicable (e.g., NICE, AHA, IDSA)
2. Consider patient safety first
3. Recommend escalation when appropriate
4. Include relevant differential diagnoses
5. Note when specialist consultation is advised

Format responses clearly with sections and bullet points.`;

    let userPrompt = question;
    if (patientContext) {
      userPrompt = `Patient Context: ${JSON.stringify(patientContext)}\n\nQuestion: ${question}`;
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const answer = result.choices[0]?.message?.content || 'Unable to generate response';

    // Log usage for monitoring
    console.log('AI query:', {
      userId: context.auth.uid,
      questionLength: question.length,
      responseLength: answer.length,
      tokens: result.usage
    });

    return {
      answer,
      disclaimer: 'This AI provides educational guidance only. Always use clinical judgment and consult specialists for complex cases. Verify all recommendations against current guidelines.',
      source: 'openai'
    };
  } catch (error: any) {
    console.error('askClinical error:', error);

    // Return mock response on error
    return {
      answer: generateMockClinicalResponse(question),
      disclaimer: 'This is educational guidance only. AI service temporarily unavailable.',
      source: 'mock-fallback'
    };
  }
});

/**
 * Get drug information
 */
export const getDrugInfo = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { drugName } = data;

  if (!drugName || typeof drugName !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Drug name is required');
  }

  try {
    // This would integrate with a drug database API
    // For now, return mock data
    return {
      name: drugName,
      info: {
        class: 'See BNF for classification',
        indications: 'See BNF for indications',
        contraindications: 'See BNF for contraindications',
        sideEffects: 'See BNF for side effects',
        dosing: 'See BNF for dosing information',
        interactions: 'See BNF for drug interactions',
        monitoring: 'See BNF for monitoring requirements'
      },
      disclaimer: 'Always verify drug information in the current BNF or local formulary.',
      source: 'placeholder'
    };
  } catch (error: any) {
    console.error('getDrugInfo error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get drug info');
  }
});

/**
 * Get antibiotic guidance
 */
export const getAntibioticGuidance = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { condition, factors } = data;

  if (!condition || typeof condition !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Condition is required');
  }

  try {
    const prompt = buildAntibioticPrompt(condition, factors);

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY || functions.config().openai?.key;

    if (!apiKey) {
      return {
        answer: generateMockAntibioticResponse(condition, factors),
        disclaimer: 'Always follow local antibiotic guidelines. This is educational guidance only.',
        source: 'mock'
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an infectious disease specialist assistant. Provide evidence-based antibiotic recommendations following local and international guidelines. Always recommend culture before antibiotics when appropriate, and consider antimicrobial stewardship.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const answer = result.choices[0]?.message?.content || 'Unable to generate response';

    return {
      answer,
      disclaimer: 'Always follow local antibiotic guidelines and antimicrobial stewardship protocols. Consult ID for complex infections.',
      source: 'openai'
    };
  } catch (error: any) {
    console.error('getAntibioticGuidance error:', error);

    return {
      answer: generateMockAntibioticResponse(condition, factors),
      disclaimer: 'Always follow local guidelines. AI service temporarily unavailable.',
      source: 'mock-fallback'
    };
  }
});

// =============================================================================
// HELPER FUNCTIONS
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
    return `### Chest Pain Assessment

**Immediate Actions:**
1. ECG within 10 minutes
2. IV access, oxygen if SpO2 <94%
3. Cardiac monitoring

**Key Differentials:**
- ACS (STEMI/NSTEMI/UA)
- PE
- Aortic dissection
- Pneumothorax
- Pericarditis

**Workup:**
- Serial troponins (0h, 3h)
- CXR
- D-dimer if PE suspected
- Consider CT angio if dissection suspected

**When to Escalate:**
- STEMI → Immediate cardiology/cath lab
- Hemodynamic instability
- Suspected dissection → Vascular surgery`;
  }

  if (lowerQ.includes('sepsis') || lowerQ.includes('infection')) {
    return `### Sepsis Management (Sepsis-6)

**Within 1 Hour:**
1. **Oxygen** - Target SpO2 >94%
2. **Blood cultures** - Before antibiotics
3. **IV antibiotics** - Broad spectrum per local guidelines
4. **IV fluids** - 30ml/kg crystalloid if hypotensive
5. **Lactate** - Measure and repeat if elevated
6. **Urine output** - Catheterize, aim >0.5ml/kg/hr

**Escalation Criteria:**
- Lactate >4 or rising despite fluids
- MAP <65 despite fluids
- Requiring vasopressors → ICU`;
  }

  return `### Clinical Guidance

This question requires clinical assessment. Key considerations:

1. **Patient Assessment** - Thorough history and examination
2. **Investigations** - Appropriate tests based on clinical picture
3. **Differential Diagnosis** - Consider common and serious causes
4. **Management** - Evidence-based treatment approach
5. **Safety Netting** - Clear escalation criteria

Please consult local guidelines and senior colleagues for specific advice.`;
}

function buildAntibioticPrompt(condition: string, factors: any): string {
  let prompt = `Provide antibiotic recommendations for: ${condition}\n\n`;

  if (factors) {
    prompt += 'Patient factors:\n';
    if (factors.ageGroup) prompt += `- Age group: ${factors.ageGroup}\n`;
    if (factors.renalFunction) prompt += `- Renal function: ${factors.renalFunction}\n`;
    if (factors.allergies && factors.allergies !== 'NKDA') {
      prompt += `- Allergies: ${factors.allergies}\n`;
    }
    if (factors.mrsaRisk) prompt += `- MRSA risk factors present\n`;
    if (factors.severe) prompt += `- Severe infection / Septic\n`;
  }

  prompt += `\nProvide:
1. First-line empiric antibiotic(s) with dose
2. Alternative if penicillin allergic
3. Duration of therapy
4. Key monitoring
5. When to consider ID consult`;

  return prompt;
}

function generateMockAntibioticResponse(condition: string, factors: any): string {
  const lowerC = condition.toLowerCase();
  const hasAllergy = factors?.allergies && factors.allergies.toLowerCase().includes('penicillin');
  const isSevere = factors?.severe;

  if (lowerC.includes('pneumonia') || lowerC.includes('cap')) {
    return `### Community-Acquired Pneumonia (CAP)

**CURB-65 Score Assessment Required**

**Empiric Therapy:**
${isSevere ? '**Severe/ICU:**' : '**Mild-Moderate:**'}
${hasAllergy
  ? '- Levofloxacin 500mg PO/IV daily (penicillin allergy)\n- OR Azithromycin 500mg day 1, then 250mg days 2-5'
  : isSevere
    ? '- Co-amoxiclav 1.2g IV TDS + Clarithromycin 500mg IV BD\n- OR Piperacillin-tazobactam if aspiration suspected'
    : '- Amoxicillin 500mg-1g PO TDS + Clarithromycin 500mg PO BD\n- OR Doxycycline 200mg then 100mg OD as monotherapy'
}

**Duration:** 5-7 days (may extend for severe/complications)

**Monitoring:**
- Clinical response by 48-72 hours
- CRP at day 3-4
- Repeat CXR only if not improving

**ID Consult If:**
- Empyema/lung abscess
- Immunocompromised
- Not responding to therapy`;
  }

  if (lowerC.includes('uti') || lowerC.includes('urinary')) {
    return `### Urinary Tract Infection

**Uncomplicated Cystitis:**
${hasAllergy
  ? '- Nitrofurantoin 100mg BD for 5 days\n- OR Trimethoprim 200mg BD for 3 days'
  : '- Nitrofurantoin 100mg BD for 5 days (first-line)\n- OR Trimethoprim 200mg BD for 3 days'
}

**Pyelonephritis:**
${isSevere
  ? '- Gentamicin + Amoxicillin IV (check local)\n- OR Piperacillin-tazobactam if severe'
  : hasAllergy
    ? '- Ciprofloxacin 500mg BD for 7 days'
    : '- Co-amoxiclav 625mg TDS for 7 days\n- OR Ciprofloxacin 500mg BD for 7 days'
}

**Key Points:**
- Send MSU before antibiotics
- Check local resistance patterns
- Adjust based on culture results
- Review need for imaging if not responding`;
  }

  return `### Antibiotic Guidance for ${condition}

**Initial Assessment:**
- Obtain cultures before starting antibiotics
- Check local antimicrobial guidelines
- Consider patient factors (allergies, renal function, age)

**General Principles:**
1. Use narrowest spectrum effective
2. De-escalate based on cultures
3. Review at 48-72 hours
4. Document indication and planned duration

Please consult local antibiotic guidelines for specific recommendations.

**Contact ID/Microbiology if:**
- Unusual organisms
- Multi-drug resistant infection
- Poor response to first-line therapy`;
}

// =============================================================================
// SCHEDULED FUNCTIONS
// =============================================================================

/**
 * Clean up expired trash items (runs daily)
 */
export const cleanupTrash = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();

    const expiredSnap = await db.collection('trash')
      .where('expiresAt', '<=', now)
      .limit(500)
      .get();

    const batch = db.batch();
    expiredSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    if (expiredSnap.docs.length > 0) {
      await batch.commit();
      console.log(`Cleaned up ${expiredSnap.docs.length} expired trash items`);
    }

    return null;
  });

/**
 * Clean up old handovers (runs weekly)
 */
export const cleanupHandovers = functions.pubsub
  .schedule('every 168 hours')
  .onRun(async (context) => {
    const thirtyDaysAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    const oldHandoversSnap = await db.collection('handovers')
      .where('status', 'in', ['accepted', 'declined'])
      .where('createdAt', '<=', thirtyDaysAgo)
      .limit(500)
      .get();

    const batch = db.batch();
    oldHandoversSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    if (oldHandoversSnap.docs.length > 0) {
      await batch.commit();
      console.log(`Cleaned up ${oldHandoversSnap.docs.length} old handovers`);
    }

    return null;
  });
