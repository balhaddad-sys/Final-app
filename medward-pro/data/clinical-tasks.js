/**
 * Predefined Clinical Task Suggestions
 */
export const ClinicalTasks = {
  categories: [
    { id: 'labs', label: 'Labs', icon: '' },
    { id: 'imaging', label: 'Imaging', icon: '' },
    { id: 'consults', label: 'Consults', icon: '' },
    { id: 'meds', label: 'Medications', icon: '' },
    { id: 'procedures', label: 'Procedures', icon: '' },
    { id: 'admin', label: 'Administrative', icon: '' },
    { id: 'general', label: 'General', icon: '' }
  ],

  suggestions: {
    labs: [
      'Order CBC with differential',
      'Order BMP (Basic Metabolic Panel)',
      'Order CMP (Comprehensive Metabolic Panel)',
      'Order coagulation panel (PT/INR, PTT)',
      'Order blood cultures x2 sets',
      'Order urinalysis + culture',
      'Order troponin levels',
      'Order BNP/NT-proBNP',
      'Order thyroid function tests',
      'Order liver function tests',
      'Order lipid panel',
      'Order HbA1c',
      'Order lactate level',
      'Order ABG (arterial blood gas)',
      'Order type and screen',
      'Order serum drug levels',
      'Order cortisol level (AM)',
      'Follow up pending lab results'
    ],

    imaging: [
      'Order chest X-ray (PA/Lateral)',
      'Order portable chest X-ray',
      'Order abdominal X-ray (KUB)',
      'Order CT head without contrast',
      'Order CT chest with contrast',
      'Order CT abdomen/pelvis with contrast',
      'Order MRI brain with and without contrast',
      'Order ultrasound abdomen',
      'Order echocardiogram (TTE)',
      'Order Doppler ultrasound (lower extremity)',
      'Follow up pending imaging results',
      'Review imaging with radiology'
    ],

    consults: [
      'Consult cardiology',
      'Consult pulmonology',
      'Consult nephrology',
      'Consult GI (gastroenterology)',
      'Consult infectious disease',
      'Consult neurology',
      'Consult surgery',
      'Consult orthopedics',
      'Consult psychiatry',
      'Consult palliative care',
      'Consult social work',
      'Consult physical therapy',
      'Consult occupational therapy',
      'Consult dietitian/nutrition',
      'Consult pharmacy',
      'Follow up pending consult'
    ],

    meds: [
      'Review medication list',
      'Medication reconciliation',
      'Adjust antibiotic regimen',
      'Start DVT prophylaxis',
      'Review pain management plan',
      'Adjust insulin sliding scale',
      'Wean IV medications to PO',
      'Review anticoagulation dosing',
      'Hold medications pre-procedure',
      'Resume home medications'
    ],

    procedures: [
      'Consent for procedure',
      'Schedule central line placement',
      'Schedule lumbar puncture',
      'Schedule thoracentesis',
      'Schedule paracentesis',
      'Schedule arterial line placement',
      'Wound care / dressing change',
      'Remove Foley catheter',
      'Remove central line'
    ],

    admin: [
      'Update family / goals of care discussion',
      'Complete discharge summary',
      'Arrange follow-up appointment',
      'Submit prior authorization',
      'Complete insurance documentation',
      'Update code status / advance directive',
      'Coordinate with case management',
      'Arrange home health services',
      'DME order for discharge'
    ],

    general: [
      'Daily progress note',
      'Update handover notes',
      'Re-examine patient',
      'Review vitals trend',
      'Review I/O balance',
      'Discuss case with attending',
      'Family meeting',
      'Patient education',
      'Fall risk assessment',
      'Skin assessment / pressure injury prevention'
    ]
  },

  /**
   * Get suggestions by category
   */
  getSuggestions(category) {
    return this.suggestions[category] || this.suggestions.general;
  },

  /**
   * Search across all suggestions
   */
  search(query) {
    if (!query) return [];
    const q = query.toLowerCase();
    const results = [];

    for (const [category, tasks] of Object.entries(this.suggestions)) {
      for (const task of tasks) {
        if (task.toLowerCase().includes(q)) {
          results.push({ text: task, category });
        }
      }
    }

    return results;
  }
};
