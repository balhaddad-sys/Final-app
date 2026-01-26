# Google Login Debugging Guide

## Step 1: Check Firebase Console

1. Go to: https://console.firebase.google.com
2. Open project: `medward-pro`
3. Navigate to: **Authentication → Settings → Authorized domains**
4. Verify these domains are listed:
   - ✅ `localhost`
   - ✅ `balhaddad-sys.github.io` ← **CRITICAL - Must be added!**

5. Navigate to: **Authentication → Sign-in method**
6. Verify **Google** is **Enabled**

## Step 2: Test Google Login with Browser Console Open

1. Open: https://balhaddad-sys.github.io/Final-app/login.html
2. Open Browser Developer Tools (F12)
3. Go to **Console** tab
4. Click "Sign in with Google"
5. Watch for these log messages:

### Expected Success Flow:
```
[Login] Starting Google sign-in...
[Login] Desktop detected, using popup flow  (or Mobile detected...)
[Auth] User logged in with Google: your-email@gmail.com
[Login] Google sign-in successful
[Login] Already authenticated, redirecting to landing
[AuthGuard] Redirecting to: .../landing.html
[Landing] User authenticated: your-email@gmail.com
```

### If You See This Error:
```
[Auth] Google sign-in error: auth/unauthorized-domain
[Auth] Domain not authorized. Add this domain to Firebase Console...
```
**Solution:** Add `balhaddad-sys.github.io` to Firebase authorized domains (Step 1)

### If You See This Error:
```
[Auth] Google sign-in error: auth/operation-not-allowed
```
**Solution:** Enable Google Sign-In in Firebase Console (Step 1, item 5)

### If You See This Error:
```
[Auth] Google sign-in error: auth/popup-blocked
```
**Solution:** Allow popups for `balhaddad-sys.github.io` in your browser

### If Login Succeeds But Redirects Back to Login:
```
[Login] Google sign-in successful
[AuthGuard] Redirecting to: .../landing.html
[Landing] Not authenticated, redirecting to login  ← PROBLEM!
[AuthGuard] Redirecting to: .../login.html
```
**Solution:** This is a timing issue - see Step 3

## Step 3: Check Auth Persistence

In browser console on login.html, run:
```javascript
// Check current persistence
firebase.auth().onAuthStateChanged(user => {
  console.log('Current user:', user);
  console.log('Persistence:', firebase.auth().persistence);
});
```

## Step 4: Test Direct Landing Page Access

After successful Google login:
1. Copy the landing.html URL
2. Open a new tab
3. Paste and visit the landing.html URL directly
4. Check console for:

### If It Works:
```
[Landing] User authenticated: your-email@gmail.com
```
**Means:** Login works, just redirect timing issue

### If It Doesn't Work:
```
[Landing] Not authenticated, redirecting to login
```
**Means:** Session not persisting - Firebase issue

## Step 5: Clear Everything and Retry

1. Open: https://balhaddad-sys.github.io/Final-app/login.html
2. Press F12 → Console
3. Run:
```javascript
// Clear all storage
localStorage.clear();
sessionStorage.clear();
firebase.auth().signOut();
location.reload();
```
4. Try Google login again

## Common Error Codes

| Error Code | Meaning | Fix |
|---|---|---|
| `auth/unauthorized-domain` | Domain not in Firebase | Add domain to Firebase Console |
| `auth/operation-not-allowed` | Google Sign-In disabled | Enable in Firebase Console |
| `auth/popup-blocked` | Browser blocked popup | Allow popups |
| `auth/popup-closed-by-user` | You cancelled | Normal - try again |
| `auth/network-request-failed` | Network issue | Check internet connection |
| `auth/internal-error` | Firebase API issue | Check Firebase API key |

## If Nothing Works

Send me the console logs from Step 2, specifically:
1. The first error message you see
2. The full auth flow logs
3. Whether it's desktop or mobile device

## Quick Fix to Test (Temporary)

If you want to test if the issue is just timing, you can temporarily increase the auth timeout:

In `auth.guard.js:24`, change:
```javascript
export function requireAuth({ onAuthed, onUnauthed, timeout = 5000 }) {
```
To:
```javascript
export function requireAuth({ onAuthed, onUnauthed, timeout = 10000 }) {
```

This gives Firebase more time to hydrate on slow connections.
