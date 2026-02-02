// features/tasks/clinical-typeahead.js
// Clinical tasks database and typeahead functionality

import { Config } from '../../core/config.js';

const CLINICAL_TASKS = {
  labs: [
    { text: 'Order CBC', category: 'labs', priority: 'routine' },
    { text: 'Order BMP (Basic Metabolic Panel)', category: 'labs', priority: 'routine' },
    { text: 'Order CMP (Comprehensive Metabolic Panel)', category: 'labs', priority: 'routine' },
    { text: 'Order LFTs (Liver Function Tests)', category: 'labs', priority: 'routine' },
    { text: 'Order Coagulation Panel (PT/INR, PTT)', category: 'labs', priority: 'routine' },
    { text: 'Order Blood Cultures x2', category: 'labs', priority: 'urgent' },
    { text: 'Order Troponin', category: 'labs', priority: 'urgent' },
    { text: 'Order ABG', category: 'labs', priority: 'urgent' },
    { text: 'Order Lactate', category: 'labs', priority: 'urgent' },
    { text: 'Order HbA1c', category: 'labs', priority: 'routine' },
    { text: 'Order Lipid Panel', category: 'labs', priority: 'routine' },
    { text: 'Order TSH', category: 'labs', priority: 'routine' },
    { text: 'Order Free T4', category: 'labs', priority: 'routine' },
    { text: 'Order Urinalysis', category: 'labs', priority: 'routine' },
    { text: 'Order Urine Culture', category: 'labs', priority: 'routine' },
    { text: 'Order Type & Screen', category: 'labs', priority: 'routine' },
    { text: 'Order Type & Crossmatch', category: 'labs', priority: 'urgent' },
    { text: 'Order D-dimer', category: 'labs', priority: 'urgent' },
    { text: 'Order BNP/NT-proBNP', category: 'labs', priority: 'routine' },
    { text: 'Order Procalcitonin', category: 'labs', priority: 'routine' },
    { text: 'Order Magnesium', category: 'labs', priority: 'routine' },
    { text: 'Order Phosphate', category: 'labs', priority: 'routine' },
    { text: 'Order Calcium', category: 'labs', priority: 'routine' },
    { text: 'Order CRP', category: 'labs', priority: 'routine' },
    { text: 'Order ESR', category: 'labs', priority: 'routine' },
    { text: 'Order Ammonia', category: 'labs', priority: 'urgent' },
    { text: 'Order Cortisol (AM)', category: 'labs', priority: 'routine' },
    { text: 'Order Vitamin D', category: 'labs', priority: 'routine' },
    { text: 'Order B12 & Folate', category: 'labs', priority: 'routine' },
    { text: 'Order Iron Studies', category: 'labs', priority: 'routine' }
  ],

  imaging: [
    { text: 'Order CXR (Chest X-ray)', category: 'imaging', priority: 'routine' },
    { text: 'Order CXR Portable', category: 'imaging', priority: 'urgent' },
    { text: 'Order CT Head without contrast', category: 'imaging', priority: 'urgent' },
    { text: 'Order CT Head with contrast', category: 'imaging', priority: 'routine' },
    { text: 'Order CT Chest with contrast', category: 'imaging', priority: 'routine' },
    { text: 'Order CT Chest without contrast', category: 'imaging', priority: 'routine' },
    { text: 'Order CT Abdomen/Pelvis with contrast', category: 'imaging', priority: 'routine' },
    { text: 'Order CT Abdomen/Pelvis without contrast', category: 'imaging', priority: 'routine' },
    { text: 'Order CT Angiogram (CTA) Chest', category: 'imaging', priority: 'urgent' },
    { text: 'Order CT Angiogram (CTA) Head/Neck', category: 'imaging', priority: 'urgent' },
    { text: 'Order Ultrasound Abdomen', category: 'imaging', priority: 'routine' },
    { text: 'Order Ultrasound Doppler (DVT)', category: 'imaging', priority: 'urgent' },
    { text: 'Order Ultrasound Renal', category: 'imaging', priority: 'routine' },
    { text: 'Order Echocardiogram (TTE)', category: 'imaging', priority: 'routine' },
    { text: 'Order Echocardiogram (TEE)', category: 'imaging', priority: 'routine' },
    { text: 'Order MRI Brain', category: 'imaging', priority: 'routine' },
    { text: 'Order MRI Brain with contrast', category: 'imaging', priority: 'routine' },
    { text: 'Order MRI Spine', category: 'imaging', priority: 'routine' },
    { text: 'Order KUB (Abdominal X-ray)', category: 'imaging', priority: 'routine' },
    { text: 'Order V/Q Scan', category: 'imaging', priority: 'urgent' },
    { text: 'Order HIDA Scan', category: 'imaging', priority: 'routine' }
  ],

  consults: [
    { text: 'Consult Cardiology', category: 'consults', priority: 'routine' },
    { text: 'Consult Cardiology - Urgent', category: 'consults', priority: 'urgent' },
    { text: 'Consult GI (Gastroenterology)', category: 'consults', priority: 'routine' },
    { text: 'Consult GI - Urgent (GI bleed)', category: 'consults', priority: 'urgent' },
    { text: 'Consult ID (Infectious Disease)', category: 'consults', priority: 'routine' },
    { text: 'Consult Neurology', category: 'consults', priority: 'routine' },
    { text: 'Consult Neurology - Stroke Alert', category: 'consults', priority: 'urgent' },
    { text: 'Consult Nephrology', category: 'consults', priority: 'routine' },
    { text: 'Consult Nephrology - Dialysis', category: 'consults', priority: 'urgent' },
    { text: 'Consult Pulmonology', category: 'consults', priority: 'routine' },
    { text: 'Consult General Surgery', category: 'consults', priority: 'routine' },
    { text: 'Consult General Surgery - Urgent', category: 'consults', priority: 'urgent' },
    { text: 'Consult Orthopedics', category: 'consults', priority: 'routine' },
    { text: 'Consult Psychiatry', category: 'consults', priority: 'routine' },
    { text: 'Consult Physical Therapy', category: 'consults', priority: 'routine' },
    { text: 'Consult Occupational Therapy', category: 'consults', priority: 'routine' },
    { text: 'Consult Speech Therapy', category: 'consults', priority: 'routine' },
    { text: 'Consult Social Work', category: 'consults', priority: 'routine' },
    { text: 'Consult Palliative Care', category: 'consults', priority: 'routine' },
    { text: 'Consult Pain Management', category: 'consults', priority: 'routine' },
    { text: 'Consult Oncology', category: 'consults', priority: 'routine' },
    { text: 'Consult Hematology', category: 'consults', priority: 'routine' },
    { text: 'Consult Endocrinology', category: 'consults', priority: 'routine' },
    { text: 'Consult Rheumatology', category: 'consults', priority: 'routine' },
    { text: 'Consult Urology', category: 'consults', priority: 'routine' },
    { text: 'Consult Vascular Surgery', category: 'consults', priority: 'routine' },
    { text: 'Consult ICU', category: 'consults', priority: 'urgent' },
    { text: 'Consult Radiology for guided procedure', category: 'consults', priority: 'routine' },
    { text: 'Consult Nutrition/Dietitian', category: 'consults', priority: 'routine' },
    { text: 'Consult Pharmacy', category: 'consults', priority: 'routine' }
  ],

  admin: [
    { text: 'Write Discharge Summary', category: 'admin', priority: 'routine' },
    { text: 'Complete Sick Leave Certificate', category: 'admin', priority: 'routine' },
    { text: 'Arrange Transfer to ward', category: 'admin', priority: 'routine' },
    { text: 'Arrange Transfer to ICU', category: 'admin', priority: 'urgent' },
    { text: 'Schedule Family Meeting', category: 'admin', priority: 'routine' },
    { text: 'Update Primary Care Physician', category: 'admin', priority: 'routine' },
    { text: 'Order Home Health referral', category: 'admin', priority: 'routine' },
    { text: 'Complete DNR/Code Status discussion', category: 'admin', priority: 'urgent' },
    { text: 'Arrange outpatient follow-up', category: 'admin', priority: 'routine' },
    { text: 'Review and reconcile medications', category: 'admin', priority: 'routine' },
    { text: 'Complete death certificate', category: 'admin', priority: 'urgent' },
    { text: 'Request medical records', category: 'admin', priority: 'routine' },
    { text: 'Update insurance/prior authorization', category: 'admin', priority: 'routine' },
    { text: 'Complete disability paperwork', category: 'admin', priority: 'routine' },
    { text: 'Arrange SNF placement', category: 'admin', priority: 'routine' },
    { text: 'Arrange rehab placement', category: 'admin', priority: 'routine' },
    { text: 'Contact family/NOK', category: 'admin', priority: 'routine' },
    { text: 'Complete admission H&P', category: 'admin', priority: 'routine' },
    { text: 'Complete progress note', category: 'admin', priority: 'routine' },
    { text: 'Sign pending orders', category: 'admin', priority: 'routine' }
  ],

  procedures: [
    { text: 'Insert IV access', category: 'procedures', priority: 'routine' },
    { text: 'Insert Foley catheter', category: 'procedures', priority: 'routine' },
    { text: 'Insert NG tube', category: 'procedures', priority: 'routine' },
    { text: 'Perform Lumbar Puncture', category: 'procedures', priority: 'urgent' },
    { text: 'Perform Paracentesis', category: 'procedures', priority: 'routine' },
    { text: 'Perform Thoracentesis', category: 'procedures', priority: 'routine' },
    { text: 'Insert Central Line', category: 'procedures', priority: 'urgent' },
    { text: 'Insert Arterial Line', category: 'procedures', priority: 'urgent' },
    { text: 'Insert PICC Line', category: 'procedures', priority: 'routine' },
    { text: 'Perform ABG', category: 'procedures', priority: 'urgent' },
    { text: 'Perform EKG', category: 'procedures', priority: 'routine' },
    { text: 'Wound care/dressing change', category: 'procedures', priority: 'routine' },
    { text: 'Remove sutures/staples', category: 'procedures', priority: 'routine' },
    { text: 'I&D abscess', category: 'procedures', priority: 'routine' },
    { text: 'Joint aspiration', category: 'procedures', priority: 'routine' },
    { text: 'Intubation', category: 'procedures', priority: 'urgent' },
    { text: 'Chest tube insertion', category: 'procedures', priority: 'urgent' },
    { text: 'Remove chest tube', category: 'procedures', priority: 'routine' }
  ],

  medications: [
    { text: 'Start IV fluids (NS)', category: 'medications', priority: 'routine' },
    { text: 'Start IV fluids (LR)', category: 'medications', priority: 'routine' },
    { text: 'Fluid bolus', category: 'medications', priority: 'urgent' },
    { text: 'Start Heparin drip', category: 'medications', priority: 'urgent' },
    { text: 'Start Insulin drip', category: 'medications', priority: 'urgent' },
    { text: 'Start DVT prophylaxis', category: 'medications', priority: 'routine' },
    { text: 'Start PPI prophylaxis', category: 'medications', priority: 'routine' },
    { text: 'Start antibiotics', category: 'medications', priority: 'urgent' },
    { text: 'Adjust antibiotic dose', category: 'medications', priority: 'routine' },
    { text: 'Start pain management', category: 'medications', priority: 'routine' },
    { text: 'Start antiemetic', category: 'medications', priority: 'routine' },
    { text: 'Start laxative/bowel regimen', category: 'medications', priority: 'routine' },
    { text: 'Start blood transfusion', category: 'medications', priority: 'urgent' },
    { text: 'Give Vitamin K', category: 'medications', priority: 'urgent' },
    { text: 'Give Kayexalate', category: 'medications', priority: 'urgent' },
    { text: 'Start pressors', category: 'medications', priority: 'urgent' },
    { text: 'Adjust insulin regimen', category: 'medications', priority: 'routine' },
    { text: 'Medication reconciliation', category: 'medications', priority: 'routine' }
  ],

  monitoring: [
    { text: 'Continuous telemetry', category: 'monitoring', priority: 'routine' },
    { text: 'Strict I/Os', category: 'monitoring', priority: 'routine' },
    { text: 'Daily weights', category: 'monitoring', priority: 'routine' },
    { text: 'Neuro checks q1h', category: 'monitoring', priority: 'urgent' },
    { text: 'Blood glucose checks QID', category: 'monitoring', priority: 'routine' },
    { text: 'Vitals q4h', category: 'monitoring', priority: 'routine' },
    { text: 'Vitals q1h', category: 'monitoring', priority: 'urgent' },
    { text: 'Fall precautions', category: 'monitoring', priority: 'routine' },
    { text: 'Seizure precautions', category: 'monitoring', priority: 'routine' },
    { text: 'Aspiration precautions', category: 'monitoring', priority: 'routine' },
    { text: 'Suicide precautions', category: 'monitoring', priority: 'urgent' },
    { text: 'Contact isolation', category: 'monitoring', priority: 'routine' },
    { text: 'Droplet isolation', category: 'monitoring', priority: 'routine' },
    { text: 'Airborne isolation', category: 'monitoring', priority: 'routine' },
    { text: 'Wound check', category: 'monitoring', priority: 'routine' },
    { text: 'Drain output monitoring', category: 'monitoring', priority: 'routine' }
  ]
};

export class ClinicalTypeahead {
  constructor(inputElement, options = {}) {
    this.input = typeof inputElement === 'string'
      ? document.getElementById(inputElement)
      : inputElement;

    if (!this.input) {
      throw new Error('ClinicalTypeahead: input element not found');
    }

    this.container = null;
    this.selectedIndex = -1;
    this.currentFilter = options.filter || null;
    this.onSelect = options.onSelect || (() => {});
    this.maxResults = options.maxResults || Config.TYPEAHEAD_MAX_RESULTS;
    this.currentResults = [];

    this._setupDOM();
    this._attachListeners();
  }

  _setupDOM() {
    // Wrap input if needed
    const wrapper = this.input.parentElement;
    if (!wrapper.classList.contains('typeahead-wrapper')) {
      const newWrapper = document.createElement('div');
      newWrapper.className = 'typeahead-wrapper';
      this.input.parentElement.insertBefore(newWrapper, this.input);
      newWrapper.appendChild(this.input);
    }

    // Create dropdown container
    this.container = document.createElement('div');
    this.container.className = 'typeahead-dropdown';
    this.container.style.display = 'none';
    this.container.setAttribute('role', 'listbox');

    this.input.parentElement.appendChild(this.container);

    // ARIA attributes
    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.setAttribute('aria-expanded', 'false');
  }

  _attachListeners() {
    this.input.addEventListener('input', (e) => this._onInput(e));
    this.input.addEventListener('keydown', (e) => this._onKeydown(e));
    this.input.addEventListener('blur', () => {
      setTimeout(() => this.hide(), 150);
    });
    this.input.addEventListener('focus', (e) => {
      if (e.target.value.length >= Config.TYPEAHEAD_MIN_CHARS) {
        this._onInput(e);
      }
    });
  }

  _onInput(e) {
    const query = e.target.value.toLowerCase().trim();

    if (query.length < Config.TYPEAHEAD_MIN_CHARS) {
      this.hide();
      return;
    }

    const results = this._search(query);
    this.currentResults = results;
    this._render(results);
  }

  _onKeydown(e) {
    if (!this.container.children.length || this.container.style.display === 'none') return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._navigate(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._navigate(-1);
        break;
      case 'Enter':
        e.preventDefault();
        this._selectCurrent();
        break;
      case 'Escape':
        this.hide();
        break;
      case 'Tab':
        if (this.selectedIndex >= 0) {
          e.preventDefault();
          this._selectCurrent();
        }
        break;
    }
  }

  _search(query) {
    const allTasks = Object.values(CLINICAL_TASKS).flat();

    let filtered = allTasks;

    // Apply category filter
    if (this.currentFilter) {
      filtered = filtered.filter(t => t.category === this.currentFilter);
    }

    // Search by text
    const results = filtered.filter(task =>
      task.text.toLowerCase().includes(query)
    );

    // Sort: exact matches first, then by priority
    results.sort((a, b) => {
      const aExact = a.text.toLowerCase().startsWith(query) ? 0 : 1;
      const bExact = b.text.toLowerCase().startsWith(query) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;

      const priorityOrder = { urgent: 0, routine: 1 };
      return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
    });

    return results.slice(0, this.maxResults);
  }

  _render(results) {
    if (!results.length) {
      this.hide();
      return;
    }

    this.selectedIndex = -1;

    this.container.innerHTML = results.map((task, i) => `
      <div class="typeahead-item" data-index="${i}" role="option" aria-selected="false">
        <span class="typeahead-category ${task.category}">${task.category}</span>
        <span class="typeahead-text">${this._highlightMatch(task.text, this.input.value)}</span>
        ${task.priority === 'urgent' ? '<span class="typeahead-urgent" title="Urgent">!</span>' : ''}
      </div>
    `).join('');

    // Click handlers
    this.container.querySelectorAll('.typeahead-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        this._select(results[idx]);
      });

      item.addEventListener('mouseenter', () => {
        this._clearSelection();
        item.classList.add('selected');
        item.setAttribute('aria-selected', 'true');
        this.selectedIndex = parseInt(item.dataset.index);
      });
    });

    this.container.style.display = 'block';
    this.input.setAttribute('aria-expanded', 'true');
  }

  _highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${this._escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  _escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _navigate(direction) {
    const items = this.container.querySelectorAll('.typeahead-item');
    if (!items.length) return;

    // Remove previous selection
    this._clearSelection();

    // Update index
    this.selectedIndex += direction;
    if (this.selectedIndex < 0) this.selectedIndex = items.length - 1;
    if (this.selectedIndex >= items.length) this.selectedIndex = 0;

    // Add new selection
    items[this.selectedIndex].classList.add('selected');
    items[this.selectedIndex].setAttribute('aria-selected', 'true');
    items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
  }

  _clearSelection() {
    this.container.querySelectorAll('.typeahead-item').forEach(item => {
      item.classList.remove('selected');
      item.setAttribute('aria-selected', 'false');
    });
  }

  _selectCurrent() {
    if (this.selectedIndex >= 0 && this.currentResults[this.selectedIndex]) {
      this._select(this.currentResults[this.selectedIndex]);
    }
  }

  _select(task) {
    this.input.value = task.text;
    this.hide();
    this.onSelect(task);
  }

  setFilter(category) {
    this.currentFilter = category;
  }

  clearFilter() {
    this.currentFilter = null;
  }

  hide() {
    this.container.style.display = 'none';
    this.selectedIndex = -1;
    this.currentResults = [];
    this.input.setAttribute('aria-expanded', 'false');
  }

  show() {
    if (this.input.value.length >= Config.TYPEAHEAD_MIN_CHARS) {
      const results = this._search(this.input.value.toLowerCase().trim());
      this.currentResults = results;
      this._render(results);
    }
  }

  destroy() {
    this.container.remove();
    this.input.removeAttribute('role');
    this.input.removeAttribute('aria-autocomplete');
    this.input.removeAttribute('aria-expanded');
  }

  // Static method to get all categories
  static getCategories() {
    return Object.keys(CLINICAL_TASKS);
  }

  // Static method to get all tasks
  static getAllTasks() {
    return Object.values(CLINICAL_TASKS).flat();
  }

  // Static method to get tasks by category
  static getTasksByCategory(category) {
    return CLINICAL_TASKS[category] || [];
  }
}
