# MedWard Pro Firebase Migration

This directory contains the Firebase Cloud Functions and configuration that replaces the Google Apps Script backend.

## Key Benefits

- **Automatic user creation** on first sign-in (no more auth failures)
- **Real-time data sync** (no polling required)
- **Offline support** built-in
- **Faster performance** (direct Firestore vs Google Drive)
- **Simpler architecture** and easier debugging

## Project Structure

```
medward-firebase/
├── firebase.json              # Firebase configuration
├── firestore.rules            # Security rules
├── firestore.indexes.json     # Database indexes
├── .firebaserc                # Project selection
└── functions/
    ├── package.json           # Node.js dependencies
    ├── index.js               # Cloud Functions code
    └── .eslintrc.js           # Linting configuration
```

## Prerequisites

1. Firebase CLI: `npm install -g firebase-tools`
2. Node.js 18+
3. Firebase project on Blaze plan (required for Cloud Functions)

## Deployment Steps

### 1. Login to Firebase

```bash
firebase login
```

### 2. Install Dependencies

```bash
cd medward-firebase/functions
npm install
cd ..
```

### 3. Configure Claude API Key

```bash
firebase functions:config:set claude.api_key="YOUR_CLAUDE_API_KEY"
```

Verify configuration:
```bash
firebase functions:config:get
```

### 4. Deploy

Deploy everything:
```bash
firebase deploy
```

Or deploy specific components:
```bash
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Cloud Functions Reference

| Function | Description | Type |
|----------|-------------|------|
| `onUserCreated` | Auto-creates user documents on sign-in | Auth Trigger |
| `onUserSignIn` | Updates lastLoginAt | Callable |
| `loadData` | Loads user data with revision check | Callable |
| `saveData` | Saves data with conflict detection | Callable |
| `moveToTrash` | Moves items to trash | Callable |
| `getTrash` | Gets trash items | Callable |
| `restoreFromTrash` | Restores from trash | Callable |
| `emptyTrash` | Permanently deletes trash | Callable |
| `sendPatient` | Sends patient to another user | Callable |
| `checkInbox` | Checks inbox for received patients | Callable |
| `acceptInboxPatient` | Accepts patient from inbox | Callable |
| `declineInboxPatient` | Declines patient from inbox | Callable |
| `heartbeat` | Session tracking | Callable |
| `askClinical` | AI clinical assistant | Callable |
| `analyzeLabs` | AI lab analysis | Callable |
| `getDrugInfo` | AI drug information | Callable |
| `generateDifferential` | AI differential diagnosis | Callable |
| `getTreatmentPlan` | AI treatment planning | Callable |
| `oncallConsult` | AI on-call consultation | Callable |
| `getUserProfile` | Gets user profile | Callable |
| `updateSettings` | Updates user settings | Callable |
| `healthCheck` | Health check endpoint | HTTP |

## Local Development

Start the Firebase emulator suite:
```bash
firebase emulators:start
```

This starts:
- Auth emulator on port 9099
- Functions emulator on port 5001
- Firestore emulator on port 8080
- Hosting emulator on port 5000

## Troubleshooting

View function logs:
```bash
firebase functions:log
```

Debug deployment:
```bash
firebase deploy --only functions --debug
```

Check Firestore rules:
```bash
firebase firestore:rules-check
```

## Data Structure

```
Firestore Database
└── users (collection)
    └── {userId} (document)
        ├── uid, email, displayName, photoURL
        ├── createdAt, lastLoginAt
        ├── settings: { adminPassword, theme, ... }
        │
        └── data (subcollection)
            ├── active (patients, units, trash, unitRequests)
            ├── trash (deleted items)
            ├── inbox (received patient handovers)
            └── sessions (active device sessions)
```

## Migration from Apps Script

The new system is backward compatible. Existing users will automatically have their documents created on first sign-in via the `onUserCreated` auth trigger.

To migrate existing data, use the `migrateFromAppsScript()` function in `firebase.functions.js`.
