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
 * UPDATED: Longer timeout for mobile devices with slow auth hydration
 * @param {Object} options
 * @param {Function} options.onAuthed - Called when user is authenticated
 * @param {Function} options.onUnauthed - Called when user is not authenticated
 * @param {number} options.timeout - Max time to wait for auth (default: 5000ms for mobile compatibility)
 */
export function requireAuth({ onAuthed, onUnauthed, timeout = 5000 }) {
  let fired = false;
  let timeoutId = null;
  let nullDebounceId = null;

  console.log('[AuthGuard] Starting auth check with', timeout, 'ms timeout...');

  // NOTE: Persistence is now set explicitly in login.html before sign-in
  // based on "Keep me logged in" checkbox. Don't override it here.

  // Listen for auth state
  // IMPORTANT: onAuthStateChanged can fire with null BEFORE Firebase loads
  // the persisted session. We debounce null responses to allow the real
  // user state to arrive.
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (fired) {
      console.log('[AuthGuard] Already fired, ignoring callback');
      return;
    }

    console.log('[AuthGuard] Auth state callback:', user ? user.email : 'null');

    if (user) {
      // User found - act immediately
      clearTimeout(nullDebounceId);
      clearTimeout(timeoutId);
      fired = true;
      unsubscribe();
      
      console.log('[AuthGuard] ✅ User authenticated:', user.email);
      try {
        onAuthed(user);
      } catch (error) {
        console.error('[AuthGuard] Error in onAuthed callback:', error);
      }
    } else {
      // Got null - but don't act immediately!
      // Wait a short time for the real auth state to arrive
      // This handles the case where Firebase fires null before loading session
      console.log('[AuthGuard] Got null, waiting 500ms for session to load...');
      
      clearTimeout(nullDebounceId);
      nullDebounceId = setTimeout(() => {
        if (fired) return;
        
        // Still no user after debounce - truly unauthenticated
        fired = true;
        clearTimeout(timeoutId);
        unsubscribe();
        
        console.log('[AuthGuard] ❌ No user after debounce');
        try {
          onUnauthed();
        } catch (error) {
          console.error('[AuthGuard] Error in onUnauthed callback:', error);
        }
      }, 500);
    }
  }, (error) => {
    // Error callback for onAuthStateChanged
    console.error('[AuthGuard] ❌ Auth state error:', error);
    if (!fired) {
      fired = true;
      clearTimeout(timeoutId);
      clearTimeout(nullDebounceId);
      unsubscribe();
      onUnauthed();
    }
  });

  // Timeout fallback (overall safety net)
  timeoutId = setTimeout(() => {
    if (!fired) {
      console.error('[AuthGuard] ⚠️ Auth timeout after', timeout, 'ms');
      fired = true;
      clearTimeout(nullDebounceId);
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
