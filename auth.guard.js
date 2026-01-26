/**
 * Professional Auth Guard for MedWard Pro - FIXED VERSION
 * ========================================================
 * Key fixes:
 * 1. Increased null debounce from 500ms to 1500ms for mobile
 * 2. Added final auth.currentUser check before calling onUnauthed
 * 3. Better logging for debugging
 */

import { auth } from './firebase.config.js';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from './firebase.config.js';

/**
 * Auth guard - waits for Firebase auth to hydrate before deciding navigation
 * FIXED: Longer debounce for mobile devices with slow auth hydration
 * @param {Object} options
 * @param {Function} options.onAuthed - Called when user is authenticated
 * @param {Function} options.onUnauthed - Called when user is not authenticated
 * @param {number} options.timeout - Max time to wait for auth (default: 5000ms)
 * @param {number} options.nullDebounce - Time to wait after null before deciding (default: 1500ms)
 */
export function requireAuth({ onAuthed, onUnauthed, timeout = 5000, nullDebounce = 1500 }) {
  let fired = false;
  let timeoutId = null;
  let nullDebounceId = null;

  console.log('[AuthGuard] Starting auth check with', timeout, 'ms timeout,', nullDebounce, 'ms null debounce...');

  // Check if we have a pending auth flag (set during Google sign-in redirect)
  const authPending = sessionStorage.getItem('MW_AUTH_PENDING');
  if (authPending) {
    console.log('[AuthGuard] Auth pending flag detected - extending timeout');
    timeout = Math.max(timeout, 6000);  // Give extra time if we know auth should be coming
  }

  // Listen for auth state
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
      
      // Clear pending flag if it exists
      sessionStorage.removeItem('MW_AUTH_PENDING');
      
      console.log('[AuthGuard] ✅ User authenticated:', user.email);
      try {
        onAuthed(user);
      } catch (error) {
        console.error('[AuthGuard] Error in onAuthed callback:', error);
      }
    } else {
      // Got null - but don't act immediately!
      // FIXED: Increased from 500ms to 1500ms for mobile compatibility
      console.log('[AuthGuard] Got null, waiting', nullDebounce, 'ms for session to load...');
      
      clearTimeout(nullDebounceId);
      nullDebounceId = setTimeout(() => {
        if (fired) return;
        
        // FIXED: Check auth.currentUser one more time before giving up
        // Sometimes onAuthStateChanged fires null but currentUser is populated
        const currentUser = auth.currentUser;
        if (currentUser) {
          fired = true;
          clearTimeout(timeoutId);
          unsubscribe();
          sessionStorage.removeItem('MW_AUTH_PENDING');
          console.log('[AuthGuard] ✅ User found via currentUser check:', currentUser.email);
          try {
            onAuthed(currentUser);
          } catch (error) {
            console.error('[AuthGuard] Error in onAuthed callback:', error);
          }
          return;
        }
        
        // Still no user after debounce - truly unauthenticated
        fired = true;
        clearTimeout(timeoutId);
        unsubscribe();
        sessionStorage.removeItem('MW_AUTH_PENDING');
        
        console.log('[AuthGuard] ❌ No user after debounce');
        try {
          onUnauthed();
        } catch (error) {
          console.error('[AuthGuard] Error in onUnauthed callback:', error);
        }
      }, nullDebounce);  // FIXED: Use configurable nullDebounce instead of hardcoded 500
    }
  }, (error) => {
    // Error callback for onAuthStateChanged
    console.error('[AuthGuard] ❌ Auth state error:', error);
    if (!fired) {
      fired = true;
      clearTimeout(timeoutId);
      clearTimeout(nullDebounceId);
      unsubscribe();
      sessionStorage.removeItem('MW_AUTH_PENDING');
      onUnauthed();
    }
  });

  // Timeout fallback (overall safety net)
  timeoutId = setTimeout(() => {
    if (!fired) {
      // FIXED: Final check of auth.currentUser before timeout
      const currentUser = auth.currentUser;
      if (currentUser) {
        fired = true;
        clearTimeout(nullDebounceId);
        unsubscribe();
        sessionStorage.removeItem('MW_AUTH_PENDING');
        console.log('[AuthGuard] ✅ User found at timeout via currentUser:', currentUser.email);
        try {
          onAuthed(currentUser);
        } catch (error) {
          console.error('[AuthGuard] Error in onAuthed callback:', error);
        }
        return;
      }
      
      console.error('[AuthGuard] ⚠️ Auth timeout after', timeout, 'ms');
      fired = true;
      clearTimeout(nullDebounceId);
      unsubscribe();
      sessionStorage.removeItem('MW_AUTH_PENDING');
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
