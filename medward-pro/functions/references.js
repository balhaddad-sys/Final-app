// references.js
// Kuwait SI Unit Reference Ranges and Clinical Protocols

const REFERENCE_RANGES = {
  // ── Renal Function ─────────────────────────────────
  Creatinine: {
    low: 62, high: 106, unit: "\u03BCmol/L",
    criticalHigh: 500,
    conversion: { factor: 0.0113, toUnit: "mg/dL" }
  },
  Urea: {
    low: 2.5, high: 7.1, unit: "mmol/L",
    conversion: { factor: 2.8, toUnit: "mg/dL" }
  },
  eGFR: { low: 90, high: 999, unit: "mL/min/1.73m\u00B2" },

  // ── Electrolytes ───────────────────────────────────
  Sodium: {
    low: 136, high: 145, unit: "mmol/L",
    criticalLow: 120, criticalHigh: 160
  },
  Potassium: {
    low: 3.5, high: 5.0, unit: "mmol/L",
    criticalLow: 2.5, criticalHigh: 6.5
  },
  Chloride: { low: 98, high: 106, unit: "mmol/L" },
  Bicarbonate: { low: 22, high: 29, unit: "mmol/L" },
  Calcium: {
    low: 2.2, high: 2.6, unit: "mmol/L",
    criticalLow: 1.6, criticalHigh: 3.5,
    conversion: { factor: 4, toUnit: "mg/dL" }
  },
  Phosphate: { low: 0.8, high: 1.5, unit: "mmol/L" },
  Magnesium: { low: 0.7, high: 1.0, unit: "mmol/L" },

  // ── Hematology ─────────────────────────────────────
  Hemoglobin: {
    low: 120, high: 160, unit: "g/L",
    criticalLow: 70,
    conversion: { factor: 0.1, toUnit: "g/dL" }
  },
  WBC: { low: 4.0, high: 11.0, unit: "\u00D710\u2079/L" },
  Platelets: {
    low: 150, high: 400, unit: "\u00D710\u2079/L",
    criticalLow: 20, criticalHigh: 1000
  },
  Neutrophils: { low: 2.0, high: 7.5, unit: "\u00D710\u2079/L" },
  Lymphocytes: { low: 1.0, high: 4.0, unit: "\u00D710\u2079/L" },
  Hematocrit: { low: 0.36, high: 0.46, unit: "L/L" },
  MCV: { low: 80, high: 100, unit: "fL" },
  RDW: { low: 11.5, high: 14.5, unit: "%" },

  // ── Coagulation ────────────────────────────────────
  PT: { low: 11, high: 13.5, unit: "seconds" },
  INR: { low: 0.9, high: 1.1, unit: "" },
  APTT: { low: 25, high: 35, unit: "seconds" },
  Fibrinogen: { low: 2, high: 4, unit: "g/L" },
  "D-Dimer": { low: 0, high: 0.5, unit: "mg/L FEU" },

  // ── Liver Function ─────────────────────────────────
  ALT: { low: 0, high: 40, unit: "U/L" },
  AST: { low: 0, high: 40, unit: "U/L" },
  ALP: { low: 40, high: 130, unit: "U/L" },
  GGT: { low: 0, high: 50, unit: "U/L" },
  Bilirubin: {
    low: 0, high: 21, unit: "\u03BCmol/L",
    conversion: { factor: 0.058, toUnit: "mg/dL" }
  },
  "Direct Bilirubin": { low: 0, high: 5, unit: "\u03BCmol/L" },
  Albumin: { low: 35, high: 50, unit: "g/L" },
  "Total Protein": { low: 60, high: 80, unit: "g/L" },
  Ammonia: { low: 10, high: 47, unit: "\u03BCmol/L" },

  // ── Cardiac Markers ────────────────────────────────
  Troponin: { low: 0, high: 0.04, unit: "ng/mL", criticalHigh: 0.04 },
  "Troponin-HS": { low: 0, high: 14, unit: "ng/L" },
  BNP: { low: 0, high: 100, unit: "pg/mL" },
  "NT-proBNP": { low: 0, high: 300, unit: "pg/mL" },
  CK: { low: 30, high: 200, unit: "U/L" },
  "CK-MB": { low: 0, high: 25, unit: "U/L" },
  LDH: { low: 140, high: 280, unit: "U/L" },

  // ── Inflammatory Markers ───────────────────────────
  CRP: { low: 0, high: 5, unit: "mg/L" },
  ESR: { low: 0, high: 20, unit: "mm/hr" },
  Procalcitonin: { low: 0, high: 0.1, unit: "ng/mL" },
  Ferritin: { low: 30, high: 300, unit: "\u03BCg/L" },

  // ── Metabolic ──────────────────────────────────────
  Glucose: {
    low: 4.0, high: 6.0, unit: "mmol/L",
    criticalLow: 2.5, criticalHigh: 25,
    conversion: { factor: 18, toUnit: "mg/dL" }
  },
  HbA1c: {
    low: 20, high: 42, unit: "mmol/mol",
    conversion: { formula: "(val/10.929) + 2.15", toUnit: "%" }
  },
  Lactate: { low: 0.5, high: 2.0, unit: "mmol/L", criticalHigh: 4.0 },

  // ── Thyroid ────────────────────────────────────────
  TSH: { low: 0.4, high: 4.0, unit: "mIU/L" },
  "Free T4": { low: 12, high: 22, unit: "pmol/L" },
  "Free T3": { low: 3.1, high: 6.8, unit: "pmol/L" },

  // ── Lipids ─────────────────────────────────────────
  "Total Cholesterol": { low: 0, high: 5.2, unit: "mmol/L" },
  LDL: { low: 0, high: 2.6, unit: "mmol/L" },
  HDL: { low: 1.0, high: 999, unit: "mmol/L" },
  Triglycerides: { low: 0, high: 1.7, unit: "mmol/L" },

  // ── Arterial Blood Gas ─────────────────────────────
  pH: { low: 7.35, high: 7.45, unit: "", criticalLow: 7.2, criticalHigh: 7.6 },
  pCO2: { low: 35, high: 45, unit: "mmHg" },
  pO2: { low: 80, high: 100, unit: "mmHg", criticalLow: 60 },
  HCO3: { low: 22, high: 26, unit: "mmol/L" },
  "Base Excess": { low: -2, high: 2, unit: "mmol/L" },
  "Anion Gap": { low: 8, high: 12, unit: "mmol/L" }
};

const CLINICAL_PROTOCOLS = {
  SEPSIS: {
    name: "Sepsis Hour-1 Bundle",
    steps: [
      "Measure lactate; re-measure if > 2 mmol/L",
      "Obtain blood cultures before antibiotics",
      "Administer broad-spectrum antibiotics",
      "Begin 30 mL/kg crystalloid for hypotension or lactate \u2265 4",
      "Apply vasopressors if hypotensive during or after fluid resuscitation"
    ]
  },
  HYPERKALEMIA: {
    name: "Hyperkalemia Emergency Protocol",
    steps: [
      "ECG immediately",
      "Calcium gluconate 10% 10 mL IV over 2\u20133 min (cardiac stabilisation)",
      "Insulin 10 units + Dextrose 50% 50 mL IV (redistribution)",
      "Salbutamol 10\u201320 mg nebulised (redistribution)",
      "Sodium bicarbonate 8.4% 50 mL IV if acidotic",
      "Calcium resonium 15\u201330 g PO/PR (elimination)",
      "Urgent nephrology if K > 6.5 or ECG changes persist"
    ]
  },
  DKA: {
    name: "DKA Management Protocol",
    steps: [
      "IV normal saline 1 L/hr for first 2 hours",
      "Insulin infusion 0.1 units/kg/hr (do NOT bolus)",
      "Monitor glucose hourly, K+ every 2 hours",
      "Add dextrose when glucose < 14 mmol/L",
      "Replace potassium: add 40 mmol KCl/L if K < 5.5",
      "Monitor bicarbonate, anion gap, pH",
      "Transition to SC insulin when anion gap closes and patient eating"
    ]
  }
};

module.exports = { REFERENCE_RANGES, CLINICAL_PROTOCOLS };
