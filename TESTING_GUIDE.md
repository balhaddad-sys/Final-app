# Testing Guide - IndexedDB Storage System
**Complete testing instructions for MedWard Pro storage layer**

Version: 1.0.0
Date: 2026-01-26

---

## 🚀 Quick Start (5 Minutes)

### Option 1: Automated Test Suite (Recommended)

1. **Open the test page:**
   ```bash
   # Open in browser
   file:///home/user/Final-app/storage.test.html
   ```

2. **Click "Run All Tests"**

3. **Watch the results:**
   - ✅ All tests should pass
   - Check stats at the top (patients, patches, storage)
   - Review event log at bottom

4. **Open DevTools to verify:**
   - Press `F12`
   - Go to **Application** tab
   - Expand **IndexedDB** → **medward_pro**
   - Verify stores: `patients`, `units`, `patches`, `wal`, `meta`, `trash`

**Expected Result:** All 9 tests pass in <5 seconds

---

## 🧪 Manual Testing (Step-by-Step)

### Test 1: Basic Initialization

**What it tests:** IndexedDB opens correctly and migration runs

**Steps:**
1. Open `storage.test.html` in browser
2. Click **"Test 1: Initialize Storage"**
3. Check result box - should show:
   - ✅ PASS
   - Initialized in ~50-200ms
   - deviceId created
   - mode: 'indexeddb'

**Verify in DevTools:**
- F12 → Application → IndexedDB → medward_pro
- Should see database with 6 stores

**Troubleshooting:**
- If FAIL: Check console for errors
- If "not supported": Browser doesn't support IndexedDB
- If timeout: Increase FETCH_TIMEOUT_MS

---

### Test 2: Add Patient

**What it tests:** Patient save with WAL and transaction commit

**Steps:**
1. Click **"Test 2: Add Patient"**
2. Check result - should show:
   - ✅ PASS
   - Patient saved in <10ms
   - Patient ID, rev, name

**Verify in DevTools:**
1. IndexedDB → medward_pro → **patients** store
2. Right-click → "Refresh"
3. Should see 1 patient entry
4. Click to expand - verify all fields present

**Verify WAL:**
1. IndexedDB → medward_pro → **wal** store
2. Should see 1 entry with:
   - status: "COMMITTED"
   - kind: "UPSERT_PATIENT"
   - opId: unique ID

**Troubleshooting:**
- If FAIL: Check console.error
- If slow (>50ms): Check browser performance
- If missing fields: Check patient object structure

---

### Test 3: Query by Unit

**What it tests:** Indexed query performance

**Steps:**
1. Click **"Test 3: Query by Unit"**
2. Check result - should show:
   - ✅ PASS
   - Query completed in <10ms
   - Performance: "Excellent"

**Expected Performance:**
- <5ms: Excellent ⚡
- 5-20ms: Good ✅
- >20ms: Slow (but still passes)

**Verify:**
- Run test multiple times
- Average should be <10ms

**Troubleshooting:**
- If slow: Check if indexes were created
- Verify: IndexedDB → patients → Indexes → "by_unit"

---

### Test 4: Soft Delete

**What it tests:** Soft delete with tombstone and trash

**Steps:**
1. Click **"Test 4: Soft Delete"**
2. Check result - should show:
   - ✅ PASS
   - Soft delete completed in <5ms
   - inTrash: true
   - inActiveList: false

**Verify in DevTools:**
1. IndexedDB → **patients** store
   - Find the deleted patient
   - Should have `deletedAt` timestamp
2. IndexedDB → **trash** store
   - Should see entry with:
     - type: "patient"
     - originalId: patient ID
     - deletedAt: timestamp

**Verify in Test Page:**
- "Patients" stat should NOT decrease
- Deleted patients are still stored, just marked

**Troubleshooting:**
- If patient still visible: Check deletedAt field
- If not in trash: Check trash store structure

---

### Test 5: Patch Queue

**What it tests:** Patch enqueueing and acknowledgment

**Steps:**
1. Click **"Test 5: Patch Queue"**
2. Check result - should show:
   - ✅ PASS
   - enqueued: true
   - acknowledged: true
   - pendingCount: number

**Verify in DevTools:**
1. IndexedDB → **patches** store
2. Should see patches with:
   - id: "p_test_..."
   - operation: "updatePatient"
   - acknowledged: true
   - acknowledgedAt: timestamp

**Verify Stats:**
- "Patches" stat at top should update
- After acknowledgment, pending count decreases

**Troubleshooting:**
- If patches not acknowledged: Check bulkAcknowledgePatches
- If missing patches: Check enqueuePatch

---

### Test 6: Crash Recovery

**What it tests:** WAL replay and data persistence

**Steps:**
1. Click **"Test 6: Crash Recovery"**
2. Check result - should show:
   - ✅ PASS
   - patientPersisted: true
   - pendingWal: 0
   - message: "Patient survived simulated crash"

**Manual Crash Test:**
1. Add a patient via Test 2
2. **Immediately close the tab** (Ctrl+W)
3. Reopen `storage.test.html`
4. Run Test 1 (init)
5. Run Test 3 (query)
6. Patient should still be there ✅

**Verify:**
- IndexedDB → wal store
- All entries should be "COMMITTED" (not "PENDING")

**Troubleshooting:**
- If data lost: WAL not working properly
- Check replayPendingWal function

---

### Test 7: Bulk Operations

**What it tests:** Performance with 100 patients

**Steps:**
1. Click **"Test 7: Bulk Operations"**
2. Wait ~2-5 seconds
3. Check result - should show:
   - ✅ PASS
   - Inserted: 100
   - Retrieved: 100
   - avgTimePerPatient: <1ms

**Verify in DevTools:**
- IndexedDB → patients store
- Should have 100+ patients (previous tests + bulk)

**Performance Benchmarks:**
- Total time <500ms: Excellent
- Total time <2000ms: Good
- Total time >2000ms: Slow (check browser)

**Verify Stats:**
- "Patients" stat should jump to 100+
- "Storage Used" should increase

**Troubleshooting:**
- If slow: Check bulkUpsertPatients implementation
- If count mismatch: Check transaction commits

---

### Test 8: Metadata

**What it tests:** Sync metadata storage (rev, checksum)

**Steps:**
1. Click **"Test 8: Metadata Storage"**
2. Check result - should show:
   - ✅ PASS
   - rev: 42
   - checksum: "test-checksum-abc123"
   - testData: nested object

**Verify in DevTools:**
1. IndexedDB → **meta** store
2. Should see entries:
   - key: "clientRev", value: 42
   - key: "clientChecksum", value: "test-checksum-abc123"
   - key: "testData", value: {nested: {value: "test"}}

**Real-World Use:**
- This is how sync state is persisted
- Replaces localStorage.setItem('MW_REV_V3', ...)

**Troubleshooting:**
- If values don't match: Check setMeta/getMeta
- If not persisting: Check meta store schema

---

### Test 9: Transaction Atomicity

**What it tests:** ACID transaction guarantees

**Steps:**
1. Click **"Test 9: Transaction Safety"**
2. Check result - should show:
   - ✅ PASS
   - atomicity: "PASS"
   - message: "Patient + WAL written atomically"

**What this proves:**
- If patient saves, WAL entry MUST also save
- If transaction fails, BOTH roll back
- No partial writes (ACID guarantee)

**Verify in DevTools:**
- Check patients and wal stores
- Every patient should have corresponding WAL entry

**Troubleshooting:**
- If patient exists but no WAL: Transaction not atomic!
- Check transaction wrapper in storage.db.js

---

## 🔍 DevTools Inspection Guide

### Opening IndexedDB in Browser

**Chrome/Edge:**
1. Press `F12`
2. Click **Application** tab
3. Expand **Storage** → **IndexedDB**
4. Click **medward_pro**
5. Inspect each store

**Firefox:**
1. Press `F12`
2. Click **Storage** tab
3. Expand **IndexedDB**
4. Click **medward_pro**
5. Inspect each store

**Safari:**
1. Enable Developer menu (Preferences → Advanced → Show Develop menu)
2. Develop → Show Web Inspector
3. Click **Storage** tab
4. Expand **IndexedDB**

---

### What to Look For in Each Store

#### patients store
- **Structure:**
  - id: string (unique)
  - name: string
  - location: string
  - status: string
  - unitId: string
  - rev: number
  - updatedAt: timestamp
  - deletedAt: timestamp or null

- **Indexes:**
  - by_unit (query by unitId)
  - by_deleted (filter deleted)
  - by_updated (sort by update time)
  - by_status (filter by status)

#### units store
- **Structure:**
  - id: string
  - name: string
  - rev: number
  - updatedAt: timestamp

#### patches store
- **Structure:**
  - id: string (e.g., "p_1234567890_abc")
  - operation: string (e.g., "updatePatient")
  - payload: object
  - ts: timestamp
  - acknowledged: boolean
  - acknowledgedAt: timestamp (if acked)

- **Indexes:**
  - by_ts (sort by time)
  - by_acked (filter by acknowledgment)

#### wal store (Write-Ahead Log)
- **Structure:**
  - opId: string (correlationId)
  - ts: timestamp
  - status: "PENDING" | "COMMITTED" | "FAILED"
  - kind: string (e.g., "UPSERT_PATIENT")
  - payload: object

- **Expected:**
  - Most entries should be "COMMITTED"
  - "PENDING" entries only during active writes
  - "FAILED" entries indicate errors

#### meta store
- **Structure:**
  - key: string
  - value: any
  - updatedAt: timestamp

- **Common keys:**
  - deviceId
  - build
  - clientRev
  - clientChecksum
  - migrationVersion
  - migratedAt

#### trash store
- **Structure:**
  - id: string
  - originalId: string (original patient/unit ID)
  - type: "patient" | "unit"
  - deletedAt: timestamp
  - ...all original fields

---

## 🧹 Cleaning Up Test Data

### Option 1: Use Test Page
1. Open `storage.test.html`
2. Click **"Clear All Data"** button
3. Confirm
4. Reload page

### Option 2: Manual (DevTools)
1. F12 → Application → IndexedDB
2. Right-click **medward_pro**
3. Click **"Delete database"**
4. Clear localStorage: `localStorage.clear()`

### Option 3: Code
```javascript
// In browser console
indexedDB.deleteDatabase('medward_pro');
localStorage.removeItem('MW_INDEXEDDB_MIGRATED');
location.reload();
```

---

## 📊 Performance Benchmarks

### Expected Performance (Typical Hardware)

| Operation | Target | Good | Slow |
|-----------|--------|------|------|
| Initialize | <200ms | <500ms | >1000ms |
| Add patient | <5ms | <20ms | >50ms |
| Query by unit | <5ms | <20ms | >50ms |
| Soft delete | <5ms | <20ms | >50ms |
| Enqueue patch | <5ms | <20ms | >50ms |
| Bulk 100 patients | <500ms | <2000ms | >5000ms |
| Get metadata | <2ms | <10ms | >20ms |

### If Performance is Slow

**Check:**
1. Browser: Chrome/Edge are fastest for IndexedDB
2. Disk: SSD vs HDD makes huge difference
3. Load: Close other tabs/apps
4. Data: Large payloads slow down operations

**Optimize:**
1. Clear old data periodically
2. Use indexed queries
3. Batch operations when possible
4. Avoid large object payloads

---

## 🐛 Common Issues & Solutions

### Issue 1: "IndexedDB not supported"
**Solution:** Use modern browser (Chrome 24+, Firefox 16+, Safari 10+, Edge 12+)

### Issue 2: Quota exceeded
**Symptoms:** Write operations fail
**Solution:**
```javascript
// Check quota
const stats = await QuickStorage.stats();
console.log('Storage:', stats.estimatedBytes);

// Clear old patches
await QuickStorage.clearAcknowledgedPatchesFromDB();

// Empty trash
await QuickStorage.emptyTrashDB({ olderThanDays: 30 });
```

### Issue 3: Migration doesn't run
**Check:**
```javascript
localStorage.getItem('MW_INDEXEDDB_MIGRATED'); // Should be "1.0.0"
```

**Fix:**
```javascript
// Force re-migration (CAUTION)
localStorage.removeItem('MW_INDEXEDDB_MIGRATED');
location.reload();
```

### Issue 4: Data not persisting
**Symptoms:** Data disappears after refresh

**Check:**
1. Are transactions committing?
2. Is database closing properly?
3. Is browser in incognito mode? (IndexedDB may not persist)

**Debug:**
```javascript
// Check if database is open
console.log('DB:', window.testDB);

// Check connection state
if (window.testDB) {
  console.log('Version:', window.testDB.version);
  console.log('Name:', window.testDB.name);
}
```

### Issue 5: Slow performance
**Symptoms:** Operations take >100ms

**Check:**
1. Are indexes created? (DevTools → IndexedDB → patients → Indexes)
2. Is disk slow? (check with `performance.now()`)
3. Is browser throttled? (check DevTools → Performance)

**Fix:**
- Use indexed queries
- Reduce payload size
- Batch operations
- Close other tabs

---

## 🎯 Integration Testing Checklist

Before integrating into dashboard.html:

- [ ] Test 1 passes (initialization)
- [ ] Test 2 passes (add patient)
- [ ] Test 3 passes (<10ms queries)
- [ ] Test 4 passes (soft delete)
- [ ] Test 5 passes (patch queue)
- [ ] Test 6 passes (crash recovery)
- [ ] Test 7 passes (bulk operations)
- [ ] Test 8 passes (metadata)
- [ ] Test 9 passes (transactions)
- [ ] DevTools shows all 6 stores
- [ ] Stats update correctly
- [ ] Event log shows SUCCESS messages
- [ ] Manual crash test works
- [ ] Performance is acceptable

---

## 📝 Next Steps

After all tests pass:

1. **Review** the test results and performance
2. **Integrate** using [`INTEGRATION_GUIDE.md`](./INTEGRATION_GUIDE.md)
3. **Test** in your actual dashboard
4. **Monitor** using monitor.html
5. **Deploy** to production

---

## 🆘 Getting Help

If tests fail:

1. **Check console** for errors
2. **Inspect IndexedDB** in DevTools
3. **Review** event log in test page
4. **Run** individual tests to isolate issue
5. **Export diagnostics:**
   ```javascript
   const diag = await QuickStorage.diagnostics();
   console.log(JSON.stringify(diag, null, 2));
   ```

---

**Happy Testing! 🧪**
