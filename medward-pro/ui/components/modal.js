// ui/components/modal.js
// Modal dialog component

import { EventBus } from '../../core/core.events.js';

class ModalManager {
  constructor() {
    this.activeModals = [];
    this._setupKeyboardListener();
  }

  _setupKeyboardListener() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModals.length > 0) {
        const topModal = this.activeModals[this.activeModals.length - 1];
        if (topModal.closeable !== false) {
          this.close(topModal.id);
        }
      }
    });
  }

  create(options = {}) {
    const {
      id = `modal-${Date.now()}`,
      title = '',
      content = '',
      size = 'medium', // small, medium, large, fullscreen
      closeable = true,
      showHeader = true,
      showFooter = false,
      footerContent = '',
      onOpen = null,
      onClose = null,
      className = ''
    } = options;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = `modal-overlay ${className}`;
    overlay.id = id;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (title) overlay.setAttribute('aria-labelledby', `${id}-title`);

    // Create modal content
    overlay.innerHTML = `
      <div class="modal modal-${size}">
        ${showHeader ? `
          <div class="modal-header">
            <h3 id="${id}-title" class="modal-title">${title}</h3>
            ${closeable ? '<button class="modal-close" aria-label="Close">&times;</button>' : ''}
          </div>
        ` : ''}
        <div class="modal-body">
          ${content}
        </div>
        ${showFooter ? `
          <div class="modal-footer">
            ${footerContent}
          </div>
        ` : ''}
      </div>
    `;

    // Close on overlay click
    if (closeable) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.close(id);
        }
      });

      const closeBtn = overlay.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close(id));
      }
    }

    // Track modal
    const modalData = { id, overlay, closeable, onClose };
    this.activeModals.push(modalData);

    // Add to DOM
    document.body.appendChild(overlay);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('modal-visible');
    });

    // Focus trap
    this._setupFocusTrap(overlay);

    // Callback
    if (onOpen) onOpen(overlay);

    EventBus.emit('modal:opened', { id });

    return {
      id,
      element: overlay,
      close: () => this.close(id),
      setContent: (html) => {
        overlay.querySelector('.modal-body').innerHTML = html;
      },
      setTitle: (text) => {
        const titleEl = overlay.querySelector('.modal-title');
        if (titleEl) titleEl.textContent = text;
      }
    };
  }

  close(id) {
    const index = this.activeModals.findIndex(m => m.id === id);
    if (index === -1) return;

    const modalData = this.activeModals[index];
    const overlay = modalData.overlay;

    // Animate out
    overlay.classList.remove('modal-visible');

    setTimeout(() => {
      overlay.remove();

      // Remove from tracking
      this.activeModals.splice(index, 1);

      // Restore body scroll if no more modals
      if (this.activeModals.length === 0) {
        document.body.style.overflow = '';
      }

      // Callback
      if (modalData.onClose) modalData.onClose();

      EventBus.emit('modal:closed', { id });
    }, 200);
  }

  closeAll() {
    [...this.activeModals].forEach(modal => this.close(modal.id));
  }

  _setupFocusTrap(overlay) {
    const modal = overlay.querySelector('.modal');
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement.focus();

    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    });
  }

  // Convenience methods
  alert(message, title = 'Alert') {
    return new Promise((resolve) => {
      this.create({
        title,
        content: `<p>${message}</p>`,
        size: 'small',
        showFooter: true,
        footerContent: '<button class="btn btn-primary modal-ok">OK</button>',
        onOpen: (overlay) => {
          overlay.querySelector('.modal-ok').addEventListener('click', () => {
            this.close(overlay.id);
            resolve(true);
          });
        }
      });
    });
  }

  confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = this.create({
        title,
        content: `<p>${message}</p>`,
        size: 'small',
        showFooter: true,
        footerContent: `
          <button class="btn btn-secondary modal-cancel">Cancel</button>
          <button class="btn btn-primary modal-confirm">Confirm</button>
        `,
        onOpen: (overlay) => {
          overlay.querySelector('.modal-cancel').addEventListener('click', () => {
            this.close(overlay.id);
            resolve(false);
          });
          overlay.querySelector('.modal-confirm').addEventListener('click', () => {
            this.close(overlay.id);
            resolve(true);
          });
        },
        onClose: () => resolve(false)
      });
    });
  }

  prompt(message, defaultValue = '', title = 'Input') {
    return new Promise((resolve) => {
      this.create({
        title,
        content: `
          <p>${message}</p>
          <input type="text" class="form-input modal-input" value="${defaultValue}">
        `,
        size: 'small',
        showFooter: true,
        footerContent: `
          <button class="btn btn-secondary modal-cancel">Cancel</button>
          <button class="btn btn-primary modal-submit">Submit</button>
        `,
        onOpen: (overlay) => {
          const input = overlay.querySelector('.modal-input');
          input.focus();
          input.select();

          const submit = () => {
            this.close(overlay.id);
            resolve(input.value);
          };

          overlay.querySelector('.modal-cancel').addEventListener('click', () => {
            this.close(overlay.id);
            resolve(null);
          });
          overlay.querySelector('.modal-submit').addEventListener('click', submit);
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
          });
        },
        onClose: () => resolve(null)
      });
    });
  }
}

export const Modal = new ModalManager();
