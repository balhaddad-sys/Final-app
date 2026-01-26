/**
 * Professional Auth Guard for MedWard Pro
 * ========================================
 * Centralized authentication guard that eliminates redirect loops
 * and ensures proper Firebase auth hydration before navigation.
 *
 * Usage:
 * - On login page: Call requireAuth({ onAuthed, onUnauthed })
 * - On protected pages: Same pattern
 * - This waits for Firebase to hydrate auth state before making ANY decisions
 */

import { auth } from './firebase.config.js';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from './firebase.config.js';

/**
 * Auth guard - waits for Firebase auth to hydrate before deciding navigation
 * @param {Object} options
 * @param {Function} options.onAuthed - Called when user is authenticated
 * @param {Function} options.onUnauthed - Called when user is not authenticated
 * @param {number} options.timeout - Max time to wait for auth (default: 3000ms)
 */
export function requireAuth({ onAuthed, onUnauthed, timeout = 3000 }) {
  let fired = false;
  let timeoutId = null;

  console.log('[AuthGuard] Starting auth check...');

  // Set persistence explicitly to ensure sessions survive refresh
  setPersistence(auth, browserLocalPersistence).catch(err => {
    console.warn('[AuthGuard] Could not set persistence:', err);
    // Continue anyway - persistence failure is not fatal
  });

  // Listen for auth state (fires once Firebase hydrates)
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (fired) {
      console.log('[AuthGuard] Already fired, ignoring duplicate callback');
      return;
    }

    fired = true;
    clearTimeout(timeoutId);
    console.log('[AuthGuard] Auth state resolved in', Date.now() % 100000, 'ms');

    if (user) {
      console.log('[AuthGuard] ✅ User authenticated:', user.email);
      try {
        onAuthed(user);
      } catch (error) {
        console.error('[AuthGuard] Error in onAuthed callback:', error);
      }
    } else {
      console.log('[AuthGuard] ❌ No user authenticated');
      try {
        onUnauthed();
      } catch (error) {
        console.error('[AuthGuard] Error in onUnauthed callback:', error);
      }
    }

    // Cleanup
    unsubscribe();
  }, (error) => {
    // Error callback for onAuthStateChanged
    console.error('[AuthGuard] ❌ Auth state error:', error);
    if (!fired) {
      fired = true;
      clearTimeout(timeoutId);
      unsubscribe();
      onUnauthed();
    }
  });

  // Timeout fallback
  timeoutId = setTimeout(() => {
    if (!fired) {
      console.error('[AuthGuard] ⚠️ Auth timeout after', timeout, 'ms - proceeding as unauthenticated');
      fired = true;
      unsubscribe();
      onUnauthed();
    }
  }, timeout);
}

/**
 * One-shot auth check - returns current auth state
 * Use this for pages that need to know auth status but don't redirect
 * @returns {Promise<object|null>} User object or null
 */
export function checkAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Helper to set legacy credentials after Firebase auth
 * (for backward compatibility with dashboard)
 */
export function setLegacyCredentials(user) {
  if (!user) return;

  const userEmail = user.email || user.uid;
  const userToken = 'FIREBASE_AUTH';

  try {
    sessionStorage.setItem('MW_USER', userEmail);
    sessionStorage.setItem('MW_PASS', userToken);
    localStorage.setItem('MW_USER', userEmail);
    localStorage.setItem('MW_PASS', userToken);
    console.log('[AuthGuard] Legacy credentials set for:', userEmail);
  } catch (error) {
    console.error('[AuthGuard] Failed to set legacy credentials:', error);
  }
}

/**
 * Helper to build absolute paths (for GitHub Pages subpath routing)
 */
export function getBasePath() {
  const base = location.origin + location.pathname.replace(/\/[^/]*$/, '/');
  return base;
}

/**
 * Safe redirect that handles GitHub Pages subpaths
 */
export function safeRedirect(page) {
  const base = getBasePath();
  const targetUrl = base + page;
  console.log('[AuthGuard] Redirecting to:', targetUrl);
  location.replace(targetUrl);
}
