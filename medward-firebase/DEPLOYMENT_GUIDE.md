# MedWard Pro - Firebase Functions Deployment Guide

## 🚀 Deployment Status

Your Firebase Functions are now configured for automatic deployment via GitHub Actions!

## 📋 Prerequisites

### 1. Firebase Service Account (✅ Already Configured)
The `FIREBASE_SERVICE_ACCOUNT` secret is already set up in your GitHub repository and is being used for Firebase Hosting deployments.

### 2. Claude API Key (⚠️ REQUIRED - Not Yet Configured)
The AI clinical functions require an Anthropic Claude API key to function.

## 🔑 Configure Claude API Key

### Option 1: Set via Firebase Functions Config (Recommended for Production)

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Navigate to the medward-firebase directory
cd medward-firebase

# Set the API key
firebase functions:config:set anthropic.key="YOUR_ANTHROPIC_API_KEY" --project medward-pro

# Deploy the functions with the new config
firebase deploy --only functions --project medward-pro
```

### Option 2: Set via Environment Variables (For Local Development)

```bash
# For local emulator testing
export ANTHROPIC_API_KEY="your-key-here"

# Then start the emulator
cd medward-firebase
firebase emulators:start
```

### Option 3: Set via GitHub Secrets (For CI/CD)

1. Go to your repository settings: `Settings → Secrets and variables → Actions`
2. Add a new secret:
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your Anthropic API key
3. Update `.github/workflows/firebase-functions-deploy.yml` to set the environment variable during deployment

## 📦 Deployment Methods

### Automatic Deployment (Recommended)
The GitHub Actions workflow `.github/workflows/firebase-functions-deploy.yml` automatically deploys functions when:
- You push to `main` or `claude/**` branches
- Changes are made to:
  - `medward-firebase/functions/**`
  - `medward-firebase/firebase.json`
  - `medward-firebase/.firebaserc`

### Manual Deployment via GitHub Actions
1. Go to: `Actions → Firebase Functions Deploy → Run workflow`
2. Select your branch
3. Click "Run workflow"

### Manual Deployment via CLI
```bash
cd medward-firebase
firebase deploy --only functions --project medward-pro
```

## 🧪 Testing Your Deployment

### 1. Test Health Check Endpoint
```bash
curl https://us-central1-medward-pro.cloudfunctions.net/healthCheck
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-28T...",
  "version": "2.0.0"
}
```

### 2. Test via Web Interface
Open: https://medward-pro.web.app/

The test interface provides buttons to test all Cloud Functions endpoints.

### 3. Test Locally with Emulator
```bash
cd medward-firebase
firebase emulators:start

# In another terminal, open the test page
# The page will automatically connect to emulator on localhost:5001
```

## 📝 Function List

### Core Functions (No API Key Required)
- ✅ `healthCheck` - Health check endpoint
- ✅ `onUserCreated` - Auto-creates user profile on signup
- ✅ `onUserSignIn` - Updates last login timestamp
- ✅ `getUserProfile` - Retrieves user profile
- ✅ `updateSettings` - Updates user settings
- ✅ `loadData` - Loads user ward data
- ✅ `saveData` - Saves user ward data
- ✅ `moveToTrash` - Moves items to trash
- ✅ `getTrash` - Retrieves trash items
- ✅ `restoreFromTrash` - Restores items from trash
- ✅ `emptyTrash` - Permanently deletes trash
- ✅ `heartbeat` - Session tracking
- ✅ `sendPatient` - Patient handover
- ✅ `checkInbox` - Check patient inbox
- ✅ `acceptInboxPatient` - Accept patient handover
- ✅ `declineInboxPatient` - Decline patient handover

### AI Functions (Requires Claude API Key)
- 🤖 `askClinical` - Clinical question assistant
- 🤖 `analyzeLabs` - Lab result analysis
- 🤖 `getDrugInfo` - Drug information lookup
- 🤖 `generateDifferential` - Differential diagnosis
- 🤖 `getTreatmentPlan` - Treatment planning
- 🤖 `oncallConsult` - On-call consultation

## 🔍 Monitoring & Logs

### View Logs in Firebase Console
1. Go to: https://console.firebase.google.com/project/medward-pro/functions
2. Click on any function to view its logs and metrics

### View Logs via CLI
```bash
firebase functions:log --project medward-pro
```

### View Logs via GitHub Actions
Check the workflow runs in the "Actions" tab of your repository.

## 🐛 Troubleshooting

### Functions returning "internal" errors
1. Check function logs for detailed error messages
2. Verify Claude API key is configured (required for AI functions)
3. Ensure all dependencies are installed (`npm ci` in functions directory)

### Deployment fails
1. Check GitHub Actions workflow run for error details
2. Verify `FIREBASE_SERVICE_ACCOUNT` secret is properly configured
3. Check that firebase.json and .firebaserc are correct

### "Failed to fetch" errors
1. Functions may not be deployed yet - check deployment status
2. CORS issues - verify CORS is configured in functions/index.js
3. Network issues - check Firebase project status

## 📚 Additional Resources

- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Anthropic Claude API Documentation](https://docs.anthropic.com/)
- [Function Implementation](./functions/index.js)
- [Test Interface](./public/index.html)

## ✅ Post-Deployment Checklist

- [ ] Functions deployed successfully (check GitHub Actions or Firebase Console)
- [ ] Claude API key configured (run: `firebase functions:config:get`)
- [ ] Health check endpoint responds: https://us-central1-medward-pro.cloudfunctions.net/healthCheck
- [ ] Test interface loads: https://medward-pro.web.app/
- [ ] Sign in with test account works
- [ ] Core functions (loadData, saveData) work
- [ ] AI functions work (after API key is configured)

---

**Current Status**: Functions code is ready, GitHub Actions workflow created.
**Next Step**: Configure Claude API key and trigger deployment.
