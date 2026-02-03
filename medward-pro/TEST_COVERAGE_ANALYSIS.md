# Test Coverage Analysis - MedWard Pro

## Executive Summary

**Current Test Coverage: 0%**

Despite having Vitest configured in `package.json`, no test files exist in the codebase. This analysis identifies critical areas requiring test coverage and provides a prioritized implementation plan.

| Metric | Value |
|--------|-------|
| Source Files | 30 (29 frontend + 1 backend) |
| Lines of Code | ~4,000 |
| Test Files | 0 |
| Functions Requiring Tests | 150+ |

---

## Current Testing Infrastructure

### Already Configured
- **Frontend**: Vitest v1.2.0 (installed, unused)
  - `npm test` - Runs vitest
  - `npm run test:coverage` - Runs vitest with coverage
- **Backend**: firebase-functions-test v3.2.0 (installed in `/functions`, unused)

### Missing
- No `vitest.config.js` or test configuration
- No `__tests__/` directories
- No mocking utilities configured
- No test utilities or fixtures

---

## Priority 1: Critical Systems (Must Test First)

These systems handle data integrity and could cause data loss if they fail.

### 1. Write-Ahead Log (WAL) System
**File**: `src/services/storage.adapter.js:19-146`

The WAL ensures offline data reliability. Bugs here could cause data loss.

**Functions to test**:
| Function | Purpose | Test Cases Needed |
|----------|---------|-------------------|
| `wal.add()` | Create WAL entries | Valid mutation, missing fields, ID generation |
| `wal.getPending()` | Get unsynced entries | Empty state, multiple entries, filtering |
| `wal.updateStatus()` | Mark synced/failed | Valid ID, invalid ID, status transitions |
| `wal.incrementRetry()` | Track retry attempts | Counter increment, max retries |
| `wal.clearSynced()` | Cleanup old entries | Age filtering, edge cases |
| `wal.enforceMaxSize()` | Prevent unbounded growth | Priority deletion order |
| `wal.autoCleanup()` | Combined cleanup | Integration of above |

**Example test cases**:
```javascript
describe('WAL System', () => {
  describe('add()', () => {
    it('should generate UUID if not provided');
    it('should set default status to pending');
    it('should create idempotency key');
    it('should persist to IndexedDB');
  });

  describe('enforceMaxSize()', () => {
    it('should delete synced entries first');
    it('should never delete pending entries');
    it('should delete failed entries after synced');
  });
});
```

### 2. State Store
**File**: `src/core/store.js`

Single source of truth for UI state. Errors here cascade through the entire app.

**Functions to test**:
| Function | Purpose | Test Cases Needed |
|----------|---------|-------------------|
| `apply()` | Apply mutations | add/update/delete operations, unknown collection |
| `restore()` | Rollback changes | Restore after add, update, delete |
| `replace()` | Bulk replace | Valid array, invalid input |
| `select()/selectOne()` | Query state | With/without filter, non-existent collection |
| `getClone()` | Deep clone for rollback | Cloning, null cases |

**Example test cases**:
```javascript
describe('Store', () => {
  describe('apply()', () => {
    it('should add item to collection');
    it('should update existing item by ID');
    it('should delete item by ID');
    it('should emit store:collection event');
    it('should emit data:updated event');
    it('should warn for unknown collection');
  });

  describe('restore()', () => {
    it('should revert add by removing item');
    it('should revert update with previous state');
    it('should revert delete by re-adding item');
  });
});
```

### 3. Firebase Cloud Functions (Backend)
**File**: `functions/src/index.ts`

All backend business logic. No validation exists for these critical functions.

**Functions to test**:
| Function | Priority | Test Cases Needed |
|----------|----------|-------------------|
| `ensureUserProfile` | High | Create new, existing user, invalid auth |
| `loadData` | Critical | Authorization check, unit membership, data chunking |
| `saveData` | Critical | Create/update ops, invalid collection, permissions |
| `moveToTrash` | High | Soft delete, already deleted, permissions |
| `sendPatient` | High | Valid handover, invalid recipient, patient not found |
| `acceptInboxPatient` | High | Accept flow, already processed, batch operations |
| `cleanupTrash` | Medium | Expiration, batch deletion |

**Example test cases**:
```typescript
describe('Cloud Functions', () => {
  describe('loadData', () => {
    it('should reject unauthenticated requests');
    it('should reject non-members of unit');
    it('should return patients and tasks for unit');
    it('should chunk patient IDs for task queries');
  });

  describe('sendPatient', () => {
    it('should create handover record');
    it('should include patient tasks');
    it('should fail if recipient not found');
    it('should set status to pending');
  });
});
```

---

## Priority 2: Core Business Logic

### 4. Patient Service
**File**: `src/features/patients/patient.service.js`

~300 lines of patient management logic.

**Key functions to test**:
- `add()` / `update()` / `delete()` - CRUD operations
- `search()` - Search across multiple fields
- `getStats()` - Statistics calculation
- `getSorted()` - Sorting with multiple criteria
- `exportForHandover()` / `importFromHandover()` - Data transfer

**Example test cases**:
```javascript
describe('PatientService', () => {
  describe('search()', () => {
    it('should search by name');
    it('should search by MRN');
    it('should search by diagnosis');
    it('should filter by status');
    it('should limit results');
    it('should handle empty query');
  });

  describe('getStats()', () => {
    it('should count patients by status');
    it('should aggregate task statistics');
    it('should calculate completion rate');
  });
});
```

### 5. Task Service
**File**: `src/features/tasks/task.service.js`

~240 lines of task management.

**Key functions to test**:
- Task CRUD operations
- `toggleComplete()` - Status toggling
- `getByPatient()` - Filtering
- `getStats()` - Per-patient statistics
- `bulkComplete()` / `bulkDelete()` - Bulk operations
- `copyToPatient()` - Task copying

### 6. Storage Database Layer
**File**: `src/services/storage.db.js`

~300 lines of IndexedDB operations.

**Key functions to test**:
- Database initialization
- Object store creation
- Index management
- CRUD operations (get, put, delete)
- Batch operations (putMany, deleteMany)
- Error handling and recovery

---

## Priority 3: Integration Points

### 7. Firebase Sync Service
**File**: `src/services/firebase.sync.js`

**Test scenarios**:
- Online/offline detection
- Outbox processing
- Conflict resolution strategies
- Real-time listener management
- Data merging logic

### 8. Authentication Service
**File**: `src/services/firebase.auth.js`

**Test scenarios**:
- Sign in/up/out flows
- OAuth (Google) integration
- Password reset
- Error message formatting
- Profile updates

### 9. Handover Service
**File**: `src/features/handover/handover.service.js`

**Test scenarios**:
- Send patient workflow
- Accept/decline inbox items
- Report generation (text/JSON)
- Clipboard operations

---

## Priority 4: Utilities and UI

### 10. Event Bus
**File**: `src/core/core.events.js`

**Test scenarios**:
- Event subscription/unsubscription
- Event emission with data
- One-time listeners (`once()`)
- Multiple subscribers

### 11. Unit Service
**File**: `src/features/units/unit.service.js`

**Test scenarios**:
- Unit CRUD
- Member management (add/remove)
- Permission checks

### 12. AI Service
**File**: `src/features/ai/ai.service.js`

**Test scenarios**:
- Clinical query processing
- Drug information retrieval
- Rate limit handling
- Error responses

---

## Recommended Test Structure

```
medward-pro/
├── src/
│   ├── __tests__/
│   │   └── setup.js           # Global test setup
│   ├── core/
│   │   └── __tests__/
│   │       ├── store.test.js
│   │       └── core.events.test.js
│   ├── services/
│   │   └── __tests__/
│   │       ├── storage.adapter.test.js
│   │       ├── storage.db.test.js
│   │       ├── firebase.auth.test.js
│   │       └── firebase.sync.test.js
│   └── features/
│       ├── patients/__tests__/
│       │   └── patient.service.test.js
│       ├── tasks/__tests__/
│       │   └── task.service.test.js
│       └── handover/__tests__/
│           └── handover.service.test.js
└── functions/
    └── src/
        └── __tests__/
            └── index.test.ts
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Goal**: Test infrastructure + critical data layer

1. Create `vitest.config.js` with proper module resolution
2. Create test setup file with mocks
3. Implement tests for:
   - `core/store.js` (15-20 tests)
   - `core/core.events.js` (8-10 tests)
   - `services/storage.adapter.js` WAL section (20-25 tests)

**Expected coverage**: ~15%

### Phase 2: Storage Layer (Week 2)
**Goal**: Complete storage testing

1. Mock IndexedDB for tests
2. Implement tests for:
   - `services/storage.db.js` (20-25 tests)
   - `services/storage.adapter.js` remaining sections (25-30 tests)

**Expected coverage**: ~30%

### Phase 3: Services (Week 3)
**Goal**: Test core services

1. Mock Firebase services
2. Implement tests for:
   - `features/patients/patient.service.js` (30-35 tests)
   - `features/tasks/task.service.js` (25-30 tests)
   - `features/units/unit.service.js` (15-20 tests)

**Expected coverage**: ~55%

### Phase 4: Firebase Integration (Week 4)
**Goal**: Test Firebase-dependent code

1. Implement tests for:
   - `services/firebase.auth.js` (20-25 tests)
   - `services/firebase.sync.js` (25-30 tests)
   - `services/firebase.functions.js` (15-20 tests)

**Expected coverage**: ~70%

### Phase 5: Backend (Week 5)
**Goal**: Test Cloud Functions

1. Set up firebase-functions-test
2. Implement tests for:
   - All cloud functions in `functions/src/index.ts` (50-60 tests)
   - Scheduled functions
   - Error handling

**Expected coverage**: ~85%

### Phase 6: Polish (Week 6)
**Goal**: Edge cases and integration

1. Add remaining service tests
2. Integration tests for critical flows
3. Edge case testing
4. Aim for 90%+ coverage

---

## Mocking Strategy

### IndexedDB
```javascript
// Use fake-indexeddb or idb-mock
import 'fake-indexeddb/auto';
```

### Firebase
```javascript
// Mock Firebase modules
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  // ...
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  // ...
}));
```

### Cloud Functions Testing
```typescript
import * as functionsTest from 'firebase-functions-test';
const test = functionsTest();
// Use test.wrap() for callable functions
```

---

## Coverage Targets

| Metric | Target |
|--------|--------|
| Statements | 85% |
| Branches | 80% |
| Functions | 90% |
| Lines | 85% |

---

## Recommendations Summary

1. **Start with WAL and Store** - These are the foundation of data integrity
2. **Use co-located tests** - Put tests next to the files they test (`__tests__/`)
3. **Mock external dependencies** - Firebase, IndexedDB should be mocked
4. **Test error paths** - Critical for a medical application
5. **Integration tests for Cloud Functions** - Use Firebase Emulator Suite
6. **Add pre-commit hooks** - Run tests before allowing commits

---

## Dependencies to Add

```json
{
  "devDependencies": {
    "@vitest/coverage-v8": "^1.2.0",
    "@vitest/ui": "^1.2.0",
    "fake-indexeddb": "^5.0.0",
    "firebase-functions-test": "^3.2.0"
  }
}
```

---

*Generated: February 2026*
*Codebase: MedWard Pro v1.0.0*
