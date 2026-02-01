/**
 * Clinical Typeahead System for MedWard Pro
 * Provides autocomplete suggestions for clinical tasks
 * Uses professional SVG icons
 */

const ClinicalTypeahead = (function() {

  // SVG Icons for each task type
  const SVG_ICONS = {
    lab: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="typeahead-svg"><path d="M9 3h6v2H9zM10 5v4l-4 8a2 2 0 002 2h8a2 2 0 002-2l-4-8V5"/><path d="M8.5 14h7"/></svg>`,
    img: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="typeahead-svg"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
    cons: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="typeahead-svg"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="typeahead-svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>`,
    proc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="typeahead-svg"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
    mon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="typeahead-svg"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`
  };

  // Clinical Tasks Database
  const CLINICAL_TASKS = [
    // LABS
    { label: "CBC (Complete Blood Count)", value: "CBC", type: "lab", keywords: "blood hemoglobin white cells cbc" },
    { label: "U&E (Urea & Electrolytes)", value: "U&E", type: "lab", keywords: "kidney renal potassium sodium uae" },
    { label: "LFT (Liver Function Tests)", value: "LFT", type: "lab", keywords: "liver enzymes alt ast lft" },
    { label: "Coagulation Profile (PT/APTT)", value: "Coag", type: "lab", keywords: "inr blood thinners coag pt aptt" },
    { label: "Blood Cultures x2", value: "Blood Cx", type: "lab", keywords: "sepsis infection fever bc" },
    { label: "Troponin", value: "Trop", type: "lab", keywords: "heart attack mi cardiac trop" },
    { label: "ABG (Arterial Blood Gas)", value: "ABG", type: "lab", keywords: "oxygen acid base abg" },
    { label: "HbA1c", value: "HbA1c", type: "lab", keywords: "diabetes sugar glucose" },
    { label: "Lipid Panel", value: "Lipids", type: "lab", keywords: "cholesterol triglycerides ldl hdl" },
    { label: "TSH + Free T4", value: "TFTs", type: "lab", keywords: "thyroid tsh t4 tfts" },
    { label: "BNP/NT-proBNP", value: "BNP", type: "lab", keywords: "heart failure bnp" },
    { label: "D-Dimer", value: "D-Dimer", type: "lab", keywords: "clot pe dvt pulmonary embolism" },
    { label: "Lactate", value: "Lactate", type: "lab", keywords: "sepsis shock perfusion" },
    { label: "Ammonia Level", value: "Ammonia", type: "lab", keywords: "liver encephalopathy hepatic" },
    { label: "Blood Glucose", value: "BG", type: "lab", keywords: "sugar diabetes glucose" },
    { label: "Magnesium Level", value: "Mg", type: "lab", keywords: "electrolyte mag" },
    { label: "Phosphate Level", value: "PO4", type: "lab", keywords: "electrolyte phosphorus" },
    { label: "Calcium Level", value: "Ca", type: "lab", keywords: "electrolyte hypercalcemia" },
    { label: "Urine Analysis", value: "UA", type: "lab", keywords: "urine uti infection" },
    { label: "Urine Culture", value: "U/C", type: "lab", keywords: "urine uti culture" },
    { label: "CRP (C-Reactive Protein)", value: "CRP", type: "lab", keywords: "inflammation infection crp" },
    { label: "Procalcitonin", value: "PCT", type: "lab", keywords: "sepsis infection bacterial" },

    // IMAGING
    { label: "CXR (Chest X-Ray)", value: "CXR", type: "img", keywords: "chest xray lungs cxr" },
    { label: "CT Head", value: "CT Head", type: "img", keywords: "brain stroke neuro cth" },
    { label: "CT Abdomen/Pelvis", value: "CT AP", type: "img", keywords: "belly pain ctap" },
    { label: "CT Chest", value: "CT Chest", type: "img", keywords: "lungs pulmonary pe" },
    { label: "CT Angiogram (CTA)", value: "CTA", type: "img", keywords: "pe pulmonary embolism angio" },
    { label: "US Abdomen", value: "US Abdo", type: "img", keywords: "ultrasound gallbladder liver" },
    { label: "US Renal", value: "US Renal", type: "img", keywords: "kidney ultrasound hydronephrosis" },
    { label: "Echocardiogram (TTE)", value: "Echo", type: "img", keywords: "heart ultrasound tte echo" },
    { label: "MRI Brain", value: "MRI Brain", type: "img", keywords: "neuro stroke ms" },
    { label: "MRI Spine", value: "MRI Spine", type: "img", keywords: "back cord compression" },
    { label: "Doppler US (DVT)", value: "Doppler LE", type: "img", keywords: "dvt clot leg swelling" },
    { label: "Doppler US (Upper Limb)", value: "Doppler UE", type: "img", keywords: "arm clot swelling" },
    { label: "AXR (Abdominal X-Ray)", value: "AXR", type: "img", keywords: "abdomen obstruction bowel" },
    { label: "HIDA Scan", value: "HIDA", type: "img", keywords: "gallbladder cholecystitis" },
    { label: "V/Q Scan", value: "V/Q", type: "img", keywords: "pe pulmonary embolism lung" },

    // CONSULTS
    { label: "Consult Cardiology", value: "C/S Cardio", type: "cons", keywords: "heart cards" },
    { label: "Consult GI", value: "C/S GI", type: "cons", keywords: "gastro stomach gi" },
    { label: "Consult ID", value: "C/S ID", type: "cons", keywords: "infection antibiotics infectious" },
    { label: "Consult Neurology", value: "C/S Neuro", type: "cons", keywords: "brain stroke seizure" },
    { label: "Consult Surgery", value: "C/S Surg", type: "cons", keywords: "operation surgical" },
    { label: "Consult Radiology", value: "C/S Rads", type: "cons", keywords: "imaging read" },
    { label: "Consult Nephrology", value: "C/S Nephro", type: "cons", keywords: "kidney renal dialysis" },
    { label: "Consult Pulmonology", value: "C/S Pulm", type: "cons", keywords: "lungs respiratory" },
    { label: "Consult Endocrine", value: "C/S Endo", type: "cons", keywords: "diabetes thyroid hormones" },
    { label: "Consult Hematology", value: "C/S Heme", type: "cons", keywords: "blood cancer anemia" },
    { label: "Consult Oncology", value: "C/S Onc", type: "cons", keywords: "cancer tumor" },
    { label: "Consult Rheumatology", value: "C/S Rheum", type: "cons", keywords: "autoimmune arthritis" },
    { label: "Consult Psychiatry", value: "C/S Psych", type: "cons", keywords: "mental health depression" },
    { label: "Consult PT/OT", value: "C/S PT/OT", type: "cons", keywords: "physical therapy rehab" },
    { label: "Consult Palliative", value: "C/S Palliative", type: "cons", keywords: "comfort pain goals" },
    { label: "Consult Social Work", value: "C/S SW", type: "cons", keywords: "discharge placement" },
    { label: "Consult Nutrition", value: "C/S Nutrition", type: "cons", keywords: "diet feeding" },
    { label: "Consult Pharmacy", value: "C/S Pharm", type: "cons", keywords: "medications drugs" },

    // ADMIN
    { label: "Discharge Summary", value: "D/C Summary", type: "admin", keywords: "discharge home leave dc" },
    { label: "Sick Leave Note", value: "Sick Note", type: "admin", keywords: "work off" },
    { label: "Transfer Summary", value: "Transfer Note", type: "admin", keywords: "move unit icu" },
    { label: "Family Meeting", value: "Family Mtg", type: "admin", keywords: "discuss goals care" },
    { label: "Update PCP", value: "Call PCP", type: "admin", keywords: "primary care doctor" },
    { label: "Insurance Auth", value: "Prior Auth", type: "admin", keywords: "insurance authorization" },
    { label: "Goals of Care Discussion", value: "GOC", type: "admin", keywords: "code status goals" },
    { label: "Discharge Planning", value: "D/C Planning", type: "admin", keywords: "discharge home snf" },
    { label: "Update Family", value: "Update Family", type: "admin", keywords: "call family update" },
    { label: "Complete H&P", value: "H&P", type: "admin", keywords: "history physical admission" },
    { label: "Progress Note", value: "Progress Note", type: "admin", keywords: "daily note" },
    { label: "Procedure Note", value: "Procedure Note", type: "admin", keywords: "document procedure" },

    // PROCEDURES
    { label: "IV Access", value: "IV Access", type: "proc", keywords: "line peripheral" },
    { label: "Central Line", value: "Central Line", type: "proc", keywords: "cvc central venous" },
    { label: "Arterial Line", value: "A-Line", type: "proc", keywords: "arterial monitoring" },
    { label: "Foley Catheter", value: "Foley", type: "proc", keywords: "urinary catheter" },
    { label: "NG Tube", value: "NGT", type: "proc", keywords: "nasogastric feeding" },
    { label: "Lumbar Puncture", value: "LP", type: "proc", keywords: "spinal tap csf" },
    { label: "Paracentesis", value: "Para", type: "proc", keywords: "ascites fluid" },
    { label: "Thoracentesis", value: "Thora", type: "proc", keywords: "pleural effusion chest" },
    { label: "Intubation", value: "Intubate", type: "proc", keywords: "airway vent" },
    { label: "Chest Tube", value: "Chest Tube", type: "proc", keywords: "pneumothorax drain" },

    // MONITORING
    { label: "Telemetry", value: "Tele", type: "mon", keywords: "cardiac monitoring heart" },
    { label: "Neuro Checks Q1H", value: "Neuro Checks", type: "mon", keywords: "neurological stroke" },
    { label: "Strict I/O", value: "Strict I/O", type: "mon", keywords: "intake output fluids" },
    { label: "Daily Weights", value: "Daily Wt", type: "mon", keywords: "weight heart failure" },
    { label: "Blood Glucose Monitoring", value: "BG Monitoring", type: "mon", keywords: "sugar diabetes glucose" },
    { label: "Pulse Ox Continuous", value: "Cont SpO2", type: "mon", keywords: "oxygen saturation" },
    { label: "Vitals Q4H", value: "VS Q4H", type: "mon", keywords: "vitals signs" },
    { label: "Vitals Q2H", value: "VS Q2H", type: "mon", keywords: "vitals signs close" },
    { label: "Vitals Q1H", value: "VS Q1H", type: "mon", keywords: "vitals signs icu" },
    { label: "Fall Precautions", value: "Fall Precautions", type: "mon", keywords: "safety fall risk" }
  ];

  // Type labels for display
  const TYPE_LABELS = {
    lab: "Lab",
    img: "Imaging",
    cons: "Consult",
    admin: "Admin",
    proc: "Procedure",
    mon: "Monitoring"
  };

  // Type colors for badges
  const TYPE_COLORS = {
    lab: '#10b981',
    img: '#3b82f6',
    cons: '#8b5cf6',
    admin: '#64748b',
    proc: '#f59e0b',
    mon: '#ef4444'
  };

  let activeInput = null;
  let selectedIndex = -1;
  let currentSuggestions = [];
  let currentFilterType = null; // Type filter: null means all types

  // Map category chip values to task types
  const CATEGORY_TO_TYPE = {
    'labs': 'lab',
    'imaging': 'img',
    'consult': 'cons',
    'general': null,      // General shows all types
    'procedure': 'proc',
    'monitoring': 'mon',
    'admin': 'admin'
  };

  /**
   * Filter tasks based on query and optionally by type
   * @param {string} query - Search query
   * @param {string|null} type - Optional type filter (lab, img, cons, admin, proc, mon)
   */
  function filterTasks(query, type = null) {
    // Use provided type or current filter type
    const filterType = type !== undefined ? type : currentFilterType;

    // If no query but we have a type filter, show all of that type
    if ((!query || query.length < 1) && filterType) {
      return CLINICAL_TASKS.filter(task => task.type === filterType).slice(0, 8);
    }

    if (!query || query.length < 1) return [];

    const q = query.toLowerCase().trim();
    let results = CLINICAL_TASKS.filter(task =>
      task.label.toLowerCase().includes(q) ||
      task.value.toLowerCase().includes(q) ||
      task.keywords.includes(q)
    );

    // Apply type filter if set
    if (filterType) {
      results = results.filter(task => task.type === filterType);
    }

    return results.slice(0, 8);
  }

  /**
   * Set the current type filter
   * @param {string|null} type - Type to filter by, or null for all
   */
  function setTypeFilter(type) {
    currentFilterType = type;
    console.log('[Typeahead] Type filter set to:', type || 'all');
  }

  /**
   * Get the current type filter
   */
  function getTypeFilter() {
    return currentFilterType;
  }

  /**
   * Create suggestion dropdown HTML
   */
  function createDropdown() {
    const existing = document.getElementById('clinicalTypeaheadDropdown');
    if (existing) existing.remove();

    const dropdown = document.createElement('div');
    dropdown.id = 'clinicalTypeaheadDropdown';
    dropdown.className = 'clinical-typeahead-dropdown';
    dropdown.style.cssText = 'display:none;position:fixed;z-index:99999;';
    document.body.appendChild(dropdown);

    return dropdown;
  }

  /**
   * Show suggestions for the given input
   */
  function showSuggestions(input, query) {
    const suggestions = filterTasks(query, currentFilterType);
    currentSuggestions = suggestions;
    selectedIndex = -1;

    let dropdown = document.getElementById('clinicalTypeaheadDropdown');
    if (!dropdown) {
      dropdown = createDropdown();
    }

    if (suggestions.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    // Position dropdown below input
    const rect = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(suggestions.length * 52, 320);

    // Show above if not enough space below
    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      dropdown.style.top = (rect.top - dropdownHeight - 4) + 'px';
    } else {
      dropdown.style.top = (rect.bottom + 4) + 'px';
    }

    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = Math.max(rect.width, 300) + 'px';
    dropdown.style.display = 'block';

    // Render suggestions with SVG icons
    dropdown.innerHTML = suggestions.map((task, index) => `
      <div class="clinical-typeahead-item" data-index="${index}" data-value="${task.value}">
        <span class="clinical-typeahead-icon" style="color:${TYPE_COLORS[task.type]}">${SVG_ICONS[task.type]}</span>
        <span class="clinical-typeahead-label">${highlightMatch(task.label, query)}</span>
        <span class="clinical-typeahead-type" style="background:${TYPE_COLORS[task.type]}20;color:${TYPE_COLORS[task.type]}">${TYPE_LABELS[task.type]}</span>
      </div>
    `).join('');

    // Add click handlers
    dropdown.querySelectorAll('.clinical-typeahead-item').forEach(item => {
      item.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        selectSuggestion(parseInt(this.dataset.index));
      };
    });

    activeInput = input;
  }

  /**
   * Highlight matching text
   */
  function highlightMatch(text, query) {
    const q = query.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return text.slice(0, idx) + '<mark>' + text.slice(idx, idx + q.length) + '</mark>' + text.slice(idx + q.length);
  }

  /**
   * Hide the suggestions dropdown
   */
  function hideSuggestions() {
    const dropdown = document.getElementById('clinicalTypeaheadDropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
    selectedIndex = -1;
    currentSuggestions = [];
  }

  /**
   * Select a suggestion and insert into input
   */
  function selectSuggestion(index) {
    if (index < 0 || index >= currentSuggestions.length) return;

    const suggestion = currentSuggestions[index];
    if (activeInput && suggestion) {
      // Get current text and cursor position
      const currentText = activeInput.value;
      const cursorPos = activeInput.selectionStart;

      // Find the word being typed (from last space or start)
      let wordStart = cursorPos;
      while (wordStart > 0 && currentText[wordStart - 1] !== ' ' && currentText[wordStart - 1] !== '\n') {
        wordStart--;
      }

      // Replace the partial word with the suggestion value
      const before = currentText.substring(0, wordStart);
      const after = currentText.substring(cursorPos);
      activeInput.value = before + suggestion.value + (after.startsWith(' ') ? '' : ' ') + after.trimStart();

      // Set cursor position after the inserted text
      const newCursorPos = wordStart + suggestion.value.length + 1;
      activeInput.setSelectionRange(newCursorPos, newCursorPos);
      activeInput.focus();

      // Auto-select category based on task type
      autoSelectCategory(suggestion.type);
    }

    hideSuggestions();
  }

  /**
   * Auto-select the category chip based on task type
   */
  function autoSelectCategory(taskType) {
    const categoryMap = {
      'lab': 'labs',
      'img': 'imaging',
      'cons': 'consult',
      'admin': 'general',
      'proc': 'procedure',
      'mon': 'monitoring'
    };

    const category = categoryMap[taskType] || 'general';
    const categoryChips = document.querySelectorAll('#categoryChips .category-chip');

    categoryChips.forEach(chip => {
      chip.classList.remove('selected');
      if (chip.dataset.value === category) {
        chip.classList.add('selected');
      }
    });
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeydown(e) {
    const dropdown = document.getElementById('clinicalTypeaheadDropdown');
    if (!dropdown || dropdown.style.display === 'none') return;

    const items = dropdown.querySelectorAll('.clinical-typeahead-item');

    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        updateSelectedItem(items);
        break;

      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelectedItem(items);
        break;

      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          selectSuggestion(selectedIndex);
        }
        break;

      case 'Escape':
        hideSuggestions();
        break;

      case 'Tab':
        if (selectedIndex >= 0) {
          e.preventDefault();
          selectSuggestion(selectedIndex);
        } else {
          hideSuggestions();
        }
        break;
    }
  }

  /**
   * Update visual selection state
   */
  function updateSelectedItem(items) {
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  /**
   * Initialize typeahead on an input element
   */
  function attach(inputElement) {
    if (!inputElement) return;

    // Prevent double-attach
    if (inputElement.dataset.typeaheadAttached) return;
    inputElement.dataset.typeaheadAttached = 'true';

    // Input handler
    inputElement.addEventListener('input', function(e) {
      const cursorPos = this.selectionStart;
      const text = this.value;

      // Find the current word being typed
      let wordStart = cursorPos;
      while (wordStart > 0 && text[wordStart - 1] !== ' ' && text[wordStart - 1] !== '\n') {
        wordStart--;
      }

      const currentWord = text.substring(wordStart, cursorPos);

      if (currentWord.length >= 1) {
        showSuggestions(this, currentWord);
      } else {
        hideSuggestions();
      }
    });

    // Keyboard handler
    inputElement.addEventListener('keydown', handleKeydown);

    // Focus handler
    inputElement.addEventListener('focus', function() {
      activeInput = this;
    });

    // Blur handler (delay to allow click on dropdown)
    inputElement.addEventListener('blur', function() {
      setTimeout(hideSuggestions, 200);
    });
  }

  /**
   * Try to attach to taskText if it exists
   */
  function tryAttach() {
    const taskText = document.getElementById('taskText');
    if (taskText && !taskText.dataset.typeaheadAttached) {
      attach(taskText);
    }
  }

  /**
   * Attach click listeners to category chips for type filtering
   */
  function attachCategoryChipListeners() {
    const categoryChips = document.querySelectorAll('#categoryChips .category-chip');
    categoryChips.forEach(chip => {
      // Prevent duplicate listeners
      if (chip.dataset.typeaheadListener) return;
      chip.dataset.typeaheadListener = 'true';

      chip.addEventListener('click', function() {
        const categoryValue = this.dataset.value;
        const typeFilter = CATEGORY_TO_TYPE[categoryValue] || null;
        setTypeFilter(typeFilter);

        // If input is focused and has text, refresh suggestions with new filter
        const taskText = document.getElementById('taskText');
        if (taskText && document.activeElement === taskText) {
          const cursorPos = taskText.selectionStart;
          const text = taskText.value;

          // Find current word
          let wordStart = cursorPos;
          while (wordStart > 0 && text[wordStart - 1] !== ' ' && text[wordStart - 1] !== '\n') {
            wordStart--;
          }
          const currentWord = text.substring(wordStart, cursorPos);

          if (currentWord.length >= 1 || typeFilter) {
            showSuggestions(taskText, currentWord);
          }
        }
      });
    });
  }

  /**
   * Initialize the typeahead system for the task modal
   */
  function init() {
    // Create dropdown container
    createDropdown();

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      const dropdown = document.getElementById('clinicalTypeaheadDropdown');
      if (dropdown && !dropdown.contains(e.target) && e.target.id !== 'taskText') {
        hideSuggestions();
      }
    });

    // Fallback: attach on focus for taskText
    document.addEventListener('focusin', function(e) {
      if (e.target && e.target.id === 'taskText') {
        tryAttach();
        // Also attach category chip listeners when task modal opens
        setTimeout(attachCategoryChipListeners, 100);
      }
    });

    // Reset type filter when modal closes (detect when taskText is removed)
    document.addEventListener('focusout', function(e) {
      if (e.target && e.target.id === 'taskText') {
        // Small delay to check if modal is closing
        setTimeout(function() {
          if (!document.getElementById('taskText')) {
            setTypeFilter(null); // Reset filter when modal closes
          }
        }, 300);
      }
    });

    // Watch for task modal being opened
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            // Check if the node itself is taskText
            if (node.id === 'taskText') {
              attach(node);
              setTimeout(attachCategoryChipListeners, 100);
            }
            // Check if node contains taskText
            const taskText = node.querySelector ? node.querySelector('#taskText') : null;
            if (taskText) {
              attach(taskText);
              setTimeout(attachCategoryChipListeners, 100);
            }
            // Check if categoryChips were added
            const categoryChips = node.querySelector ? node.querySelector('#categoryChips') : null;
            if (categoryChips || node.id === 'categoryChips') {
              setTimeout(attachCategoryChipListeners, 100);
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Public API
  return {
    init: init,
    attach: attach,
    filterTasks: filterTasks,
    setTypeFilter: setTypeFilter,
    getTypeFilter: getTypeFilter,
    CLINICAL_TASKS: CLINICAL_TASKS,
    SVG_ICONS: SVG_ICONS,
    CATEGORY_TO_TYPE: CATEGORY_TO_TYPE
  };

})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ClinicalTypeahead.init);
} else {
  ClinicalTypeahead.init();
}
