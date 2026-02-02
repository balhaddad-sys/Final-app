// features/ai/ai.prompts.js
// AI prompt templates for clinical decision support

export const AIPrompts = {
  // System prompt for clinical assistant
  systemPrompt: `You are a clinical decision support assistant for healthcare professionals.
Provide evidence-based guidance. Always cite sources when possible (guidelines, UpToDate, etc.).
Structure responses with: Assessment, Red Flags, Recommendations, References.
IMPORTANT: This is for educational purposes. Always recommend consulting specialists for complex cases.
Do not provide definitive diagnoses or treatment decisions without proper clinical evaluation.`,

  // Drug information template
  drugInfo: (drugName, indication) => `
Provide drug information for: ${drugName}
${indication ? `Indication context: ${indication}` : ''}

Format response as:
1. **Drug Class**
2. **Mechanism of Action**
3. **Dosing** (adult, renal/hepatic adjustments)
4. **Contraindications**
5. **Major Interactions**
6. **Monitoring**
7. **Common Side Effects**
8. **References** (cite BNF, UpToDate, or guidelines)
`,

  // Antibiotic guidance template
  antibioticGuidance: (condition, factors) => `
Antibiotic guidance needed for: ${condition}

Patient factors:
- Age group: ${factors.ageGroup || 'adult'}
- Allergies: ${factors.allergies?.join(', ') || 'NKDA'}
- Renal function: ${factors.renalFunction || 'normal'}
- Recent antibiotics: ${factors.recentAbx || 'none'}
- MRSA risk: ${factors.mrsaRisk || 'low'}
- Severe/septic: ${factors.severe ? 'yes' : 'no'}

Provide:
1. **First-line empiric therapy**
2. **Alternative for penicillin allergy**
3. **Dose and duration**
4. **De-escalation guidance**
5. **Local resistance considerations**
6. **Reference guidelines** (NICE, IDSA, local protocols)
`,

  // Differential diagnosis template
  differentialDx: (presentation) => `
Generate a differential diagnosis for: ${presentation}

Format:
1. **Most Likely** (top 3 diagnoses with brief reasoning)
2. **Must Not Miss** (dangerous diagnoses to rule out)
3. **Key differentiating features**
4. **Recommended initial workup**
5. **Red flags for immediate concern**
`,

  // Treatment approach template
  treatmentApproach: (condition) => `
Provide treatment approach for: ${condition}

Structure:
1. **Initial stabilization** (if applicable)
2. **First-line treatment**
3. **Second-line options**
4. **Monitoring parameters**
5. **Expected response timeline**
6. **When to escalate/consult**
7. **Key guidelines referenced**
`,

  // Investigation workup template
  investigationWorkup: (presentation) => `
What investigations should be ordered for: ${presentation}

Organize by:
1. **Immediate/bedside** (ECG, glucose, etc.)
2. **Laboratory** (with rationale for each)
3. **Imaging** (with timing and type)
4. **Special tests** (if indicated)
5. **Interpretation tips**
`,

  // Handover summary template
  handoverSummary: (patientContext) => `
Generate a concise handover summary for a patient with:
- Diagnosis: ${patientContext.diagnosis || 'Not specified'}
- Current status: ${patientContext.status || 'active'}
- Pending tasks: ${patientContext.pendingTasks?.length || 0}
${patientContext.keyFindings ? `- Key findings: ${patientContext.keyFindings}` : ''}

Format as:
1. **One-liner** (brief summary)
2. **Background** (relevant history)
3. **Assessment** (current state)
4. **Plan** (pending items and monitoring)
5. **Concerns** (things to watch for)
`,

  // On-call query template
  onCallQuery: (query) => `
On-call query: ${query}

Provide practical guidance for a junior doctor covering overnight including:
1. **Immediate actions** (what to do right now)
2. **Can it wait?** (urgency assessment)
3. **Who to call if needed**
4. **Documentation points**
5. **Safety netting advice**
`,

  // Pre-built clinical scenarios
  scenarios: {
    sepsisWorkup: {
      title: 'Sepsis Workup',
      prompt: `What is the standard sepsis workup and initial management?

Include:
1. Sepsis-3 criteria
2. Hour-1 bundle components
3. Empiric antibiotic selection
4. Fluid resuscitation guidance
5. Vasopressor initiation criteria
6. Source control considerations`
    },

    chestPain: {
      title: 'Chest Pain Approach',
      prompt: `What is the systematic approach to acute chest pain?

Cover:
1. Immediate assessment (vital signs, ECG)
2. HEART score calculation
3. Must-rule-out diagnoses (ACS, PE, dissection, tension pneumo)
4. Investigation pathway
5. Risk stratification
6. Disposition decisions`
    },

    aki: {
      title: 'Acute Kidney Injury',
      prompt: `How should acute kidney injury be evaluated and managed?

Address:
1. KDIGO staging criteria
2. Pre-renal vs intrinsic vs post-renal
3. Initial workup (labs, imaging, urinalysis)
4. Medication review (nephrotoxins)
5. Fluid management
6. Indications for nephrology consult/dialysis`
    },

    hyperkalemia: {
      title: 'Hyperkalemia Management',
      prompt: `What is the emergency management of hyperkalemia?

Include:
1. ECG changes to look for
2. Cardiac stabilization (calcium)
3. Redistribution therapies (insulin/dextrose, salbutamol)
4. Elimination therapies (diuretics, resins, dialysis)
5. Monitoring frequency
6. When to call nephrology/ICU`
    },

    stroke: {
      title: 'Acute Stroke Management',
      prompt: `What are the key steps in acute stroke management?

Cover:
1. Time-critical actions (door-to-needle)
2. NIHSS key components
3. CT interpretation (ASPECTS score basics)
4. tPA eligibility criteria and contraindications
5. Blood pressure targets
6. Thrombectomy considerations`
    }
  },

  // Get scenario by key
  getScenario(key) {
    return this.scenarios[key] || null;
  },

  // List all scenarios
  listScenarios() {
    return Object.entries(this.scenarios).map(([key, value]) => ({
      key,
      title: value.title
    }));
  }
};
