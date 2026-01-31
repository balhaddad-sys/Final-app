/**
 * Clinical Typeahead System for MedWard Pro
 * Provides autocomplete suggestions for clinical tasks
 */

const ClinicalTypeahead = (function() {

  // Clinical Tasks Database
  const CLINICAL_TASKS = [
    // LABS (🧪)
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

    // IMAGING (📷)
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

    // CONSULTS (👨‍⚕️)
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

    // ADMIN (📝)
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

    // PROCEDURES (🏥)
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

    // MONITORING (📊)
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

  // Icon mapping for task types
  const TYPE_ICONS = {
    lab: "🧪",
    img: "📷",
    cons: "👨‍⚕️",
    admin: "📝",
    proc: "🏥",
    mon: "📊"
  };

  // Type labels for display
  const TYPE_LABELS = {
    lab: "Lab",
    img: "Imaging",
    cons: "Consult",
    admin: "Admin",
    proc: "Procedure",
    mon: "Monitoring"
  };

  let activeInput = null;
  let selectedIndex = -1;
  let currentSuggestions = [];

  /**
   * Filter tasks based on query
   */
  function filterTasks(query) {
    if (!query || query.length < 1) return [];

    const q = query.toLowerCase().trim();
    return CLINICAL_TASKS.filter(task =>
      task.label.toLowerCase().includes(q) ||
      task.value.toLowerCase().includes(q) ||
      task.keywords.includes(q)
    ).slice(0, 8);
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
    dropdown.style.display = 'none';
    document.body.appendChild(dropdown);

    return dropdown;
  }

  /**
   * Show suggestions for the given input
   */
  function showSuggestions(input, query) {
    const suggestions = filterTasks(query);
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
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
    dropdown.style.display = 'block';

    // Render suggestions
    dropdown.innerHTML = suggestions.map((task, index) => `
      <div class="clinical-typeahead-item" data-index="${index}" data-value="${task.value}">
        <span class="clinical-typeahead-icon">${TYPE_ICONS[task.type]}</span>
        <span class="clinical-typeahead-label">${task.label}</span>
        <span class="clinical-typeahead-type">${TYPE_LABELS[task.type]}</span>
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

    // Watch for task modal being opened
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            const taskText = node.querySelector ? node.querySelector('#taskText') : null;
            if (taskText) {
              attach(taskText);
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
    CLINICAL_TASKS: CLINICAL_TASKS,
    TYPE_ICONS: TYPE_ICONS
  };

})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ClinicalTypeahead.init);
} else {
  ClinicalTypeahead.init();
}
