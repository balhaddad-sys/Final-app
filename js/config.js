/**
 * MedWard Enterprise - Configuration
 * Version 2.0
 */

var MedWard = MedWard || {};

MedWard.CONFIG = {
  STORAGE_KEY: 'medward_enterprise_v2',
  ADMIN_PASSWORD: 'admin123',
  API_URL: 'https://script.google.com/macros/s/AKfycbwnPMayEKM6rHJB2qZ-DDECoVB4Kte1EcoBiea0pmcasfyAeW7RGeADiH5DMXGRJOSJ/exec',
  MAX_IMAGES: 5,
  MAX_IMAGE_SIZE: 4 * 1024 * 1024,
  IMAGE_QUALITY: 0.8,
  MAX_IMAGE_DIMENSION: 2000
};

MedWard.DEFAULT_UNITS = [
  { id: 'neuro', name: 'Neurology', icon: '🧠', desc: 'Stroke & Neuro Care', code: '1234', color: '#a855f7' },
  { id: 'cardio', name: 'Cardiology', icon: '❤️', desc: 'Cardiac Care', code: '5678', color: '#ef4444' },
  { id: 'icu', name: 'ICU', icon: '🏥', desc: 'Intensive Care', code: '9012', color: '#f97316' }
];

MedWard.REFERENCES = [
  { title: '🚨 Critical Labs', content: '<b>K:</b> <2.5 or >6.5 mEq/L<br><b>Na:</b> <120 or >160 mEq/L<br><b>Glucose:</b> <40 or >500 mg/dL<br><b>pH:</b> <7.2 or >7.6' },
  { title: '⚡ Hyperkalemia', content: '<b>Stabilize:</b> Ca gluconate 10mL IV<br><b>Shift:</b> Insulin 10U + D50, Albuterol<br><b>Remove:</b> Kayexalate, Lasix, HD' },
  { title: '❤️ ACS Protocol', content: '<b>MONA:</b> Morphine, O₂, Nitrates, Aspirin 325mg<br><b>STEMI:</b> PCI <90min or lytics<br><b>NSTEMI:</b> Anticoag + cath' },
  { title: '🧠 Stroke tPA', content: '<b>Window:</b> ≤4.5h from LKW<br><b>Dose:</b> 0.9 mg/kg (max 90mg)<br><b>BP goal:</b> <185/110 pre-tPA' },
  { title: '🦠 Sepsis Bundle', content: '<b>Hour-1:</b> Lactate, cultures, antibiotics<br><b>Fluids:</b> 30mL/kg if hypotensive<br><b>Pressors:</b> Norepi first line' },
  { title: '💊 Seizure Rx', content: '<b>1st:</b> Lorazepam 4mg IV<br><b>2nd:</b> Levetiracetam 60mg/kg<br><b>Refractory:</b> Propofol or midazolam gtt' },
  { title: '🫁 PE Treatment', content: '<b>Massive:</b> tPA 100mg over 2h<br><b>Submassive:</b> Anticoag ± lytics<br><b>Low-risk:</b> DOAC outpatient' },
  { title: '💧 DKA Protocol', content: '<b>Fluids:</b> NS 1-2L/h initially<br><b>Insulin:</b> 0.1 U/kg/h gtt<br><b>K:</b> Replace if <5.3' }
];
