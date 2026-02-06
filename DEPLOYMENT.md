# Firebase Deployment Guide

This guide explains how to deploy the MedWard Pro application to Firebase.

## Prerequisites

1. **Firebase CLI**: Ensure you have Firebase CLI installed
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Project**: You need a Firebase project set up. If not, create one at https://console.firebase.google.com

3. **Authentication**: Log in to Firebase
   ```bash
   firebase login
   ```

## Project Structure

- `medward-pro/` - Main application directory
  - `services/` - Firebase service integrations
  - `functions/` - Cloud Functions
  - `dist/` - Built application (created by `npm run build`)

## Deployment Steps

### 1. Build the Application

Navigate to the `medward-pro` directory and build:

```bash
cd medward-pro
npm install  # If dependencies aren't installed
npm run build
```

This creates the `dist/` directory with optimized production files.

### 2. Deploy Options

You have several deployment options depending on what you want to deploy:

#### Deploy Everything (Hosting + Functions + Rules + Indexes)
```bash
npm run deploy:all
```

This runs:
- `npm run build` - Builds the frontend
- `firebase deploy` - Deploys everything

#### Deploy Only Hosting (Frontend)
```bash
npm run deploy:hosting
```

This deploys just the frontend application.

#### Deploy Only Functions (Backend)
```bash
npm run deploy:functions
```

This deploys only the Cloud Functions.

#### Deploy Only Firestore Rules
```bash
npm run deploy:rules
```

#### Deploy Only Firestore Indexes
```bash
npm run deploy:indexes
```

### 3. Verify Deployment

After deployment, Firebase CLI will provide URLs:
- **Hosting URL**: Your application's public URL (e.g., `https://your-project.web.app`)
- **Functions**: Cloud function endpoints

Test the application by visiting the hosting URL.

## Environment Configuration

### Development vs Production

The application uses different environment configurations:

- **Development**: `.env.development`
- **Production**: `.env.production`

Make sure your production environment file has the correct Firebase configuration:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_USE_EMULATORS=false
```

## Firebase Emulators (Local Testing)

Before deploying to production, test locally with Firebase Emulators:

### Start Emulators
```bash
npm run emulators
```

This starts:
- **Auth Emulator**: Port 9099
- **Firestore Emulator**: Port 8080
- **Functions Emulator**: Port 5001
- **Hosting Emulator**: Port 5000
- **Emulator UI**: Port 4000 (http://localhost:4000)

### With Data Import
```bash
npm run emulators:import
```

### Export Emulator Data
```bash
npm run emulators:export
```

## Troubleshooting

### Build Fails
- Check that all dependencies are installed: `npm install`
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check for TypeScript/ESLint errors: `npm run lint`

### Deployment Fails
- Verify you're logged in: `firebase login`
- Check your Firebase project: `firebase projects:list`
- Ensure the correct project is selected: `firebase use <project-id>`

### Functions Deployment Issues
- Check `functions/package.json` for correct dependencies
- Ensure Node.js version matches Firebase requirements
- Review function logs: `firebase functions:log`

## Post-Deployment

### Monitor Application
1. Check Firebase Console for errors
2. Review Cloud Function logs
3. Monitor Firestore usage
4. Check Authentication activity

### Update Security Rules
If you modified Firestore rules or indexes, deploy them separately:
```bash
npm run deploy:rules
npm run deploy:indexes
```

## Rollback

If deployment causes issues, you can roll back:

### Hosting Rollback
```bash
firebase hosting:rollback
```

### Functions Rollback
Functions don't have automatic rollback. Redeploy the previous version from git:
```bash
git checkout <previous-commit>
npm run deploy:functions
```

## Continuous Deployment

For automated deployments, consider setting up GitHub Actions with Firebase:

1. Add Firebase token: `firebase login:ci`
2. Store token in GitHub Secrets
3. Create `.github/workflows/deploy.yml` workflow

## Support

For Firebase-specific issues, refer to:
- Firebase Documentation: https://firebase.google.com/docs
- Firebase CLI Reference: https://firebase.google.com/docs/cli
- Firebase Console: https://console.firebase.google.com
