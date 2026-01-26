/**
 * Firebase Authentication Service for MedWard Pro
 * ================================================
 * Handles user login, logout, registration, and session management
 */

import {
    auth,
    db,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from './firebase.config.js';

/**
 * Current user state
 */
let currentUser = null;
let authStateListeners = [];

/**
 * Register a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - Display name
 * @returns {Promise<object>} User object
 */
export async function register(email, password, displayName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update display name
        await updateProfile(user, { displayName });

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            displayName: displayName,
            role: 'user',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            settings: {
                theme: 'light',
                defaultUnit: null
            }
        });

        console.log('[Auth] User registered:', user.email);
        return { success: true, user };

    } catch (error) {
        console.error('[Auth] Registration error:', error.code, error.message);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} Result object
 */
export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        console.log('[Auth] User logged in:', user.email);
        return { success: true, user };

    } catch (error) {
        console.error('[Auth] Login error:', error.code, error.message);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Detect if user is on mobile device
 * @returns {boolean}
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Sign in with Google
 * @returns {Promise<object>} Result object
 */
export async function signInWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();

        // Use redirect on mobile, popup on desktop
        if (isMobileDevice()) {
            console.log('[Auth] Mobile detected, using redirect flow');
            await signInWithRedirect(auth, provider);
            // Return pending - actual result will be handled by handleGoogleRedirect
            return { success: true, pending: true };
        } else {
            console.log('[Auth] Desktop detected, using popup flow');
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if user document exists, create if not
            await createUserProfileIfNeeded(user);

            console.log('[Auth] User logged in with Google:', user.email);
            return { success: true, user };
        }

    } catch (error) {
        console.error('[Auth] Google sign-in error:', error.code, error.message);

        // Handle popup closed by user
        if (error.code === 'auth/popup-closed-by-user') {
            return { success: false, error: 'Sign-in cancelled' };
        }

        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Handle Google redirect result (for mobile)
 * Call this on page load
 * @returns {Promise<object>} Result object
 */
export async function handleGoogleRedirect() {
    try {
        const result = await getRedirectResult(auth);

        if (result && result.user) {
            console.log('[Auth] Google redirect successful');
            const user = result.user;

            // Check if user document exists, create if not
            await createUserProfileIfNeeded(user);

            console.log('[Auth] User logged in with Google:', user.email);
            return { success: true, user };
        }

        return { success: true, noResult: true };

    } catch (error) {
        console.error('[Auth] Google redirect error:', error.code, error.message);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Create user profile if it doesn't exist
 * @param {object} user - Firebase user object
 */
async function createUserProfileIfNeeded(user) {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
        // Create user document for new Google users
        await setDoc(userDocRef, {
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || null,
            role: 'user',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            settings: {
                theme: 'light',
                defaultUnit: null
            }
        });
        console.log('[Auth] New Google user created:', user.email);
    }
}

/**
 * Logout current user
 * @returns {Promise<object>} Result object
 */
export async function logout() {
    try {
        await signOut(auth);

        // Clear legacy session storage
        sessionStorage.removeItem('MW_USER');
        sessionStorage.removeItem('MW_PASS');
        sessionStorage.removeItem('MW_UNIT');
        sessionStorage.removeItem('MW_UNIT_NAME');

        localStorage.removeItem('MW_USER');
        localStorage.removeItem('MW_PASS');

        console.log('[Auth] User logged out');
        return { success: true };

    } catch (error) {
        console.error('[Auth] Logout error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current authenticated user
 * @returns {object|null} Current user or null
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
    return currentUser !== null;
}

/**
 * Get user profile from Firestore
 * @param {string} uid - User ID
 * @returns {Promise<object|null>} User profile
 */
export async function getUserProfile(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return { id: userDoc.id, ...userDoc.data() };
        }
        return null;
    } catch (error) {
        console.error('[Auth] Error fetching user profile:', error);
        return null;
    }
}

/**
 * Subscribe to auth state changes
 * @param {function} callback - Called with (user) on auth change
 * @returns {function} Unsubscribe function
 */
export function onAuthChange(callback) {
    authStateListeners.push(callback);

    // Return unsubscribe function
    return () => {
        authStateListeners = authStateListeners.filter(cb => cb !== callback);
    };
}

/**
 * Initialize auth state listener
 * Call this once on app startup
 */
export function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0]
            };

            // Fetch additional profile data
            const profile = await getUserProfile(user.uid);
            if (profile) {
                currentUser = { ...currentUser, ...profile };
            }

            console.log('[Auth] Auth state: signed in as', currentUser.email);
        } else {
            // User is signed out
            currentUser = null;
            console.log('[Auth] Auth state: signed out');
        }

        // Notify all listeners
        authStateListeners.forEach(callback => callback(currentUser));
    });
}

/**
 * Wait for auth to be ready (useful on page load)
 * @returns {Promise<object|null>} Current user or null
 */
export function waitForAuth() {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

/**
 * Convert Firebase auth error codes to user-friendly messages
 * @param {string} errorCode - Firebase error code
 * @returns {string} User-friendly message
 */
function getAuthErrorMessage(errorCode) {
    const messages = {
        'auth/email-already-in-use': 'This email is already registered',
        'auth/invalid-email': 'Invalid email address',
        'auth/operation-not-allowed': 'Email/password accounts are not enabled',
        'auth/weak-password': 'Password is too weak (min 6 characters)',
        'auth/user-disabled': 'This account has been disabled',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-credential': 'Invalid email or password',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later',
        'auth/network-request-failed': 'Network error. Check your connection',
        'auth/popup-blocked': 'Popup was blocked. Please allow popups for this site',
        'auth/popup-closed-by-user': 'Sign-in cancelled',
        'auth/account-exists-with-different-credential': 'An account already exists with the same email'
    };

    return messages[errorCode] || 'An error occurred. Please try again';
}

// Auto-initialize on import
initAuth();
