/**
 * Firebase Authentication Service
 */
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './firebase.config.js';
import { Store } from '../core/store.js';
import { EventBus, Events } from '../core/events.js';

const googleProvider = new GoogleAuthProvider();

export const Auth = {
  /**
   * Initialize auth listener
   */
  init() {
    onAuthStateChanged(auth, (user) => {
      Store.set({
        user: user ? {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        } : null,
        isAuthenticated: !!user
      });

      EventBus.emit(Events.AUTH_CHANGED, { user });
    });
  },

  /**
   * Email/Password login
   */
  async login(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (error) {
      EventBus.emit(Events.AUTH_ERROR, { error });
      return { success: false, error: error.message };
    }
  },

  /**
   * Google Sign-In
   */
  async loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return { success: true, user: result.user };
    } catch (error) {
      EventBus.emit(Events.AUTH_ERROR, { error });
      return { success: false, error: error.message };
    }
  },

  /**
   * Sign out
   */
  async logout() {
    try {
      await signOut(auth);
      Store.reset();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get current user
   */
  getCurrentUser() {
    return auth.currentUser;
  },

  /**
   * Check if authenticated
   */
  isAuthenticated() {
    return !!auth.currentUser;
  }
};
