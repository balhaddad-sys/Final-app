# MEDWARD PRO - Complete Application Documentation

> **Last Updated:** 2026-02-02
> **Application Type:** Vanilla JavaScript + Firebase (NOT React)
> **Version:** Production

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [HTML Pages (UI Components)](#2-html-pages-ui-components)
3. [JavaScript Modules & Functions](#3-javascript-modules--functions)
4. [CSS Styles & Design System](#4-css-styles--design-system)
5. [State Management](#5-state-management)
6. [API Endpoints & Data Types](#6-api-endpoints--data-types)
7. [Data Models](#7-data-models)
8. [File Structure](#8-file-structure)

---

## 1. Architecture Overview

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JavaScript (ES6 Modules) + HTML5 |
| **Backend** | Firebase Cloud Functions v2 (Node.js 20) |
| **Database** | Firebase Firestore |
| **Authentication** | Firebase Auth (Email/Password + Google OAuth) |
| **Local Storage** | IndexedDB + LocalStorage fallback |
| **AI Integration** | Anthropic Claude API |
| **Hosting** | Firebase Hosting |

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────┐
│              USER INTERACTIONS (HTML Pages)         │
├─────────────────────────────────────────────────────┤
│ Dashboard | Login | Landing | Handover | Monitor    │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌───────────────────┐    ┌──────────────────┐
│  Firebase Auth    │    │ Firebase Firestore│
│  (firebase.auth.js)│   │ (firebase.store.js)│
└────────┬──────────┘    └────────┬─────────┘
         │                        │
         └────────────┬───────────┘
                      ▼
         ┌──────────────────────────┐
         │  Real-time Sync Layer    │
         │ (firebase.sync.js)       │
         └────────────┬─────────────┘
                      ▼
         ┌──────────────────────────┐
         │  Storage Layer           │
         │ IndexedDB + LocalStorage │
         │ (storage.db.js,          │
         │  storage.adapter.js)     │
         └──────────────────────────┘
```

---

## 2. HTML Pages (UI Components)

### 2.1 login.html
**Purpose:** User authentication page

**Inputs:**
| Input | Type | Description |
|-------|------|-------------|
| Email | text | User email address |
| Password | password | User password |
| Remember Me | checkbox | Persist session |

**Actions:**
- Form submission (email/password login)
- Google Sign-In button click
- Theme toggle (dark/light)
- Password recovery link
- Tour guide activation

**Outputs:**
- Redirect to landing.html on success
- Error messages on failure

---

### 2.2 landing.html
**Purpose:** Unit/ward selection page

**Inputs:**
| Input | Type | Description |
|-------|------|-------------|
| Unit Selection | click | Select a ward/unit |
| Create Unit | button | Open unit creation modal |
| Unit Name | text | Name for new unit |
| Unit Icon | select | Emoji icon for unit |

**Actions:**
- Unit selection click
- Create new unit
- Edit unit settings
- Delete unit
- Logout
- Theme toggle
- Settings access

**Outputs:**
- Redirect to dashboard.html with selected unit
- Unit list display
- User profile badge

---

### 2.3 dashboard.html
**Purpose:** Primary clinical ward management interface

**Inputs:**
| Input | Type | Description |
|-------|------|-------------|
| Patient Name | text | New patient name |
| MRN | text | Medical Record Number |
| Bed Number | text | Patient bed/room |
| Diagnosis | text | Primary diagnosis |
| Task Text | text | Clinical task description |
| Task Category | select | Labs/Imaging/Consults/Admin |
| Task Due Date | date | Task deadline |
| Notes | textarea | Patient notes |
| Search | text | Filter patients |

**Actions:**
- Add patient (quick-add form)
- Select patient (view details)
- Edit patient information
- Delete/restore patient
- Add task with clinical typeahead
- Mark task complete
- Add/edit notes
- Drug information lookup
- Patient handover initiation
- Pharmacy management
- Sync/refresh data
- Dark mode toggle
- Logout

**Outputs:**
- Patient list with status indicators
- Selected patient details panel
- Task list with completion status
- Drug information display
- Sync status indicator
- Notifications

---

### 2.4 handover.html
**Purpose:** Patient handover and transfer management

**Inputs:**
| Input | Type | Description |
|-------|------|-------------|
| Patient Selection | checkbox | Select patients for handover |
| Recipient Email | email | Recipient user's email |
| Handover Notes | textarea | Additional notes |
| QR Scanner | camera | Scan handover QR |

**Actions:**
- Select patients for handover
- Generate QR code
- Send handover via email
- Print handover summary
- Scan QR code to receive
- Accept/decline handover
- Back/cancel

**Outputs:**
- Selected patients list
- QR code display
- Handover status
- Print-ready summary

---

### 2.5 monitor.html
**Purpose:** System monitoring and debugging dashboard

**Inputs:**
| Input | Type | Description |
|-------|------|-------------|
| Filter Level | select | INFO/WARN/ERROR |
| Filter Type | select | AUTH/SYNC/NET/etc |
| Search | text | Search log entries |

**Actions:**
- Pause/Resume log
- Clear log
- Export data
- Copy to clipboard
- Test heartbeat
- Test fetch
- Test sync
- Test save
- Test delete

**Outputs:**
- Real-time event log (max 2500 entries)
- Performance statistics (network, memory, storage)
- Error counts
- Session information
- Health status indicator

---

### 2.6 ai_assistant.html
**Purpose:** AI-powered clinical decision support

**Inputs:**
| Input | Type | Description |
|-------|------|-------------|
| Query | text | Clinical question |
| Patient Context | object | Optional patient info |

**Actions:**
- Send message
- Clear conversation
- Copy response
- Select suggested prompt

**Outputs:**
- AI response with clinical guidance
- Message history
- Loading indicator

---

### 2.7 antibiotic_guide.html
**Purpose:** Antibiotic prescribing guidelines reference

**Inputs:**
| Input | Type | Description |
|-------|------|-------------|
| Search | text | Antibiotic name |
| Filter by Indication | select | Infection type |
| Filter by Pathogen | select | Target organism |

**Actions:**
- Search antibiotics
- Filter by criteria
- Select antibiotic
- Copy dosing information

**Outputs:**
- Searchable antibiotic database
- Dosing information
- Drug interactions
- Contraindications
- Administration routes

---

### 2.8 oncall_assistant.html
**Purpose:** On-call emergency reference and decision support

**Inputs:**
| Input | Type | Description |
|-------|------|-------------|
| Scenario | text | Clinical scenario |
| Urgency | select | low/medium/high/critical |

**Actions:**
- Protocol selection
- Checklist interaction
- Emergency contact call
- Acknowledgment actions

**Outputs:**
- Emergency protocols
- Quick reference guides
- Checklist templates
- Emergency contacts
- Critical alerts

---

## 3. JavaScript Modules & Functions

### 3.1 Authentication (firebase.auth.js)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `register` | `(email, password, displayName)` | `{success, user?, error?}` | Register new user |
| `login` | `(email, password)` | `{success, user?, error?}` | Email/password login |
| `signInWithGoogle` | `()` | `{success, user?, error?}` | Google OAuth popup |
| `logout` | `()` | `{success, error?}` | Sign out user |
| `getCurrentUser` | `()` | `User \| null` | Get current user |
| `isAuthenticated` | `()` | `boolean` | Check auth status |
| `getUserProfile` | `(uid)` | `Promise<Profile>` | Fetch user profile |
| `onAuthChange` | `(callback)` | `unsubscribe fn` | Subscribe to auth changes |
| `waitForAuth` | `()` | `Promise<User>` | Wait for auth ready |
| `requireAuth` | `({timeoutMs})` | `Promise<User>` | Hydration-safe guard |

---

### 3.2 Firestore Operations (firebase.store.js)

#### Patient Operations

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `createPatient` | `(patientData)` | `{success, patient}` | Create patient |
| `getPatient` | `(patientId)` | `Patient \| null` | Get single patient |
| `getPatientsByUnit` | `(unitId, includeDeleted)` | `Patient[]` | Get unit patients |
| `updatePatient` | `(patientId, updates)` | `{success}` | Update patient |
| `deletePatient` | `(patientId)` | `{success}` | Soft delete |
| `restorePatient` | `(patientId)` | `{success}` | Restore from trash |
| `hardDeletePatient` | `(patientId)` | `{success}` | Permanent delete |
| `batchCreatePatients` | `(patients, unitId)` | `{success, count}` | Bulk import |

#### Unit Operations

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `createUnit` | `(unitData)` | `{success, unit}` | Create unit |
| `getUnit` | `(unitId)` | `Unit \| null` | Get single unit |
| `getUnitsForUser` | `()` | `Unit[]` | Get user's units |
| `updateUnit` | `(unitId, updates)` | `{success}` | Update unit |
| `deleteUnit` | `(unitId)` | `{success}` | Delete unit |
| `addUnitMember` | `(unitId, userId)` | `{success}` | Add member |
| `removeUnitMember` | `(unitId, userId)` | `{success}` | Remove member |

---

### 3.3 Cloud Functions (firebase.functions.js)

#### Data Operations

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `loadData` | `({clientRev, deviceId})` | `{success, data, rev}` | Load user data |
| `saveData` | `({payload, baseRev, force})` | `{success, rev, conflict?}` | Save with conflict detection |
| `listenToData` | `(onUpdate, onError)` | `unsubscribe fn` | Real-time listener |

#### Trash Management

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `moveToTrash` | `(itemIds, itemType)` | `{trashedCount}` | Trash items |
| `getTrash` | `()` | `{items}` | Get trash |
| `restoreFromTrash` | `(itemIds)` | `{restoredCount}` | Restore items |
| `emptyTrash` | `(itemIds?)` | `{deletedCount}` | Empty trash |

#### Patient Handover

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `sendPatient` | `(email, patientData)` | `{success, message}` | Send handover |
| `checkInbox` | `()` | `{items, count}` | Check inbox |
| `acceptInboxPatient` | `(patientId, unitId)` | `{success}` | Accept handover |
| `declineInboxPatient` | `(patientId)` | `{success}` | Decline handover |

#### AI Functions (Claude Integration)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `askClinical` | `(question, context?, model?)` | `{answer, usage}` | Clinical Q&A |
| `analyzeLabs` | `(labs, context?, model?)` | `{analysis, usage}` | Lab analysis |
| `getDrugInfo` | `(drugName, indication?)` | `{drugInfo, usage}` | Drug information |
| `generateDifferential` | `(symptoms, context?)` | `{differential, usage}` | Differential diagnosis |
| `getTreatmentPlan` | `(diagnosis, context?)` | `{plan, usage}` | Treatment plan |
| `oncallConsult` | `(scenario, urgency)` | `{consultation, usage}` | On-call consult |
| `identifyMedication` | `(image, info?)` | `{identification}` | Medication ID (vision) |
| `analyzeDocument` | `(image, type?)` | `{analysis}` | Document OCR |
| `extractPatients` | `(image, format?)` | `{patients, count}` | Patient extraction |

---

### 3.4 Real-time Sync (firebase.sync.js)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `subscribeToPatients` | `(unitId, onUpdate, onError)` | `unsubscribe fn` | Patient listener |
| `subscribeToUnits` | `(onUpdate, onError)` | `unsubscribe fn` | Unit listener |
| `subscribeToPatient` | `(patientId, onUpdate, onError)` | `unsubscribe fn` | Single patient |
| `getSyncStatus` | `()` | `string` | Get status |
| `onSyncStatusChange` | `(callback)` | `unsubscribe fn` | Status listener |
| `unsubscribeAll` | `()` | `void` | Cleanup all |
| `initConnectionMonitor` | `()` | `void` | Start monitoring |

---

### 3.5 Clinical Typeahead (clinical-typeahead.js)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `filterTasks` | `(query, type?)` | `Task[]` (max 8) | Filter suggestions |
| `setTypeFilter` | `(type)` | `void` | Set category filter |
| `showSuggestions` | `(input, query)` | `void` | Display dropdown |
| `hideSuggestions` | `()` | `void` | Hide dropdown |
| `selectSuggestion` | `(index)` | `void` | Select item |
| `attach` | `(inputElement)` | `void` | Initialize on input |
| `init` | `()` | `void` | Auto-initialize |

**Clinical Task Database:**

| Category | Tasks |
|----------|-------|
| **Labs** | CBC, U&E, LFT, Coagulation, Blood Cultures, Troponin, ABG, HbA1c, Lipid Panel, TSH |
| **Imaging** | CXR, CT Head, CT Abdomen, US Abdomen, Echo, MRI, Doppler |
| **Consults** | Cardiology, GI, ID, Neurology, Surgery, Radiology |
| **Admin** | Discharge Summary, Sick Leave, Transfer, Family Meeting, Update PCP |

---

### 3.6 Monitoring (monitor.core.js)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `MW_MONITOR.log` | `(type, msg, data, level)` | `void` | Log event |
| `MW_MONITOR.subscribe` | `(callback)` | `unsubscribe fn` | Subscribe to events |
| `MW_MONITOR.getAll` | `()` | `Event[]` | Get all events |
| `MW_MONITOR.getStats` | `()` | `{byLevel, byType}` | Get statistics |
| `MW_MONITOR.clear` | `()` | `void` | Clear buffer |
| `instrumentAll` | `()` | `void` | Initialize all |
| `timed` | `(label, fn)` | `Promise<*>` | Time async operation |

**Event Types:** `AUTH`, `SYNC`, `STORE`, `NET`, `UI`, `RUNTIME`, `CONSOLE`
**Log Levels:** `info`, `warn`, `error`

---

### 3.7 Storage (storage.db.js, storage.adapter.js)

#### IndexedDB Operations

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `initStorage` | `({build})` | `{db, deviceId}` | Initialize DB |
| `upsertPatient` | `(db, patient, options)` | `record` | Create/update |
| `listPatientsByUnit` | `(db, unitId)` | `Patient[]` | Query by unit |
| `softDeletePatient` | `(db, patientId)` | `record` | Soft delete |
| `enqueuePatch` | `(db, patch)` | `record` | Queue for sync |
| `listPendingPatches` | `(db, {maxAge})` | `Patch[]` | Get pending |
| `acknowledgePatch` | `(db, patchId)` | `true` | Mark synced |
| `exportFullState` | `(db)` | `state` | Export backup |
| `importFullState` | `(db, state)` | `true` | Import data |

**IndexedDB Stores:**

| Store | Key | Indexes |
|-------|-----|---------|
| `patients` | `id` | by_unit, by_deleted, by_updated, by_status |
| `units` | `id` | by_updated |
| `trash` | `id` | by_type, by_deleted |
| `wal` | `opId` | by_status, by_ts |
| `patches` | `id` | by_ts, by_acked |
| `meta` | `key` | - |

---

## 4. CSS Styles & Design System

### 4.1 CSS Variables (Design Tokens)

#### Light Theme (Default)
```css
:root {
  /* Primary Colors */
  --primary: #005eb8;              /* NHS Medical Standard Blue */
  --primary-dark: #003087;         /* Deep Navy */
  --primary-light: #e6f0f9;        /* Faint blue highlight */

  /* Background Colors */
  --bg-app: #f8fafc;               /* Light Gray App Background */
  --bg-surface: #ffffff;           /* Pure White Cards */
  --bg-input: #f1f5f9;             /* Light gray inputs */

  /* Text Colors */
  --text-main: #0f172a;            /* Near Black */
  --text-secondary: #475569;       /* Gray labels */
  --text-muted: #94a3b8;           /* Light gray metadata */

  /* Semantic Colors */
  --success: #059669;              /* Emerald Green */
  --danger: #dc2626;               /* Red */
  --warning: #d97706;              /* Amber */

  /* Borders & Layout */
  --border: #e2e8f0;               /* Subtle dividers */
  --radius: 16px;                  /* Default border radius */
  --radius-sm: 10px;               /* Small radius */
}
```

#### Dark Theme
```css
body.dark-theme {
  --primary: #60a5fa;
  --bg-app: #0f172a;
  --bg-surface: #1e293b;
  --text-main: #f8fafc;
  --border: #334155;
}
```

### 4.2 Typography

| Size | Usage |
|------|-------|
| 0.7rem | Form labels, metadata |
| 0.85rem | Body text, labels |
| 1rem | Default body |
| 1.25rem | Page titles |
| 1.75rem | Major headings |

**Font Family:** `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
**Monospace:** `'JetBrains Mono', monospace`

### 4.3 Spacing System

```
Base unit: 4px
Common: 4, 8, 12, 16, 20, 24, 32, 40, 48px
```

### 4.4 Component Patterns

#### Buttons
```css
.btn {
  padding: 14px 24px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  transition: all 0.2s;
}

.btn-primary { background: var(--primary); color: #fff; }
.btn-secondary { background: transparent; border: 1px solid var(--border); }
.btn-danger { background: var(--danger); color: #fff; }
```

#### Form Inputs
```css
.form-input {
  padding: 14px 16px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(0, 94, 184, 0.1);
}
```

#### Cards
```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

#### Modals
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1000;
}

.modal {
  background: var(--bg-surface);
  border-radius: var(--radius);
  max-width: 480px;
  max-height: 90vh;
}
```

### 4.5 Animations

```css
/* Spin (Loading) */
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Pulse (Breathing) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Scale In */
@keyframes scaleIn {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

/* Modal In */
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

### 4.6 Responsive Breakpoints

| Breakpoint | Usage |
|------------|-------|
| `max-width: 480px` | Mobile |
| `max-width: 768px` | Tablet |
| `min-width: 600px` | Desktop |

---

## 5. State Management

### 5.1 Global State (window.state)

```javascript
const state = window.state = {
  // Data
  patients: [],
  units: [],
  trash: { patients: [], units: [] },

  // Current Selections
  currentUnit: null,
  currentPatient: null,
  currentUser: null,
  selectedUnitId: null,

  // UI State
  currentFilter: 'all',
  selectedIcon: '🏥',

  // Settings
  settings: {
    theme: 'light'
  }
};
```

### 5.2 State Layers

| Layer | Storage | Persistence |
|-------|---------|-------------|
| Firebase Auth | Memory + IndexedDB | Automatic |
| Firestore | Cloud | Real-time sync |
| IndexedDB | Local device | Manual |
| window.state | Memory | Session only |
| Monitor buffer | Memory | Max 2000 events |

### 5.3 Sync Status Values

- `'connected'` - Firebase connected
- `'disconnected'` - Firebase offline
- `'syncing'` - Data syncing in progress

---

## 6. API Endpoints & Data Types

### 6.1 Cloud Functions

#### Data Operations
```javascript
// Load user data
loadData({ clientRev, deviceId }) → { success, data, rev, upToDate }

// Save with conflict detection
saveData({ payload, baseRev, force, deviceId }) → { success, rev, conflict? }
```

#### Trash Management
```javascript
moveToTrash(itemIds, itemType) → { trashedCount }
getTrash() → { items }
restoreFromTrash(itemIds) → { restoredCount }
emptyTrash(itemIds?) → { deletedCount }
```

#### Handover
```javascript
sendPatient(email, patientData) → { success, message }
checkInbox() → { items, count, pendingCount }
acceptInboxPatient(patientId, unitId) → { success }
declineInboxPatient(patientId) → { success }
```

#### AI Functions
```javascript
askClinical(question, context?, model?) → { answer, model, usage }
analyzeLabs(labs, context?, model?) → { analysis, model, usage }
getDrugInfo(drugName, indication?, context?, model?) → { drugInfo, model, usage }
generateDifferential(symptoms, context?, model?) → { differential, model, usage }
getTreatmentPlan(diagnosis, context?, model?) → { plan, model, usage }
oncallConsult(scenario, context?, urgency, model?) → { consultation, model, usage }
identifyMedication(image, info?) → { identification, model, usage }
analyzeDocument(image, type?, context?) → { analysis, model, usage }
extractPatients(image, format?) → { patients, rawText, count, model, usage }
```

### 6.2 Error Codes

**Firebase HttpsError:**
- `unauthenticated` - Not logged in
- `permission-denied` - Access denied
- `invalid-argument` - Bad parameters
- `not-found` - Resource missing
- `failed-precondition` - Prerequisites not met
- `internal` - Server error

**Auth Errors:**
- `auth/email-already-in-use`
- `auth/invalid-email`
- `auth/weak-password`
- `auth/user-not-found`
- `auth/wrong-password`
- `auth/popup-blocked`

---

## 7. Data Models

### 7.1 Patient

```typescript
interface Patient {
  id: string;
  unitId: string;
  name: string;
  mrn?: string;
  room?: string;
  ward?: string;
  diagnosis?: string;
  age?: string;
  gender?: string;
  doctor?: string;
  consultant?: string;
  admitDate?: string;
  notes?: string;
  status: 'active' | 'chronic' | 'discharged' | 'transferred';
  chronic?: boolean;
  newPatient?: boolean;       // Highlights in orange
  createdBy: string;          // userId
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;      // Soft delete
  // Handover fields
  sentAt?: string;
  sentBy?: { uid, email, displayName };
  acceptedAt?: string;
  acceptedFrom?: { uid, email };
  source?: 'google-sheets' | 'manual' | 'handover';
}
```

### 7.2 Task

```typescript
interface Task {
  id: string;
  patientId: string;
  title: string;              // From clinical typeahead
  type: 'lab' | 'img' | 'cons' | 'admin';
  completed: boolean;
  dueDate?: string;
  completedAt?: Timestamp;
  notes?: string;
  createdAt: Timestamp;
}
```

### 7.3 Unit

```typescript
interface Unit {
  id: string;
  name: string;
  code?: string;
  icon?: string;              // Emoji
  members: string[];          // userIds
  admins: string[];           // userIds
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 7.4 User Profile

```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  authProvider: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  settings: {
    theme: 'auto' | 'light' | 'dark';
    notifications?: boolean;
    offlineMode?: boolean;
    defaultUnit?: string;
  };
}
```

### 7.5 Handover Item

```typescript
interface HandoverItem extends Patient {
  sentAt: string;
  sentBy: {
    uid: string;
    email: string;
    displayName: string;
  };
  status: 'pending' | 'accepted' | 'declined';
}
```

### 7.6 Patch (Sync Queue)

```typescript
interface Patch {
  id: string;
  ts: number;                 // Timestamp
  kind: 'upsert' | 'delete';
  entity: 'patient' | 'unit';
  payload: object;
  acked: boolean;             // Acknowledged by server
}
```

---

## 8. File Structure

```
/home/user/Final-app/
├── HTML Pages
│   ├── index.html              # Redirect/routing
│   ├── login.html              # Authentication
│   ├── landing.html            # Unit selection
│   ├── dashboard.html          # Main application
│   ├── handover.html           # Patient handover
│   ├── monitor.html            # System monitoring
│   ├── loading.html            # Splash screen
│   ├── ai_assistant.html       # AI chat
│   ├── antibiotic_guide.html   # Drug reference
│   └── oncall_assistant.html   # On-call support
│
├── JavaScript Modules
│   ├── firebase.config.js      # Firebase initialization (141 lines)
│   ├── firebase.auth.js        # Authentication service (406 lines)
│   ├── firebase.store.js       # Firestore CRUD (468 lines)
│   ├── firebase.functions.js   # Cloud Functions client (692 lines)
│   ├── firebase.sync.js        # Real-time sync (455 lines)
│   ├── auth.guard.js           # Auth protection (172 lines)
│   ├── storage.db.js           # IndexedDB layer (1,077 lines)
│   ├── storage.adapter.js      # Storage wrapper (474 lines)
│   ├── storage.migrate.js      # Data migration (474 lines)
│   ├── storage.quickstart.js   # Storage helpers (417 lines)
│   ├── clinical-typeahead.js   # Task autocomplete (507 lines)
│   ├── medward-tour.js         # Guided tours (1,311 lines)
│   ├── monitor.core.js         # Core monitoring (336 lines)
│   ├── monitor.js              # Monitor UI (583 lines)
│   └── sw.js                   # Service Worker (64 lines)
│
├── Firebase Backend
│   └── medward-firebase/
│       ├── functions/
│       │   └── index.js        # Cloud Functions (2,500+ lines)
│       ├── firestore.rules     # Security rules
│       └── firestore.indexes.json
│
└── Configuration
    ├── firebase.json           # Firebase config
    └── package.json            # Dependencies
```

---

## Summary

**Medward Pro** is a comprehensive clinical ward management system built with:

- **15 HTML pages** serving as UI interfaces
- **15+ JavaScript modules** providing business logic
- **200+ functions** across all modules
- **Firebase backend** with Cloud Functions and Firestore
- **IndexedDB** for offline-first persistence
- **Real-time synchronization** across devices
- **AI integration** with Claude for clinical decision support
- **Clinical-specific features** including typeahead, drug lookup, and patient handover

The application follows an **offline-first architecture** with **cloud synchronization**, using **Firebase as the source of truth** and **IndexedDB for local persistence**.
