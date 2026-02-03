/**
 * Privacy Blur - Protects PHI after inactivity
 * Triggers after 30 seconds of no interaction
 */
import { EventBus } from '../core/events.js';

const TIMEOUT_MS = 30000; // 30 seconds
let timeoutId = null;
let isBlurred = false;

export const Privacy = {
  init() {
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'privacy-overlay';
    overlay.innerHTML = `
      <div class="privacy-unlock-prompt glass">
        <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
        <h3>Screen Protected</h3>
        <p>Tap anywhere to unlock</p>
        <button class="btn btn-primary">Unlock</button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Unlock on interaction
    overlay.addEventListener('click', () => this.unlock());
    overlay.addEventListener('touchstart', () => this.unlock());

    // Track user activity
    const resetTimer = () => {
      if (isBlurred) return;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => this.blur(), TIMEOUT_MS);
    };

    // Activity events
    ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'].forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    // Start timer
    resetTimer();

    // Also blur on visibility change (user switches tabs/apps)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.blur();
      }
    });
  },

  blur() {
    if (isBlurred) return;
    isBlurred = true;
    document.body.classList.add('privacy-blur-active');
    EventBus.emit('privacy:blurred');
  },

  unlock() {
    if (!isBlurred) return;
    isBlurred = false;
    document.body.classList.remove('privacy-blur-active');
    EventBus.emit('privacy:unlocked');

    // Restart timer
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => this.blur(), TIMEOUT_MS);
  },

  /**
   * Manual trigger (e.g., via gesture or button)
   */
  toggle() {
    if (isBlurred) {
      this.unlock();
    } else {
      this.blur();
    }
  },

  /**
   * Check current state
   */
  isBlurred() {
    return isBlurred;
  }
};
