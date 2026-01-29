# Firebase Functions Troubleshooting Guide

## Current Status

✅ **Deployment:** Workflow completed successfully (PR #148 merged to main)
❌ **Runtime:** Functions returning "internal" errors
❌ **Health Check:** Failing with "Failed to fetch"

## Diagnostic Steps

### 1. **Verify Functions Are Actually Deployed**

Open Firebase Console and check deployed functions:
https://console.firebase.google.com/project/medward-pro/functions

You should see 22 functions listed:
- onUserCreated (auth trigger)
- healthCheck, loadData, saveData, getUserProfile, etc. (callable functions)

**If functions are NOT listed:**
- Check GitHub Actions logs: https://github.com/balhaddad-sys/Final-app/actions
- Look for deployment errors in the workflow run
- Verify FIREBASE_SERVICE_ACCOUNT secret has correct permissions

**If functions ARE listed:**
- Proceed to step 2

### 2. **Check Function Logs for Errors**

```bash
# View real-time logs
firebase functions:log --project medward-pro

# Or use Firebase Console
# https://console.firebase.google.com/project/medward-pro/functions/logs
```

Look for error messages that indicate the root cause:
- `ANTHROPIC_API_KEY not configured` → Claude API key missing (expected for AI functions)
- `Permission denied` → Firestore rules or IAM permissions issue
- `Module not found` → Dependencies not installed correctly
- `Cannot read properties of undefined` → Runtime error in function code

### 3. **Test Health Check Endpoint Directly**

Open this URL in your browser (not via the test page):
```
https://us-central1-medward-pro.cloudfunctions.net/healthCheck
```

**Expected Response (if working):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-29T...",
  "version": "2.0.0"
}
```

**If you get 404:**
- Functions not deployed or deployed to wrong region
- Check `firebase.json` for region configuration
- Verify project ID is correct

**If you get 403:**
- IAM permissions issue
- Function may require authentication
- Check CORS configuration

**If you get 500:**
- Runtime error in function
- Check function logs for stack trace

**If you get "Failed to fetch" in browser:**
- CORS issue (but healthCheck has CORS configured)
- Network/firewall blocking request
- Function endpoint doesn't exist

### 4. **Common Issues & Solutions**

#### Issue: All Functions Return "internal" Error

**Possible Causes:**
1. **Missing Environment Configuration**
   - For AI functions: Claude API key not set
   - For other functions: Firebase config issues

   **Solution:**
   ```bash
   # Set Claude API key (required for AI functions only)
   firebase functions:config:set anthropic.key="YOUR_ANTHROPIC_API_KEY" --project medward-pro

   # Re-deploy after setting config
   firebase deploy --only functions --project medward-pro
   ```

2. **Firebase Admin SDK Not Initialized**
   - Check functions/index.js line 66: `admin.initializeApp();`
   - Ensure GOOGLE_APPLICATION_CREDENTIALS is set during deployment

3. **Firestore Permissions**
   - Cloud Functions use Admin SDK (bypasses rules)
   - But check if service account has Firestore permissions

   **Solution:** Ensure service account has these roles:
   - Cloud Functions Developer
   - Firebase Admin
   - Cloud Datastore User

#### Issue: "Failed to fetch" for healthCheck

**This is the most critical issue** - if even healthCheck fails, the functions may not be deployed properly.

**Debugging Steps:**
1. Check if function exists:
   ```bash
   firebase functions:list --project medward-pro
   ```

2. Test with curl (bypasses CORS):
   ```bash
   curl -v https://us-central1-medward-pro.cloudfunctions.net/healthCheck
   ```

3. Check deployment logs:
   ```bash
   # In GitHub Actions, check the "Deploy Firebase Functions" step
   # Look for messages like:
   # ✔  functions[healthCheck(us-central1)] Successful create operation.
   ```

4. If function exists but fails, check for code syntax errors:
   ```bash
   cd medward-firebase/functions
   npm install
   npm run lint
   ```

#### Issue: Works Locally But Not in Production

**Cause:** Environment differences

**Solution:**
1. Compare environment variables:
   ```bash
   # Local emulator uses .env or export ANTHROPIC_API_KEY=...
   # Production uses: firebase functions:config:set
   ```

2. Check Node.js version:
   - firebase.json specifies `nodejs20`
   - Verify your local Node version matches

3. Test with production config locally:
   ```bash
   firebase functions:config:get --project medward-pro > .runtimeconfig.json
   firebase emulators:start
   ```

### 5. **Quick Fixes to Try**

#### Fix 1: Re-deploy Functions
```bash
cd medward-firebase
firebase deploy --only functions --project medward-pro --force
```

#### Fix 2: Set Claude API Key
```bash
firebase functions:config:set anthropic.key="sk-ant-..." --project medward-pro
firebase deploy --only functions --project medward-pro
```

#### Fix 3: Check Service Account Permissions

Go to: https://console.cloud.google.com/iam-admin/iam?project=medward-pro

Find the service account used in FIREBASE_SERVICE_ACCOUNT secret.

Ensure it has these roles:
- ✅ Firebase Admin SDK Administrator Service Agent
- ✅ Cloud Functions Developer
- ✅ Cloud Datastore User
- ✅ Service Account Token Creator

#### Fix 4: Enable Required APIs

Go to: https://console.cloud.google.com/apis/library?project=medward-pro

Ensure these APIs are enabled:
- ✅ Cloud Functions API
- ✅ Cloud Firestore API
- ✅ Firebase Management API
- ✅ Cloud Build API

## Testing Checklist

After deploying fixes, test in this order:

### Level 1: Basic Connectivity
- [ ] Health check endpoint responds: https://us-central1-medward-pro.cloudfunctions.net/healthCheck
- [ ] Returns HTTP 200 with JSON response

### Level 2: Core Functions (No API Key Required)
Test via https://medward-pro.web.app/ after signing in:
- [ ] Load Data (should work or create new user data)
- [ ] Save Test Data (should save successfully)
- [ ] Get Profile (should return user profile)
- [ ] Get Trash (should return empty array for new users)
- [ ] Check Inbox (should return empty array for new users)
- [ ] Heartbeat (should update session timestamp)

### Level 3: AI Functions (Requires API Key)
Only test after configuring Claude API key:
- [ ] Ask Clinical Question
- [ ] Analyze Labs
- [ ] Get Drug Info
- [ ] Generate Differential
- [ ] Get Treatment Plan
- [ ] On-Call Consult

## Expected Behavior

### Before API Key Configuration:
- ✅ Core functions (loadData, saveData, etc.) should work
- ⚠️ AI functions should return: "Claude API key not configured"

### After API Key Configuration:
- ✅ All 22 functions should work
- ✅ AI responses should return clinical information

## Getting Help

If issues persist:

1. **Check Firebase Console Logs:**
   https://console.firebase.google.com/project/medward-pro/functions/logs

2. **Check GitHub Actions Logs:**
   https://github.com/balhaddad-sys/Final-app/actions

3. **Run diagnostic script:**
   ```bash
   cd medward-firebase
   chmod +x diagnose-functions.sh
   ./diagnose-functions.sh
   ```

4. **Test locally with emulator:**
   ```bash
   cd medward-firebase
   firebase emulators:start
   # Open http://localhost:5000 to test
   ```

## Most Likely Solution

Based on the symptoms (all functions failing with "internal" errors), the most likely cause is:

**❌ Functions deployed successfully BUT encountering runtime errors**

**Solution:** Check Firebase Console logs immediately to see the actual error messages. The logs will show the exact error that's causing the "internal" response.

---

**Last Updated:** 2026-01-29
**Deploy Status:** GitHub Actions reports SUCCESS
**Next Step:** Check Firebase Console logs for runtime errors
