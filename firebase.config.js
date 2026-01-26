/**
 * Firebase Configuration for MedWard Pro
 * =======================================
 * CDN-based setup (no npm required)
 */

// Firebase SDK imports (v12.8.0)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    setPersistence,
    browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDuug0BTqO6DsSuyS2RkVcrcXCIB7E0oB4",
    authDomain: "medward-pro.firebaseapp.com",
    projectId: "medward-pro",
    storageBucket: "medward-pro.firebasestorage.app",
    messagingSenderId: "1033128540980",
    appId: "1:1033128540980:web:07bba197713232b0b54361",
    measurementId: "G-LQYE3F4T5C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Offline persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Offline persistence not supported in this browser');
    }
});

console.log('[Firebase] Initialized successfully');

// Export everything needed by other modules
export {
    // Core
    app,
    db,
    auth,
    analytics,

    // Firestore functions
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,

    // Auth functions
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    setPersistence,
    browserLocalPersistence
};
