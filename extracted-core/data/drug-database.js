/**
 * Local Drug Reference Database
 * Common medications for quick reference during ward rounds
 */
export const DrugDatabase = {
  categories: [
    'antibiotics',
    'cardiovascular',
    'analgesics',
    'anticoagulants',
    'diabetes',
    'respiratory',
    'gi',
    'electrolytes'
  ],

  drugs: {
    antibiotics: [
      {
        name: 'Amoxicillin/Clavulanate',
        brand: 'Augmentin',
        route: 'PO/IV',
        commonDose: '625mg PO TDS or 1.2g IV TDS',
        indication: 'Community-acquired pneumonia, UTI, skin/soft tissue',
        warnings: ['Hepatotoxicity risk', 'C. difficile risk']
      },
      {
        name: 'Piperacillin/Tazobactam',
        brand: 'Tazocin',
        route: 'IV',
        commonDose: '4.5g IV Q6-8H',
        indication: 'Broad-spectrum: intra-abdominal, HAP, febrile neutropenia',
        warnings: ['Renal dose adjustment', 'Sodium load']
      },
      {
        name: 'Ceftriaxone',
        brand: 'Rocephin',
        route: 'IV/IM',
        commonDose: '1-2g IV OD',
        indication: 'Meningitis, pneumonia, UTI, gonorrhea',
        warnings: ['Do not mix with calcium-containing IV fluids']
      },
      {
        name: 'Vancomycin',
        brand: 'Vancocin',
        route: 'IV',
        commonDose: '15-20mg/kg IV Q8-12H (target trough)',
        indication: 'MRSA infections, C. difficile (PO)',
        warnings: ['Monitor trough levels', 'Red man syndrome', 'Nephrotoxicity']
      },
      {
        name: 'Meropenem',
        brand: 'Merrem',
        route: 'IV',
        commonDose: '1g IV Q8H (2g for meningitis)',
        indication: 'Severe sepsis, multi-drug resistant organisms',
        warnings: ['Seizure risk', 'Renal dose adjustment']
      },
      {
        name: 'Metronidazole',
        brand: 'Flagyl',
        route: 'PO/IV',
        commonDose: '500mg PO/IV TDS',
        indication: 'Anaerobic infections, C. difficile, H. pylori',
        warnings: ['Disulfiram-like reaction with alcohol', 'Peripheral neuropathy']
      }
    ],

    cardiovascular: [
      {
        name: 'Metoprolol',
        brand: 'Lopressor',
        route: 'PO/IV',
        commonDose: '25-100mg PO BD; 5mg IV (acute)',
        indication: 'Hypertension, heart failure, rate control in AF',
        warnings: ['Bradycardia', 'Bronchospasm', 'Do not stop abruptly']
      },
      {
        name: 'Amlodipine',
        brand: 'Norvasc',
        route: 'PO',
        commonDose: '5-10mg PO OD',
        indication: 'Hypertension, angina',
        warnings: ['Peripheral edema', 'Hepatic dose adjustment']
      },
      {
        name: 'Furosemide',
        brand: 'Lasix',
        route: 'PO/IV',
        commonDose: '20-80mg PO/IV (titrate to response)',
        indication: 'Edema, heart failure, acute pulmonary edema',
        warnings: ['Electrolyte monitoring (K+, Na+, Mg2+)', 'Ototoxicity']
      }
    ],

    analgesics: [
      {
        name: 'Paracetamol (Acetaminophen)',
        brand: 'Tylenol/Panadol',
        route: 'PO/IV/PR',
        commonDose: '1g PO/IV Q6H (max 4g/day)',
        indication: 'Pain, fever',
        warnings: ['Hepatotoxicity if >4g/day', 'Reduce dose in liver disease']
      },
      {
        name: 'Morphine',
        brand: 'MS Contin',
        route: 'PO/IV/SC',
        commonDose: '2.5-10mg IV PRN Q4H; 10-30mg PO Q4H',
        indication: 'Severe pain, acute MI, pulmonary edema',
        warnings: ['Respiratory depression', 'Constipation', 'Renal adjustment']
      },
      {
        name: 'Ibuprofen',
        brand: 'Advil/Nurofen',
        route: 'PO',
        commonDose: '400-600mg PO TDS with food',
        indication: 'Pain, inflammation, fever',
        warnings: ['GI bleeding', 'Renal impairment', 'CV risk']
      }
    ],

    anticoagulants: [
      {
        name: 'Enoxaparin',
        brand: 'Clexane/Lovenox',
        route: 'SC',
        commonDose: 'Prophylaxis: 40mg SC OD; Treatment: 1mg/kg SC BD',
        indication: 'DVT/PE prophylaxis and treatment',
        warnings: ['Monitor anti-Xa if renal impairment', 'Adjust for weight/CrCl']
      },
      {
        name: 'Heparin (Unfractionated)',
        brand: 'Heparin',
        route: 'IV/SC',
        commonDose: 'Per protocol (bolus + infusion, target aPTT)',
        indication: 'VTE treatment, ACS, bridge therapy',
        warnings: ['HIT risk', 'Monitor aPTT', 'Protamine for reversal']
      },
      {
        name: 'Warfarin',
        brand: 'Coumadin',
        route: 'PO',
        commonDose: 'Variable - target INR 2-3 (2.5-3.5 for mechanical valve)',
        indication: 'AF, mechanical valve, VTE',
        warnings: ['Numerous drug interactions', 'Monitor INR', 'Vitamin K for reversal']
      }
    ],

    diabetes: [
      {
        name: 'Insulin (Regular)',
        brand: 'Actrapid/Humulin R',
        route: 'IV/SC',
        commonDose: 'Per sliding scale or infusion protocol',
        indication: 'Hyperglycemia, DKA',
        warnings: ['Hypoglycemia', 'Monitor potassium']
      },
      {
        name: 'Metformin',
        brand: 'Glucophage',
        route: 'PO',
        commonDose: '500-1000mg PO BD',
        indication: 'Type 2 diabetes',
        warnings: ['Hold if eGFR <30', 'Hold before contrast', 'Lactic acidosis risk']
      }
    ],

    electrolytes: [
      {
        name: 'Potassium Chloride',
        brand: 'KCl',
        route: 'PO/IV',
        commonDose: 'PO: 20-40 mEq; IV: 10-20 mEq/hr (max 40 mEq/hr via central)',
        indication: 'Hypokalemia',
        warnings: ['Cardiac monitoring if IV >10 mEq/hr', 'Check Mg2+ concurrently']
      },
      {
        name: 'Magnesium Sulfate',
        brand: 'MgSO4',
        route: 'IV',
        commonDose: '2g IV over 1 hour (replacement)',
        indication: 'Hypomagnesemia, eclampsia, torsades',
        warnings: ['Monitor reflexes', 'Renal dose adjustment']
      }
    ]
  },

  /**
   * Get drugs by category
   */
  getByCategory(category) {
    return this.drugs[category] || [];
  },

  /**
   * Search drugs by name
   */
  search(query) {
    if (!query) return [];
    const q = query.toLowerCase();
    const results = [];

    for (const [category, drugs] of Object.entries(this.drugs)) {
      for (const drug of drugs) {
        if (drug.name.toLowerCase().includes(q) ||
            drug.brand.toLowerCase().includes(q) ||
            drug.indication.toLowerCase().includes(q)) {
          results.push({ ...drug, category });
        }
      }
    }

    return results;
  }
};
