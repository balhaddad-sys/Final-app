/**
 * Bottom Sheet Modal System
 */
import { EventBus, Events } from '../../core/events.js';

let backdrop = null;
let activeModal = null;

export function initModals() {
  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'modal-backdrop';
  document.body.appendChild(backdrop);

  backdrop.addEventListener('click', closeModal);

  EventBus.on(Events.MODAL_OPEN, openModal);
  EventBus.on(Events.MODAL_CLOSE, closeModal);
}

export function openModal({ id, title, content, onClose }) {
  closeModal(); // Close any existing

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = id || 'modal';

  modal.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h3>${escapeHtml(title || '')}</h3>
      <button class="btn btn-ghost btn-icon modal-close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="modal-body"></div>
  `;

  const body = modal.querySelector('.modal-body');
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  modal.querySelector('.modal-close').addEventListener('click', closeModal);

  // Swipe down to close
  let startY = 0;
  modal.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
  }, { passive: true });

  modal.addEventListener('touchmove', e => {
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      modal.style.transform = `translateY(${deltaY}px)`;
    }
  }, { passive: true });

  modal.addEventListener('touchend', e => {
    const deltaY = e.changedTouches[0].clientY - startY;
    if (deltaY > 100) {
      closeModal();
    } else {
      modal.style.transform = '';
    }
  });

  document.body.appendChild(modal);
  activeModal = { modal, onClose };

  // Trigger animation
  requestAnimationFrame(() => {
    backdrop.classList.add('active');
    modal.classList.add('active');
  });
}

export function closeModal() {
  if (!activeModal) return;

  const { modal, onClose } = activeModal;

  backdrop.classList.remove('active');
  modal.classList.remove('active');

  setTimeout(() => {
    modal.remove();
    if (onClose) onClose();
  }, 300);

  activeModal = null;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
