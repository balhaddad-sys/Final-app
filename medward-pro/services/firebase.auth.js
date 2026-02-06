// services/firebase.auth.js
// Authentication service

import { auth } from './firebase.config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
import { EventBus } from '../core/core.events.js';
import { Store } from '../core/store.js';
import { Monitor } from '../monitor/monitor.core.js';

export const Auth = {
  _unsubscribe: null,

  // Initialize auth listener
  init() {
    this._unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        };

        Store.setCurrentUser(userData);
        EventBus.emit('auth:ready', userData);
        Monitor.log('AUTH', `User authenticated: ${user.email}`);
      } else {
        Store.setCurrentUser(null);
        EventBus.emit('auth:logout');
        Monitor.log('AUTH', 'User logged out');
      }
    });
  },

  // Stop listening to auth changes
  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  },

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!auth.currentUser;
  },

  // Email/Password sign in
  async signIn(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      Monitor.log('AUTH', `Sign in successful: ${email}`);
      return { success: true, user: result.user };
    } catch (error) {
      Monitor.logError('AUTH_SIGNIN_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Create new account
  async signUp(email, password, displayName = '') {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);

      if (displayName) {
        await updateProfile(result.user, { displayName });
      }

      Monitor.log('AUTH', `Sign up successful: ${email}`);
      return { success: true, user: result.user };
    } catch (error) {
      Monitor.logError('AUTH_SIGNUP_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Google sign in
  async signInWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      Monitor.log('AUTH', `Google sign in successful: ${result.user.email}`);
      return { success: true, user: result.user };
    } catch (error) {
      Monitor.logError('AUTH_GOOGLE_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Sign out
  async signOut() {
    try {
      await signOut(auth);
      Monitor.log('AUTH', 'Sign out successful');
      return { success: true };
    } catch (error) {
      Monitor.logError('AUTH_SIGNOUT_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Send password reset email
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      Monitor.log('AUTH', `Password reset email sent to: ${email}`);
      return { success: true };
    } catch (error) {
      Monitor.logError('AUTH_RESET_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Update user profile
  async updateProfile(updates) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      await updateProfile(user, updates);
      Monitor.log('AUTH', 'Profile updated');
      return { success: true };
    } catch (error) {
      Monitor.logError('AUTH_PROFILE_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Change password
  async changePassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
      Monitor.log('AUTH', 'Password changed');
      return { success: true };
    } catch (error) {
      Monitor.logError('AUTH_PASSWORD_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Format Firebase auth errors to user-friendly messages
  _formatError(error) {
    const errorMap = {
      'auth/invalid-email': 'Invalid email address',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'An account with this email already exists',
      'auth/weak-password': 'Password must be at least 6 characters',
      'auth/network-request-failed': 'Network error. Please check your connection',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
      'auth/popup-closed-by-user': 'Sign in cancelled',
      'auth/invalid-credential': 'Invalid credentials. Please try again'
    };

    return errorMap[error.code] || error.message || 'An error occurred';
  }
};
