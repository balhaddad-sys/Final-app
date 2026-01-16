/**
 * MedWard Clinical Data Parser
 * Intelligently detects and categorizes clinical information from free text
 */

const ClinicalParser = {

  // Medication database with categories
  medications: {
    antibiotics: {
      names: ['amoxicillin', 'augmentin', 'azithromycin', 'zithromax', 'ciprofloxacin', 'cipro',
              'levofloxacin', 'levaquin', 'metronidazole', 'flagyl', 'doxycycline', 'ceftriaxone',
              'rocephin', 'cefuroxime', 'zinacef', 'meropenem', 'vancomycin', 'piperacillin',
              'tazobactam', 'tazocin', 'amikacin', 'gentamicin', 'clindamycin', 'trimethoprim',
              'sulfamethoxazole', 'bactrim', 'nitrofurantoin', 'cephalexin', 'keflex', 'penicillin',
              'ampicillin', 'cefazolin', 'ceftazidime', 'cefepime', 'linezolid', 'colistin'],
      icon: '💊',
      color: '#ef4444'
    },
    cardiac: {
      names: ['aspirin', 'clopidogrel', 'plavix', 'ticagrelor', 'brilinta', 'warfarin', 'coumadin',
              'rivaroxaban', 'xarelto', 'apixaban', 'eliquis', 'dabigatran', 'pradaxa', 'heparin',
              'enoxaparin', 'lovenox', 'clexane', 'metoprolol', 'bisoprolol', 'carvedilol',
              'atenolol', 'propranolol', 'amlodipine', 'norvasc', 'nifedipine', 'diltiazem',
              'verapamil', 'lisinopril', 'enalapril', 'ramipril', 'losartan', 'valsartan',
              'irbesartan', 'telmisartan', 'spironolactone', 'furosemide', 'lasix', 'bumetanide',
              'hydrochlorothiazide', 'hctz', 'atorvastatin', 'lipitor', 'rosuvastatin', 'crestor',
              'simvastatin', 'pravastatin', 'digoxin', 'amiodarone', 'cordarone', 'isosorbide',
              'nitroglycerin', 'ntg', 'hydralazine', 'nitroprusside', 'dobutamine', 'dopamine',
              'norepinephrine', 'noradrenaline', 'epinephrine', 'adrenaline', 'milrinone'],
      icon: '❤️',
      color: '#f43f5e'
    },
    diabetes: {
      names: ['metformin', 'glucophage', 'gliclazide', 'glimepiride', 'glipizide', 'insulin',
              'lantus', 'levemir', 'tresiba', 'novolog', 'humalog', 'novorapid', 'actrapid',
              'nph', 'mixtard', 'sitagliptin', 'januvia', 'linagliptin', 'empagliflozin',
              'jardiance', 'dapagliflozin', 'forxiga', 'canagliflozin', 'liraglutide', 'ozempic',
              'semaglutide', 'dulaglutide', 'trulicity', 'pioglitazone', 'repaglinide'],
      icon: '🩸',
      color: '#8b5cf6'
    },
    gi: {
      names: ['omeprazole', 'prilosec', 'pantoprazole', 'protonix', 'esomeprazole', 'nexium',
              'lansoprazole', 'rabeprazole', 'ranitidine', 'famotidine', 'pepcid', 'sucralfate',
              'metoclopramide', 'reglan', 'ondansetron', 'zofran', 'domperidone', 'lactulose',
              'bisacodyl', 'senna', 'docusate', 'polyethylene glycol', 'miralax', 'loperamide',
              'mesalamine', 'sulfasalazine', 'infliximab', 'adalimumab'],
      icon: '🫁',
      color: '#f59e0b'
    },
    pain: {
      names: ['paracetamol', 'acetaminophen', 'tylenol', 'ibuprofen', 'advil', 'naproxen',
              'diclofenac', 'voltaren', 'ketorolac', 'toradol', 'celecoxib', 'celebrex',
              'tramadol', 'morphine', 'oxycodone', 'hydromorphone', 'fentanyl', 'codeine',
              'meperidine', 'demerol', 'gabapentin', 'pregabalin', 'lyrica', 'amitriptyline',
              'duloxetine', 'cymbalta', 'lidocaine', 'ketamine'],
      icon: '💉',
      color: '#10b981'
    },
    respiratory: {
      names: ['salbutamol', 'albuterol', 'ventolin', 'ipratropium', 'atrovent', 'tiotropium',
              'spiriva', 'formoterol', 'salmeterol', 'budesonide', 'pulmicort', 'fluticasone',
              'beclomethasone', 'montelukast', 'singulair', 'theophylline', 'aminophylline',
              'prednisone', 'prednisolone', 'methylprednisolone', 'solumedrol', 'dexamethasone',
              'hydrocortisone', 'acetylcysteine', 'mucomyst', 'guaifenesin', 'dextromethorphan'],
      icon: '🌬️',
      color: '#06b6d4'
    },
    neuro: {
      names: ['levetiracetam', 'keppra', 'phenytoin', 'dilantin', 'carbamazepine', 'tegretol',
              'valproate', 'depakote', 'lamotrigine', 'topiramate', 'lorazepam', 'ativan',
              'diazepam', 'valium', 'midazolam', 'versed', 'clonazepam', 'alprazolam',
              'haloperidol', 'haldol', 'risperidone', 'risperdal', 'quetiapine', 'seroquel',
              'olanzapine', 'zyprexa', 'aripiprazole', 'abilify', 'sertraline', 'zoloft',
              'escitalopram', 'lexapro', 'fluoxetine', 'prozac', 'paroxetine', 'venlafaxine',
              'effexor', 'mirtazapine', 'remeron', 'trazodone', 'bupropion', 'wellbutrin',
              'lithium', 'donepezil', 'aricept', 'memantine', 'levodopa', 'carbidopa',
              'pramipexole', 'ropinirole', 'propofol', 'ketamine', 'dexmedetomidine', 'precedex'],
      icon: '🧠',
      color: '#6366f1'
    },
    electrolytes: {
      names: ['potassium', 'kcl', 'magnesium', 'calcium', 'phosphate', 'sodium chloride',
              'normal saline', 'ns', 'd5w', 'dextrose', 'lactated ringer', 'lr', 'albumin',
              'bicarbonate', 'nahco3'],
      icon: '⚗️',
      color: '#0ea5e9'
    },
    other: {
      names: ['allopurinol', 'colchicine', 'hydroxychloroquine', 'azathioprine', 'mycophenolate',
              'tacrolimus', 'cyclosporine', 'levothyroxine', 'synthroid', 'methimazole',
              'propylthiouracil', 'ferrous', 'iron', 'folic acid', 'vitamin b12', 'vitamin d',
              'calcium carbonate', 'calcitriol', 'epoetin', 'filgrastim', 'ondansetron'],
      icon: '💊',
      color: '#64748b'
    }
  },

  // Lab categories
  labCategories: {
    cbc: {
      name: 'Complete Blood Count',
      shortName: 'CBC',
      tests: ['wbc', 'rbc', 'hemoglobin', 'hgb', 'hb', 'hematocrit', 'hct', 'platelets', 'plt',
              'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils', 'mcv',
              'mch', 'mchc', 'rdw', 'mpv'],
      icon: '🔬',
      color: '#ef4444'
    },
    metabolic: {
      name: 'Metabolic Panel',
      shortName: 'BMP/CMP',
      tests: ['sodium', 'na', 'potassium', 'k', 'chloride', 'cl', 'co2', 'bicarbonate', 'hco3',
              'bun', 'urea', 'creatinine', 'cr', 'glucose', 'calcium', 'ca', 'magnesium', 'mg',
              'phosphate', 'phosphorus', 'egfr', 'gfr', 'anion gap'],
      icon: '⚗️',
      color: '#8b5cf6'
    },
    lft: {
      name: 'Liver Function',
      shortName: 'LFTs',
      tests: ['alt', 'sgpt', 'ast', 'sgot', 'alp', 'alkaline phosphatase', 'ggt', 'bilirubin',
              'total bilirubin', 'direct bilirubin', 'albumin', 'total protein', 'globulin',
              'inr', 'pt', 'ptt', 'aptt'],
      icon: '🫀',
      color: '#f59e0b'
    },
    cardiac: {
      name: 'Cardiac Markers',
      shortName: 'Cardiac',
      tests: ['troponin', 'tni', 'tnt', 'bnp', 'nt-probnp', 'ck', 'cpk', 'ck-mb', 'ldh',
              'myoglobin'],
      icon: '❤️',
      color: '#f43f5e'
    },
    coag: {
      name: 'Coagulation',
      shortName: 'Coags',
      tests: ['pt', 'inr', 'ptt', 'aptt', 'fibrinogen', 'd-dimer', 'bleeding time'],
      icon: '🩸',
      color: '#dc2626'
    },
    thyroid: {
      name: 'Thyroid Function',
      shortName: 'TFTs',
      tests: ['tsh', 't3', 't4', 'free t3', 'ft3', 'free t4', 'ft4', 'thyroglobulin'],
      icon: '🦋',
      color: '#0ea5e9'
    },
    inflammatory: {
      name: 'Inflammatory Markers',
      shortName: 'Inflam',
      tests: ['crp', 'c-reactive protein', 'esr', 'sed rate', 'procalcitonin', 'pct',
              'ferritin', 'ldh', 'il-6', 'interleukin'],
      icon: '🔥',
      color: '#f97316'
    },
    abg: {
      name: 'Arterial Blood Gas',
      shortName: 'ABG',
      tests: ['ph', 'pco2', 'po2', 'hco3', 'base excess', 'be', 'sao2', 'lactate'],
      icon: '💨',
      color: '#06b6d4'
    },
    urinalysis: {
      name: 'Urinalysis',
      shortName: 'UA',
      tests: ['urine', 'wbc urine', 'rbc urine', 'bacteria', 'nitrite', 'leukocyte esterase',
              'protein urine', 'glucose urine', 'ketones', 'specific gravity', 'ph urine'],
      icon: '🧪',
      color: '#eab308'
    }
  },

  // Vital signs patterns
  vitalPatterns: {
    bp: /(?:bp|blood pressure)[:\s]*(\d{2,3})[\/\\](\d{2,3})/i,
    hr: /(?:hr|heart rate|pulse)[:\s]*(\d{2,3})/i,
    rr: /(?:rr|respiratory rate|resp)[:\s]*(\d{1,2})/i,
    temp: /(?:temp|temperature)[:\s]*(\d{2}(?:\.\d)?)/i,
    spo2: /(?:spo2|sao2|o2 sat|oxygen)[:\s]*(\d{2,3})%?/i,
    weight: /(?:weight|wt)[:\s]*(\d{2,3}(?:\.\d)?)\s*(?:kg)?/i,
    height: /(?:height|ht)[:\s]*(\d{2,3})\s*(?:cm)?/i
  },

  /**
   * Parse clinical text and extract structured data
   */
  parse(text) {
    if (!text) return null;

    const result = {
      medications: this.extractMedications(text),
      labs: this.extractLabs(text),
      vitals: this.extractVitals(text),
      diagnoses: this.extractDiagnoses(text),
      notes: this.extractNotes(text),
      rawText: text
    };

    // Calculate if we found anything useful
    result.hasData = (
      result.medications.length > 0 ||
      Object.keys(result.labs).length > 0 ||
      Object.keys(result.vitals).length > 0 ||
      result.diagnoses.length > 0
    );

    return result;
  },

  /**
   * Extract medications from text
   */
  extractMedications(text) {
    const found = [];
    const textLower = text.toLowerCase();
    const words = textLower.split(/[\s,;:\(\)\[\]\/]+/);

    for (const [category, data] of Object.entries(this.medications)) {
      for (const med of data.names) {
        // Check for medication name in text
        const medLower = med.toLowerCase();

        // Look for the medication with potential dosing info
        const regex = new RegExp(
          `\\b${this.escapeRegex(medLower)}\\b[\\s]*(\\d+(?:\\.\\d+)?\\s*(?:mg|g|mcg|units?|ml|iu))?(?:[\\s]*(?:od|bd|tds|qid|prn|daily|twice|once|q\\d+h?))?`,
          'gi'
        );

        const matches = text.match(regex);
        if (matches) {
          matches.forEach(match => {
            // Avoid duplicates
            if (!found.find(f => f.name.toLowerCase() === medLower)) {
              found.push({
                name: this.capitalize(med),
                category: category,
                categoryInfo: data,
                fullMatch: match.trim(),
                dose: this.extractDose(match)
              });
            }
          });
        }
      }
    }

    // Sort by category priority
    const priority = ['antibiotics', 'cardiac', 'diabetes', 'respiratory', 'pain', 'neuro', 'gi', 'electrolytes', 'other'];
    found.sort((a, b) => priority.indexOf(a.category) - priority.indexOf(b.category));

    return found;
  },

  /**
   * Extract lab values from text
   */
  extractLabs(text) {
    const found = {};
    const textLower = text.toLowerCase();

    for (const [category, data] of Object.entries(this.labCategories)) {
      const categoryLabs = [];

      for (const test of data.tests) {
        // Pattern: test name followed by value (with optional units)
        const patterns = [
          new RegExp(`\\b${this.escapeRegex(test)}[:\\s]+([\\d.]+)\\s*([a-zA-Z/%²³]*)?(?:\\s*[\\(\\[]?([HL]|high|low|normal|abnormal)[\\)\\]]?)?`, 'gi'),
          new RegExp(`\\b${this.escapeRegex(test)}[:\\s]*([\\d.]+)`, 'gi')
        ];

        for (const pattern of patterns) {
          const matches = [...text.matchAll(pattern)];
          matches.forEach(match => {
            const value = match[1];
            const unit = match[2] || '';
            const flag = match[3] || '';

            // Avoid duplicates
            if (!categoryLabs.find(l => l.name.toLowerCase() === test.toLowerCase())) {
              categoryLabs.push({
                name: this.formatLabName(test),
                value: value,
                unit: unit,
                flag: flag.toUpperCase(),
                status: this.interpretLabFlag(flag)
              });
            }
          });
        }
      }

      if (categoryLabs.length > 0) {
        found[category] = {
          ...data,
          results: categoryLabs
        };
      }
    }

    return found;
  },

  /**
   * Extract vital signs from text
   */
  extractVitals(text) {
    const vitals = {};

    for (const [key, pattern] of Object.entries(this.vitalPatterns)) {
      const match = text.match(pattern);
      if (match) {
        if (key === 'bp') {
          vitals.bp = {
            systolic: parseInt(match[1]),
            diastolic: parseInt(match[2]),
            display: `${match[1]}/${match[2]}`
          };
        } else {
          vitals[key] = {
            value: parseFloat(match[1]),
            display: match[1] + (key === 'temp' ? '°C' : key === 'spo2' ? '%' : '')
          };
        }
      }
    }

    return vitals;
  },

  /**
   * Extract diagnoses from text
   */
  extractDiagnoses(text) {
    const diagnoses = [];

    // Common diagnosis patterns
    const dxPatterns = [
      /(?:diagnosis|dx|assessment|impression)[:\s]+([^\n]+)/gi,
      /(?:admitted (?:for|with)|presenting with)[:\s]+([^\n]+)/gi
    ];

    for (const pattern of dxPatterns) {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        const dx = match[1].trim();
        if (dx && dx.length > 2 && !diagnoses.includes(dx)) {
          diagnoses.push(dx);
        }
      });
    }

    return diagnoses;
  },

  /**
   * Extract clinical notes/plans
   */
  extractNotes(text) {
    const notes = [];

    const notePatterns = [
      /(?:plan|management|recommendations?)[:\s]+([^\n]+(?:\n(?![A-Z]{2,}:)[^\n]+)*)/gi,
      /(?:note|comment)[:\s]+([^\n]+)/gi
    ];

    for (const pattern of notePatterns) {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        const note = match[1].trim();
        if (note && note.length > 5) {
          notes.push(note);
        }
      });
    }

    return notes;
  },

  // Helper functions
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  formatLabName(name) {
    const formatted = {
      'wbc': 'WBC', 'rbc': 'RBC', 'hgb': 'Hgb', 'hb': 'Hb', 'hct': 'Hct',
      'plt': 'Plt', 'mcv': 'MCV', 'mch': 'MCH', 'mchc': 'MCHC', 'rdw': 'RDW',
      'na': 'Na', 'k': 'K', 'cl': 'Cl', 'co2': 'CO2', 'bun': 'BUN',
      'cr': 'Cr', 'ca': 'Ca', 'mg': 'Mg', 'alt': 'ALT', 'ast': 'AST',
      'alp': 'ALP', 'ggt': 'GGT', 'inr': 'INR', 'pt': 'PT', 'ptt': 'PTT',
      'tsh': 'TSH', 'crp': 'CRP', 'esr': 'ESR', 'bnp': 'BNP', 'egfr': 'eGFR'
    };
    return formatted[name.toLowerCase()] || this.capitalize(name);
  },

  extractDose(text) {
    const doseMatch = text.match(/(\d+(?:\.\d+)?)\s*(mg|g|mcg|units?|ml|iu)/i);
    return doseMatch ? `${doseMatch[1]} ${doseMatch[2]}` : '';
  },

  interpretLabFlag(flag) {
    if (!flag) return 'normal';
    const f = flag.toLowerCase();
    if (f === 'h' || f.includes('high')) return 'high';
    if (f === 'l' || f.includes('low')) return 'low';
    if (f.includes('abnormal')) return 'abnormal';
    return 'normal';
  }
};

// Export
if (typeof window !== 'undefined') {
  window.ClinicalParser = ClinicalParser;
}
