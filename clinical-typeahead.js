/**
 * Clinical Typeahead System for MedWard Pro
 * Provides autocomplete suggestions for clinical tasks
 * Uses emoji icons for task types
 */

const ClinicalTypeahead = (function() {

  // Emoji Icons for each task type
  const TYPE_ICONS = {
    lab: "🧪",
    img: "📷",
    cons: "👨‍⚕️",
    admin: "📝"
  };

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

    // IMAGING (📷)
    { label: "CXR (Chest X-Ray)", value: "CXR", type: "img", keywords: "chest xray lungs cxr" },
    { label: "CT Head", value: "CT Head", type: "img", keywords: "brain stroke neuro cth" },
    { label: "CT Abdomen/Pelvis", value: "CT AP", type: "img", keywords: "belly pain ctap" },
    { label: "US Abdomen", value: "US Abdo", type: "img", keywords: "ultrasound gallbladder liver" },
    { label: "Echocardiogram (TTE)", value: "Echo", type: "img", keywords: "heart ultrasound tte echo" },
    { label: "MRI Brain", value: "MRI Brain", type: "img", keywords: "neuro stroke ms" },
    { label: "Doppler US (DVT)", value: "Doppler LE", type: "img", keywords: "dvt clot leg swelling" },

    // CONSULTS (👨‍⚕️)
    { label: "Consult Cardiology", value: "C/S Cardio", type: "cons", keywords: "heart cards" },
    { label: "Consult GI", value: "C/S GI", type: "cons", keywords: "gastro stomach gi" },
    { label: "Consult ID", value: "C/S ID", type: "cons", keywords: "infection antibiotics" },
    { label: "Consult Neurology", value: "C/S Neuro", type: "cons", keywords: "brain stroke seizure" },
    { label: "Consult Surgery", value: "C/S Surg", type: "cons", keywords: "operation surgical" },
    { label: "Consult Radiology", value: "C/S Rads", type: "cons", keywords: "imaging read" },

    // ADMIN (📝)
    { label: "Discharge Summary", value: "D/C Summary", type: "admin", keywords: "discharge home leave dc" },
    { label: "Sick Leave Note", value: "Sick Note", type: "admin", keywords: "work off" },
    { label: "Transfer Summary", value: "Transfer Note", type: "admin", keywords: "move unit icu" },
    { label: "Family Meeting", value: "Family Mtg", type: "admin", keywords: "discuss goals care" },
    { label: "Update PCP", value: "Call PCP", type: "admin", keywords: "primary care doctor" }
  ];

  // Type labels for display
  const TYPE_LABELS = {
    lab: "Lab",
    img: "Imaging",
    cons: "Consult",
    admin: "Admin"
  };

  // Type colors for badges
  const TYPE_COLORS = {
    lab: '#10b981',
    img: '#3b82f6',
    cons: '#8b5cf6',
    admin: '#64748b'
  };

  let activeInput = null;
  let selectedIndex = -1;
  let currentSuggestions = [];
  let currentFilterType = null;

  // Map category chip values to task types
  const CATEGORY_TO_TYPE = {
    'labs': 'lab',
    'imaging': 'img',
    'consult': 'cons',
    'general': null,
    'admin': 'admin'
  };

  /**
   * Filter tasks based on query and optionally by type
   * Matches against label, value, AND keywords
   */
  function filterTasks(query, type = null) {
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
   */
  function setTypeFilter(type) {
    currentFilterType = type;
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

    // Render suggestions with emoji icons
    dropdown.innerHTML = suggestions.map((task, index) => `
      <div class="clinical-typeahead-item" data-index="${index}" data-value="${task.value}">
        <span class="clinical-typeahead-icon">${TYPE_ICONS[task.type]}</span>
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
   * Select a suggestion and insert into input (inserts short form value)
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

      // Replace the partial word with the suggestion value (short form like "CBC")
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
      'admin': 'general'
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
   * Handle keyboard navigation (arrow keys + Enter)
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

    // Input handler - show suggestions when typing (min 1 char)
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

    // Keyboard handler for navigation
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

    // Reset type filter when modal closes
    document.addEventListener('focusout', function(e) {
      if (e.target && e.target.id === 'taskText') {
        setTimeout(function() {
          if (!document.getElementById('taskText')) {
            setTypeFilter(null);
          }
        }, 300);
      }
    });

    // Watch for task modal being opened
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            if (node.id === 'taskText') {
              attach(node);
              setTimeout(attachCategoryChipListeners, 100);
            }
            const taskText = node.querySelector ? node.querySelector('#taskText') : null;
            if (taskText) {
              attach(taskText);
              setTimeout(attachCategoryChipListeners, 100);
            }
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
    TYPE_ICONS: TYPE_ICONS,
    CATEGORY_TO_TYPE: CATEGORY_TO_TYPE
  };

})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ClinicalTypeahead.init);
} else {
  ClinicalTypeahead.init();
}
