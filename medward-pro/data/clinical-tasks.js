/**
 * Clinical Task Database
 * Organized by category with common ward tasks
 * Supports fuzzy matching and smart suggestions
 */
export const ClinicalTasks = {
  labs: [
    // Routine
    { id: 'cbc', text: 'Order CBC', keywords: ['blood count', 'hemoglobin', 'wbc', 'platelets'] },
    { id: 'bmp', text: 'Order BMP', keywords: ['metabolic', 'electrolytes', 'creatinine', 'bun'] },
    { id: 'cmp', text: 'Order CMP', keywords: ['comprehensive', 'liver', 'albumin'] },
    { id: 'lfts', text: 'Order LFTs', keywords: ['liver function', 'ast', 'alt', 'bilirubin'] },
    { id: 'coags', text: 'Order Coagulation Panel', keywords: ['pt', 'inr', 'ptt', 'clotting'] },
    { id: 'tsh', text: 'Order TSH', keywords: ['thyroid'] },
    { id: 'hba1c', text: 'Order HbA1c', keywords: ['diabetes', 'glucose', 'sugar'] },
    { id: 'lipids', text: 'Order Lipid Panel', keywords: ['cholesterol', 'triglycerides', 'ldl', 'hdl'] },

    // Urgent
    { id: 'troponin', text: 'Order Troponin', keywords: ['cardiac', 'mi', 'chest pain', 'acs'], urgent: true },
    { id: 'abg', text: 'Order ABG', keywords: ['arterial', 'blood gas', 'respiratory', 'acidosis'], urgent: true },
    { id: 'lactate', text: 'Order Lactate', keywords: ['sepsis', 'shock', 'perfusion'], urgent: true },
    { id: 'dimer', text: 'Order D-Dimer', keywords: ['pe', 'dvt', 'clot', 'embolism'], urgent: true },
    { id: 'bnp', text: 'Order BNP/NT-proBNP', keywords: ['heart failure', 'chf', 'dyspnea'], urgent: true },

    // Cultures
    { id: 'bcx', text: 'Order Blood Cultures x2', keywords: ['sepsis', 'fever', 'infection'] },
    { id: 'ucx', text: 'Order Urine Culture', keywords: ['uti', 'dysuria'] },
    { id: 'sputum', text: 'Order Sputum Culture', keywords: ['pneumonia', 'respiratory'] },

    // Specific
    { id: 'ue', text: 'Order U&E', keywords: ['urea', 'electrolytes', 'potassium', 'sodium'] },
    { id: 'mg', text: 'Order Magnesium', keywords: ['mg', 'electrolyte'] },
    { id: 'phos', text: 'Order Phosphate', keywords: ['phosphorus'] },
    { id: 'ca', text: 'Order Calcium', keywords: ['hypercalcemia', 'hypocalcemia'] },
    { id: 'iron', text: 'Order Iron Studies', keywords: ['ferritin', 'tibc', 'anemia'] },
    { id: 'b12', text: 'Order B12/Folate', keywords: ['anemia', 'macrocytic'] },
    { id: 'crp', text: 'Order CRP', keywords: ['inflammation', 'infection'] },
    { id: 'esr', text: 'Order ESR', keywords: ['sed rate', 'inflammation'] },
    { id: 'procal', text: 'Order Procalcitonin', keywords: ['sepsis', 'bacterial'] },
    { id: 'ammonia', text: 'Order Ammonia', keywords: ['encephalopathy', 'liver'] },
    { id: 'cortisol', text: 'Order Cortisol', keywords: ['adrenal', 'addison'] },
  ],

  imaging: [
    // X-rays
    { id: 'cxr', text: 'Order CXR', keywords: ['chest xray', 'pneumonia', 'effusion'] },
    { id: 'axr', text: 'Order AXR', keywords: ['abdominal xray', 'obstruction', 'constipation'] },

    // CT
    { id: 'ct-head', text: 'Order CT Head', keywords: ['stroke', 'bleed', 'mental status'], urgent: true },
    { id: 'ct-chest', text: 'Order CT Chest', keywords: ['pe', 'lung', 'mass'] },
    { id: 'ct-abd', text: 'Order CT Abdomen/Pelvis', keywords: ['appendicitis', 'abscess', 'obstruction'] },
    { id: 'cta-pe', text: 'Order CTA Chest (PE Protocol)', keywords: ['pulmonary embolism'], urgent: true },
    { id: 'cta-head', text: 'Order CTA Head/Neck', keywords: ['stroke', 'dissection'], urgent: true },

    // Ultrasound
    { id: 'us-abd', text: 'Order US Abdomen', keywords: ['gallbladder', 'liver', 'kidney'] },
    { id: 'us-doppler', text: 'Order Doppler US (DVT)', keywords: ['leg swelling', 'clot'] },
    { id: 'us-renal', text: 'Order Renal US', keywords: ['kidney', 'hydronephrosis', 'aki'] },
    { id: 'echo', text: 'Order Echocardiogram', keywords: ['heart', 'ef', 'valve', 'chf'] },

    // MRI
    { id: 'mri-brain', text: 'Order MRI Brain', keywords: ['stroke', 'tumor', 'ms'] },
    { id: 'mri-spine', text: 'Order MRI Spine', keywords: ['cord compression', 'back pain'] },
    { id: 'mrcp', text: 'Order MRCP', keywords: ['biliary', 'pancreas', 'stones'] },
  ],

  consults: [
    { id: 'cards', text: 'Consult Cardiology', keywords: ['heart', 'arrhythmia', 'mi', 'chf'] },
    { id: 'gi', text: 'Consult GI', keywords: ['liver', 'bleed', 'endoscopy'] },
    { id: 'pulm', text: 'Consult Pulmonology', keywords: ['lung', 'copd', 'respiratory'] },
    { id: 'renal', text: 'Consult Nephrology', keywords: ['kidney', 'dialysis', 'aki'] },
    { id: 'neuro', text: 'Consult Neurology', keywords: ['stroke', 'seizure', 'mental status'] },
    { id: 'id', text: 'Consult Infectious Disease', keywords: ['sepsis', 'antibiotic', 'fever'] },
    { id: 'endo', text: 'Consult Endocrinology', keywords: ['diabetes', 'thyroid', 'adrenal'] },
    { id: 'heme', text: 'Consult Hematology', keywords: ['anemia', 'clotting', 'cancer'] },
    { id: 'onc', text: 'Consult Oncology', keywords: ['cancer', 'tumor', 'chemo'] },
    { id: 'surgery', text: 'Consult Surgery', keywords: ['acute abdomen', 'appendix'] },
    { id: 'ortho', text: 'Consult Orthopedics', keywords: ['fracture', 'bone', 'joint'] },
    { id: 'psych', text: 'Consult Psychiatry', keywords: ['depression', 'suicide', 'agitation'] },
    { id: 'palliative', text: 'Consult Palliative Care', keywords: ['goals of care', 'comfort', 'hospice'] },
    { id: 'sw', text: 'Consult Social Work', keywords: ['discharge', 'placement', 'resources'] },
    { id: 'pt', text: 'Consult PT/OT', keywords: ['mobility', 'rehab', 'therapy'] },
    { id: 'nutrition', text: 'Consult Nutrition', keywords: ['diet', 'feeding', 'tpn'] },
    { id: 'pharmacy', text: 'Consult Pharmacy', keywords: ['medication', 'dosing', 'interaction'] },
  ],

  admin: [
    { id: 'dc-summary', text: 'Write Discharge Summary', keywords: ['discharge', 'paperwork'] },
    { id: 'sick-leave', text: 'Write Sick Leave Certificate', keywords: ['certificate', 'work'] },
    { id: 'transfer', text: 'Arrange Transfer', keywords: ['icu', 'floor', 'facility'] },
    { id: 'family-meeting', text: 'Schedule Family Meeting', keywords: ['goals', 'discussion'] },
    { id: 'update-pcp', text: 'Update PCP', keywords: ['primary care', 'communication'] },
    { id: 'code-status', text: 'Discuss Code Status', keywords: ['dnr', 'resuscitation', 'goals'] },
    { id: 'consent', text: 'Obtain Procedure Consent', keywords: ['informed consent', 'procedure'] },
    { id: 'referral', text: 'Write Outpatient Referral', keywords: ['follow up', 'clinic'] },
    { id: 'med-rec', text: 'Complete Medication Reconciliation', keywords: ['meds', 'home medications'] },
  ],

  procedures: [
    { id: 'iv', text: 'Place IV Access', keywords: ['cannula', 'line'] },
    { id: 'foley', text: 'Insert Foley Catheter', keywords: ['urinary', 'catheter'] },
    { id: 'ng', text: 'Insert NG Tube', keywords: ['nasogastric', 'feeding'] },
    { id: 'abg-draw', text: 'Draw ABG', keywords: ['arterial', 'blood gas'] },
    { id: 'lp', text: 'Perform Lumbar Puncture', keywords: ['spinal tap', 'csf', 'meningitis'] },
    { id: 'paracentesis', text: 'Perform Paracentesis', keywords: ['ascites', 'tap'] },
    { id: 'thoracentesis', text: 'Perform Thoracentesis', keywords: ['effusion', 'tap'] },
    { id: 'central-line', text: 'Place Central Line', keywords: ['cvc', 'ij', 'subclavian'] },
    { id: 'art-line', text: 'Place Arterial Line', keywords: ['a-line', 'bp monitoring'] },
  ],

  medications: [
    { id: 'abx-start', text: 'Start Antibiotics', keywords: ['infection', 'sepsis'] },
    { id: 'pain-mgmt', text: 'Adjust Pain Management', keywords: ['analgesia', 'prn'] },
    { id: 'insulin', text: 'Adjust Insulin Regimen', keywords: ['glucose', 'diabetes'] },
    { id: 'anticoag', text: 'Start/Adjust Anticoagulation', keywords: ['heparin', 'warfarin', 'dvt'] },
    { id: 'diuresis', text: 'Adjust Diuretics', keywords: ['lasix', 'fluid', 'chf'] },
    { id: 'pressors', text: 'Titrate Pressors', keywords: ['vasopressor', 'bp', 'shock'], urgent: true },
    { id: 'fluids', text: 'Order IV Fluids', keywords: ['hydration', 'resuscitation'] },
    { id: 'electrolytes', text: 'Replete Electrolytes', keywords: ['potassium', 'magnesium', 'phosphorus'] },
    { id: 'sedation', text: 'Adjust Sedation', keywords: ['agitation', 'delirium'] },
    { id: 'prn-review', text: 'Review PRN Medications', keywords: ['as needed', 'protocol'] },
  ],

  monitoring: [
    { id: 'vitals-freq', text: 'Increase Vital Sign Frequency', keywords: ['monitoring', 'q1h', 'q2h'] },
    { id: 'tele', text: 'Place on Telemetry', keywords: ['cardiac monitor', 'arrhythmia'] },
    { id: 'neuro-checks', text: 'Neuro Checks q2h', keywords: ['neurological', 'stroke'] },
    { id: 'strict-io', text: 'Strict I/O Monitoring', keywords: ['intake', 'output', 'fluid'] },
    { id: 'daily-weight', text: 'Daily Weights', keywords: ['fluid', 'chf'] },
    { id: 'cbg', text: 'CBG Monitoring', keywords: ['glucose', 'fingerstick', 'diabetes'] },
    { id: 'fall-precautions', text: 'Fall Precautions', keywords: ['safety', 'risk'] },
    { id: 'aspiration', text: 'Aspiration Precautions', keywords: ['swallow', 'npo'] },
    { id: 'isolation', text: 'Place on Isolation', keywords: ['contact', 'droplet', 'airborne'] },
  ]
};

/**
 * Get all tasks as flat array
 */
export function getAllTasks() {
  const all = [];
  for (const [category, tasks] of Object.entries(ClinicalTasks)) {
    tasks.forEach(task => {
      all.push({ ...task, category });
    });
  }
  return all;
}

/**
 * Get tasks by category
 */
export function getTasksByCategory(category) {
  return ClinicalTasks[category] || [];
}

/**
 * Get categories list
 */
export function getCategories() {
  return Object.keys(ClinicalTasks);
}
