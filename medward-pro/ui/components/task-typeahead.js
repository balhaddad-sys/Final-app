/**
 * Clinical Task Typeahead
 * Fuzzy search with category filtering and keyboard navigation
 */
import { getAllTasks, getCategories } from '../../data/clinical-tasks.js';
import { EventBus } from '../../core/events.js';

const MAX_SUGGESTIONS = 8;

export class TaskTypeahead {
  constructor(inputElement, options = {}) {
    this.input = inputElement;
    this.options = {
      onSelect: options.onSelect || (() => {}),
      showCategories: options.showCategories !== false,
      placeholder: options.placeholder || 'Add task...'
    };

    this.allTasks = getAllTasks();
    this.filteredTasks = [];
    this.selectedIndex = -1;
    this.activeCategory = null;

    this._createDOM();
    this._bindEvents();
  }

  _createDOM() {
    // Wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'typeahead-wrapper';
    this.input.parentNode.insertBefore(this.wrapper, this.input);
    this.wrapper.appendChild(this.input);

    // Category chips
    if (this.options.showCategories) {
      this.categoryBar = document.createElement('div');
      this.categoryBar.className = 'typeahead-categories';
      this.categoryBar.innerHTML = `
        <button class="chip chip-sm chip-active" data-category="">All</button>
        ${getCategories().map(cat => `
          <button class="chip chip-sm" data-category="${cat}">
            ${this._formatCategory(cat)}
          </button>
        `).join('')}
      `;
      this.wrapper.appendChild(this.categoryBar);
    }

    // Dropdown
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'typeahead-dropdown';
    this.dropdown.setAttribute('role', 'listbox');
    this.wrapper.appendChild(this.dropdown);

    // Set input attributes
    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.placeholder = this.options.placeholder;
  }

  _bindEvents() {
    // Input events
    this.input.addEventListener('input', () => this._onInput());
    this.input.addEventListener('focus', () => this._onFocus());
    this.input.addEventListener('blur', () => this._onBlur());
    this.input.addEventListener('keydown', (e) => this._onKeydown(e));

    // Category filter
    this.categoryBar?.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;

      // Update active state
      this.categoryBar.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');

      // Set filter
      this.activeCategory = chip.dataset.category || null;
      this._filter();
    });

    // Dropdown click
    this.dropdown.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur
      const item = e.target.closest('.typeahead-item');
      if (item) {
        this._selectItem(parseInt(item.dataset.index, 10));
      }
    });
  }

  _onInput() {
    this._filter();
    this._showDropdown();
  }

  _onFocus() {
    if (this.input.value || this.filteredTasks.length) {
      this._filter();
      this._showDropdown();
    }
  }

  _onBlur() {
    // Delay to allow click on dropdown
    setTimeout(() => this._hideDropdown(), 150);
  }

  _onKeydown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._moveSelection(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._moveSelection(-1);
        break;
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this._selectItem(this.selectedIndex);
        } else if (this.input.value.trim()) {
          // Allow custom task
          this._selectCustom();
        }
        break;
      case 'Escape':
        this._hideDropdown();
        this.input.blur();
        break;
      case 'Tab':
        if (this.selectedIndex >= 0) {
          e.preventDefault();
          this._selectItem(this.selectedIndex);
        }
        break;
    }
  }

  _filter() {
    const query = this.input.value.toLowerCase().trim();

    let tasks = this.allTasks;

    // Category filter
    if (this.activeCategory) {
      tasks = tasks.filter(t => t.category === this.activeCategory);
    }

    // Text filter
    if (query) {
      tasks = tasks.filter(task => {
        const textMatch = task.text.toLowerCase().includes(query);
        const keywordMatch = task.keywords?.some(k => k.toLowerCase().includes(query));
        return textMatch || keywordMatch;
      });

      // Sort by relevance (exact match first, then starts with, then contains)
      tasks.sort((a, b) => {
        const aText = a.text.toLowerCase();
        const bText = b.text.toLowerCase();

        const aExact = aText === query;
        const bExact = bText === query;
        if (aExact !== bExact) return aExact ? -1 : 1;

        const aStarts = aText.startsWith(query);
        const bStarts = bText.startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;

        return 0;
      });
    }

    this.filteredTasks = tasks.slice(0, MAX_SUGGESTIONS);
    this.selectedIndex = -1;
    this._renderDropdown();
  }

  _renderDropdown() {
    if (this.filteredTasks.length === 0) {
      this.dropdown.innerHTML = `
        <div class="typeahead-empty">
          ${this.input.value ? 'No matching tasks' : 'Start typing or select a category'}
        </div>
      `;
      return;
    }

    this.dropdown.innerHTML = this.filteredTasks.map((task, i) => `
      <div
        class="typeahead-item ${i === this.selectedIndex ? 'selected' : ''} ${task.urgent ? 'urgent' : ''}"
        data-index="${i}"
        role="option"
        aria-selected="${i === this.selectedIndex}"
      >
        <span class="typeahead-item-text">${this._highlight(task.text, this.input.value)}</span>
        <span class="typeahead-item-category">${this._formatCategory(task.category)}</span>
        ${task.urgent ? '<span class="badge badge-danger" style="margin-left: auto;">Urgent</span>' : ''}
      </div>
    `).join('');
  }

  _highlight(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${this._escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _formatCategory(category) {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  _moveSelection(delta) {
    const max = this.filteredTasks.length - 1;
    this.selectedIndex = Math.max(-1, Math.min(max, this.selectedIndex + delta));
    this._renderDropdown();

    // Scroll into view
    const selected = this.dropdown.querySelector('.typeahead-item.selected');
    selected?.scrollIntoView({ block: 'nearest' });
  }

  _selectItem(index) {
    const task = this.filteredTasks[index];
    if (!task) return;

    this.input.value = '';
    this._hideDropdown();
    this.options.onSelect({
      text: task.text,
      category: task.category,
      taskId: task.id,
      urgent: task.urgent || false
    });
  }

  _selectCustom() {
    const text = this.input.value.trim();
    if (!text) return;

    this.input.value = '';
    this._hideDropdown();
    this.options.onSelect({
      text,
      category: this.activeCategory || 'general',
      taskId: null,
      urgent: false
    });
  }

  _showDropdown() {
    this.dropdown.classList.add('visible');
  }

  _hideDropdown() {
    this.dropdown.classList.remove('visible');
    this.selectedIndex = -1;
  }

  destroy() {
    this.wrapper.parentNode.insertBefore(this.input, this.wrapper);
    this.wrapper.remove();
  }
}

// Initialize on inputs with data-typeahead="task"
export function initTaskTypeaheads() {
  document.querySelectorAll('input[data-typeahead="task"]').forEach(input => {
    new TaskTypeahead(input, {
      onSelect: (task) => {
        EventBus.emit('task:typeahead-selected', task);
      }
    });
  });
}
