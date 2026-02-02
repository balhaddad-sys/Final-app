// ui/list-renderer.js
// Efficient DOM updates with keyed rendering (no full re-renders)

import { Config } from '../core/config.js';

export class KeyedListRenderer {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    if (!this.container) {
      throw new Error('KeyedListRenderer: container not found');
    }

    this.itemMap = new Map(); // id -> DOM element
    this.renderItem = options.renderItem || ((item) => `<div>${JSON.stringify(item)}</div>`);
    this.getKey = options.getKey || (item => item.id);
    this.onClick = options.onClick;
    this.onLongPress = options.onLongPress;
    this.onDoubleClick = options.onDoubleClick;
    this.emptyMessage = options.emptyMessage || 'No items';
    this.emptyIcon = options.emptyIcon || '';
    this.itemClass = options.itemClass || 'list-item';
    this.animateChanges = options.animateChanges !== false;
  }

  render(items) {
    if (!Array.isArray(items)) {
      console.warn('KeyedListRenderer: items must be an array');
      return;
    }

    const existingIds = new Set(this.itemMap.keys());
    const newIds = new Set(items.map(this.getKey));

    // REMOVE items no longer in list
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        const el = this.itemMap.get(id);
        if (this.animateChanges) {
          el.classList.add('list-item-removing');
          setTimeout(() => {
            el.remove();
          }, 200);
        } else {
          el.remove();
        }
        this.itemMap.delete(id);
      }
    }

    // UPDATE or ADD items
    items.forEach((item, index) => {
      const id = this.getKey(item);
      let el = this.itemMap.get(id);

      if (el) {
        // UPDATE existing element
        this._updateElement(el, item);
      } else {
        // CREATE new element
        el = this._createElement(item);
        this.itemMap.set(id, el);

        if (this.animateChanges) {
          el.classList.add('list-item-entering');
          requestAnimationFrame(() => {
            el.classList.remove('list-item-entering');
          });
        }
      }

      // Ensure correct order
      const currentIndex = Array.from(this.container.children).indexOf(el);
      if (currentIndex !== index) {
        if (index === 0) {
          this.container.prepend(el);
        } else {
          const prevItem = items[index - 1];
          const prevEl = this.itemMap.get(this.getKey(prevItem));
          if (prevEl) {
            prevEl.after(el);
          }
        }
      }
    });

    // Show empty state if needed
    this._handleEmptyState(items.length === 0);
  }

  _createElement(item) {
    const el = document.createElement('div');
    el.className = this.itemClass;
    el.dataset.id = this.getKey(item);

    el.innerHTML = this.renderItem(item);

    // Click handler
    if (this.onClick) {
      el.addEventListener('click', (e) => {
        // Don't trigger if clicking a button or link inside
        if (e.target.closest('button, a, input, select, textarea')) return;
        this.onClick(item, e);
      });
    }

    // Double click handler
    if (this.onDoubleClick) {
      el.addEventListener('dblclick', (e) => {
        this.onDoubleClick(item, e);
      });
    }

    // Long press for mobile
    if (this.onLongPress) {
      let pressTimer;
      let startX, startY;

      el.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        pressTimer = setTimeout(() => {
          this.onLongPress(item, e);
        }, Config.LONG_PRESS_DURATION);
      });

      el.addEventListener('touchend', () => clearTimeout(pressTimer));

      el.addEventListener('touchmove', (e) => {
        const moveX = e.touches[0].clientX;
        const moveY = e.touches[0].clientY;
        // Cancel if moved more than 10px
        if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
          clearTimeout(pressTimer);
        }
      });
    }

    return el;
  }

  _updateElement(el, item) {
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      const newHtml = this.renderItem(item);

      // Only update if content changed
      if (el.innerHTML !== newHtml) {
        el.innerHTML = newHtml;

        if (this.animateChanges) {
          el.classList.add('list-item-updated');
          setTimeout(() => el.classList.remove('list-item-updated'), 300);
        }
      }
    });
  }

  _handleEmptyState(isEmpty) {
    let emptyEl = this.container.querySelector('.empty-state');

    if (isEmpty && !emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state';
      emptyEl.innerHTML = `
        ${this.emptyIcon ? `<div class="empty-icon">${this.emptyIcon}</div>` : ''}
        <p class="empty-message">${this.emptyMessage}</p>
      `;
      this.container.appendChild(emptyEl);
    } else if (!isEmpty && emptyEl) {
      emptyEl.remove();
    }
  }

  // Update single item without full re-render
  updateItem(id, item) {
    const el = this.itemMap.get(id);
    if (el) {
      this._updateElement(el, item);
    }
  }

  // Remove single item
  removeItem(id) {
    const el = this.itemMap.get(id);
    if (el) {
      if (this.animateChanges) {
        el.classList.add('list-item-removing');
        setTimeout(() => el.remove(), 200);
      } else {
        el.remove();
      }
      this.itemMap.delete(id);
    }

    // Check empty state
    this._handleEmptyState(this.itemMap.size === 0);
  }

  // Add single item
  addItem(item, position = 'end') {
    const id = this.getKey(item);

    // Don't add if already exists
    if (this.itemMap.has(id)) {
      this.updateItem(id, item);
      return;
    }

    const el = this._createElement(item);
    this.itemMap.set(id, el);

    // Remove empty state
    this._handleEmptyState(false);

    if (position === 'start') {
      this.container.prepend(el);
    } else {
      this.container.appendChild(el);
    }

    if (this.animateChanges) {
      el.classList.add('list-item-entering');
      requestAnimationFrame(() => {
        el.classList.remove('list-item-entering');
      });
    }
  }

  // Get item by ID
  getItem(id) {
    return this.itemMap.get(id);
  }

  // Get all items
  getItems() {
    return Array.from(this.itemMap.keys());
  }

  // Get count
  get count() {
    return this.itemMap.size;
  }

  // Clear all items
  clear() {
    this.itemMap.clear();
    this.container.innerHTML = '';
    this._handleEmptyState(true);
  }

  // Destroy the renderer
  destroy() {
    this.clear();
    this.container = null;
    this.itemMap = null;
  }

  // Scroll to item
  scrollToItem(id, behavior = 'smooth') {
    const el = this.itemMap.get(id);
    if (el) {
      el.scrollIntoView({ behavior, block: 'nearest' });
    }
  }

  // Highlight item temporarily
  highlightItem(id, duration = 2000) {
    const el = this.itemMap.get(id);
    if (el) {
      el.classList.add('list-item-highlighted');
      setTimeout(() => el.classList.remove('list-item-highlighted'), duration);
    }
  }
}
