// data/reference-ranges.js
// Kuwait SI Unit Reference Ranges
// As specified in the OnCall system

export const KUWAIT_REFERENCE_RANGES = {
  // ═══════════════════════════════════════════
  // RENAL FUNCTION
  // ═══════════════════════════════════════════
  'Creatinine': {
    low: 62, high: 106, unit: '\u03BCmol/L',
    criticalHigh: 500,
    conversion: { factor: 0.0113, toUnit: 'mg/dL' }
  },
  'Urea': {
    low: 2.5, high: 7.1, unit: 'mmol/L',
    conversion: { factor: 2.8, toUnit: 'mg/dL' }
  },
  'eGFR': { low: 90, high: 999, unit: 'mL/min/1.73m\u00B2' },

  // ═══════════════════════════════════════════
  // ELECTROLYTES
  // ═══════════════════════════════════════════
  'Sodium': {
    low: 136, high: 145, unit: 'mmol/L',
    criticalLow: 120, criticalHigh: 160
  },
  'Potassium': {
    low: 3.5, high: 5.0, unit: 'mmol/L',
    criticalLow: 2.5, criticalHigh: 6.5
  },
  'Chloride': { low: 98, high: 106, unit: 'mmol/L' },
  'Bicarbonate': { low: 22, high: 29, unit: 'mmol/L' },
  'Calcium': {
    low: 2.2, high: 2.6, unit: 'mmol/L',
    criticalLow: 1.6, criticalHigh: 3.5,
    conversion: { factor: 4, toUnit: 'mg/dL' }
  },
  'Phosphate': { low: 0.8, high: 1.5, unit: 'mmol/L' },
  'Magnesium': { low: 0.7, high: 1.0, unit: 'mmol/L' },

  // ═══════════════════════════════════════════
  // HEMATOLOGY
  // ═══════════════════════════════════════════
  'Hemoglobin': {
    low: 120, high: 160, unit: 'g/L',
    criticalLow: 70,
    conversion: { factor: 0.1, toUnit: 'g/dL' }
  },
  'WBC': { low: 4.0, high: 11.0, unit: '\u00D710\u2079/L' },
  'Platelets': {
    low: 150, high: 400, unit: '\u00D710\u2079/L',
    criticalLow: 20, criticalHigh: 1000
  },
  'Neutrophils': { low: 2.0, high: 7.5, unit: '\u00D710\u2079/L' },
  'Lymphocytes': { low: 1.0, high: 4.0, unit: '\u00D710\u2079/L' },
  'Hematocrit': { low: 0.36, high: 0.46, unit: 'L/L' },
  'MCV': { low: 80, high: 100, unit: 'fL' },
  'RDW': { low: 11.5, high: 14.5, unit: '%' },

  // ═══════════════════════════════════════════
  // COAGULATION
  // ═══════════════════════════════════════════
  'PT': { low: 11, high: 13.5, unit: 'seconds' },
  'INR': { low: 0.9, high: 1.1, unit: '' },
  'APTT': { low: 25, high: 35, unit: 'seconds' },
  'Fibrinogen': { low: 2, high: 4, unit: 'g/L' },
  'D-Dimer': { low: 0, high: 0.5, unit: 'mg/L FEU' },

  // ═══════════════════════════════════════════
  // LIVER FUNCTION
  // ═══════════════════════════════════════════
  'ALT': { low: 0, high: 40, unit: 'U/L' },
  'AST': { low: 0, high: 40, unit: 'U/L' },
  'ALP': { low: 40, high: 130, unit: 'U/L' },
  'GGT': { low: 0, high: 50, unit: 'U/L' },
  'Bilirubin': {
    low: 0, high: 21, unit: '\u03BCmol/L',
    conversion: { factor: 0.058, toUnit: 'mg/dL' }
  },
  'Direct Bilirubin': { low: 0, high: 5, unit: '\u03BCmol/L' },
  'Albumin': { low: 35, high: 50, unit: 'g/L' },
  'Total Protein': { low: 60, high: 80, unit: 'g/L' },
  'Ammonia': { low: 10, high: 47, unit: '\u03BCmol/L' },

  // ═══════════════════════════════════════════
  // CARDIAC MARKERS
  // ═══════════════════════════════════════════
  'Troponin': {
    low: 0, high: 0.04, unit: 'ng/mL',
    criticalHigh: 0.04
  },
  'Troponin-HS': { low: 0, high: 14, unit: 'ng/L' },
  'BNP': { low: 0, high: 100, unit: 'pg/mL' },
  'NT-proBNP': { low: 0, high: 300, unit: 'pg/mL' },
  'CK': { low: 30, high: 200, unit: 'U/L' },
  'CK-MB': { low: 0, high: 25, unit: 'U/L' },
  'LDH': { low: 140, high: 280, unit: 'U/L' },

  // ═══════════════════════════════════════════
  // INFLAMMATORY MARKERS
  // ═══════════════════════════════════════════
  'CRP': { low: 0, high: 5, unit: 'mg/L' },
  'ESR': { low: 0, high: 20, unit: 'mm/hr' },
  'Procalcitonin': {
    low: 0, high: 0.1, unit: 'ng/mL'
    // >0.5 suggests bacterial infection
    // >2.0 suggests severe sepsis
  },
  'Ferritin': { low: 30, high: 300, unit: '\u03BCg/L' },

  // ═══════════════════════════════════════════
  // METABOLIC
  // ═══════════════════════════════════════════
  'Glucose': {
    low: 4.0, high: 6.0, unit: 'mmol/L',
    criticalLow: 2.5, criticalHigh: 25,
    conversion: { factor: 18, toUnit: 'mg/dL' }
  },
  'HbA1c': {
    low: 20, high: 42, unit: 'mmol/mol',
    conversion: { formula: '(val/10.929) + 2.15', toUnit: '%' }
  },
  'Lactate': {
    low: 0.5, high: 2.0, unit: 'mmol/L',
    criticalHigh: 4.0
  },

  // ═══════════════════════════════════════════
  // THYROID
  // ═══════════════════════════════════════════
  'TSH': { low: 0.4, high: 4.0, unit: 'mIU/L' },
  'Free T4': { low: 12, high: 22, unit: 'pmol/L' },
  'Free T3': { low: 3.1, high: 6.8, unit: 'pmol/L' },

  // ═══════════════════════════════════════════
  // LIPIDS
  // ═══════════════════════════════════════════
  'Total Cholesterol': { low: 0, high: 5.2, unit: 'mmol/L' },
  'LDL': { low: 0, high: 2.6, unit: 'mmol/L' },
  'HDL': { low: 1.0, high: 999, unit: 'mmol/L' },
  'Triglycerides': { low: 0, high: 1.7, unit: 'mmol/L' },

  // ═══════════════════════════════════════════
  // ARTERIAL BLOOD GAS
  // ═══════════════════════════════════════════
  'pH': { low: 7.35, high: 7.45, unit: '', criticalLow: 7.2, criticalHigh: 7.6 },
  'pCO2': { low: 35, high: 45, unit: 'mmHg' },
  'pO2': { low: 80, high: 100, unit: 'mmHg', criticalLow: 60 },
  'HCO3': { low: 22, high: 26, unit: 'mmol/L' },
  'Base Excess': { low: -2, high: 2, unit: 'mmol/L' },
  'Anion Gap': { low: 8, high: 12, unit: 'mmol/L' }
};
